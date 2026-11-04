(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const hud = document.getElementById("hud");
  const title = document.getElementById("title");
  const description = document.getElementById("description");
  const promptLabel = document.querySelector(".prompt-label");
  const waveLabel = document.getElementById("wave-label");
  const timeLabel = document.getElementById("time-label");
  const soundLabel = document.getElementById("sound-label");

  const WIDTH = 320;
  const HEIGHT = 180;
  const SCALE = 6;
  const WAVE_LENGTH = 12;
  const keys = new Set();
  let state = "title";
  let player = null;
  let balls = [];
  let elapsed = 0;
  let spawnTimer = 0;
  let spawnCount = 0;
  let lastFrameTime = 0;
  let animationId = 0;
  let highestWave = 1;
  let previousWave = 1;

  // 사운드는 Web Audio로 실시간 생성하며 외부 음원 파일이 필요 없습니다.
  let audioContext = null;
  let masterGain = null;
  let soundEnabled = true;
  let audioReady = false;

  const ballColors = [
    { base: "#ff638c", dark: "#b83261", light: "#ffb2c4" },
    { base: "#ffc84d", dark: "#c27b27", light: "#fff0a8" },
    { base: "#59e5d1", dark: "#238e93", light: "#b3fff0" },
    { base: "#a48aff", dark: "#6353bd", light: "#ded1ff" }
  ];
  const ballSprite = [
    "...DDDDD...", "..DBBBBBB..", ".DBBLLBBBBD", "DBBLLLBBBBD",
    "DBBLLBBBBBD", "DBBBBBBBSSD", "DBBBBBBSSSD", ".DBBBBSSSD.",
    "..DSSSSSD..", "...DDDDD..."
  ];
  const playerSprite = [
    "...C...", "..CCC..", ".CCWCC.", "CCWWWCC", ".CCWCC.", "..CCC..", "...C..."
  ];

  ctx.imageSmoothingEnabled = false;
  setLogicalCanvasTransform();
  updateSoundLabel();

  function setLogicalCanvasTransform() {
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function getWave() { return Math.floor(elapsed / WAVE_LENGTH) + 1; }

  function initAudio() {
    if (audioContext) {
      if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    masterGain.gain.value = soundEnabled ? 0.28 : 0;
    masterGain.connect(audioContext.destination);
    audioReady = true;
  }

  function updateSoundLabel() {
    if (soundLabel) soundLabel.textContent = soundEnabled ? "사운드 ON · M 키로 끄기" : "사운드 OFF · M 키로 켜기";
  }

  function setSoundEnabled(enabled) {
    soundEnabled = enabled;
    if (audioContext && masterGain) {
      const now = audioContext.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setTargetAtTime(enabled ? 0.28 : 0, now, 0.025);
    }
    updateSoundLabel();
    if (enabled) playTone(660, 0.09, "sine", 0.12);
  }

  function playTone(frequency, duration = 0.12, waveform = "sine", volume = 0.5, endFrequency = null) {
    if (!soundEnabled || !audioContext || !masterGain) return;
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(Math.max(1, frequency), now);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    gain.gain.setValueAtTime(Math.max(0.0001, volume), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.015);
  }

  function playStartSound() {
    playTone(440, 0.12, "square", 0.18);
    window.setTimeout(() => playTone(660, 0.16, "square", 0.14), 95);
  }

  function playWaveSound(wave) {
    const base = 520 + Math.min(wave, 12) * 22;
    playTone(base, 0.13, "triangle", 0.24);
    window.setTimeout(() => playTone(base * 1.25, 0.18, "triangle", 0.2), 110);
  }

  function playSniperWarning() {
    playTone(760, 0.09, "square", 0.16, 430);
  }

  function playDashSound() {
    playTone(250, 0.24, "sawtooth", 0.2, 95);
  }

  function playHitSound() {
    playTone(180, 0.42, "sawtooth", 0.32, 42);
    window.setTimeout(() => playTone(95, 0.3, "square", 0.16, 45), 70);
  }

  function updateHud() {
    const wave = getWave();
    highestWave = Math.max(highestWave, wave);
    waveLabel.textContent = wave >= 5 ? `WAVE ${wave} · 저격수 출현` : `WAVE ${wave} · 기본`;
    timeLabel.textContent = `생존 ${elapsed.toFixed(1)}초`;
    updateSoundLabel();
  }

  function resetGame() {
    player = { x: WIDTH / 2, y: HEIGHT / 2, speed: 86 };
    balls = [];
    elapsed = spawnTimer = spawnCount = 0;
    highestWave = previousWave = 1;
    updateHud();
  }

  function startGame() {
    initAudio();
    cancelAnimationFrame(animationId);
    resetGame();
    state = "playing";
    overlay.hidden = true;
    hud.hidden = false;
    lastFrameTime = performance.now();
    playStartSound();
    animationId = requestAnimationFrame(gameLoop);
  }

  function endGame() {
    state = "over";
    hud.hidden = true;
    playHitSound();
    title.textContent = "게임 종료";
    description.innerHTML = `생존 시간 <strong>${elapsed.toFixed(1)}초</strong><br>도달한 웨이브: <strong>${highestWave}</strong>`;
    promptLabel.textContent = "다시 하려면 Enter 또는 Space";
    overlay.hidden = false;
  }

  function drawBackground() {
    ctx.fillStyle = "#101027";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#191832";
    for (let x = 8; x < WIDTH; x += 16) ctx.fillRect(x, 0, 1, HEIGHT);
    for (let y = 8; y < HEIGHT; y += 16) ctx.fillRect(0, y, WIDTH, 1);
    for (let i = 0; i < 28; i++) {
      ctx.fillStyle = i % 3 === 0 ? "#514a88" : "#29294b";
      ctx.fillRect((i * 73 + 19) % WIDTH, (i * 47 + 11) % HEIGHT, 1, 1);
    }
  }

  function drawSprite(sprite, x, y, palette) {
    const left = Math.round(x - sprite[0].length / 2);
    const top = Math.round(y - sprite.length / 2);
    for (let row = 0; row < sprite.length; row++) {
      for (let col = 0; col < sprite[row].length; col++) {
        const pixel = sprite[row][col];
        if (pixel !== "." && palette[pixel]) {
          ctx.fillStyle = palette[pixel];
          ctx.fillRect(left + col, top + row, 1, 1);
        }
      }
    }
  }

  function drawBall(ball) {
    if (ball.type === "sniper" && ball.phase === "windup") {
      ctx.strokeStyle = Math.floor(ball.age * 14) % 2 === 0 ? "#ff456b" : "#ff9b72";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(ball.x + ball.aimX * 400, ball.y + ball.aimY * 400);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (ball.type === "sniper" && ball.phase === "dash") {
      ctx.fillStyle = "#ff456b99";
      ctx.fillRect(Math.round(ball.x - ball.vx * 0.07 - 2), Math.round(ball.y - ball.vy * 0.07 - 2), 5, 5);
    }
    const palette = ball.type === "sniper"
      ? { D: "#a72d54", B: ball.phase === "dash" ? "#ff375f" : "#ff596d", L: "#ffd0a8", S: "#621f4b" }
      : { D: ball.color.dark, B: ball.color.base, L: ball.color.light, S: "#572c59" };
    drawSprite(ballSprite, ball.x, ball.y, palette);
  }

  function drawGame() {
    drawBackground();
    for (const ball of balls) drawBall(ball);
    if (player) drawSprite(playerSprite, player.x, player.y, { C: "#665cff", W: "#a9fff1" });
  }

  function spawnBall() {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = Math.random() * WIDTH; y = -8; }
    else if (side === 1) { x = WIDTH + 8; y = Math.random() * HEIGHT; }
    else if (side === 2) { x = Math.random() * WIDTH; y = HEIGHT + 8; }
    else { x = -8; y = Math.random() * HEIGHT; }

    const dx = player.x - x;
    const dy = player.y - y;
    const distance = Math.hypot(dx, dy) || 1;
    const wave = getWave();
    const speed = 38 + Math.min(wave - 1, 3) * 11 + Math.random() * 10;
    spawnCount++;
    const isSniper = wave >= 5 && spawnCount % 3 === 0;
    const aimX = dx / distance;
    const aimY = dy / distance;
    balls.push({
      x, y, vx: aimX * speed, vy: aimY * speed, speed, age: 0,
      type: isSniper ? "sniper" : "normal",
      phase: isSniper ? "windup" : "normal", phaseTime: 0,
      aimX, aimY, dashRange: 0, dashTravelled: 0, remove: false,
      color: ballColors[Math.floor(Math.random() * ballColors.length)]
    });
    if (isSniper) playSniperWarning();
  }

  function updateBall(ball, deltaTime) {
    if (ball.type !== "sniper") {
      ball.x += ball.vx * deltaTime;
      ball.y += ball.vy * deltaTime;
      return;
    }
    ball.age += deltaTime;
    ball.phaseTime += deltaTime;
    if (ball.phase === "windup") {
      const dx = player.x - ball.x;
      const dy = player.y - ball.y;
      const distance = Math.hypot(dx, dy) || 1;
      ball.aimX = dx / distance;
      ball.aimY = dy / distance;
      if (ball.phaseTime >= 0.85) {
        ball.phase = "dash";
        ball.phaseTime = 0;
        ball.dashTravelled = 0;
        const wave = getWave();
        ball.dashRange = Math.hypot(WIDTH, HEIGHT) * (0.38 + (wave - 5) * 0.16);
        const dashSpeed = 230;
        ball.vx = ball.aimX * dashSpeed;
        ball.vy = ball.aimY * dashSpeed;
        playDashSound();
      }
      return;
    }
    if (ball.phase === "dash") {
      const moveX = ball.vx * deltaTime;
      const moveY = ball.vy * deltaTime;
      ball.x += moveX;
      ball.y += moveY;
      ball.dashTravelled += Math.hypot(moveX, moveY);
      if (ball.dashTravelled >= ball.dashRange) ball.remove = true;
      return;
    }
    ball.x += ball.vx * deltaTime;
    ball.y += ball.vy * deltaTime;
  }

  function gameLoop(now) {
    if (state !== "playing") return;
    const deltaTime = Math.min((now - lastFrameTime) / 1000, 0.04);
    lastFrameTime = now;
    elapsed += deltaTime;

    const wave = getWave();
    if (wave > previousWave) {
      previousWave = wave;
      playWaveSound(wave);
    }

    let moveX = 0, moveY = 0;
    if (keys.has("a")) moveX--;
    if (keys.has("d")) moveX++;
    if (keys.has("w")) moveY--;
    if (keys.has("s")) moveY++;
    if (moveX !== 0 || moveY !== 0) {
      const length = Math.hypot(moveX, moveY);
      player.x += moveX / length * player.speed * deltaTime;
      player.y += moveY / length * player.speed * deltaTime;
    }
    player.x = Math.max(5, Math.min(WIDTH - 5, player.x));
    player.y = Math.max(5, Math.min(HEIGHT - 5, player.y));

    const difficultyWave = Math.min(getWave(), 4);
    const spawnInterval = Math.max(0.23, 0.82 - (difficultyWave - 1) * 0.08);
    spawnTimer += deltaTime;
    while (spawnTimer >= spawnInterval) {
      spawnTimer -= spawnInterval;
      spawnBall();
    }

    for (const ball of balls) {
      updateBall(ball, deltaTime);
      if (Math.hypot(ball.x - player.x, ball.y - player.y) < 8) {
        updateHud();
        drawGame();
        endGame();
        return;
      }
    }
    balls = balls.filter(ball => !ball.remove && ball.x > -24 && ball.x < WIDTH + 24 && ball.y > -24 && ball.y < HEIGHT + 24);
    updateHud();
    drawGame();
    animationId = requestAnimationFrame(gameLoop);
  }

  function drawTitleScreen() {
    if (state !== "title") return;
    drawBackground();
    const time = performance.now() / 1000;
    const centerX = WIDTH / 2;
    const centerY = HEIGHT / 2;
    ctx.strokeStyle = "#332e63";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, 42, 24, 0, 0, Math.PI * 2);
    ctx.stroke();
    const angle = time * 1.4;
    ctx.fillStyle = "#ff638c";
    ctx.fillRect(Math.round(centerX + Math.cos(angle) * 42) - 2, Math.round(centerY + Math.sin(angle) * 24) - 2, 5, 5);
    ctx.fillStyle = "#59e5d1";
    ctx.fillRect(Math.round(centerX + Math.cos(angle + Math.PI) * 42) - 2, Math.round(centerY + Math.sin(angle + Math.PI) * 24) - 2, 5, 5);
    animationId = requestAnimationFrame(drawTitleScreen);
  }

  window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", " ", "enter", "m"].includes(key)) event.preventDefault();
    if (["w", "a", "s", "d"].includes(key)) keys.add(key);
    if (key === "m" && !event.repeat) {
      initAudio();
      setSoundEnabled(!soundEnabled);
    }
    if ((key === "enter" || key === " ") && state !== "playing") startGame();
  });

  window.addEventListener("keyup", event => keys.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());

  drawTitleScreen();
})();
