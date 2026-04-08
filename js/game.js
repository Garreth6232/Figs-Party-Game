import { ASSET_MANIFEST, GAME_CONFIG, GAME_STATES, STANDARD_ROAD_VEHICLE_ASSET_KEY, STORAGE_KEYS } from './config.js';
import { CollisionSystem } from './collision.js';

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

const DEFAULT_MOVING_PROFILE = {
  render: { width: 1, height: 0.6, offsetX: 0, offsetY: 0 },
  collision: { type: 'car', width: 1, height: 0.5, offsetX: 0, offsetY: 0 }
};

export class Game {
  constructor({ canvas, audio, ui, onGameOver = null }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = audio;
    this.ui = ui;
    this.state = GAME_STATES.MENU;
    this.onGameOver = onGameOver;
    this.best = Number(localStorage.getItem(STORAGE_KEYS.bestScore) ?? 0);
    this.playerSprites = {};
    this.environmentSprites = {};
    this.collectibleSprites = {};
    this.vehicleSprites = {};
    this.hazardSprites = {};
    this.superJumpVisualTimer = 0;
    this.collisionSystem = new CollisionSystem();
    this.resize();
    this.loadSprites();
    window.addEventListener('resize', () => this.resize());
    this.reset();
  }

  loadSprites() {
    const sprites = ASSET_MANIFEST.player;
    const playerMap = {
      forward: sprites.figForward,
      left: sprites.figLeft,
      right: sprites.figRight,
      back: sprites.figBack,
      superJump: sprites.figSJ
    };
    for (const [direction, src] of Object.entries(playerMap)) {
      const image = new Image();
      image.src = src;
      image.decoding = 'async';
      this.playerSprites[direction] = image;
    }

    const worldSprites = {
      riverTile: ASSET_MANIFEST.environment.riverTile,
      tree1: ASSET_MANIFEST.environment.tree1,
      coin: ASSET_MANIFEST.collectibles.coin
    };

    for (const [key, src] of Object.entries(worldSprites)) {
      const image = new Image();
      image.src = src;
      image.decoding = 'async';
      if (key === 'coin') this.collectibleSprites[key] = image;
      else this.environmentSprites[key] = image;
    }

    for (const [key, src] of Object.entries(ASSET_MANIFEST.vehicles)) {
      const image = new Image();
      image.src = src;
      image.decoding = 'async';
      this.vehicleSprites[key] = image;
    }

    for (const [key, src] of Object.entries(ASSET_MANIFEST.hazards)) {
      const image = new Image();
      image.src = src;
      image.decoding = 'async';
      this.hazardSprites[key] = image;
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
      fx: Math.floor(GAME_CONFIG.cols / 2),
      y: GAME_CONFIG.startY,
      drawX: Math.floor(GAME_CONFIG.cols / 2),
      drawY: GAME_CONFIG.startY,
      stretch: 0,
      tilt: 0,
      facing: 'forward',
      visualState: 'normal'
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
    this.superJumpVisualTimer = 0;
    this.cameraY = this.player.y - 3;
    this.shake = 0;
    this.shakeTimer = 0;
    this.nextHazardId = 1;
    this.nextPlatformId = 1;
    this.nextCoinId = 1;
    this.attachedPlatformId = null;
    this.laneCache = new Map();
    this.trainWarnings = new Map();
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

  toggleCollisionDebug() {
    const enabled = this.collisionSystem.toggleDebug();
    this.ui.showToast(`Collision debug ${enabled ? 'ON' : 'OFF'}`, 'info');
    return enabled;
  }

  setCollisionDebug(enabled) {
    this.collisionSystem.debugEnabled = Boolean(enabled);
  }

  togglePause() {
    if (this.state === GAME_STATES.PLAYING) this.state = GAME_STATES.PAUSED;
    else if (this.state === GAME_STATES.PAUSED) this.state = GAME_STATES.PLAYING;
  }

  move(dir) {
    if (this.state !== GAME_STATES.PLAYING) return;

    const facingMap = { up: 'back', down: 'forward', left: 'left', right: 'right' };
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
    this.player.fx = nx;
    this.player.y = ny;
    this.attachedPlatformId = null;
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
    const targetY = this.player.y + GAME_CONFIG.coins.superJumpDistance;
    const landing = this.findSafeLandingSpot(targetY);

    this.superJumps -= 1;
    this.ui.updateSuperJumps(this.superJumps);
    this.ui.showToast('SUPER JUMP!', 'success');
    this.audio.play('super_use');

    this.player.x = landing.x;
    this.player.fx = landing.x;
    this.player.drawX = landing.x;
    this.player.y = landing.y;
    this.player.drawY = landing.y - 1.2;
    this.player.stretch = 0.35;
    this.player.facing = 'back';
    this.player.visualState = 'superJump';
    this.superJumpVisualTimer = GAME_CONFIG.superJump.spriteDuration;
    this.spawnBurst('#d9bd70', 30);

    this.handleProgressScore();
    this.collectCoinAtPlayer();

    for (let y = this.player.y - 8; y < this.player.y + 45; y += 1) this.ensureLane(y);
  }

  findSafeLandingSpot(targetY) {
    const scanDepth = 10;
    for (let y = targetY; y >= Math.max(this.player.y + 1, targetY - scanDepth); y -= 1) {
      this.ensureLane(y);
      const lane = this.laneCache.get(y);
      if (!lane) continue;
      if (lane.type === 'grass') return { x: this.player.x, y };
      if (lane.type === 'road' && !this.hasBlockingHazard(this.player.x + 0.5, y, 0.55)) return { x: this.player.x, y };
      if (lane.type === 'water') {
        const platform = this.findPlatformUnderPoint(this.player.x + 0.5, y);
        if (platform) return { x: clamp(Math.floor(platform.x), 0, GAME_CONFIG.cols - 1), y };
      }
    }
    return { x: this.player.x, y: Math.max(this.player.y + 1, targetY - scanDepth) };
  }

  hasBlockingHazard(centerX, y, padding = 0.8) {
    return this.hazards.some((h) => {
      if (h.y !== y) return false;
      const profile = this.getMovingProfile(h.type);
      return Math.abs(this.getMovingCenterX(h, profile) - centerX) < (profile.collision.width ?? h.w) * 0.5 + padding;
    });
  }

  getMovingProfile(type) {
    return GAME_CONFIG.movingEntities.profiles[type] ?? DEFAULT_MOVING_PROFILE;
  }

  getMovingCenterX(entity, profile) {
    return entity.x + (profile.collision.offsetX ?? 0);
  }

  getMovingCenterY(laneY, profile, mode = 'collision') {
    const laneScreen = this.worldToScreen(0, laneY).y;
    const offsetY = profile[mode]?.offsetY ?? 0;
    return laneScreen + this.tile * (0.5 + offsetY);
  }

  getMovingDrawRect(entity, profile) {
    const centerX = entity.x + (profile.render.offsetX ?? 0);
    const centerY = this.getMovingCenterY(entity.y, profile, 'render');
    const width = profile.render.width * this.tile;
    const height = profile.render.height * this.tile;
    return { x: centerX * this.tile - width / 2, y: centerY - height / 2, width, height };
  }

  drawSpriteWithRenderProfile(image, targetRect, renderProfileKey) {
    if (!image?.complete || image.naturalWidth === 0 || image.naturalHeight === 0) return false;
    const renderProfile = GAME_CONFIG.renderProfiles[renderProfileKey] ?? {};
    const crop = renderProfile.crop ?? {};
    const sx = image.naturalWidth * (crop.left ?? 0);
    const sy = image.naturalHeight * (crop.top ?? 0);
    const sw = image.naturalWidth * (1 - (crop.left ?? 0) - (crop.right ?? 0));
    const sh = image.naturalHeight * (1 - (crop.top ?? 0) - (crop.bottom ?? 0));
    if (sw <= 0 || sh <= 0) return false;

    const drawWidth = targetRect.width * (renderProfile.scaleX ?? 1);
    const drawHeight = targetRect.height * (renderProfile.scaleY ?? 1);
    const anchor = renderProfile.anchor ?? 'center';
    const baseX = anchor === 'topleft' ? targetRect.x : targetRect.x + (targetRect.width - drawWidth) / 2;
    const baseY = anchor === 'topleft' ? targetRect.y : targetRect.y + (targetRect.height - drawHeight) / 2;
    const dx = baseX + (renderProfile.offsetX ?? 0) * this.tile;
    const dy = baseY + (renderProfile.offsetY ?? 0) * this.tile;

    this.ctx.drawImage(image, sx, sy, sw, sh, dx, dy, drawWidth, drawHeight);
    return true;
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

  isLaneSafeForSpawn(y) {
    return y <= GAME_CONFIG.safeZones.guaranteedSafeRows;
  }

  ensureLane(y) {
    if (this.laneCache.has(y)) return;

    const type = this.isLaneSafeForSpawn(y) ? 'grass' : weightedLaneType(GAME_CONFIG.laneWeights);
    const direction = Math.random() > 0.5 ? 1 : -1;
    const lane = { y, type, direction, speed: 0, timer: 0, interval: 2, seed: Math.random() * 1000, warningActive: false };

    if (type === 'road') {
      lane.speed = randRange(1.35, 2.7) + this.score * 0.012;
      lane.interval = randRange(1.75, 2.8);
    } else if (type === 'water') {
      lane.speed = randRange(GAME_CONFIG.riverPlatforms.minSpeed, GAME_CONFIG.riverPlatforms.maxSpeed);
      lane.platformType = randomFrom(GAME_CONFIG.riverPlatforms.laneTypes);
      const platformW = this.getMovingProfile(lane.platformType).render.width;
      const maxIntervalByGap = GAME_CONFIG.riverPlatforms.maxGapSeconds - platformW / lane.speed;
      lane.interval = clamp(
        randRange(GAME_CONFIG.riverPlatforms.minInterval, GAME_CONFIG.riverPlatforms.maxInterval),
        GAME_CONFIG.riverPlatforms.minInterval,
        Math.max(GAME_CONFIG.riverPlatforms.minInterval, maxIntervalByGap)
      );
      this.seedWaterLanePlatforms(lane);
    } else if (type === 'rail') {
      lane.speed = randRange(GAME_CONFIG.railHazard.minSpeed, GAME_CONFIG.railHazard.maxSpeed) + this.score * GAME_CONFIG.railHazard.scoreScale;
      lane.interval = randRange(GAME_CONFIG.railHazard.minInterval, GAME_CONFIG.railHazard.maxInterval);
      lane.warningLead = GAME_CONFIG.trainWarning.leadTime;
      lane.warningActive = false;
      lane.pendingSpawn = false;
    }
    this.laneCache.set(y, lane);
  }

  seedWaterLanePlatforms(lane) {
    const count = GAME_CONFIG.riverPlatforms.minLanePlatformCount;
    for (let i = 0; i < count; i += 1) {
      const spacing = i * (GAME_CONFIG.cols / count);
      const x = lane.direction > 0 ? -1.2 + spacing : GAME_CONFIG.cols + 1.2 - spacing;
      const profile = this.getMovingProfile(lane.platformType);
      this.platforms.push({
        id: this.nextPlatformId++,
        type: lane.platformType,
        x,
        prevX: x,
        y: lane.y,
        dir: lane.direction,
        speed: lane.speed,
        w: profile.render.width,
        h: profile.render.height
      });
    }
  }

  spawnHazard(lane) {
    if (lane.type === 'grass' || lane.type === 'water') return;
    const startX = lane.direction > 0 ? -1.4 : GAME_CONFIG.cols + 1.4;
    const vehicleType = lane.type === 'rail' ? 'maxTrain' : randomFrom(['car1', 'car2', 'car3', 'scooter1', 'bike1']);
    const profile = this.getMovingProfile(vehicleType);
    const h = {
      id: this.nextHazardId++,
      type: vehicleType,
      x: startX,
      prevX: startX,
      y: lane.y,
      dir: lane.direction,
      speed: lane.speed,
      w: profile.render.width,
      h: profile.render.height
    };
    this.hazards.push(h);
  }

  spawnPlatform(lane) {
    if (lane.type !== 'water') return;
    const platformType = lane.platformType ?? randomFrom(GAME_CONFIG.riverPlatforms.laneTypes);
    const startX = lane.direction > 0 ? -1.2 : GAME_CONFIG.cols + 1.2;
    const profile = this.getMovingProfile(platformType);
    this.platforms.push({
      id: this.nextPlatformId++,
      type: platformType,
      x: startX,
      prevX: startX,
      y: lane.y,
      dir: lane.direction,
      speed: lane.speed,
      w: profile.render.width,
      h: profile.render.height
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

      this.coins.push({ id: this.nextCoinId++, x, y, bobSeed: Math.random() * 1000, w: 0.32, h: 0.32 });
      return;
    }
  }

  collectCoinAtPlayer() {
    const playerEntity = this.getPlayerCollisionEntity();
    const coinIndex = this.coins.findIndex((coin) => {
      const coinEntity = this.getCoinCollisionEntity(coin);
      return this.collisionSystem.narrowPhase(playerEntity, 'player', this.player.facing, coinEntity, 'collectible', 'forward', this.tile);
    });
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
    this.player.drawX += (this.player.fx - this.player.drawX) * 0.45;
    this.player.drawY += (this.player.y - this.player.drawY) * 0.34;
    this.player.tilt *= 0.86;
    this.player.stretch = Math.max(0, this.player.stretch - dt * 1.8);
    if (this.player.visualState === 'superJump') {
      this.superJumpVisualTimer = Math.max(0, this.superJumpVisualTimer - dt);
      if (this.superJumpVisualTimer <= 0) this.player.visualState = 'normal';
    }
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

      if (lane.type === 'rail') {
        const untilSpawn = interval - lane.timer;
        lane.warningActive = untilSpawn <= lane.warningLead;
        this.trainWarnings.set(lane.y, {
          active: lane.warningActive,
          phase: Math.sin(this.time * GAME_CONFIG.trainWarning.flashHz * Math.PI * 2)
        });
      }

      if (lane.timer >= interval) {
        lane.timer = 0;
        lane.warningActive = false;
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
      this.maybeTriggerTrainPassShake(hazard);
    }
    this.hazards = this.hazards.filter((h) => h.x > -5 && h.x < GAME_CONFIG.cols + 5);

    for (const platform of this.platforms) {
      platform.prevX = platform.x;
      platform.x += platform.speed * platform.dir * dt;
    }
    this.platforms = this.platforms.filter((p) => p.x > -5 && p.x < GAME_CONFIG.cols + 5);

    this.updateRiverAttachment(dt);

    const minCoinY = this.player.y - 2;
    this.coins = this.coins.filter((coin) => coin.y >= minCoinY);

    this.handleCollisions(dt);
    this.collectCoinAtPlayer();
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      this.shake *= GAME_CONFIG.screenShakeDecay;
    } else {
      this.shake = 0;
    }
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

  findPlatformUnderPoint(x, y) {
    return this.platforms.find((platform) => {
      if (platform.y !== y) return false;
      const entity = this.getPlatformCollisionEntity(platform);
      const broad = this.collisionSystem.getAABB(entity, 'platform', this.tile);
      const laneScreen = this.worldToScreen(0, y).y;
      const playerCenterY = laneScreen + this.tile * 0.5;
      return x * this.tile >= broad.left && x * this.tile <= broad.right && playerCenterY >= broad.top && playerCenterY <= broad.bottom;
    });
  }

  updateRiverAttachment(dt) {
    const lane = this.laneCache.get(this.player.y);
    if (lane?.type !== 'water') {
      this.attachedPlatformId = null;
      return;
    }

    const playerCenterX = this.player.fx + 0.5;
    let platform = this.platforms.find((entry) => entry.id === this.attachedPlatformId && entry.y === this.player.y);
    if (!platform || !this.findPlatformUnderPoint(playerCenterX, this.player.y)) {
      platform = this.findPlatformUnderPoint(playerCenterX, this.player.y);
    }

    if (!platform) {
      this.attachedPlatformId = null;
      return;
    }

    this.attachedPlatformId = platform.id;
    const rideStep = platform.x - platform.prevX;
    this.player.fx += rideStep;
    this.player.fx = clamp(this.player.fx, -0.49, GAME_CONFIG.cols - 0.51);
    this.player.x = clamp(Math.round(this.player.fx), 0, GAME_CONFIG.cols - 1);

    if (this.player.fx <= -0.45 || this.player.fx >= GAME_CONFIG.cols - 0.55) {
      this.kill('You drifted off the floating platform into the river.');
    }
  }

  getPlayerCollisionEntity() {
    const laneScreen = this.worldToScreen(0, this.player.y).y;
    const align = GAME_CONFIG.alignment.player;
    return {
      x: this.player.fx,
      y: this.player.y,
      w: GAME_CONFIG.collisions.profiles.player.width,
      h: GAME_CONFIG.collisions.profiles.player.height,
      screenY: laneScreen + this.tile * align.collisionOffsetY
    };
  }

  getHazardCollisionEntity(hazard) {
    const profile = this.getMovingProfile(hazard.type);
    return {
      ...hazard,
      centerX: this.getMovingCenterX(hazard, profile),
      prevCenterX: hazard.prevX + (profile.collision.offsetX ?? 0),
      centerY: this.getMovingCenterY(hazard.y, profile, 'collision'),
      w: profile.collision.width,
      h: profile.collision.height
    };
  }

  getPlatformCollisionEntity(platform) {
    const profile = this.getMovingProfile(platform.type);
    return {
      ...platform,
      centerX: this.getMovingCenterX(platform, profile),
      prevCenterX: platform.prevX + (profile.collision.offsetX ?? 0),
      centerY: this.getMovingCenterY(platform.y, profile, 'collision'),
      w: profile.collision.width,
      h: profile.collision.height
    };
  }

  getCoinCollisionEntity(coin) {
    const laneScreen = this.worldToScreen(0, coin.y).y;
    return { ...coin, screenY: laneScreen + this.tile * GAME_CONFIG.alignment.collectible.collisionOffsetY };
  }

  handleCollisions(dt) {
    const lane = this.laneCache.get(this.player.y);
    if (!lane) return;

    const playerEntity = this.getPlayerCollisionEntity();

    for (const h of this.hazards) {
      if (Math.abs(h.y - this.player.y) > 0.25) continue;
      const hazardEntity = this.getHazardCollisionEntity(h);
      const playerBroad = this.collisionSystem.getAABB(playerEntity, 'player', this.tile);
      const hazardBroad = this.collisionSystem.getAABB(hazardEntity, this.getMovingProfile(h.type).collision.type, this.tile, {
        swept: true
      });
      if (!this.collisionSystem.broadPhase(playerBroad, hazardBroad)) continue;

      const hit = this.collisionSystem.narrowPhase(
        playerEntity,
        'player',
        this.player.facing,
        hazardEntity,
        this.getMovingProfile(h.type).collision.type,
        'forward',
        this.tile
      );
      if (hit) {
        this.kill(h.type === 'maxTrain' ? 'A MAX train blasted through your lane.' : 'Portland traffic cut off your route.');
        return;
      }

      if (lane.type === 'road') {
        const near = Math.abs(this.getMovingCenterX(h, this.getMovingProfile(h.type)) - (this.player.fx + 0.5));
        const now = performance.now();
        if (near < 0.65 && !this.nearMisses.has(h.id) && now - this.lastNearMissAt > 120) {
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
      const platform = this.findPlatformUnderPoint(this.player.fx + 0.5, this.player.y);
      if (!platform) {
        this.attachedPlatformId = null;
        this.kill('The Willamette rain runoff swept you away.');
      }
    }
  }

  kill(message) {
    if (this.state !== GAME_STATES.PLAYING) return;
    this.state = GAME_STATES.GAME_OVER;
    this.audio.play('hit');
    this.triggerScreenShake(GAME_CONFIG.effects.deathShake);
    this.spawnBurst('#c56f5c', 26);
    this.onGameOver?.({ score: this.score, message });
  }

  maybeTriggerTrainPassShake(hazard) {
    if (hazard.type !== 'maxTrain' || hazard.didShake) return;
    if (Math.abs(hazard.y - this.player.y) > 6) return;

    const profile = this.getMovingProfile(hazard.type);
    const prevCenter = hazard.prevX + (profile.collision.offsetX ?? 0);
    const currentCenter = hazard.x + (profile.collision.offsetX ?? 0);
    const playerCenter = this.player.fx + 0.5;

    const crossedPlayer =
      (prevCenter <= playerCenter && currentCenter >= playerCenter) ||
      (prevCenter >= playerCenter && currentCenter <= playerCenter);

    if (!crossedPlayer) return;

    hazard.didShake = true;
    this.triggerScreenShake(GAME_CONFIG.effects.maxTrainPassShake);
  }

  triggerScreenShake({ intensity, duration }) {
    this.shake = Math.max(this.shake, intensity);
    this.shakeTimer = Math.max(this.shakeTimer, duration);
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
    this.drawCollisionDebug();
    ctx.restore();
  }

  worldToScreen(x, y) {
    return { x: x * this.tile, y: this.worldHeight - (y - this.cameraY + 1) * this.tile };
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
        const riverTile = this.environmentSprites.riverTile;
        if (riverTile?.complete) ctx.drawImage(riverTile, 0, pos.y, this.worldWidth, this.tile);
        else {
          ctx.fillStyle = '#34576d';
          ctx.fillRect(0, pos.y, this.worldWidth, this.tile);
        }

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

        const warning = this.trainWarnings.get(y);
        if (warning?.active) {
          const alpha = warning.phase > 0 ? 0.55 : 0.2;
          ctx.fillStyle = `rgba(200, 54, 54, ${alpha})`;
          ctx.fillRect(0, pos.y + this.tile * 0.06, this.worldWidth, this.tile * 0.88);
          ctx.fillStyle = `rgba(255, 240, 240, ${Math.max(0.24, alpha - 0.08)})`;
          ctx.beginPath();
          ctx.arc(this.worldWidth - 20, pos.y + this.tile * 0.5, 9, 0, Math.PI * 2);
          ctx.arc(20, pos.y + this.tile * 0.5, 9, 0, Math.PI * 2);
          ctx.fill();
        }
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
      const treeSprite = this.environmentSprites.tree1;
      for (let i = 0; i < 3; i += 1) {
        const px = (i * 2 + seedOffset) * this.tile * 0.9;
        if (treeSprite?.complete) {
          ctx.drawImage(treeSprite, px + 8, y + this.tile * 0.15, this.tile * 0.32, this.tile * 0.44);
        } else {
          ctx.fillStyle = '#2c4b36';
          ctx.beginPath();
          ctx.moveTo(px + 20, y + this.tile * 0.24);
          ctx.lineTo(px + 8, y + this.tile * 0.58);
          ctx.lineTo(px + 32, y + this.tile * 0.58);
          ctx.closePath();
          ctx.fill();
        }
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
      const profile = this.getMovingProfile(p.type);
      const { x, y, width, height } = this.getMovingDrawRect(p, profile);

      const sprite = this.hazardSprites[p.type];
      if (this.drawSpriteWithRenderProfile(sprite, { x, y, width, height }, p.type)) {
        // image path drawn
      } else if (p.type === 'raft1') {
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
        for (let i = 0; i < 4; i += 1) ctx.fillRect(x + i * (width / 4), y + height * 0.2, 2, height * 0.6);
      }

      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(x + 5, y + height - 4, Math.max(8, width - 10), 4);
    }
  }

  drawHazards() {
    const ctx = this.ctx;
    for (const h of this.hazards) {
      const profile = this.getMovingProfile(h.type);
      const { x, y, width, height } = this.getMovingDrawRect(h, profile);

      const spriteKey = h.type === 'maxTrain' ? 'maxTrain' : STANDARD_ROAD_VEHICLE_ASSET_KEY;
      const sprite = this.vehicleSprites[spriteKey];
      if (this.drawSpriteWithRenderProfile(sprite, { x, y, width, height }, spriteKey)) {
        // image path drawn
      } else {
        if (h.type.startsWith('car')) {
          ctx.fillStyle = '#9a4f3d';
          ctx.fillRect(x, y, width, height);
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(x + 10, y + 9, width * 0.3, 10);
        } else if (h.type === 'scooter1') {
          ctx.fillStyle = '#2c8f71';
          ctx.fillRect(x, y + height * 0.35, width, height * 0.28);
        } else if (h.type === 'bike1') {
          ctx.fillStyle = '#59685a';
          ctx.fillRect(x, y + height * 0.35, width, height * 0.22);
        } else {
          ctx.fillStyle = '#1e8a5a';
          ctx.fillRect(x, y, width, height);
        }
      }

      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x + 6, y + height - 8, Math.max(10, width - 12), 5);
    }
  }

  drawCoins() {
    const ctx = this.ctx;
    const coinSprite = this.collectibleSprites.coin;
    for (const coin of this.coins) {
      const pos = this.worldToScreen(coin.x, coin.y);
      const bob = Math.sin(this.time * 5 + coin.bobSeed) * this.tile * 0.06;
      const cx = (coin.x + 0.5) * this.tile;
      const cy = pos.y + this.tile * (0.45 + GAME_CONFIG.alignment.collectible.renderOffsetY) + bob;
      const drawSize = this.tile * 0.34;
      if (coinSprite?.complete) {
        this.drawSpriteWithRenderProfile(
          coinSprite,
          { x: cx - drawSize / 2, y: cy - drawSize / 2, width: drawSize, height: drawSize },
          'coin'
        );
      } else {
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
  }

  drawPlayer() {
    const ctx = this.ctx;
    const pos = this.worldToScreen(this.player.drawX, this.player.drawY);
    const w = this.tile * (0.58 + this.player.stretch * 0.24);
    const h = this.tile * (0.62 - this.player.stretch * 0.16);
    const x = pos.x + (this.tile - w) / 2;
    const y = pos.y + (this.tile - h) * (0.5 + GAME_CONFIG.alignment.player.renderOffsetY);

    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(this.player.tilt);
    ctx.translate(-(x + w / 2), -(y + h / 2));

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.95, w * 0.4, h * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    const sprite = this.player.visualState === 'superJump' ? this.playerSprites.superJump : this.playerSprites[this.player.facing];
    if (!this.drawSpriteWithRenderProfile(sprite, { x, y, width: w, height: h }, 'player')) {
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

  drawCollisionDebug() {
    if (!this.collisionSystem.debugEnabled) return;
    // Toggle with the dev key in config (default: C) to visualize broad boxes, mask footprint, and ride zones.
    const entries = [
      { entity: this.getPlayerCollisionEntity(), type: 'player', orientation: this.player.facing, color: 'rgba(245, 219, 111, 0.7)', showMask: true }
    ];

    for (const h of this.hazards) {
      const profile = this.getMovingProfile(h.type);
      entries.push({
        entity: this.getHazardCollisionEntity(h),
        type: profile.collision.type,
        color: 'rgba(238, 104, 104, 0.7)',
        swept: true,
        showMask: false
      });
    }

    for (const p of this.platforms) {
      entries.push({ entity: this.getPlatformCollisionEntity(p), type: 'platform', color: p.id === this.attachedPlatformId ? 'rgba(107, 236, 146, 0.9)' : 'rgba(111, 214, 170, 0.7)', showMask: false });
    }

    for (const coin of this.coins) {
      entries.push({ entity: this.getCoinCollisionEntity(coin), type: 'collectible', color: 'rgba(255, 221, 111, 0.7)', showMask: false });
    }

    const lane = this.laneCache.get(this.player.y);
    if (lane?.type === 'water') {
      const waterY = this.worldToScreen(0, this.player.y).y;
      this.ctx.strokeStyle = 'rgba(84, 172, 219, 0.8)';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(0, waterY + 2, this.worldWidth, this.tile - 4);
    }

    this.collisionSystem.drawDebug(this.ctx, entries, this.tile);
  }
}
