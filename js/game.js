import { GAME_CONFIG, STORAGE_KEYS } from './config.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const randRange = (min, max) => Math.random() * (max - min) + min;

function weightedLaneType(weights) {
  const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = Math.random() * total;
  for (const entry of weights) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.type;
  }
  return weights[0].type;
}

export class Game {
  constructor({ canvas, audio, ui }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = audio;
    this.ui = ui;
    this.state = 'start';
    this.best = Number(localStorage.getItem(STORAGE_KEYS.bestScore) ?? 0);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.reset();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.worldWidth = rect.width;
    this.worldHeight = rect.height;
    this.tile = this.worldWidth / GAME_CONFIG.cols;
  }

  reset() {
    this.player = {
      x: Math.floor(GAME_CONFIG.cols / 2),
      y: GAME_CONFIG.startY,
      drawX: Math.floor(GAME_CONFIG.cols / 2),
      drawY: GAME_CONFIG.startY,
      stretch: 0
    };
    this.score = 0;
    this.maxY = this.player.y;
    this.hazards = [];
    this.particles = [];
    this.nearMisses = new Set();
    this.lastMoveAt = 0;
    this.time = 0;
    this.cameraY = this.player.y - 3;
    this.shake = 0;
    this.nextHazardId = 1;
    this.laneCache = new Map();
    for (let y = -6; y < 80; y += 1) {
      this.ensureLane(y);
    }
    this.ui.updateScore(this.score);
    this.ui.updateBest(this.best);
  }

  start() {
    this.reset();
    this.state = 'running';
  }

  togglePause() {
    if (this.state === 'running') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'running';
  }

  move(dir) {
    if (this.state === 'start' || this.state === 'dead') {
      this.start();
      return;
    }
    if (this.state !== 'running') return;
    const now = performance.now();
    const cooldown = GAME_CONFIG.baseMoveCooldown;
    if (now - this.lastMoveAt < cooldown) return;

    let nx = this.player.x;
    let ny = this.player.y;
    if (dir === 'up') ny += 1;
    if (dir === 'down') ny -= 1;
    if (dir === 'left') nx -= 1;
    if (dir === 'right') nx += 1;
    nx = clamp(nx, 0, GAME_CONFIG.cols - 1);
    ny = Math.max(-2, ny);
    if (nx === this.player.x && ny === this.player.y) return;

    this.player.x = nx;
    this.player.y = ny;
    this.player.stretch = 0.16;
    this.spawnHopParticles();
    this.audio.play('hop');
    this.lastMoveAt = now;

    if (this.player.y > this.maxY) {
      this.maxY = this.player.y;
      this.score = this.maxY - GAME_CONFIG.startY;
      this.ui.updateScore(this.score);
      this.audio.play('score');
      if (this.score > this.best) {
        this.best = this.score;
        localStorage.setItem(STORAGE_KEYS.bestScore, String(this.best));
        this.ui.updateBest(this.best);
      }
    }

    for (let y = this.player.y - 8; y < this.player.y + 40; y += 1) this.ensureLane(y);
  }

  ensureLane(y) {
    if (this.laneCache.has(y)) return;
    const type = y <= 0 ? 'grass' : weightedLaneType(GAME_CONFIG.laneWeights);
    const direction = Math.random() > 0.5 ? 1 : -1;
    const lane = { y, type, direction, speed: 0, density: 0, timer: 0, interval: 2 };

    if (type === 'road') {
      lane.speed = randRange(1.6, 3.4) + this.score * 0.018;
      lane.interval = randRange(1.6, 2.6);
    } else if (type === 'water') {
      lane.speed = randRange(1.1, 2.2);
      lane.interval = randRange(1.8, 3.2);
    } else if (type === 'rail') {
      lane.speed = randRange(5.6, 7.3) + this.score * 0.04;
      lane.interval = randRange(4.2, 6.7);
    }
    this.laneCache.set(y, lane);
  }

