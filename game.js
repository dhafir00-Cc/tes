const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const levelEl = document.querySelector("#level");
const livesEl = document.querySelector("#lives");
const bestEl = document.querySelector("#best");
const overlay = document.querySelector("#overlay");
const messageEl = document.querySelector("#message");
const startBtn = document.querySelector("#startBtn");
const pauseBtn = document.querySelector("#pauseBtn");
const restartBtn = document.querySelector("#restartBtn");

const storageKey = "meteor-mini-best";
const keys = new Set();
const pointer = { active: false, x: 0 };

let width = 0;
let height = 0;
let dpr = 1;
let lastTime = 0;
let spawnTimer = 0;
let shake = 0;
let best = Number(localStorage.getItem(storageKey) || 0);

const state = {
  running: false,
  paused: false,
  over: false,
  score: 0,
  level: 1,
  lives: 3,
  shield: 0,
  time: 0,
};

const player = {
  x: 0,
  y: 0,
  w: 54,
  h: 26,
  speed: 520,
  targetX: 0,
};

const items = [];
const particles = [];
const stars = [];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(320, rect.width);
  height = Math.max(320, rect.height);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  player.y = height - 78;
  player.x = clamp(player.x || width / 2, player.w, width - player.w);
  player.targetX = player.x;

  buildStars();
}

function buildStars() {
  stars.length = 0;
  const count = Math.round((width * height) / 15000);
  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: rand(0.7, 2.1),
      drift: rand(8, 34),
      alpha: rand(0.22, 0.82),
    });
  }
}

function resetGame() {
  state.running = true;
  state.paused = false;
  state.over = false;
  state.score = 0;
  state.level = 1;
  state.lives = 3;
  state.shield = 0;
  state.time = 0;
  spawnTimer = 0.2;
  shake = 0;
  items.length = 0;
  particles.length = 0;
  player.x = width / 2;
  player.targetX = player.x;
  overlay.hidden = true;
  pauseBtn.setAttribute("aria-label", "Jeda");
  pauseBtn.title = "Jeda";
  pauseBtn.querySelector("span").textContent = "II";
  updateHud();
}

function endGame() {
  state.running = false;
  state.paused = false;
  state.over = true;
  best = Math.max(best, state.score);
  localStorage.setItem(storageKey, String(best));
  messageEl.textContent = `Skor ${state.score}. Rekor ${best}.`;
  startBtn.textContent = "Main Lagi";
  overlay.hidden = false;
  updateHud();
}

function togglePause() {
  if (!state.running || state.over) return;
  state.paused = !state.paused;
  pauseBtn.setAttribute("aria-label", state.paused ? "Lanjut" : "Jeda");
  pauseBtn.title = state.paused ? "Lanjut" : "Jeda";
  pauseBtn.querySelector("span").textContent = state.paused ? ">" : "II";
  messageEl.textContent = "Permainan dijeda.";
  startBtn.textContent = "Lanjut";
  overlay.hidden = !state.paused;
}

function updateHud() {
  scoreEl.textContent = state.score;
  levelEl.textContent = state.level;
  livesEl.textContent = state.lives;
  bestEl.textContent = best;
}

function spawnItem() {
  const roll = Math.random();
  let type = "star";
  if (roll > 0.76) type = "meteor";
  if (roll > 0.94) type = "heart";
  if (roll > 0.975) type = "shield";

  const baseSpeed = 120 + state.level * 24;
  const radius = type === "meteor" ? rand(17, 26) : rand(12, 18);
  items.push({
    type,
    x: rand(radius + 16, width - radius - 16),
    y: -radius - 20,
    r: radius,
    speed: baseSpeed + rand(0, 115),
    spin: rand(-4, 4),
    angle: rand(0, Math.PI * 2),
  });
}

function addBurst(x, y, color, count = 12) {
  for (let i = 0; i < count; i += 1) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(45, 210);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: rand(0.34, 0.72),
      age: 0,
      size: rand(2, 5),
      color,
    });
  }
}

