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

  // 320×180 논리 해상도를 1920×1080 캔버스에 6배로 표시
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

  const ballColors = [
    { base: "#ff638c", dark: "#b83261", light: "#ffb2c4" },
    { base: "#ffc84d", dark: "#c27b27", light: "#fff0a8" },
    { base: "#59e5d1", dark: "#238e93", light: "#b3fff0" },
    { base: "#a48aff", dark: "#6353bd", light: "#ded1ff" }
  ];

  const ballSprite = [
    "...DDDDD...",
    "..DBBBBBB..",
    ".DBBLLBBBBD",
    "DBBLLLBBBBD",
    "DBBLLBBBBBD",
    "DBBBBBBBSSD",
    "DBBBBBBSSSD",
    ".DBBBBSSSD.",
    "..DSSSSSD..",
    "...DDDDD..."
  ];

  const playerSprite = [
    "...C...",
    "..CCC..",
    ".CCWCC.",
    "CCWWWCC",
    ".CCWCC.",
    "..CCC..",
    "...C..."
  ];

  ctx.imageSmoothingEnabled = false;
  setLogicalCanvasTransform();

  function setLogicalCanvasTransform() {
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function getWave() {
    return Math.floor(elapsed / WAVE_LENGTH) + 1;
  }

  function updateHud() {
    const wave = getWave();
    highestWave = Math.max(highestWave, wave);
    waveLabel.textContent = wave >= 5
      ? `WAVE ${wave} · 저격수 출현`
      : `WAVE ${wave} · 기본`;
    timeLabel.textContent = `생존 ${elapsed.toFixed(1)}초`;
  }

  function resetGame() {
    player = { x: WIDTH / 2, y: HEIGHT / 2, speed: 86 };
    balls = [];
    elapsed = 0;
    spawnTimer = 0;
    spawnCount = 0;
    highestWave = 1;
    updateHud();
  }

  function startGame() {
    cancelAnimationFrame(animationId);
    resetGame();
    state = "playing";
    overlay.hidden = true;
    hud.hidden = false;
    lastFrameTime = performance.now();
    animationId = requestAnimationFrame(gameLoop);
  }

  function endGame() {
    state = "over";
    hud.hidden = true;
    title.textContent = "게임 종료";
    description.innerHTML =
      `생존 시간 <strong>${elapsed.toFixed(1)}초</strong><br>` +
      `도달한 웨이브: <strong>${highestWave}</strong>`;
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
      const x = (i * 73 + 19) % WIDTH;
      const y = (i * 47 + 11) % HEIGHT;
      ctx.fillStyle = i % 3 === 0 ? "#514a88" : "#29294b";
      ctx.fillRect(x, y, 1, 1);
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
      ctx.fillRect(
        Math.round(ball.x - ball.vx * 0.07 - 2),
        Math.round(ball.y - ball.vy * 0.07 - 2),
        5,
        5
      );
    }

    const palette = ball.type === "sniper"
      ? {
          D: "#a72d54",
          B: ball.phase === "dash" ? "#ff375f" : "#ff596d",
          L: "#ffd0a8",
          S: "#621f4b"
        }
      : {
          D: ball.color.dark,
          B: ball.color.base,
          L: ball.color.light,
          S: "#572c59"
        };

    drawSprite(ballSprite, ball.x, ball.y, palette);
  }

  function drawGame() {
    drawBackground();
    for (const ball of balls) drawBall(ball);
    if (player) {
      drawSprite(playerSprite, player.x, player.y, { C: "#665cff", W: "#a9fff1" });
    }
  }

  function spawnBall() {
    const side = Math.floor(Math.random() * 4);
    let x;
    let y;

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
      x, y,
      vx: aimX * speed,
      vy: aimY * speed,
      speed,
      age: 0,
      type: isSniper ? "sniper" : "normal",
      phase: isSniper ? "windup" : "normal",
      phaseTime: 0,
      aimX,
      aimY,
      dashRange: 0,
      dashTravelled: 0,
      remove: false,
      color: ballColors[Math.floor(Math.random() * ballColors.length)]
    });
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

        // 웨이브 5부터 웨이브마다 돌진 사거리 증가. 돌진 속도는 고정.
        const wave = getWave();
        ball.dashRange = Math.hypot(WIDTH, HEIGHT) * (0.38 + (wave - 5) * 0.16);
        const dashSpeed = 230;
        ball.vx = ball.aimX * dashSpeed;
        ball.vy = ball.aimY * dashSpeed;
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

    let moveX = 0;
    let moveY = 0;
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

    // 기본 공 생성 빈도는 웨이브 4 이후 고정
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

    balls = balls.filter(ball =>
      !ball.remove &&
      ball.x > -24 && ball.x < WIDTH + 24 &&
      ball.y > -24 && ball.y < HEIGHT + 24
    );

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

    if (["w", "a", "s", "d", " ", "enter"].includes(key)) {
      event.preventDefault();
    }

    if (["w", "a", "s", "d"].includes(key)) keys.add(key);
    if ((key === "enter" || key === " ") && state !== "playing") startGame();
  });

  window.addEventListener("keyup", event => keys.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());

  // 게임 조작용 마우스 이벤트는 등록하지 않습니다.
  drawTitleScreen();
})();
