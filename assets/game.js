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
  const adminPanel = document.getElementById("admin-panel");
  const speedSlider = document.getElementById("speed-slider");
  const speedValue = document.getElementById("speed-value");
  const invincibleToggle = document.getElementById("invincible-toggle");

  const WIDTH = 320, HEIGHT = 180, SCALE = 6, WAVE_LENGTH = 12;
  const DEFAULT_SPEED = 150;
  const keys = new Set();
  // XOR obfuscation only: client-side credentials can always be recovered from downloaded code.
  const encodedCredential = [57, 50, 53, 51, 109, 104, 104, 96, 59, 62, 55, 51, 52];
  const credentialParts = String.fromCharCode(...encodedCredential.map(byte => byte ^ 90)).split(":");

  let state = "title", player = null, balls = [];
  let elapsed = 0, spawnTimer = 0, spawnCount = 0, lastFrameTime = 0;
  let animationId = 0, highestWave = 1, previousWave = 1;
  let playerSpeed = DEFAULT_SPEED, invincible = false, adminAuthenticated = false;
  let audioContext = null, masterGain = null, soundEnabled = true;

  const ballColors = [
    { base: "#ff638c", dark: "#b83261", light: "#ffb2c4" },
    { base: "#ffc84d", dark: "#c27b27", light: "#fff0a8" },
    { base: "#59e5d1", dark: "#238e93", light: "#b3fff0" },
    { base: "#a48aff", dark: "#6353bd", light: "#ded1ff" }
  ];
  const ballSprite = ["...DDDDD...", "..DBBBBBB..", ".DBBLLBBBBD", "DBBLLLBBBBD", "DBBLLBBBBBD", "DBBBBBBBSSD", "DBBBBBBSSSD", ".DBBBBSSSD.", "..DSSSSSD..", "...DDDDD..."];
  const playerSprite = ["...C...", "..CCC..", ".CCWCC.", "CCWWWCC", ".CCWCC.", "..CCC..", "...C..."];

  ctx.imageSmoothingEnabled = false;
  setLogicalCanvasTransform();
  speedSlider.value = String(DEFAULT_SPEED);
  speedValue.value = speedValue.textContent = String(DEFAULT_SPEED);
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
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audioContext = new Audio();
    masterGain = audioContext.createGain();
    masterGain.gain.value = soundEnabled ? 0.24 : 0;
    masterGain.connect(audioContext.destination);
  }
  function playTone(frequency, duration = 0.1, waveform = "square", volume = 0.2, endFrequency = null, delay = 0) {
    if (!soundEnabled || !audioContext || !masterGain) return;
    const start = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.setValueAtTime(volume, start + duration * 0.55);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain); gain.connect(masterGain);
    oscillator.start(start); oscillator.stop(start + duration + 0.02);
  }
  function updateSoundLabel() {
    if (soundLabel) soundLabel.textContent = soundEnabled ? "사운드 ON · M 키로 끄기" : "사운드 OFF · M 키로 켜기";
  }
  function setSoundEnabled(enabled) {
    soundEnabled = enabled;
    if (audioContext && masterGain) {
      const now = audioContext.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setTargetAtTime(enabled ? 0.24 : 0, now, 0.025);
    }
    updateSoundLabel();
    if (enabled) playTone(660, 0.07, "square", 0.08);
  }
  function playStartSound() {
    playTone(440, 0.09, "square", 0.11);
    playTone(660, 0.13, "square", 0.11, null, 0.1);
  }
  function playWaveSound(wave) {
    const note = 500 + Math.min(wave, 10) * 24;
    playTone(note, 0.09, "square", 0.1);
    playTone(note * 1.25, 0.13, "square", 0.1, null, 0.12);
  }
  function playSniperWarning() {
    playTone(587.33, 0.075, "square", 0.12);
    playTone(698.46, 0.075, "square", 0.13, null, 0.12);
    playTone(440, 0.2, "square", 0.16, 330, 0.27);
  }
  function playDashSound() {
    playTone(880, 0.055, "square", 0.09, 660);
    playTone(520, 0.11, "triangle", 0.1, 260, 0.045);
  }
  function playHitSound() {
    playTone(220, 0.23, "square", 0.18, 75);
    playTone(110, 0.18, "triangle", 0.11, 55, 0.08);
  }

  function updateHud() {
    const wave = getWave();
    highestWave = Math.max(highestWave, wave);
    waveLabel.textContent = wave >= 5 ? `WAVE ${wave} · 저격수 출현` : `WAVE ${wave} · 기본`;
    timeLabel.textContent = `생존 ${elapsed.toFixed(1)}초`;
    updateSoundLabel();
  }
  function resetGame() {
    player = { x: WIDTH / 2, y: HEIGHT / 2, speed: playerSpeed };
    balls = []; elapsed = 0; spawnTimer = 0; spawnCount = 0; highestWave = 1; previousWave = 1;
    updateHud();
  }
  function startGame() {
    initAudio(); cancelAnimationFrame(animationId); resetGame();
    state = "playing"; overlay.hidden = true; hud.hidden = false;
    lastFrameTime = performance.now(); playStartSound();
    animationId = requestAnimationFrame(gameLoop);
  }
  function endGame() {
    state = "over"; hud.hidden = true;
    if (!invincible) playHitSound();
    title.textContent = "게임 종료";
    description.innerHTML = `생존 시간 <strong>${elapsed.toFixed(1)}초</strong><br>도달한 웨이브: <strong>${highestWave}</strong>`;
    promptLabel.textContent = "다시 하려면 Enter 또는 Space";
    overlay.hidden = false;
  }
  function drawBackground() {
    ctx.fillStyle = "#101027"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#191832";
    for (let x = 8; x < WIDTH; x += 16) ctx.fillRect(x, 0, 1, HEIGHT);
    for (let y = 8; y < HEIGHT; y += 16) ctx.fillRect(0, y, WIDTH, 1);
    for (let i = 0; i < 28; i++) {
      ctx.fillStyle = i % 3 === 0 ? "#514a88" : "#29294b";
      ctx.fillRect((i * 73 + 19) % WIDTH, (i * 47 + 11) % HEIGHT, 1, 1);
    }
  }
  function drawSprite(sprite, x, y, palette) {
    const left = Math.round(x - sprite[0].length / 2), top = Math.round(y - sprite.length / 2);
    for (let row = 0; row < sprite.length; row++) for (let col = 0; col < sprite[row].length; col++) {
      const pixel = sprite[row][col];
      if (pixel !== "." && palette[pixel]) { ctx.fillStyle = palette[pixel]; ctx.fillRect(left + col, top + row, 1, 1); }
    }
  }
  function drawBall(ball) {
    if (ball.type === "sniper" && ball.phase === "windup") {
      ctx.strokeStyle = Math.floor(ball.age * 14) % 2 === 0 ? "#ff456b" : "#ff9b72";
      ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(ball.x + ball.aimX * 400, ball.y + ball.aimY * 400); ctx.stroke(); ctx.setLineDash([]);
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
    drawBackground(); for (const ball of balls) drawBall(ball);
    if (player) drawSprite(playerSprite, player.x, player.y, {
      C: invincible ? "#ffca55" : "#665cff", W: invincible ? "#fff2a8" : "#a9fff1"
    });
  }
  function spawnBall() {
    const side = Math.floor(Math.random() * 4); let x, y;
    if (side === 0) { x = Math.random() * WIDTH; y = -8; }
    else if (side === 1) { x = WIDTH + 8; y = Math.random() * HEIGHT; }
    else if (side === 2) { x = Math.random() * WIDTH; y = HEIGHT + 8; }
    else { x = -8; y = Math.random() * HEIGHT; }
    const dx = player.x - x, dy = player.y - y, distance = Math.hypot(dx, dy) || 1;
    const wave = getWave(), speed = 38 + Math.min(wave - 1, 3) * 11 + Math.random() * 10;
    spawnCount++;
    const isSniper = wave >= 5 && spawnCount % 3 === 0;
    const aimX = dx / distance, aimY = dy / distance;
    balls.push({ x, y, vx: aimX * speed, vy: aimY * speed, speed, age: 0,
      type: isSniper ? "sniper" : "normal", phase: isSniper ? "windup" : "normal", phaseTime: 0,
      aimX, aimY, dashRange: 0, dashTravelled: 0, remove: false,
      color: ballColors[Math.floor(Math.random() * ballColors.length)] });
    if (isSniper) playSniperWarning();
  }
  function updateBall(ball, dt) {
    if (ball.type !== "sniper") { ball.x += ball.vx * dt; ball.y += ball.vy * dt; return; }
    ball.age += dt; ball.phaseTime += dt;
    if (ball.phase === "windup") {
      const dx = player.x - ball.x, dy = player.y - ball.y, distance = Math.hypot(dx, dy) || 1;
      ball.aimX = dx / distance; ball.aimY = dy / distance;
      if (ball.phaseTime >= 0.85) {
        ball.phase = "dash"; ball.phaseTime = 0; ball.dashTravelled = 0;
        ball.dashRange = Math.hypot(WIDTH, HEIGHT) * (0.38 + (getWave() - 5) * 0.16);
        ball.vx = ball.aimX * 230; ball.vy = ball.aimY * 230; playDashSound();
      }
      return;
    }
    if (ball.phase === "dash") {
      const mx = ball.vx * dt, my = ball.vy * dt;
      ball.x += mx; ball.y += my; ball.dashTravelled += Math.hypot(mx, my);
      if (ball.dashTravelled >= ball.dashRange) ball.remove = true;
      return;
    }
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
  }
  function gameLoop(now) {
    if (state !== "playing") return;
    const dt = Math.min((now - lastFrameTime) / 1000, 0.04); lastFrameTime = now; elapsed += dt;
    const wave = getWave();
    if (wave > previousWave) { previousWave = wave; playWaveSound(wave); }
    let mx = 0, my = 0;
    if (keys.has("a")) mx--; if (keys.has("d")) mx++; if (keys.has("w")) my--; if (keys.has("s")) my++;
    if (mx || my) { const len = Math.hypot(mx, my); player.x += mx / len * player.speed * dt; player.y += my / len * player.speed * dt; }
    player.x = Math.max(5, Math.min(WIDTH - 5, player.x)); player.y = Math.max(5, Math.min(HEIGHT - 5, player.y));
    const spawnInterval = Math.max(0.23, 0.82 - (Math.min(getWave(), 4) - 1) * 0.08);
    spawnTimer += dt;
    while (spawnTimer >= spawnInterval) { spawnTimer -= spawnInterval; spawnBall(); }
    for (const ball of balls) {
      updateBall(ball, dt);
      if (!invincible && Math.hypot(ball.x - player.x, ball.y - player.y) < 8) { updateHud(); drawGame(); endGame(); return; }
    }
    balls = balls.filter(ball => !ball.remove && ball.x > -24 && ball.x < WIDTH + 24 && ball.y > -24 && ball.y < HEIGHT + 24);
    updateHud(); drawGame(); animationId = requestAnimationFrame(gameLoop);
  }
  function drawTitleScreen() {
    if (state !== "title") return;
    drawBackground(); const t = performance.now() / 1000, cx = WIDTH / 2, cy = HEIGHT / 2;
    ctx.strokeStyle = "#332e63"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy, 42, 24, 0, 0, Math.PI * 2); ctx.stroke();
    const angle = t * 1.4;
    ctx.fillStyle = "#ff638c"; ctx.fillRect(Math.round(cx + Math.cos(angle) * 42) - 2, Math.round(cy + Math.sin(angle) * 24) - 2, 5, 5);
    ctx.fillStyle = "#59e5d1"; ctx.fillRect(Math.round(cx + Math.cos(angle + Math.PI) * 42) - 2, Math.round(cy + Math.sin(angle + Math.PI) * 24) - 2, 5, 5);
    animationId = requestAnimationFrame(drawTitleScreen);
  }

  function authenticateAdmin(nickname, password) {
    if (nickname !== credentialParts[0] || password !== credentialParts[1]) { console.warn("관리자 인증 실패."); return false; }
    adminAuthenticated = true; adminPanel.hidden = false;
    console.info("관리자 인증 완료. 명령: speed(값), god(true/false), adminLogout()");
    return true;
  }
  function requireAdmin() {
    if (adminAuthenticated) return true;
    console.warn('먼저 acess("닉네임", "비밀번호")로 인증하세요.'); return false;
  }
  function setPlayerSpeed(value) {
    if (!requireAdmin()) return false;
    const next = Number(value);
    if (!Number.isFinite(next) || next < 40 || next > 600) { console.warn("속도는 40~600 사이 숫자로 입력하세요."); return false; }
    playerSpeed = next; speedSlider.value = String(Math.max(80, Math.min(360, next)));
    speedValue.value = speedValue.textContent = String(next);
    if (player) player.speed = next;
    console.info(`플레이어 속도: ${next}`); return next;
  }
  function setGodMode(enabled = !invincible) {
    if (!requireAdmin()) return false;
    invincible = Boolean(enabled); invincibleToggle.checked = invincible;
    console.info(`무적 모드 ${invincible ? "ON" : "OFF"}`); return invincible;
  }
  function logoutAdmin() { adminAuthenticated = false; adminPanel.hidden = true; console.info("관리자 로그아웃 완료."); }

  // DevTools Console: acess("choi722", "admin"), speed(240), god(true), god(false), adminLogout()
  // This is obfuscation for a local game cheat, not secure authentication.
  window.acess = authenticateAdmin;
  window.access = authenticateAdmin;
  window.speed = setPlayerSpeed;
  window.god = setGodMode;
  window.adminLogout = logoutAdmin;
  window.adminStatus = () => ({ authenticated: adminAuthenticated, speed: playerSpeed, invincible });

  speedSlider.addEventListener("input", () => { if (adminAuthenticated) setPlayerSpeed(Number(speedSlider.value)); });
  invincibleToggle.addEventListener("change", () => {
    if (!adminAuthenticated) { invincibleToggle.checked = false; return; }
    invincible = invincibleToggle.checked;
  });
  window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", " ", "enter", "m"].includes(key)) event.preventDefault();
    if (["w", "a", "s", "d"].includes(key)) keys.add(key);
    if (key === "m" && !event.repeat) { initAudio(); setSoundEnabled(!soundEnabled); }
    if (key === "escape" && !adminPanel.hidden) adminPanel.hidden = true;
    if ((key === "enter" || key === " ") && state !== "playing") startGame();
  });
  window.addEventListener("keyup", event => keys.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());
  drawTitleScreen();
})();