function collidesWithPlayer(item) {
  const left = player.x - player.w / 2;
  const right = player.x + player.w / 2;
  const top = player.y - player.h / 2;
  const bottom = player.y + player.h / 2;
  const nearestX = clamp(item.x, left, right);
  const nearestY = clamp(item.y, top, bottom);
  const dx = item.x - nearestX;
  const dy = item.y - nearestY;
  return dx * dx + dy * dy <= item.r * item.r;
}

function collect(item) {
  if (item.type === "star") {
    state.score += 10 + state.level * 2;
    addBurst(item.x, item.y, "#ffd166", 10);
  }

  if (item.type === "heart") {
    state.lives = clamp(state.lives + 1, 1, 5);
    state.score += 18;
    addBurst(item.x, item.y, "#7bd88f", 14);
  }

  if (item.type === "shield") {
    state.shield = 6.5;
    state.score += 16;
    addBurst(item.x, item.y, "#42d9c8", 16);
  }

  if (item.type === "meteor") {
    if (state.shield > 0) {
      state.shield = 0;
      state.score += 8;
      addBurst(item.x, item.y, "#42d9c8", 18);
    } else {
      state.lives -= 1;
      shake = 0.32;
      addBurst(item.x, item.y, "#ff6b6b", 18);
      if (state.lives <= 0) {
        endGame();
      }
    }
  }

  state.level = 1 + Math.floor(state.score / 160);
  updateHud();
}