  spawnHazard(lane) {
    if (lane.type === 'grass') return;
    const startX = lane.direction > 0 ? -1.4 : GAME_CONFIG.cols + 1.4;
    const h = {
      id: this.nextHazardId++,
      type: lane.type === 'water' ? 'log' : lane.type === 'rail' ? 'train' : 'car',
      x: startX,
      y: lane.y,
      dir: lane.direction,
      speed: lane.speed,
      w: lane.type === 'rail' ? 2.4 : lane.type === 'water' ? 1.8 : 1.25,
      h: lane.type === 'water' ? 0.8 : 0.85
    };
    this.hazards.push(h);
  }

  update(dt) {
    this.time += dt;
    this.player.drawX += (this.player.x - this.player.drawX) * 0.32;
    this.player.drawY += (this.player.y - this.player.drawY) * 0.32;
    this.player.stretch = Math.max(0, this.player.stretch - dt * 1.8);

    if (this.state !== 'running') return;

    this.cameraY += (this.player.y - 3 - this.cameraY) * GAME_CONFIG.cameraLerp;

    const difficulty = 1 + Math.floor(this.score / GAME_CONFIG.difficultyRampEvery) * 0.08;

    for (const lane of this.laneCache.values()) {
      if (lane.type === 'grass') continue;
      lane.timer += dt;
      const interval = Math.max(0.85, lane.interval / difficulty);
      if (lane.timer >= interval) {
        lane.timer = 0;
        this.spawnHazard(lane);
      }
    }

    for (const hazard of this.hazards) hazard.x += hazard.speed * hazard.dir * dt;
    this.hazards = this.hazards.filter((h) => h.x > -5 && h.x < GAME_CONFIG.cols + 5);

    this.handleCollisions();
    this.updateParticles(dt);
    this.shake *= GAME_CONFIG.screenShakeDecay;
  }

  handleCollisions() {
    const lane = this.laneCache.get(this.player.y);
    const laneHazards = this.hazards.filter((h) => Math.abs(h.y - this.player.y) < 0.2);

    if (lane?.type === 'water') {
      const carryingLog = laneHazards.find((h) => h.type === 'log' && Math.abs(h.x - this.player.x) < (h.w + 0.5) / 2);
      if (carryingLog) {
        this.player.drawX += carryingLog.speed * carryingLog.dir * 0.012;
        this.player.x = clamp(Math.round(this.player.drawX), 0, GAME_CONFIG.cols - 1);
      } else {
        this.kill('You fell into the current.');
        return;
      }
    }

    for (const h of laneHazards) {
      if (h.type === 'log') continue;
      const hitX = Math.abs(h.x - this.player.x) <= (h.w + 0.52) / 2;
      if (hitX) {
        this.kill(h.type === 'train' ? 'A mag-rail slammed through.' : 'Traffic clipped your run.');
        return;
      }
      const near = Math.abs(h.x - this.player.x);
      if (near < 0.9 && !this.nearMisses.has(h.id) && this.state === 'running' && lane?.type === 'road') {
        this.nearMisses.add(h.id);
        this.score += 1;
        this.maxY += 1;
        this.ui.updateScore(this.score);
        if (this.score > this.best) {
          this.best = this.score;
          localStorage.setItem(STORAGE_KEYS.bestScore, String(this.best));
          this.ui.updateBest(this.best);
        }
        this.spawnBurst('#22d3ee', 12);
      }
    }
  }

  kill(message) {
    if (this.state !== 'running') return;
    this.state = 'dead';
    this.audio.play('hit');
    this.shake = GAME_CONFIG.screenShakeMax;
    this.spawnBurst('#f87171', 26);
    this.ui.showGameOver(this.score, message);
  }

  spawnHopParticles() {
    this.spawnBurst('#f59e0b', 6);
  }

