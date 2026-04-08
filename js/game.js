import { ASSET_MANIFEST, GAME_CONFIG, GAME_STATES, STORAGE_KEYS } from './config.js';

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

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export class Game {
  constructor({ canvas, audio, ui }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = audio;
    this.ui = ui;
    this.state = GAME_STATES.MENU;
    this.best = Number(localStorage.getItem(STORAGE_KEYS.bestScore) ?? 0);
    this.playerSprites = {};
    this.resize();
    this.loadPlayerSprites();
    window.addEventListener('resize', () => this.resize());
    this.reset();
  }

  loadPlayerSprites() {
    const sprites = ASSET_MANIFEST.player;
    const map = {
      forward: sprites.figForward,
      left: sprites.figLeft,
      right: sprites.figRight,
      back: sprites.figBack
    };
    for (const [direction, src] of Object.entries(map)) {
      const image = new Image();
      image.src = src;
      image.decoding = 'async';
      this.playerSprites[direction] = image;
    }
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
    this.seedRain();
  }

  seedRain() {
    this.rainDrops = Array.from({ length: GAME_CONFIG.rainAmount }, () => ({
      x: Math.random() * this.worldWidth,
      y: Math.random() * this.worldHeight,
      len: randRange(6, 16),
      speed: randRange(240, 460),
      drift: randRange(-24, 24)
    }));
  }

  reset() {
    this.player = {
      x: Math.floor(GAME_CONFIG.cols / 2),
      y: GAME_CONFIG.startY,
      drawX: Math.floor(GAME_CONFIG.cols / 2),
      drawY: GAME_CONFIG.startY,
      stretch: 0,
      tilt: 0,
      facing: 'forward'
    };
    this.score = 0;
    this.coinCount = 0;
    this.superJumps = 0;
    this.maxY = this.player.y;
    this.hazards = [];
    this.platforms = [];
    this.coins = [];
    this.coinSpawnTimer = 0;
    this.particles = [];
    this.nearMisses = new Set();
    this.lastNearMissAt = 0;
    this.lastMoveAt = 0;
    this.time = 0;
    this.cameraY = this.player.y - 3;
    this.shake = 0;
    this.nextHazardId = 1;
    this.nextPlatformId = 1;
    this.nextCoinId = 1;
    this.laneCache = new Map();
    for (let y = -6; y < 80; y += 1) this.ensureLane(y);
    this.ui.updateScore(this.score);
    this.ui.updateBest(this.best);
    this.ui.updateCoins(this.coinCount, GAME_CONFIG.coins.coinsNeededForSuperJump);
    this.ui.updateSuperJumps(this.superJumps);
  }

  start() {
    this.reset();
    this.state = GAME_STATES.PLAYING;
  }

  setState(nextState) {
    this.state = nextState;
  }

  togglePause() {
    if (this.state === GAME_STATES.PLAYING) this.state = GAME_STATES.PAUSED;
    else if (this.state === GAME_STATES.PAUSED) this.state = GAME_STATES.PLAYING;
  }

  move(dir) {
    if (this.state !== GAME_STATES.PLAYING) return;

    const facingMap = {
      up: 'back',
      down: 'forward',
      left: 'left',
      right: 'right'
    };
    this.player.facing = facingMap[dir] ?? this.player.facing;

    const now = performance.now();
    if (now - this.lastMoveAt < GAME_CONFIG.baseMoveCooldown) return;

    let nx = this.player.x;
    let ny = this.player.y;
    if (dir === 'up') ny += 1;
    if (dir === 'down') ny -= 1;
    if (dir === 'left') nx -= 1;
    if (dir === 'right') nx += 1;
    nx = clamp(nx, 0, GAME_CONFIG.cols - 1);
    ny = Math.max(-2, ny);
    if (nx === this.player.x && ny === this.player.y) return;

    const dx = nx - this.player.x;
    this.player.x = nx;
    this.player.y = ny;
    this.player.tilt = dx * 0.2;
    this.player.stretch = 0.15;
    this.spawnHopParticles();
    this.audio.play('hop');
    this.lastMoveAt = now;

    this.handleProgressScore();
    this.collectCoinAtPlayer();

    for (let y = this.player.y - 8; y < this.player.y + 40; y += 1) this.ensureLane(y);
  }

  useSuperJump() {
    if (this.state !== GAME_STATES.PLAYING || this.superJumps < 1) return;
    const startY = this.player.y;
    const targetY = startY + GAME_CONFIG.coins.superJumpDistance;
    const landingY = this.findSafeLandingRow(targetY);

    this.superJumps -= 1;
    this.ui.updateSuperJumps(this.superJumps);
    this.ui.showToast('SUPER JUMP!', 'success');
    this.audio.play('super_use');

    this.player.y = landingY;
    this.player.drawY = landingY - 1.2;
    this.player.stretch = 0.35;
    this.player.facing = 'back';
    this.spawnBurst('#d9bd70', 30);

    this.handleProgressScore();
    this.collectCoinAtPlayer();

    for (let y = this.player.y - 8; y < this.player.y + 45; y += 1) this.ensureLane(y);
  }

  findSafeLandingRow(targetY) {
    const scanDepth = 8;
    for (let y = targetY; y >= Math.max(this.player.y + 1, targetY - scanDepth); y -= 1) {
      this.ensureLane(y);
      const lane = this.laneCache.get(y);
      if (!lane) continue;
      if (lane.type === 'grass') return y;
      if (lane.type === 'road' && !this.hasBlockingHazard(this.player.x, y, 0.9)) return y;
      if (lane.type === 'rail') continue;
      if (lane.type === 'water') {
        const platform = this.findPlatformUnderPlayerAt(this.player.x, y);
        if (platform) return y;
      }
    }
    return Math.max(this.player.y + 1, targetY - scanDepth);
  }

  hasBlockingHazard(x, y, padding = 0.8) {
    return this.hazards.some((h) => h.y === y && Math.abs(h.x - x) < h.w * 0.5 + padding);
  }

  handleProgressScore() {
    if (this.player.y <= this.maxY) return;
    const gained = this.player.y - this.maxY;
    this.maxY = this.player.y;
    this.score += gained;
    const bestPulse = this.updateBestIfNeeded();
    this.ui.updateScore(this.score, { pulse: true, bestPulse });
    this.audio.play('score');
    this.spawnBurst('#9fb8aa', 10);
  }

  updateBestIfNeeded() {
    if (this.score <= this.best) return false;
    this.best = this.score;
    localStorage.setItem(STORAGE_KEYS.bestScore, String(this.best));
    this.ui.updateBest(this.best);
    return true;
  }

  ensureLane(y) {
    if (this.laneCache.has(y)) return;

    const isSafeStart = y <= GAME_CONFIG.safeStartRows;
    const type = isSafeStart ? 'grass' : weightedLaneType(GAME_CONFIG.laneWeights);
    const direction = Math.random() > 0.5 ? 1 : -1;
    const lane = { y, type, direction, speed: 0, timer: 0, interval: 2, seed: Math.random() * 1000 };

    if (type === 'road') {
      lane.speed = randRange(1.35, 2.7) + this.score * 0.012;
      lane.interval = randRange(1.75, 2.8);
    } else if (type === 'water') {
      lane.speed = randRange(GAME_CONFIG.riverPlatforms.minSpeed, GAME_CONFIG.riverPlatforms.maxSpeed);
      lane.interval = randRange(GAME_CONFIG.riverPlatforms.minInterval, GAME_CONFIG.riverPlatforms.maxInterval);
      lane.platformType = randomFrom(GAME_CONFIG.riverPlatforms.laneTypes);
    } else if (type === 'rail') {
      lane.speed = randRange(5.1, 7.2) + this.score * 0.03;
      lane.interval = randRange(4.7, 7.7);
    }
    this.laneCache.set(y, lane);
  }

  spawnHazard(lane) {
    if (lane.type === 'grass' || lane.type === 'water') return;
    const startX = lane.direction > 0 ? -1.4 : GAME_CONFIG.cols + 1.4;
    const vehicleType = lane.type === 'rail' ? 'maxTrain' : randomFrom(['car1', 'car2', 'car3', 'scooter1', 'bike1']);
    const h = {
      id: this.nextHazardId++,
      type: vehicleType,
      x: startX,
      prevX: startX,
      y: lane.y,
      dir: lane.direction,
      speed: lane.speed,
      w: lane.type === 'rail' ? 2.8 : vehicleType.startsWith('car') ? 1.2 : vehicleType === 'scooter1' ? 1.0 : 0.9,
      h: lane.type === 'rail' ? 0.8 : 0.7
    };
    this.hazards.push(h);
  }

  spawnPlatform(lane) {
    if (lane.type !== 'water') return;
    const platformType = lane.platformType ?? randomFrom(GAME_CONFIG.riverPlatforms.laneTypes);
    const startX = lane.direction > 0 ? -1.2 : GAME_CONFIG.cols + 1.2;
    const width = GAME_CONFIG.riverPlatforms.widthByType[platformType] ?? 1.1;
    const height = GAME_CONFIG.riverPlatforms.heightByType[platformType] ?? 0.45;
    this.platforms.push({
      id: this.nextPlatformId++,
      type: platformType,
      x: startX,
      prevX: startX,
      y: lane.y,
      dir: lane.direction,
      speed: lane.speed,
      w: width,
      h: height
    });
  }

  spawnCoin() {
    if (this.coins.length >= GAME_CONFIG.coins.maxActive) return;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const y = this.player.y + Math.floor(randRange(GAME_CONFIG.coins.spawnAheadMin, GAME_CONFIG.coins.spawnAheadMax));
      this.ensureLane(y);
      const lane = this.laneCache.get(y);
      if (!lane || lane.type !== 'grass') continue;

      const x = Math.floor(randRange(0, GAME_CONFIG.cols));
      const occupied = this.coins.some((coin) => coin.x === x && Math.abs(coin.y - y) < 2);
      if (occupied) continue;

      this.coins.push({ id: this.nextCoinId++, x, y, bobSeed: Math.random() * 1000 });
      return;
    }
  }

  collectCoinAtPlayer() {
    const coinIndex = this.coins.findIndex((coin) => coin.x === this.player.x && coin.y === this.player.y);
    if (coinIndex < 0) return;

    this.coins.splice(coinIndex, 1);
    this.coinCount += 1;
    this.ui.updateCoins(this.coinCount, GAME_CONFIG.coins.coinsNeededForSuperJump);
    this.audio.play('coin');
    this.spawnBurst('#e1bf63', 14);

    if (this.coinCount >= GAME_CONFIG.coins.coinsNeededForSuperJump) {
      this.coinCount -= GAME_CONFIG.coins.coinsNeededForSuperJump;
      this.superJumps += 1;
      this.ui.updateCoins(this.coinCount, GAME_CONFIG.coins.coinsNeededForSuperJump);
      this.ui.updateSuperJumps(this.superJumps);
      this.ui.showToast('Super Jump Charged! Press J', 'success');
      this.audio.play('super_ready');
    }
  }

  update(dt) {
    this.time += dt;
    this.player.drawX += (this.player.x - this.player.drawX) * 0.34;
    this.player.drawY += (this.player.y - this.player.drawY) * 0.34;
    this.player.tilt *= 0.86;
    this.player.stretch = Math.max(0, this.player.stretch - dt * 1.8);
    this.updateParticles(dt);
    this.updateRain(dt);

    if (this.state !== GAME_STATES.PLAYING) return;

    this.cameraY += (this.player.y - 3 - this.cameraY) * GAME_CONFIG.cameraLerp;

    const stage = this.score / GAME_CONFIG.difficultyRampEvery;
    const difficulty = clamp(1 + stage * 0.06 + Math.sqrt(stage) * 0.05, 1, 2.35);

    for (const lane of this.laneCache.values()) {
      if (lane.type === 'grass') continue;
      lane.timer += dt;
      let minInterval = 1.1;
      if (lane.type === 'water') minInterval = GAME_CONFIG.riverPlatforms.minInterval;
      if (lane.type === 'rail') minInterval = 3.35;
      const interval = Math.max(minInterval, lane.interval / difficulty);
      if (lane.timer >= interval) {
        lane.timer = 0;
        if (lane.type === 'water') this.spawnPlatform(lane);
        else this.spawnHazard(lane);
      }
    }

    this.coinSpawnTimer += dt;
    if (this.coinSpawnTimer >= 1) {
      this.coinSpawnTimer = 0;
      if (Math.random() < GAME_CONFIG.coins.spawnChancePerSecond) this.spawnCoin();
    }

    for (const hazard of this.hazards) {
      hazard.prevX = hazard.x;
      hazard.x += hazard.speed * hazard.dir * dt;
    }
    this.hazards = this.hazards.filter((h) => h.x > -5 && h.x < GAME_CONFIG.cols + 5);

    for (const platform of this.platforms) {
      platform.prevX = platform.x;
      platform.x += platform.speed * platform.dir * dt;
    }
    this.platforms = this.platforms.filter((p) => p.x > -5 && p.x < GAME_CONFIG.cols + 5);

    const minCoinY = this.player.y - 2;
    this.coins = this.coins.filter((coin) => coin.y >= minCoinY);

    this.handleCollisions(dt);
    this.collectCoinAtPlayer();
    this.shake *= GAME_CONFIG.screenShakeDecay;
  }

  updateRain(dt) {
    for (const drop of this.rainDrops) {
      drop.y += drop.speed * dt;
      drop.x += drop.drift * dt;
      if (drop.y > this.worldHeight + 20 || drop.x < -20 || drop.x > this.worldWidth + 20) {
        drop.y = -10;
        drop.x = Math.random() * this.worldWidth;
      }
    }
  }

  findPlatformUnderPlayerAt(x, y) {
    const padding = GAME_CONFIG.riverPlatforms.hitboxPaddingX;
    return this.platforms.find((platform) => {
      if (platform.y !== y) return false;
      const halfWidth = platform.w * 0.5 - padding;
      return Math.abs(platform.x - x) <= halfWidth;
    });
  }

  handleCollisions(dt) {
    const lane = this.laneCache.get(this.player.y);
    if (!lane) return;

    for (const h of this.hazards) {
      if (Math.abs(h.y - this.player.y) > 0.2) continue;

      const playerRadius = 0.23;
      const hazardRadius = h.w * 0.5;
      const nowGap = Math.abs(h.x - this.player.drawX);
      const minX = Math.min(h.prevX, h.x) - playerRadius;
      const maxX = Math.max(h.prevX, h.x) + playerRadius;
      const sweptHit = this.player.drawX >= minX - hazardRadius && this.player.drawX <= maxX + hazardRadius;

      if (nowGap <= hazardRadius + playerRadius || sweptHit) {
        this.kill(h.type === 'maxTrain' ? 'A MAX train blasted through your lane.' : 'Portland traffic cut off your route.');
        return;
      }

      if (lane.type === 'road') {
        const near = Math.abs(h.x - this.player.x);
        const now = performance.now();
        if (near < 0.8 && !this.nearMisses.has(h.id) && now - this.lastNearMissAt > 120) {
          this.nearMisses.add(h.id);
          this.lastNearMissAt = now;
          this.score += 1;
          const bestPulse = this.updateBestIfNeeded();
          this.ui.updateScore(this.score, { pulse: true, bestPulse });
          this.spawnBurst('#7aa58a', 12);
          this.audio.play('score');
        }
      }
    }

    if (lane.type === 'water') {
      const platform = this.findPlatformUnderPlayerAt(this.player.drawX, this.player.y);
      if (!platform) {
        this.kill('The Willamette rain runoff swept you away.');
        return;
      }

      const rideStep = platform.speed * platform.dir * dt;
      this.player.drawX = clamp(this.player.drawX + rideStep, 0, GAME_CONFIG.cols - 1);
      this.player.x = clamp(Math.round(this.player.drawX), 0, GAME_CONFIG.cols - 1);

      if (this.player.drawX <= 0.03 || this.player.drawX >= GAME_CONFIG.cols - 1.03) {
        this.kill('You drifted off the floating platform into the river.');
      }
    }
  }

  kill(message) {
    if (this.state !== GAME_STATES.PLAYING) return;
    this.state = GAME_STATES.GAME_OVER;
    this.audio.play('hit');
    this.shake = GAME_CONFIG.screenShakeMax;
    this.spawnBurst('#c56f5c', 26);
    this.ui.showGameOver(this.score, message);
  }

  spawnHopParticles() {
    this.spawnBurst('#97aa7f', 8);
  }

  spawnBurst(color, amount) {
    for (let i = 0; i < amount; i += 1) {
      this.particles.push({
        x: this.player.drawX + randRange(-0.3, 0.3),
        y: this.player.drawY + randRange(-0.2, 0.2),
        vx: randRange(-0.7, 0.7),
        vy: randRange(-1.6, -0.25),
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
    this.drawPlatforms();
    this.drawHazards();
    this.drawCoins();
    this.drawPlayer();
    this.drawParticles();
    this.drawRain();
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
        ctx.fillStyle = '#505962';
        ctx.fillRect(0, pos.y + this.tile * 0.12, this.worldWidth, this.tile * 0.76);
        ctx.fillStyle = '#5f7f69';
        ctx.fillRect(0, pos.y + this.tile * 0.12, this.worldWidth, this.tile * 0.16);
        ctx.strokeStyle = 'rgba(245, 245, 245, 0.55)';
        ctx.setLineDash([14, 18]);
        ctx.lineDashOffset = -(this.time * 58 * lane.direction);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, pos.y + this.tile * 0.56);
        ctx.lineTo(this.worldWidth, pos.y + this.tile * 0.56);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (lane.type === 'water') {
        ctx.fillStyle = '#34576d';
        ctx.fillRect(0, pos.y, this.worldWidth, this.tile);
        ctx.fillStyle = 'rgba(238, 242, 245, 0.14)';
        for (let i = 0; i < 4; i += 1) {
          const waveY = pos.y + this.tile * 0.2 + i * 13 + Math.sin(this.time * 2.5 + i + lane.seed) * 3;
          ctx.fillRect(0, waveY, this.worldWidth, 3);
        }
      } else if (lane.type === 'rail') {
        ctx.fillStyle = '#6f755b';
        ctx.fillRect(0, pos.y, this.worldWidth, this.tile);
        ctx.fillStyle = '#616161';
        ctx.fillRect(0, pos.y + this.tile * 0.2, this.worldWidth, 6);
        ctx.fillRect(0, pos.y + this.tile * 0.74, this.worldWidth, 6);
        ctx.fillStyle = '#8f8a7a';
        for (let x = 0; x < this.worldWidth; x += 26) ctx.fillRect(x, pos.y + this.tile * 0.48, 10, 5);
      } else {
        ctx.fillStyle = '#4a6047';
        ctx.fillRect(0, pos.y, this.worldWidth, this.tile);
      }

      this.drawProps(lane, pos.y);
    }
  }

  drawProps(lane, y) {
    const ctx = this.ctx;
    const seedOffset = Math.floor((lane.seed * 100) % 7);

    if (lane.type === 'grass') {
      for (let i = 0; i < 3; i += 1) {
        const px = (i * 2 + seedOffset) * this.tile * 0.9;
        ctx.fillStyle = '#2c4b36';
        ctx.beginPath();
        ctx.moveTo(px + 20, y + this.tile * 0.24);
        ctx.lineTo(px + 8, y + this.tile * 0.58);
        ctx.lineTo(px + 32, y + this.tile * 0.58);
        ctx.closePath();
        ctx.fill();
      }
      return;
    }

    const propX = (seedOffset % 4) * this.tile * 2.1 + this.tile * 0.25;
    if (lane.type === 'road') {
      ctx.fillStyle = '#7c5235';
      ctx.fillRect(propX, y + this.tile * 0.65, 36, 20);
      ctx.fillStyle = '#d8c7a1';
      ctx.fillRect(propX + 4, y + this.tile * 0.59, 28, 8);
    } else if (lane.type === 'water') {
      ctx.fillStyle = '#6b7e8b';
      ctx.fillRect(propX + 14, y + this.tile * 0.08, 6, 24);
      ctx.fillStyle = '#d1d5db';
      ctx.fillRect(propX, y + this.tile * 0.04, 34, 12);
    } else if (lane.type === 'rail') {
      ctx.fillStyle = '#64564f';
      ctx.fillRect(propX, y + this.tile * 0.06, 44, 18);
      ctx.fillStyle = '#d4d4d4';
      ctx.fillRect(propX + 8, y + this.tile * 0.09, 18, 6);
    }
  }

  drawPlatforms() {
    const ctx = this.ctx;
    for (const p of this.platforms) {
      const pos = this.worldToScreen(p.x, p.y);
      const width = p.w * this.tile;
      const height = p.h * this.tile;
      const x = pos.x - width / 2;
      const y = pos.y + (this.tile - height) * 0.48;

      if (p.type === 'raft1') {
        ctx.fillStyle = '#907357';
        ctx.fillRect(x, y, width, height);
        ctx.fillStyle = '#c2ad7f';
        ctx.fillRect(x + 5, y + 5, width - 10, height - 10);
      } else if (p.type === 'kayak1') {
        ctx.fillStyle = '#d87a49';
        ctx.fillRect(x, y + 3, width, height - 6);
        ctx.fillStyle = '#b86439';
        ctx.fillRect(x + 5, y + height * 0.38, width - 10, height * 0.2);
      } else {
        ctx.fillStyle = '#7d5a3f';
        ctx.fillRect(x, y + height * 0.15, width, height * 0.7);
        ctx.fillStyle = '#8f6747';
        for (let i = 0; i < 4; i += 1) {
          ctx.fillRect(x + i * (width / 4), y + height * 0.2, 2, height * 0.6);
        }
      }

      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(x + 5, y + height - 4, Math.max(8, width - 10), 4);
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

      if (h.type.startsWith('car')) {
        ctx.fillStyle = h.type === 'car2' ? '#3d7b9a' : h.type === 'car3' ? '#9b5c3d' : '#9a4f3d';
        ctx.fillRect(x, y, width, height);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(x + 10, y + 9, width * 0.3, 10);
      } else if (h.type === 'scooter1') {
        ctx.fillStyle = '#2c8f71';
        ctx.fillRect(x, y + height * 0.35, width, height * 0.28);
        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.arc(x + 8, y + height * 0.72, 4, 0, Math.PI * 2);
        ctx.arc(x + width - 8, y + height * 0.72, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (h.type === 'bike1') {
        ctx.fillStyle = '#59685a';
        ctx.fillRect(x, y + height * 0.35, width, height * 0.22);
      } else {
        ctx.fillStyle = '#1e8a5a';
        ctx.fillRect(x, y, width, height);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(x + 14, y + 10, width * 0.6, 8);
      }

      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x + 6, y + height - 8, Math.max(10, width - 12), 5);
    }
  }

  drawCoins() {
    const ctx = this.ctx;
    for (const coin of this.coins) {
      const pos = this.worldToScreen(coin.x, coin.y);
      const bob = Math.sin(this.time * 5 + coin.bobSeed) * this.tile * 0.06;
      const cx = pos.x + this.tile * 0.5;
      const cy = pos.y + this.tile * 0.45 + bob;
      const r = this.tile * 0.16;
      ctx.fillStyle = '#e5c15f';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8f6f2d';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#f6e7a6';
      ctx.fillRect(cx - 2, cy - r * 0.6, 4, r * 1.2);
    }
  }

  drawPlayer() {
    const ctx = this.ctx;
    const pos = this.worldToScreen(this.player.drawX, this.player.drawY);
    const w = this.tile * (0.58 + this.player.stretch * 0.24);
    const h = this.tile * (0.62 - this.player.stretch * 0.16);
    const x = pos.x + (this.tile - w) / 2;
    const y = pos.y + (this.tile - h) / 2;

    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(this.player.tilt);
    ctx.translate(-(x + w / 2), -(y + h / 2));

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.95, w * 0.4, h * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    const sprite = this.playerSprites[this.player.facing];
    if (sprite && sprite.complete) {
      ctx.drawImage(sprite, x, y, w, h);
    } else {
      ctx.fillStyle = '#f4a261';
      ctx.fillRect(x, y, w, h);
    }

    ctx.restore();
  }

  drawParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const pos = this.worldToScreen(p.x, p.y);
      const alpha = Math.max(0, p.life / GAME_CONFIG.particleLifetime);
      ctx.fillStyle = `${p.color}${Math.floor(alpha * 255)
        .toString(16)
        .padStart(2, '0')}`;
      ctx.fillRect(pos.x + this.tile * 0.45, pos.y + this.tile * 0.45, 4, 4);
    }
  }

  drawRain() {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(228, 236, 242, 0.23)';
    ctx.lineWidth = 1.2;
    for (const drop of this.rainDrops) {
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - 2, drop.y + drop.len);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(41, 52, 59, 0.2)';
    ctx.fillRect(0, 0, this.worldWidth, this.worldHeight);
  }
}