function update(dt) {
  if (!state.running || state.paused) return;

  state.time += dt;
  state.shield = Math.max(0, state.shield - dt);
  shake = Math.max(0, shake - dt);

  const movingLeft = keys.has("ArrowLeft") || keys.has("a") || keys.has("A");
  const movingRight = keys.has("ArrowRight") || keys.has("d") || keys.has("D");

  if (pointer.active) {
    player.targetX = pointer.x;
  } else if (movingLeft || movingRight) {
    const direction = (movingRight ? 1 : 0) - (movingLeft ? 1 : 0);
    player.targetX += direction * player.speed * dt;
  }

  player.targetX = clamp(player.targetX, player.w / 2 + 8, width - player.w / 2 - 8);
  player.x += (player.targetX - player.x) * Math.min(1, dt * 12);

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnItem();
    const cadence = Math.max(0.22, 0.78 - state.level * 0.045);
    spawnTimer = cadence * rand(0.62, 1.18);
  }

  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    item.y += item.speed * dt;
    item.angle += item.spin * dt;

    if (collidesWithPlayer(item)) {
      items.splice(i, 1);
      collect(item);
      continue;
    }

    if (item.y > height + item.r + 40) {
      items.splice(i, 1);
    }
  }

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 90 * dt;
    if (p.age >= p.life) particles.splice(i, 1);
  }
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#111817");
  sky.addColorStop(0.52, "#101010");
  sky.addColorStop(1, "#1a1510");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glowA = ctx.createRadialGradient(width * 0.22, height * 0.16, 0, width * 0.22, height * 0.16, width * 0.48);
  glowA.addColorStop(0, "rgba(66, 217, 200, 0.16)");
  glowA.addColorStop(1, "rgba(66, 217, 200, 0)");
  ctx.fillStyle = glowA;
  ctx.fillRect(0, 0, width, height);

  const glowB = ctx.createRadialGradient(width * 0.78, height * 0.32, 0, width * 0.78, height * 0.32, width * 0.42);
  glowB.addColorStop(0, "rgba(255, 107, 107, 0.12)");
  glowB.addColorStop(1, "rgba(255, 107, 107, 0)");
  ctx.fillStyle = glowB;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  const grid = 52;
  const offset = (state.time * 28) % grid;
  for (let y = -grid + offset; y < height + grid; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  for (const star of stars) {
    const y = (star.y + state.time * star.drift) % height;
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = "#f8f6ef";
    ctx.beginPath();
    ctx.arc(star.x, y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawStar(x, y, r, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.46;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = Math.cos(a) * radius;
    const py = Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#ffd166";
  ctx.shadowColor = "#ffd166";
  ctx.shadowBlur = 16;
  ctx.fill();
  ctx.restore();
}

function drawMeteor(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.angle);
  ctx.shadowColor = "#ff6b6b";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#ff6b6b";
  ctx.beginPath();
  ctx.moveTo(0, -item.r);
  ctx.lineTo(item.r * 0.9, item.r * 0.45);
  ctx.lineTo(item.r * 0.2, item.r * 0.9);
  ctx.lineTo(-item.r, item.r * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(24, 18, 14, 0.5)";
  ctx.beginPath();
  ctx.arc(-item.r * 0.18, item.r * 0.05, item.r * 0.22, 0, Math.PI * 2);
  ctx.arc(item.r * 0.32, item.r * 0.34, item.r * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHeart(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(Math.sin(state.time * 4) * 0.12);
  ctx.scale(item.r / 17, item.r / 17);
  ctx.shadowColor = "#7bd88f";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#7bd88f";
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.bezierCurveTo(-22, -4, -12, -20, 0, -9);
  ctx.bezierCurveTo(12, -20, 22, -4, 0, 12);
  ctx.fill();
  ctx.restore();
}

function drawShield(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.angle);
  ctx.shadowColor = "#42d9c8";
  ctx.shadowBlur = 18;
  ctx.strokeStyle = "#42d9c8";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, item.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(66, 217, 200, 0.2)";
  ctx.beginPath();
  ctx.moveTo(0, -item.r * 0.82);
  ctx.lineTo(item.r * 0.72, -item.r * 0.1);
  ctx.lineTo(0, item.r * 0.82);
  ctx.lineTo(-item.r * 0.72, -item.r * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  if (state.shield > 0) {
    ctx.strokeStyle = `rgba(66, 217, 200, ${0.44 + Math.sin(state.time * 12) * 0.14})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = "#42d9c8";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.shadowColor = "#ffd166";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(34, 19);
  ctx.lineTo(9, 12);
  ctx.lineTo(0, 28);
  ctx.lineTo(-9, 12);
  ctx.lineTo(-34, 19);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#16110c";
  ctx.beginPath();
  ctx.arc(0, -3, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#ff6b6b";
  ctx.beginPath();
  ctx.ellipse(0, 24, 10 + Math.sin(state.time * 18) * 3, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    const alpha = 1 - p.age / p.life;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawItems() {
  for (const item of items) {
    if (item.type === "star") drawStar(item.x, item.y, item.r, item.angle);
    if (item.type === "meteor") drawMeteor(item);
    if (item.type === "heart") drawHeart(item);
    if (item.type === "shield") drawShield(item);
  }
}

function render() {
  ctx.save();
  if (shake > 0) {
    ctx.translate(rand(-7, 7) * shake * 4, rand(-7, 7) * shake * 4);
  }
  drawBackground();
  drawItems();
  drawPlayer();
  drawParticles();
  ctx.restore();
}

function loop(time) {
  const dt = Math.min(0.033, (time - lastTime) / 1000 || 0);
  lastTime = time;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

window.addEventListener("resize", resize);

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "a", "A", "d", "D"].includes(event.key)) {
    keys.add(event.key);
    event.preventDefault();
  }
  if (event.key === " " || event.key === "p" || event.key === "P") {
    togglePause();
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

canvas.addEventListener("pointerdown", (event) => {
  pointer.active = true;
  pointer.x = event.offsetX;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!pointer.active) return;
  pointer.x = event.offsetX;
});

canvas.addEventListener("pointerup", () => {
  pointer.active = false;
});

canvas.addEventListener("pointercancel", () => {
  pointer.active = false;
});

startBtn.addEventListener("click", () => {
  if (state.paused) {
    state.paused = false;
    overlay.hidden = true;
    pauseBtn.querySelector("span").textContent = "II";
    pauseBtn.setAttribute("aria-label", "Jeda");
    pauseBtn.title = "Jeda";
    return;
  }
  resetGame();
});

pauseBtn.addEventListener("click", togglePause);
restartBtn.addEventListener("click", resetGame);

bestEl.textContent = best;
resize();
requestAnimationFrame(loop);