  spawnBurst(color, amount) {
    for (let i = 0; i < amount; i += 1) {
      this.particles.push({
        x: this.player.drawX + randRange(-0.3, 0.3),
        y: this.player.drawY + randRange(-0.2, 0.2),
        vx: randRange(-0.7, 0.7),
        vy: randRange(-1.5, -0.3),
        color,
        life: GAME_CONFIG.particleLifetime * randRange(0.6, 1.2)
      });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 2.2 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.worldWidth, this.worldHeight);

    const shakeX = (Math.random() - 0.5) * this.shake;
    const shakeY = (Math.random() - 0.5) * this.shake;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    this.drawLanes();
    this.drawHazards();
    this.drawPlayer();
    this.drawParticles();

    ctx.restore();
  }

  worldToScreen(x, y) {
    return {
      x: x * this.tile,
      y: this.worldHeight - (y - this.cameraY + 1) * this.tile
    };
  }

  drawLanes() {
    const ctx = this.ctx;
    const from = Math.floor(this.cameraY) - 2;
    const to = from + GAME_CONFIG.visibleRows + 5;
    for (let y = from; y <= to; y += 1) {
      this.ensureLane(y);
      const lane = this.laneCache.get(y);
      const pos = this.worldToScreen(0, y);
      ctx.fillStyle = GAME_CONFIG.lanePalette[lane.type];
      ctx.fillRect(0, pos.y, this.worldWidth, this.tile + 1);

      if (lane.type === 'road') {
        ctx.strokeStyle = 'rgba(255,255,255,0.24)';
        ctx.setLineDash([14, 18]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, pos.y + this.tile / 2);
        ctx.lineTo(this.worldWidth, pos.y + this.tile / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (lane.type === 'water') {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        for (let i = 0; i < 4; i += 1) {
          const waveY = pos.y + 12 + i * 22 + Math.sin(this.time * 2 + i + y) * 4;
          ctx.fillRect(0, waveY, this.worldWidth, 4);
        }
      }
      if (lane.type === 'rail') {
        ctx.fillStyle = '#71717a';
        ctx.fillRect(0, pos.y + this.tile * 0.2, this.worldWidth, 6);
        ctx.fillRect(0, pos.y + this.tile * 0.74, this.worldWidth, 6);
      }
    }
  }

  drawHazards() {
    const ctx = this.ctx;
    for (const h of this.hazards) {
      const pos = this.worldToScreen(h.x, h.y);
      const width = h.w * this.tile;
      const height = h.h * this.tile;
      const x = pos.x - width / 2;
      const y = pos.y + (this.tile - height) * 0.5;

      if (h.type === 'car') ctx.fillStyle = '#ef4444';
      if (h.type === 'log') ctx.fillStyle = '#92400e';
      if (h.type === 'train') ctx.fillStyle = '#f97316';

      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(x + 6, y + height - 10, width - 12, 6);
      if (h.type === 'car') {
        ctx.fillStyle = '#bfdbfe';
        ctx.fillRect(x + 10, y + 10, width * 0.3, 12);
      }
    }
  }

  drawPlayer() {
    const ctx = this.ctx;
    const pos = this.worldToScreen(this.player.drawX, this.player.drawY);
    const w = this.tile * (0.58 + this.player.stretch * 0.24);
    const h = this.tile * (0.62 - this.player.stretch * 0.16);
    const x = pos.x + (this.tile - w) / 2;
    const y = pos.y + (this.tile - h) / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.95, w * 0.42, h * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#111827';
    ctx.fillRect(x + w * 0.2, y + h * 0.25, w * 0.12, h * 0.12);
    ctx.fillRect(x + w * 0.68, y + h * 0.25, w * 0.12, h * 0.12);
    ctx.fillRect(x + w * 0.36, y + h * 0.6, w * 0.28, h * 0.08);
  }

  drawParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const pos = this.worldToScreen(p.x, p.y);
      const alpha = Math.max(0, p.life / GAME_CONFIG.particleLifetime);
      ctx.fillStyle = `${p.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
      ctx.fillRect(pos.x + this.tile * 0.45, pos.y + this.tile * 0.45, 4, 4);
    }
  }
}
