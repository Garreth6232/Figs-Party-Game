import { ASSET_MANIFEST, ENTITY_LANE_RULES, GAME_CONFIG, GAME_STATES, LANE_DEFINITIONS, STORAGE_KEYS } from './config.js';
import { CollisionSystem } from './collision.js';
import { TerrainSystem } from './terrain-system.js';
import { DEATH_CAUSES, getDeathMessage } from './death-messages.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const randRange = (min, max) => Math.random() * (max - min) + min;
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - ((-2 * t + 2) ** 3) / 2);
const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};
const hash01 = (value) => {
  const x = Math.sin(value * 12.9898 + 78.233) * 43758.5453123;
  return x - Math.floor(x);
};

const createRunSeed = () => {
  const now = Date.now() >>> 0;
  const perf = Math.floor((performance.now?.() ?? 0) * 1000) >>> 0;
  const noise = Math.floor(Math.random() * 0xffffffff) >>> 0;
  return (now ^ (perf << 11) ^ (noise >>> 3)) >>> 0;
};

class RunRng {
  constructor(seed) {
    this.state = (seed >>> 0) || 1;
  }

  next() {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  range(min, max) {
    return min + (max - min) * this.next();
  }

  int(minInclusive, maxExclusive) {
    return Math.floor(this.range(minInclusive, maxExclusive));
  }

  pick(list) {
    if (!Array.isArray(list) || list.length === 0) return null;
    return list[this.int(0, list.length)];
  }
}

const DEFAULT_MOVING_PROFILE = {
  render: { width: 1, height: 0.6, offsetX: 0, offsetY: 0 }
};
const CAR_RENDER_KEYS = ['car1', 'car2', 'car3', 'bike1', 'scooter1'];


export class Game {
  constructor({ canvas, audio, ui, runtimeSettings, onGameOver = null }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = audio;
    this.ui = ui;
    this.state = GAME_STATES.MENU;
    this.onGameOver = onGameOver;
    this.runtimeSettings = runtimeSettings;
    this.best = Number(localStorage.getItem(STORAGE_KEYS.bestScore) ?? 0);
    this.playerSprites = {};
    this.environmentSprites = {};
    this.collectibleSprites = {};
    this.vehicleSprites = {};
    this.hazardSprites = {};
    this.superJumpVisualTimer = 0;
    this.superJumpState = null;
    this.collisionSystem = new CollisionSystem();
    this.initializeRunRandomness();
    this.terrainDebugEnabled = false;
    this.resetRuntimeGameplaySettings();
    this.missingAssets = new Set();
    this.resize();
    this.loadSprites();
    // Watching the canvas itself also catches mobile URL-bar and orientation changes.
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => this.resize()).observe(this.canvas);
    else window.addEventListener('resize', () => this.resize());
    this.reset();
  }

  loadSprites() {
    const registerImage = (bucket, key, src) => {
      if (!src || typeof src !== 'string') return;
      const image = new Image();
      image.src = src;
      image.decoding = 'async';
      image.loading = 'eager';
      image.onerror = () => {
        const record = `${key}:${src}`;
        this.missingAssets.add(record);
        console.warn(`[Asset Missing] ${record}`);
      };
      bucket[key] = image;
    };

    const sprites = ASSET_MANIFEST.player;
    const playerMap = {
      forward: sprites.figForward,
      left: sprites.figLeft,
      right: sprites.figRight,
      back: sprites.figBack,
      superJump: sprites.figSJ
    };
    for (const [direction, src] of Object.entries(playerMap)) {
      registerImage(this.playerSprites, direction, src);
    }

    const worldSprites = {
      grassTile: ASSET_MANIFEST.environment.grassTile,
      riverTile: ASSET_MANIFEST.environment.riverTile,
      roadTile: ASSET_MANIFEST.environment.roadTile,
      railTile: ASSET_MANIFEST.environment.railTile,
      sidewalkTile: ASSET_MANIFEST.environment.sidewalkTile,
      tree1: ASSET_MANIFEST.environment.tree1,
      foodCart: ASSET_MANIFEST.environment.foodCart,
      benson1: ASSET_MANIFEST.environment.benson1,
      portlandOregonSign: ASSET_MANIFEST.environment.portlandOregonSign,
      sign1: ASSET_MANIFEST.environment.sign1,
      sign2: ASSET_MANIFEST.environment.sign2,
      sign3: ASSET_MANIFEST.environment.sign3,
      sign4: ASSET_MANIFEST.environment.sign4,
      sign5: ASSET_MANIFEST.environment.sign5,
      bookstore1: ASSET_MANIFEST.environment.bookstore1,
      coin: ASSET_MANIFEST.collectibles.coin
    };

    for (const [key, src] of Object.entries(worldSprites)) {
      if (key === 'coin') registerImage(this.collectibleSprites, key, src);
      else registerImage(this.environmentSprites, key, src);
    }

    for (const [key, src] of Object.entries(ASSET_MANIFEST.vehicles)) {
      registerImage(this.vehicleSprites, key, src);
    }

    for (const [key, src] of Object.entries(ASSET_MANIFEST.hazards)) {
      registerImage(this.hazardSprites, key, src);
    }
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    if (this.worldWidth && (!rect.width || !rect.height)) return;
    if (rect.width === this.worldWidth && rect.height === this.worldHeight && dpr === this.dpr) return;
    this.dpr = dpr;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.worldWidth = rect.width;
    this.worldHeight = rect.height;
    this.tile = this.worldWidth / GAME_CONFIG.cols;
    this.laneGradients = new Map();
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

  resetRuntimeGameplaySettings() {
    this.runtimeLaneLabelsVisible = true;
    this.runtimeHitboxOpacity = 0.7;
    this.runtimeRenderScale = { player: 1, car: 1, train: 1 };
    this.runtimePropDensity = 1;
    this.runtimeTrafficSpeedMultiplier = 1;
    this.runtimeRiverDensity = 1;
    this.runtimeCameraOffsetRows = 3;
    this.runtimeSuperJumpDistance = GAME_CONFIG.superJump.launchDistance;
    this.runtimeCoinsPerSuperJump = GAME_CONFIG.coins.coinsNeededForSuperJump;
    this.runtimeCoinSpawnChance = GAME_CONFIG.coins.spawnChancePerSecond;
    this.runtimeTrainWarningLead = GAME_CONFIG.trainWarning.leadTime;
    this.baseConfig = { baseMoveCooldown: GAME_CONFIG.baseMoveCooldown };
  }

  reset() {
    // Recovery mode: ignore persisted runtime overrides during resets until core gameplay stability is confirmed.
    this.resetRuntimeGameplaySettings();
    this.initializeRunRandomness();
    this.player = {
      x: Math.floor(GAME_CONFIG.cols / 2),
      fx: Math.floor(GAME_CONFIG.cols / 2),
      y: GAME_CONFIG.startY,
      drawX: Math.floor(GAME_CONFIG.cols / 2),
      drawY: GAME_CONFIG.startY,
      hop: null,
      hopLift: 0,
      stretch: 0,
      tilt: 0,
      facing: 'forward',
      visualState: 'normal',
      superJumpEnergy: 0,
      superJumpPhase: 'idle'
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
    this.lastNearMissAt = 0;
    this.lastMoveAt = 0;
    this.queuedMove = null;
    this.pruneTimer = 0;
    this.time = 0;
    this.superJumpVisualTimer = 0;
    this.superJumpState = null;
    this.cameraY = this.player.y - this.runtimeCameraOffsetRows;
    this.shake = 0;
    this.shakeTimer = 0;
    this.nextHazardId = 1;
    this.nextPlatformId = 1;
    this.nextCoinId = 1;
    this.attachedPlatformId = null;
    this.laneCache = new Map();
    this.trainWarnings = new Map();
    this.bridgeEncounters = new Map();
    this.activeBridgeEncounterId = null;
    this.propRuntime = this.createPropRuntimeState();
    for (let y = -6; y < 80; y += 1) this.ensureLane(y);
    this.ui.updateScore(this.score);
    this.ui.updateBest(this.best);
    this.ui.updateCoins(this.coinCount, this.runtimeCoinsPerSuperJump);
    this.ui.updateSuperJumps(this.superJumps);
  }

  start() {
    this.reset();
    this.state = GAME_STATES.PLAYING;
  }

  initializeRunRandomness() {
    this.runSeed = createRunSeed();
    this.runRng = new RunRng(this.runSeed);
    this.worldSeed = this.runSeed % 1000000;
    this.terrainSystem = new TerrainSystem({
      gameConfig: GAME_CONFIG,
      laneDefinitions: LANE_DEFINITIONS,
      worldSeed: this.worldSeed
    });
  }

  setState(nextState) {
    this.state = nextState;
  }

  toggleCollisionDebug() {
    const enabled = this.collisionSystem.toggleDebug();
    this.ui.showToast(`Collision debug ${enabled ? 'ON' : 'OFF'}`, 'info');
    return enabled;
  }

  toggleTerrainDebug() {
    this.terrainDebugEnabled = !this.terrainDebugEnabled;
    this.ui.showToast(`Terrain debug ${this.terrainDebugEnabled ? 'ON' : 'OFF'}`, 'info');
    return this.terrainDebugEnabled;
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
    if (this.superJumpState?.active && GAME_CONFIG.superJump.inputLocked) return;
    this.queuedMove = { dir, at: performance.now() };
    this.processQueuedMove();
  }

  // Moves pressed during the hop cooldown wait briefly instead of being dropped.
  processQueuedMove() {
    const queued = this.queuedMove;
    if (!queued) return;
    const now = performance.now();
    if (now - queued.at > GAME_CONFIG.movement.inputBufferMs) {
      this.queuedMove = null;
      return;
    }
    if (now - this.lastMoveAt < this.getCurrentMoveCooldown()) return;
    this.queuedMove = null;
    this.performMove(queued.dir, now);
  }

  performMove(dir, now) {
    const facingMap = { up: 'back', down: 'forward', left: 'left', right: 'right' };
    this.player.facing = facingMap[dir] ?? this.player.facing;

    let nx = this.player.fx;
    let ny = this.player.y;
    if (dir === 'up') ny += 1;
    if (dir === 'down') ny -= 1;
    if (dir === 'left') nx -= 1;
    if (dir === 'right') nx += 1;
    ny = Math.max(-2, ny);
    this.ensureLane(ny);
    // On the river Fig keeps her exact spot so she lands where she is looking; elsewhere she snaps to the grid.
    if (this.laneCache.get(ny)?.type !== 'water') nx = clamp(Math.round(nx), 0, GAME_CONFIG.cols - 1);
    else if (nx < -0.49 || nx > GAME_CONFIG.cols - 0.51) nx = this.player.fx;
    if (nx === this.player.fx && ny === this.player.y) return;

    const dx = nx - this.player.fx;
    this.player.hop = { fromX: this.player.drawX, fromY: this.player.drawY, elapsed: 0 };
    this.player.x = clamp(Math.round(nx), 0, GAME_CONFIG.cols - 1);
    this.player.fx = nx;
    this.player.y = ny;
    this.attachedPlatformId = null;
    this.player.tilt = Math.sign(dx) * 0.2;
    this.player.stretch = 0.15;
    this.spawnHopParticles();
    this.audio.play('hop');
    this.lastMoveAt = now;

    this.handleProgressScore();
    this.collectCoinAtPlayer();

    for (let y = this.player.y - 8; y < this.player.y + 40; y += 1) this.ensureLane(y);
  }

  useSuperJump() {
    if (this.state !== GAME_STATES.PLAYING || this.superJumps < 1 || this.superJumpState?.active) return;
    const distance = this.runtimeSuperJumpDistance ?? GAME_CONFIG.superJump.launchDistance ?? GAME_CONFIG.coins.superJumpDistance;
    const targetY = this.player.y + distance;
    const landing = this.findSafeLandingSpot(targetY);

    this.superJumps -= 1;
    this.ui.updateSuperJumps(this.superJumps);
    this.ui.showToast('SUPER JUMP!', 'success');
    this.audio.play('super_use');

    const phaseConfig = GAME_CONFIG.superJump.phases;
    const phaseTotal = phaseConfig.charge + phaseConfig.lift + phaseConfig.launch + phaseConfig.settle;
    const totalDuration = phaseTotal;

    this.player.facing = 'back';
    this.player.visualState = 'superJump';
    this.player.hop = null;
    this.player.hopLift = 0;
    this.queuedMove = null;
    this.superJumpVisualTimer = totalDuration;
    this.attachedPlatformId = null;
    this.triggerScreenShake({ intensity: GAME_CONFIG.superJump.cameraPunch, duration: 0.14 });
    this.spawnBurst('#d9bd70', 20);
    this.spawnBurst('#f7f0c4', 14);

    this.superJumpState = {
      active: true,
      elapsed: 0,
      totalDuration,
      phases: phaseConfig,
      startX: this.player.fx,
      startY: this.player.y,
      targetX: landing.x,
      targetY: landing.y,
      liftHeight: GAME_CONFIG.superJump.liftHeight
    };

    for (let y = this.player.y - 8; y < landing.y + 45; y += 1) this.ensureLane(y);
  }

  updateSuperJump(dt) {
    if (!this.superJumpState?.active) return;

    const sj = this.superJumpState;
    sj.elapsed = Math.min(sj.totalDuration, sj.elapsed + dt);
    const t = sj.elapsed;
    const { charge, lift, launch, settle } = sj.phases;
    const liftStart = charge;
    const launchStart = charge + lift;
    const settleStart = launchStart + launch;
    const laneDelta = sj.targetY - sj.startY;

    let x = sj.startX;
    let y = sj.startY;
    let arc = 0;
    let tilt = 0;
    let stretch = 0;
    let energy = 0;
    let phase = 'charge';

    if (t < liftStart) {
      const p = t / charge;
      phase = 'charge';
      stretch = 0.1 + Math.sin(p * Math.PI) * 0.05;
      energy = 0.35 + p * 0.3;
      tilt = Math.sin(p * Math.PI * 4) * 0.02;
    } else if (t < launchStart) {
      const p = (t - liftStart) / lift;
      phase = 'lift';
      const eased = easeOutCubic(p);
      y = sj.startY + laneDelta * 0.12 * eased;
      arc = sj.liftHeight * eased;
      stretch = 0.2 + Math.sin(p * Math.PI) * 0.1;
      energy = 0.65 + p * 0.35;
      tilt = 0.05 * p;
    } else if (t < settleStart) {
      const p = (t - launchStart) / launch;
      phase = 'launch';
      const eased = easeInOutCubic(p);
      x = lerp(sj.startX, sj.targetX, eased);
      y = sj.startY + laneDelta * (0.12 + 0.88 * eased);
      arc = sj.liftHeight * (1 - p * 0.88);
      stretch = 0.12 + (1 - p) * 0.16;
      energy = 1;
      tilt = 0.07 * (1 - p);
      if (p > 0.15 && p < 0.85 && Math.random() < 0.35) this.spawnSuperJumpTrail();
    } else {
      const p = (t - settleStart) / settle;
      phase = 'settle';
      const eased = easeOutBack(Math.min(1, p));
      x = lerp(sj.startX, sj.targetX, 1);
      y = lerp(sj.startY + laneDelta, sj.targetY, Math.min(1, eased));
      arc = Math.max(0, sj.liftHeight * 0.2 * (1 - p));
      stretch = Math.max(0, 0.14 * (1 - p));
      energy = 0.3 * (1 - p);
      tilt = 0;
    }

    this.player.fx = x;
    this.player.x = clamp(Math.round(x), 0, GAME_CONFIG.cols - 1);
    this.player.y = y;
    this.player.drawX = x;
    this.player.drawY = y + arc;
    this.player.tilt = tilt;
    this.player.stretch = stretch;
    this.player.superJumpEnergy = energy;
    this.player.superJumpPhase = phase;

    if (sj.elapsed >= sj.totalDuration) {
      this.completeSuperJump();
    }
  }

  completeSuperJump() {
    if (!this.superJumpState?.active) return;
    const sj = this.superJumpState;
    this.player.fx = sj.targetX;
    this.player.x = clamp(Math.round(sj.targetX), 0, GAME_CONFIG.cols - 1);
    this.player.y = sj.targetY;
    this.player.drawX = sj.targetX;
    this.player.drawY = sj.targetY;
    this.player.tilt = 0;
    this.player.stretch = 0;
    this.player.superJumpEnergy = 0;
    this.player.superJumpPhase = 'idle';
    this.player.visualState = 'normal';
    this.superJumpVisualTimer = 0;
    this.superJumpState = null;
    this.snapToNearbyPlatform();
    this.spawnBurst('#d9bd70', 24);
    this.spawnBurst('#9fb8aa', 10);

    this.handleProgressScore();
    this.collectCoinAtPlayer();
  }

  findSafeLandingSpot(targetY) {
    const scanDepth = 10;
    const lowestY = Math.max(this.player.y + 1, targetY - scanDepth);
    // Traffic keeps moving during the 2.5s jump, so grass is the only landing that stays safe.
    for (let y = targetY; y >= lowestY; y -= 1) {
      this.ensureLane(y);
      if (this.laneCache.get(y)?.type === 'grass') return { x: this.player.x, y };
    }
    for (let y = targetY; y >= lowestY; y -= 1) {
      const lane = this.laneCache.get(y);
      if (lane?.type === 'road' && !this.hasBlockingHazard(this.player.x + 0.5, y)) return { x: this.player.x, y };
      if (lane?.type === 'water' && this.findPlatformUnderPoint(this.player.x + 0.5, y)) return { x: this.player.x, y };
    }
    return { x: this.player.x, y: lowestY };
  }

  // On landing in the river, step onto the nearest platform within reach.
  snapToNearbyPlatform() {
    if (this.laneCache.get(this.player.y)?.type !== 'water') return;
    if (this.findPlatformUnderPoint(this.player.fx + 0.5, this.player.y)) return;
    const nearest = this.platforms
      .filter((platform) => platform.y === this.player.y && platform.x > 0 && platform.x < GAME_CONFIG.cols)
      .sort((a, b) => Math.abs(a.x - this.player.fx - 0.5) - Math.abs(b.x - this.player.fx - 0.5))[0];
    if (!nearest || Math.abs(nearest.x - this.player.fx - 0.5) > 1.5) return;
    this.player.fx = clamp(nearest.x - 0.5, 0, GAME_CONFIG.cols - 1);
    this.player.x = Math.round(this.player.fx);
    this.player.drawX = this.player.fx;
  }

  hasBlockingHazard(centerX, y, padding = 0.55) {
    return this.hazards.some((h) => h.y === y && Math.abs(h.x - centerX) < this.getVisibleLengthTiles(h.type) / 2 + padding);
  }

  getMovingProfile(type) {
    return GAME_CONFIG.movingEntities.profiles[type] ?? DEFAULT_MOVING_PROFILE;
  }

  getMovingDrawRect(entity, profile = this.getMovingProfile(entity.type)) {
    const { render } = profile;
    const centerX = (entity.x + (render.offsetX ?? 0)) * this.tile;
    const centerY = this.worldToScreen(0, entity.y).y + this.tile * (0.5 + (render.offsetY ?? 0));
    const width = render.width * this.tile;
    const height = render.height * this.tile;
    return { x: centerX - width / 2, y: centerY - height / 2, width, height };
  }

  getRuntimeRenderScale(renderProfileKey) {
    if (renderProfileKey === 'player') return this.runtimeRenderScale.player;
    if (renderProfileKey === 'maxTrain') return this.runtimeRenderScale.train;
    if (CAR_RENDER_KEYS.includes(renderProfileKey)) return this.runtimeRenderScale.car;
    return 1;
  }

  // The exact screen rectangle a sprite is drawn into. Hitboxes use the same rectangle.
  getSpriteRect(targetRect, renderProfileKey) {
    const renderProfile = GAME_CONFIG.renderProfiles[renderProfileKey] ?? {};
    const runtimeScale = this.getRuntimeRenderScale(renderProfileKey);
    const width = targetRect.width * (renderProfile.scaleX ?? 1) * runtimeScale;
    const height = targetRect.height * (renderProfile.scaleY ?? 1) * runtimeScale;
    const anchor = renderProfile.anchor ?? 'center';
    const baseX = anchor === 'topleft' ? targetRect.x : targetRect.x + (targetRect.width - width) / 2;
    const baseY = anchor === 'topleft' ? targetRect.y : targetRect.y + (targetRect.height - height) / 2;
    return {
      x: baseX + (renderProfile.offsetX ?? 0) * this.tile,
      y: baseY + (renderProfile.offsetY ?? 0) * this.tile,
      width,
      height
    };
  }

  drawSpriteWithRenderProfile(image, targetRect, renderProfileKey, { flipX = false } = {}) {
    if (!image?.complete || image.naturalWidth === 0 || image.naturalHeight === 0) return false;
    const crop = GAME_CONFIG.renderProfiles[renderProfileKey]?.crop ?? {};
    const sx = image.naturalWidth * (crop.left ?? 0);
    const sy = image.naturalHeight * (crop.top ?? 0);
    const sw = image.naturalWidth * (1 - (crop.left ?? 0) - (crop.right ?? 0));
    const sh = image.naturalHeight * (1 - (crop.top ?? 0) - (crop.bottom ?? 0));
    if (sw <= 0 || sh <= 0) return false;

    const rect = this.getSpriteRect(targetRect, renderProfileKey);
    if (flipX) {
      this.ctx.save();
      this.ctx.translate(rect.x + rect.width, rect.y);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(image, sx, sy, sw, sh, 0, 0, rect.width, rect.height);
      this.ctx.restore();
    } else {
      this.ctx.drawImage(image, sx, sy, sw, sh, rect.x, rect.y, rect.width, rect.height);
    }
    return true;
  }

  getEntitySprite(type) {
    return this.vehicleSprites[type] ?? this.hazardSprites[type];
  }

  isEntityFlipped(entity, profile = this.getMovingProfile(entity.type)) {
    return Boolean(profile.facesLeft) && entity.motionAxis !== 'y' && entity.dir > 0;
  }

  getEntityShape(entity) {
    const profile = this.getMovingProfile(entity.type);
    return {
      ...this.getSpriteRect(this.getMovingDrawRect(entity, profile), entity.type),
      mask: this.collisionSystem.getMask(this.getEntitySprite(entity.type), GAME_CONFIG.renderProfiles[entity.type]?.crop),
      flipX: this.isEntityFlipped(entity, profile)
    };
  }

  // Length of the visible part of a sprite, in tiles. Used to space traffic by what you can see.
  getVisibleLengthTiles(type) {
    const profile = this.getMovingProfile(type);
    const renderProfile = GAME_CONFIG.renderProfiles[type] ?? {};
    const mask = this.collisionSystem.getMask(this.getEntitySprite(type), renderProfile.crop);
    const width = profile.render.width * (renderProfile.scaleX ?? 1) * this.getRuntimeRenderScale(type);
    return width * (mask.maxU - mask.minU);
  }

  getPlayerSprite() {
    return this.player.visualState === 'superJump' ? this.playerSprites.superJump : this.playerSprites[this.player.facing];
  }

  getPlayerRect(drawX, drawY, stretch = 0) {
    const pos = this.worldToScreen(drawX, drawY);
    const width = this.tile * (0.58 + stretch * 0.24);
    const height = this.tile * (0.62 - stretch * 0.16);
    return {
      x: pos.x + (this.tile - width) / 2,
      y: pos.y + (this.tile - height) * (0.5 + GAME_CONFIG.alignment.player.renderOffsetY),
      width,
      height
    };
  }

  // Fig's hitbox follows where she is drawn (mid-hop too), minus the squash-and-stretch.
  getPlayerShape() {
    return {
      ...this.getSpriteRect(this.getPlayerRect(this.player.drawX, this.player.drawY), 'player'),
      mask: this.collisionSystem.getMask(this.getPlayerSprite(), GAME_CONFIG.renderProfiles.player.crop),
      scale: GAME_CONFIG.collisions.playerForgiveness
    };
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

  getLaneDefinition(laneType) {
    return LANE_DEFINITIONS[laneType] ?? LANE_DEFINITIONS.grass;
  }

  getLaneGameplayType(lane) {
    if (!lane) return 'grass';
    return lane.gameplayType ?? lane.type ?? 'grass';
  }

  laneAllowsEntityType(lane, entityType, entityKind) {
    if (!lane || !entityType || !entityKind) return false;
    const gameplayType = this.getLaneGameplayType(lane);
    const laneDef = this.getLaneDefinition(gameplayType);
    const allowedByLaneDefinition = entityKind === 'hazards'
      ? laneDef.allowedHazards.includes(entityType)
      : laneDef.allowedPlatforms.includes(entityType);
    if (!allowedByLaneDefinition) return false;
    const allowedLaneTypes = ENTITY_LANE_RULES[entityKind]?.[entityType];
    if (!allowedLaneTypes) return false;
    return allowedLaneTypes.includes(gameplayType);
  }

  createPropRuntimeState() {
    const early = GAME_CONFIG.props.earlyLandmarkDistance;
    const large = GAME_CONFIG.props.largeLandmarkDistance;
    const earlyLandmarkY = this.player.y + Math.round(this.runRng.range(early.min, early.max));
    const bookstoreY = this.player.y + Math.round(this.runRng.range(large.min, large.max));
    const signs = GAME_CONFIG.props.rules.streetSigns.family.filter((key) => this.canUseDecorAsset(key));
    for (let i = signs.length - 1; i > 0; i -= 1) {
      const j = Math.floor(hash01(this.worldSeed + i * 1.27) * (i + 1));
      [signs[i], signs[j]] = [signs[j], signs[i]];
    }
    return {
      landmarksSpawned: new Set(),
      earlyLandmarkY,
      bookstoreY,
      streetSignBag: signs,
      lastStreetSign: null
    };
  }

  nextStreetSignAsset() {
    if (!this.propRuntime.streetSignBag.length) {
      this.propRuntime.streetSignBag = GAME_CONFIG.props.rules.streetSigns.family.filter((key) => this.canUseDecorAsset(key));
    }
    if (!this.propRuntime.streetSignBag.length) return null;
    let key = this.propRuntime.streetSignBag.shift();
    if (key === this.propRuntime.lastStreetSign && this.propRuntime.streetSignBag.length > 0) {
      this.propRuntime.streetSignBag.push(key);
      key = this.propRuntime.streetSignBag.shift();
    }
    this.propRuntime.lastStreetSign = key;
    return key;
  }

  resolveDecorSpawnGroup(groupKey) {
    if (!groupKey) return [];
    const groupRule = GAME_CONFIG.props.rules?.[groupKey];
    if (groupRule?.family) return groupRule.family;
    return [groupKey];
  }

  areDecorAssetsMutuallyExclusive(assetA, assetB) {
    if (!assetA || !assetB) return false;
    const exclusions = GAME_CONFIG.props.rules?.mutualExclusions ?? {};
    const groupsA = exclusions[assetA] ?? [];
    const groupsB = exclusions[assetB] ?? [];
    const blockedByA = groupsA.some((groupKey) => this.resolveDecorSpawnGroup(groupKey).includes(assetB));
    if (blockedByA) return true;
    return groupsB.some((groupKey) => this.resolveDecorSpawnGroup(groupKey).includes(assetA));
  }

  canSpawnDecorWithLaneProps(assetKey, laneAssetKeys) {
    if (!assetKey) return false;
    for (const existingAsset of laneAssetKeys) {
      if (this.areDecorAssetsMutuallyExclusive(assetKey, existingAsset)) return false;
    }
    return true;
  }

  canUseDecorAsset(assetKey) {
    if (!assetKey) return false;
    const path = ASSET_MANIFEST.environment?.[assetKey];
    if (!path) return false;
    const hasRecord = [...this.missingAssets].some((entry) => entry.startsWith(`${assetKey}:`));
    return !hasRecord;
  }

  createDecorProp(assetKey, lane, options = {}) {
    if (!this.canUseDecorAsset(assetKey)) return null;
    const width = options.width ?? 0.5;
    const height = options.height ?? 0.5;
    const offsetY = options.offsetY ?? 0.5;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
    if (!Number.isFinite(offsetY)) return null;
    const anchor = options.anchor ?? (lane.direction > 0 ? 'right' : 'left');
    const edgePadding = options.edgePadding ?? 0.28;
    const x =
      anchor === 'right' || anchor === 'edge'
        ? GAME_CONFIG.cols - width - edgePadding
        : edgePadding;
    const maxX = GAME_CONFIG.cols - width;
    if (!Number.isFinite(x) || maxX < 0) return null;
    return {
      assetKey,
      x: clamp(x, 0, maxX),
      width,
      height,
      offsetY,
      zIndex: options.zIndex ?? 1
    };
  }

  generateLaneProps(lane) {
    const laneDef = this.getLaneDefinition(lane.type);
    const props = [];
    const laneAssetKeys = new Set();
    const density = this.runtimePropDensity * GAME_CONFIG.props.laneDecorationDensity;
    const laneRoll = hash01(this.worldSeed * 0.81 + lane.y * 0.327);

    if (laneDef.key === 'grass' && laneRoll < 0.9 * density) {
      const treeCount = laneRoll < 0.4 * density ? 2 : 1;
      for (let i = 0; i < treeCount; i += 1) {
        const leftSide = (i + Math.floor(lane.seed * 10)) % 2 === 0;
        const treeProp = this.createDecorProp('tree1', lane, {
          anchor: leftSide ? 'left' : 'right',
          width: GAME_CONFIG.props.render.tree1.width,
          height: GAME_CONFIG.props.render.tree1.height,
          offsetY: GAME_CONFIG.props.render.tree1.offsetY,
          edgePadding: 0.2 + i * 0.3
        });
        if (treeProp) {
          props.push(treeProp);
          laneAssetKeys.add('tree1');
        }
      }
    }

    if (laneDef.key === 'road' && laneRoll < 0.42 * density) {
      const variant = Math.floor(lane.seed * 1000) % 2 === 0 ? 'foodCart' : 'benson1';
      const profile = GAME_CONFIG.props.render[variant];
      const roadProp = this.createDecorProp(variant, lane, { ...profile, edgePadding: 0.2 });
      if (roadProp) {
        props.push(roadProp);
        laneAssetKeys.add(variant);
      }
    }

    if (['grass', 'road'].includes(laneDef.key) && laneRoll < GAME_CONFIG.props.roadSignSpawnChance * density) {
      const sign = this.nextStreetSignAsset();
      if (sign && this.canSpawnDecorWithLaneProps(sign, laneAssetKeys)) {
        const profile = GAME_CONFIG.props.render[sign];
        const signProp = this.createDecorProp(sign, lane, { ...profile, edgePadding: 0.08 + hash01(lane.y) * 0.5, zIndex: 2 });
        if (signProp) {
          props.push(signProp);
          laneAssetKeys.add(sign);
        }
      }
    }

    if (!this.propRuntime.landmarksSpawned.has('portland') && lane.y === this.propRuntime.earlyLandmarkY && ['grass', 'road'].includes(laneDef.key)) {
      const profile = GAME_CONFIG.props.render.portlandOregonSign;
      const landmark = this.createDecorProp('portlandOregonSign', lane, { ...profile, anchor: 'left', edgePadding: 0.18, zIndex: 3 });
      if (landmark) {
        this.propRuntime.landmarksSpawned.add('portland');
        props.push(landmark);
        laneAssetKeys.add('portlandOregonSign');
      }
    }

    if (!this.propRuntime.landmarksSpawned.has('bookstore') && lane.y === this.propRuntime.bookstoreY && ['grass', 'road'].includes(laneDef.key)) {
      const profile = GAME_CONFIG.props.render.bookstore1;
      const landmark = this.createDecorProp('bookstore1', lane, { ...profile, anchor: 'right', edgePadding: 0.05, zIndex: 0 });
      if (landmark) {
        this.propRuntime.landmarksSpawned.add('bookstore');
        props.push(landmark);
        laneAssetKeys.add('bookstore1');
      }
    }

    return props;
  }

  getBridgePlayableColumns() {
    const laneCount = clamp(Math.round(GAME_CONFIG.bridgeEncounter.laneCount), 1, GAME_CONFIG.cols);
    const start = Math.floor((GAME_CONFIG.cols - laneCount) / 2);
    return Array.from({ length: laneCount }, (_, index) => start + index);
  }

  isBridgePlayableColumn(x) {
    return this.getBridgePlayableColumns().includes(x);
  }

  getBridgeEncounterState(encounterId) {
    if (!encounterId) return null;
    if (!this.bridgeEncounters.has(encounterId)) {
      this.bridgeEncounters.set(encounterId, {
        id: encounterId,
        activated: false,
        warningShown: false,
        spawnTimer: 0,
        lastSpawnLane: null,
        minimumPicklesSeeded: false,
        encounter: null
      });
    }
    return this.bridgeEncounters.get(encounterId);
  }

  getBridgeEncounterStateByPlayerLane() {
    const lane = this.laneCache.get(this.player.y);
    const encounter = lane?.bridgeEncounter;
    if (!encounter?.id) return { lane: null, encounter: null, state: null };
    const state = this.getBridgeEncounterState(encounter.id);
    if (state && !state.encounter) state.encounter = encounter;
    return { lane, encounter, state };
  }

  isWithinBridgeEncounterBounds(encounter) {
    if (!encounter) return false;
    const endBoundary = encounter.endY + (GAME_CONFIG.bridgeEncounter.trafficStopAfterEncounterRows ?? 0);
    return this.player.y <= endBoundary;
  }

  isLaneYVisibleOnScreen(y) {
    const laneY = this.getLaneScreenY(y);
    const laneHeight = this.getLaneScreenHeight();
    return laneY + laneHeight >= 0 && laneY <= this.worldHeight;
  }

  isBridgeEncounterEndVisible(encounter) {
    if (!encounter) return false;
    return this.isLaneYVisibleOnScreen(encounter.endY);
  }

  shouldStopBridgeTrafficSpawning(encounter) {
    const stopMode = GAME_CONFIG.bridgeEncounter.trafficStopMode;
    if (stopMode === 'onBridgeEndVisible') return this.isBridgeEncounterEndVisible(encounter);
    return !this.isWithinBridgeEncounterBounds(encounter);
  }

  getCurrentMoveCooldown() {
    const { lane } = this.getBridgeEncounterStateByPlayerLane();
    const bridgeMultiplier = lane?.type === 'bridgeEncounter'
      ? GAME_CONFIG.bridgeEncounter.jumpCooldownMultiplier ?? 1
      : 1;
    return this.baseConfig.baseMoveCooldown * bridgeMultiplier;
  }

  getCurrentPickleSpawnChancePerSecond() {
    const { lane } = this.getBridgeEncounterStateByPlayerLane();
    const bridgeMultiplier = lane?.type === 'bridgeEncounter'
      ? GAME_CONFIG.bridgeEncounter.pickleSpawnChanceMultiplier ?? 1
      : 1;
    return Math.min(1, this.runtimeCoinSpawnChance * bridgeMultiplier);
  }

  isHazardCompatibleWithLane(hazard) {
    const lane = this.laneCache.get(hazard.y);
    if (!lane) return false;
    return this.laneAllowsEntityType(lane, hazard.type, 'hazards');
  }

  isPlatformCompatibleWithLane(platform) {
    const lane = this.laneCache.get(platform.y);
    if (!lane) return false;
    return this.laneAllowsEntityType(lane, platform.type, 'platforms');
  }

  ensureLane(y) {
    if (this.laneCache.has(y)) return;
    const lane = this.terrainSystem.createLane(y, this.score);
    lane.decorProps = this.generateLaneProps(lane);
    if (lane.type === 'water' && GAME_CONFIG.riverPlatforms.alternateDirections) {
      const neighbor = [this.laneCache.get(y - 1), this.laneCache.get(y + 1)].find((other) => other?.type === 'water');
      if (neighbor) lane.direction = -neighbor.direction;
    }
    if (lane.type === 'road') lane.speed *= this.runtimeTrafficSpeedMultiplier;
    if (lane.type === 'rail') lane.warningLead = this.runtimeTrainWarningLead;
    if (lane.type === 'bridgeEncounter' && lane.bridgeEncounter?.id) {
      const encounterState = this.getBridgeEncounterState(lane.bridgeEncounter.id);
      if (encounterState && !encounterState.encounter) encounterState.encounter = lane.bridgeEncounter;
    }
    this.laneCache.set(y, lane);
    if (lane.type === 'road' || lane.type === 'water') this.initFlowLane(lane);
    this.terrainSystem.updateConnectedContextForLane(y, this.laneCache);
    this.terrainSystem.updateConnectedContextForLane(y - 1, this.laneCache);
    this.terrainSystem.updateConnectedContextForLane(y + 1, this.laneCache);
  }

  getDifficulty() {
    const stage = this.score / GAME_CONFIG.difficultyRampEvery;
    return clamp(1 + stage * 0.06 + Math.sqrt(stage) * 0.05, 1, 2.35);
  }

  // Roads and rivers are "flow lanes": entities enter at one edge and the next one is
  // released once the last has moved its own half length + the planned gap + the next half length.
  initFlowLane(lane) {
    lane.flow = {
      travel: 0,
      spawnDistance: this.runRng.range(0, 3),
      nextType: this.pickFlowEntityType(lane),
      platoonLeft: 0,
      alternate: false,
      convoyNext: false
    };
    // Run the lane forward one screen width so it is already populated when it scrolls into view.
    this.advanceFlowLane(lane, GAME_CONFIG.cols + GAME_CONFIG.flowLanes.entryOffset * 2);
  }

  advanceFlowLane(lane, distance) {
    const flow = lane.flow;
    flow.travel += distance;
    while (flow.travel >= flow.spawnDistance) {
      flow.travel -= flow.spawnDistance;
      const spawnedType = flow.nextType;
      this.spawnFlowEntity(lane, spawnedType, flow.travel);
      flow.nextType = this.pickFlowEntityType(lane);
      const gap = lane.type === 'water' ? this.nextRiverGap(lane, flow) : this.nextRoadGap(lane, flow);
      flow.spawnDistance = this.getVisibleLengthTiles(spawnedType) / 2 + gap + this.getVisibleLengthTiles(flow.nextType) / 2;
    }
  }

  pickFlowEntityType(lane) {
    if (lane.type === 'water') {
      const pool = (lane.platformPool ?? []).filter((type) => this.laneAllowsEntityType(lane, type, 'platforms'));
      if (!pool.length || this.runRng.next() < GAME_CONFIG.riverPlatforms.primaryTypeShare) return lane.platformType;
      return this.runRng.pick(pool);
    }
    const spawnable = this.getLaneDefinition(lane.type).allowedHazards.filter((type) => this.laneAllowsEntityType(lane, type, 'hazards'));
    return this.runRng.pick(spawnable);
  }

  // Smallest gap (tiles) that still leaves Fig a fair window to hop through at this speed.
  getMinRoadGap(speed) {
    const { clearWidth, minCrossWindow } = GAME_CONFIG.roadTraffic;
    return clearWidth + speed * minCrossWindow;
  }

  nextRoadGap(lane, flow) {
    const archetype = lane.trafficArchetype ?? {};
    const minGap = this.getMinRoadGap(lane.speed);
    const roll = (range, fallback) => (range ? this.runRng.range(range[0], range[1]) : fallback);
    let gap;
    if (archetype.platoonSize) {
      if (flow.platoonLeft > 0) {
        flow.platoonLeft -= 1;
        return minGap * roll(archetype.platoonGapScale, 1.1);
      }
      flow.platoonLeft = this.runRng.int(archetype.platoonSize[0], archetype.platoonSize[1]) - 1;
      gap = roll(archetype.gap, 5);
    } else if (archetype.altGap) {
      flow.alternate = !flow.alternate;
      gap = roll(flow.alternate ? archetype.altGap : archetype.gap, 3);
    } else {
      gap = roll(archetype.gap, 3);
    }
    const squeeze = 1 + (this.getDifficulty() - 1) * GAME_CONFIG.roadTraffic.difficultyGapSqueeze;
    return Math.max(minGap, gap / squeeze);
  }

  nextRiverGap(lane, flow) {
    const river = GAME_CONFIG.riverPlatforms;
    const archetype = lane.riverArchetype ?? {};
    let gap;
    if (flow.convoyNext) {
      flow.convoyNext = false;
      gap = this.runRng.range(river.minGap, river.minGap + 0.2);
    } else {
      gap = archetype.gap ? this.runRng.range(archetype.gap[0], archetype.gap[1]) : 1.2;
      flow.convoyNext = this.runRng.next() < (archetype.convoyChance ?? 0);
      gap *= (1 + (this.getDifficulty() - 1) * river.difficultyGapStretch) / this.runtimeRiverDensity;
    }
    const maxGap = Math.max(river.minGap, Math.min(river.maxGap, lane.speed * river.maxGapSeconds));
    return clamp(gap, river.minGap, maxGap);
  }

  spawnFlowEntity(lane, type, offset = 0) {
    const entryOffset = GAME_CONFIG.flowLanes.entryOffset;
    const startX = lane.direction > 0 ? -entryOffset : GAME_CONFIG.cols + entryOffset;
    const x = startX + lane.direction * offset;
    const entity = { id: 0, type, x, prevX: x, y: lane.y, dir: lane.direction, speed: lane.speed };
    if (lane.type === 'water') {
      entity.id = this.nextPlatformId++;
      this.platforms.push(entity);
    } else {
      entity.id = this.nextHazardId++;
      this.hazards.push(entity);
    }
  }

  spawnTrain(lane) {
    if (!this.laneAllowsEntityType(lane, 'maxTrain', 'hazards')) return;
    // Start fully off screen so the train never pops in.
    const halfLength = this.getMovingProfile('maxTrain').render.width / 2 + 0.3;
    const startX = lane.direction > 0 ? -halfLength : GAME_CONFIG.cols + halfLength;
    this.hazards.push({
      id: this.nextHazardId++,
      type: 'maxTrain',
      x: startX,
      prevX: startX,
      y: lane.y,
      dir: lane.direction,
      speed: lane.speed
    });
  }

  updateRailLane(lane, dt, difficulty) {
    lane.timer += dt;
    const interval = Math.max(3.35, lane.interval / difficulty);
    lane.warningActive = interval - lane.timer <= lane.warningLead;
    this.trainWarnings.set(lane.y, {
      active: lane.warningActive,
      phase: Math.sin(this.time * GAME_CONFIG.trainWarning.flashHz * Math.PI * 2)
    });
    if (lane.timer >= interval) {
      lane.timer = 0;
      lane.warningActive = false;
      this.spawnTrain(lane);
    }
  }

  // Only lanes near the camera move; lanes further ahead are pre-filled and wait their turn.
  getSimulationRange() {
    const rowsOnScreen = Math.ceil(this.worldHeight / this.tile);
    return { min: Math.floor(this.cameraY) - 3, max: Math.ceil(this.cameraY) + rowsOnScreen + 4 };
  }

  pruneLanesBehind() {
    const minY = Math.floor(Math.min(this.player.y, this.cameraY)) - 12;
    for (const y of this.laneCache.keys()) {
      if (y >= minY) continue;
      this.laneCache.delete(y);
      this.trainWarnings.delete(y);
    }
  }

  spawnBridgeHazard(lane, encounterState) {
    const gameplayType = this.getLaneGameplayType(lane);
    const laneDef = this.getLaneDefinition(gameplayType);
    const spawnableHazards = laneDef.allowedHazards.filter((hazardType) => this.laneAllowsEntityType(lane, hazardType, 'hazards'));
    if (!spawnableHazards.length) return;

    const playableColumns = this.getBridgePlayableColumns();
    const candidates = playableColumns.filter((col) => col !== encounterState.lastSpawnLane);
    const spawnColumn = this.runRng.pick(candidates.length ? candidates : playableColumns);
    const vehicleType = this.runRng.pick(spawnableHazards);
    const bridgeEncounter = lane.bridgeEncounter;
    const spawnAtBridgeEnd = GAME_CONFIG.bridgeEncounter.trafficDirection === 'down';
    const spawnY = spawnAtBridgeEnd
      ? (bridgeEncounter?.endY ?? lane.y) + 1.1
      : (bridgeEncounter?.startY ?? lane.y) - 1.1;
    const spawnDirection = spawnAtBridgeEnd ? -1 : 1;

    this.hazards.push({
      id: this.nextHazardId++,
      type: vehicleType,
      x: spawnColumn + 0.5,
      prevX: spawnColumn + 0.5,
      y: spawnY,
      prevY: spawnY,
      dir: spawnDirection,
      speed: lane.speed,
      motionAxis: 'y',
      encounterId: bridgeEncounter?.id ?? null
    });
    encounterState.lastSpawnLane = spawnColumn;
  }

  ensureBridgeEncounterMinimumPickles(encounter, encounterState) {
    if (!encounter || encounterState?.minimumPicklesSeeded) return;
    const minPickles = Math.max(0, Math.floor(GAME_CONFIG.bridgeEncounter.minimumPickles ?? 0));
    if (minPickles <= 0) {
      if (encounterState) encounterState.minimumPicklesSeeded = true;
      return;
    }

    const playableColumns = this.getBridgePlayableColumns();
    const isBridgeEncounterCoin = (coin) => (
      coin.y >= encounter.startY &&
      coin.y <= encounter.endY &&
      playableColumns.includes(coin.x)
    );
    let bridgeCoinCount = this.coins.filter(isBridgeEncounterCoin).length;
    if (bridgeCoinCount >= minPickles) {
      if (encounterState) encounterState.minimumPicklesSeeded = true;
      return;
    }

    const candidates = [];
    for (let y = encounter.startY; y <= encounter.endY; y += 1) {
      this.ensureLane(y);
      const lane = this.laneCache.get(y);
      if (lane?.type !== 'bridgeEncounter' || lane.bridgeEncounter?.id !== encounter.id) continue;
      for (const x of playableColumns) candidates.push({ x, y });
    }

    const deterministicCandidates = candidates
      .map((candidate, index) => ({
        ...candidate,
        sortKey: hash01((this.worldSeed + encounter.startY * 11 + encounter.endY * 17) + index * 0.618)
      }))
      .sort((a, b) => a.sortKey - b.sortKey);

    for (const candidate of deterministicCandidates) {
      if (bridgeCoinCount >= minPickles) break;
      const occupied = this.coins.some((coin) => coin.x === candidate.x && Math.abs(coin.y - candidate.y) < 2);
      if (occupied) continue;
      const bobSeed = hash01(this.worldSeed + candidate.y * 1.37 + candidate.x * 7.19) * 1000;
      this.coins.push({ id: this.nextCoinId++, x: candidate.x, y: candidate.y, bobSeed, w: 0.32, h: 0.32 });
      bridgeCoinCount += 1;
    }

    if (encounterState) encounterState.minimumPicklesSeeded = true;
  }

  spawnCoin() {
    if (this.coins.length >= GAME_CONFIG.coins.maxActive) return;
    const playerOnBridge = this.getBridgeEncounterStateByPlayerLane().lane?.type === 'bridgeEncounter';

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const y = this.player.y + Math.floor(this.runRng.range(GAME_CONFIG.coins.spawnAheadMin, GAME_CONFIG.coins.spawnAheadMax));
      this.ensureLane(y);
      const lane = this.laneCache.get(y);
      if (!lane) continue;
      const laneAllowsCoins = this.getLaneDefinition(lane.type).allowsCoins;
      const bridgeAllowsCoins = playerOnBridge && lane.type === 'bridgeEncounter';
      if (!laneAllowsCoins && !bridgeAllowsCoins) continue;

      const x = bridgeAllowsCoins
        ? this.runRng.pick(this.getBridgePlayableColumns())
        : this.runRng.int(0, GAME_CONFIG.cols);
      const occupied = this.coins.some((coin) => coin.x === x && Math.abs(coin.y - y) < 2);
      if (occupied) continue;

      this.coins.push({ id: this.nextCoinId++, x, y, bobSeed: this.runRng.range(0, 1000), w: 0.32, h: 0.32 });
      return;
    }
  }

  collectCoinAtPlayer() {
    const coinIndex = this.coins.findIndex((coin) => coin.y === this.player.y && Math.abs(coin.x - this.player.fx) < 0.6);
    if (coinIndex < 0) return;

    this.coins.splice(coinIndex, 1);
    const reward = this.addCoins(1);
    this.audio.play('coin');
    this.spawnBurst('#e1bf63', 14);

    if (reward.superJumpsGranted > 0) {
      this.ui.showToast('Super Jump Charged! Press J', 'success');
      this.audio.play('super_ready');
    }
  }

  addCoins(amount) {
    const grant = Math.max(0, Math.floor(Number(amount) || 0));
    if (grant <= 0) return { grantedCoins: 0, superJumpsGranted: 0 };

    const needed = this.runtimeCoinsPerSuperJump;
    const coinPool = this.coinCount + grant;
    const superJumpsGranted = Math.floor(coinPool / needed);

    this.coinCount = coinPool % needed;
    this.superJumps += superJumpsGranted;
    this.ui.updateCoins(this.coinCount, needed);
    if (superJumpsGranted > 0) this.ui.updateSuperJumps(this.superJumps);

    return { grantedCoins: grant, superJumpsGranted };
  }

  activateCheatCoins() {
    if (this.state !== GAME_STATES.PLAYING) return;
    this.addCoins(GAME_CONFIG.cheats.rewardCoins);
    this.ui.showToast(`Cheat activated: +${GAME_CONFIG.cheats.rewardCoins} pickles`, 'info');
  }

  updateBridgeEncounterActivation() {
    if (GAME_CONFIG.bridgeEncounter.activationMode !== 'onPlayerEntry') return;
    const { encounter, state } = this.getBridgeEncounterStateByPlayerLane();
    if (encounter?.id) {
      if (!state) return;
      this.activeBridgeEncounterId = encounter.id;
      if (state.activated) return;

      state.activated = true;
      state.spawnTimer = 0;
      state.encounter = encounter;
      this.ensureBridgeEncounterMinimumPickles(encounter, state);
      if (!state.warningShown) {
        this.ui.showToast(
          GAME_CONFIG.bridgeEncounter.warningText,
          'info',
          GAME_CONFIG.bridgeEncounter.warningDurationSeconds * 1000,
          { screenFlash: GAME_CONFIG.bridgeEncounter.warningFlash }
        );
        state.warningShown = true;
      }
      return;
    }

    if (!this.activeBridgeEncounterId) return;
    const activeState = this.getBridgeEncounterState(this.activeBridgeEncounterId);
    if (!activeState) {
      this.activeBridgeEncounterId = null;
      return;
    }

    if (!GAME_CONFIG.bridgeEncounter.trafficActiveUntilExit || this.shouldStopBridgeTrafficSpawning(activeState.encounter)) {
      activeState.activated = false;
      activeState.spawnTimer = 0;
      this.activeBridgeEncounterId = null;
    }
  }

  updateBridgeEncounterTraffic(dt, difficulty) {
    if (!this.activeBridgeEncounterId) return;
    const encounterState = this.getBridgeEncounterState(this.activeBridgeEncounterId);
    if (!encounterState?.activated) return;
    if (this.shouldStopBridgeTrafficSpawning(encounterState.encounter)) return;
    const spawnLane = this.laneCache.get(encounterState.encounter?.startY);
    if (!spawnLane || spawnLane.type !== 'bridgeEncounter') return;

    const interval = Math.max(0.55, spawnLane.interval / difficulty);
    encounterState.spawnTimer += dt;
    if (encounterState.spawnTimer >= interval) {
      encounterState.spawnTimer = 0;
      this.spawnBridgeHazard(spawnLane, encounterState);
    }
  }

  update(dt) {
    this.time += dt;
    if (this.superJumpState?.active) {
      this.updateSuperJump(dt);
    } else {
      this.updatePlayerHop(dt);
      this.player.tilt *= Math.pow(0.86, dt * 60);
      this.player.stretch = Math.max(0, this.player.stretch - dt * 1.8);
      this.player.superJumpEnergy = 0;
      this.player.superJumpPhase = 'idle';
      if (this.player.visualState === 'superJump') {
        this.superJumpVisualTimer = Math.max(0, this.superJumpVisualTimer - dt);
        if (this.superJumpVisualTimer <= 0) this.player.visualState = 'normal';
      }
    }
    this.updateParticles(dt);
    this.updateRain(dt);

    if (this.state !== GAME_STATES.PLAYING) return;

    this.processQueuedMove();
    this.updateBridgeEncounterActivation();

    const cameraFollow = 1 - Math.pow(1 - GAME_CONFIG.cameraLerp, dt * 60);
    this.cameraY += (this.player.y - this.runtimeCameraOffsetRows - this.cameraY) * cameraFollow;

    const difficulty = this.getDifficulty();
    const active = this.getSimulationRange();
    const isActiveRow = (y) => y >= active.min && y <= active.max;

    for (const lane of this.laneCache.values()) {
      if (!isActiveRow(lane.y)) continue;
      if (lane.flow) this.advanceFlowLane(lane, lane.speed * dt);
      else if (lane.type === 'rail') this.updateRailLane(lane, dt, difficulty);
    }
    this.updateBridgeEncounterTraffic(dt, difficulty);

    this.pruneTimer += dt;
    if (this.pruneTimer >= 0.5) {
      this.pruneTimer = 0;
      this.pruneLanesBehind();
    }

    this.coinSpawnTimer += dt;
    if (this.coinSpawnTimer >= 1) {
      this.coinSpawnTimer = 0;
      if (this.runRng.next() < this.getCurrentPickleSpawnChancePerSecond()) this.spawnCoin();
    }

    for (const hazard of this.hazards) {
      hazard.prevX = hazard.x;
      hazard.prevY = hazard.y;
      if (hazard.motionAxis !== 'y' && !isActiveRow(hazard.y)) continue;
      if (hazard.motionAxis === 'y') hazard.y += hazard.speed * hazard.dir * dt;
      else hazard.x += hazard.speed * hazard.dir * dt;
      this.maybeTriggerTrainPassShake(hazard);
    }
    this.hazards = this.hazards.filter((h) => {
      if (h.motionAxis === 'y') {
        const encounterState = h.encounterId ? this.bridgeEncounters.get(h.encounterId) : null;
        const encounter = encounterState?.encounter;
        if (!encounter) return false;
        return h.y >= encounter.startY - 2 && h.y <= encounter.endY + 2;
      }
      return this.isHazardCompatibleWithLane(h) && h.x > -5 && h.x < GAME_CONFIG.cols + 5;
    });

    for (const platform of this.platforms) {
      platform.prevX = platform.x;
      if (isActiveRow(platform.y)) platform.x += platform.speed * platform.dir * dt;
    }
    this.platforms = this.platforms.filter((p) => this.isPlatformCompatibleWithLane(p) && p.x > -5 && p.x < GAME_CONFIG.cols + 5);

    this.updateRiverAttachment(dt);

    const minCoinY = this.player.y - 2;
    this.coins = this.coins.filter((coin) => coin.y >= minCoinY);

    if (!this.superJumpState?.active) {
      this.handleCollisions();
      this.collectCoinAtPlayer();
    }

    if (this.player.y < this.cameraY - 4.25) {
      this.kill(DEATH_CAUSES.TIMEOUT);
      return;
    }
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

  updatePlayerHop(dt) {
    const { player } = this;
    const { hop } = player;
    if (!hop) {
      player.drawX = player.fx;
      player.drawY = player.y;
      player.hopLift = 0;
      return;
    }
    hop.elapsed += dt;
    const progress = Math.min(1, hop.elapsed / GAME_CONFIG.movement.hopDuration);
    const eased = easeOutCubic(progress);
    player.drawX = lerp(hop.fromX, player.fx, eased);
    player.drawY = lerp(hop.fromY, player.y, eased);
    player.hopLift = Math.sin(progress * Math.PI) * GAME_CONFIG.movement.hopHeight;
    if (progress >= 1) player.hop = null;
  }

  // x is Fig's center in tiles. She stands on a platform if her center is over its visible pixels.
  findPlatformUnderPoint(x, y) {
    const grace = GAME_CONFIG.collisions.platformGraceTiles * this.tile;
    const px = x * this.tile;
    return this.platforms.find((platform) => {
      if (platform.y !== y) return false;
      const span = this.collisionSystem.getVisibleSpan(this.getEntityShape(platform));
      return px >= span.left - grace && px <= span.right + grace;
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
    if (!this.player.hop) this.player.drawX = this.player.fx;

    if (this.player.fx <= -0.45 || this.player.fx >= GAME_CONFIG.cols - 0.55) {
      this.kill(DEATH_CAUSES.OFF_PLATFORM);
    }
  }

  handleCollisions() {
    const lane = this.laneCache.get(this.player.y);
    if (!lane) return;
    const landed = !this.player.hop;

    if (landed && lane.type === 'bridgeEncounter' && !this.isBridgePlayableColumn(this.player.x)) {
      this.kill(DEATH_CAUSES.RIVER);
      return;
    }

    // Pixel-mask test between what Fig looks like and what each vehicle looks like, at their drawn positions.
    const playerShape = this.getPlayerShape();
    const playerCenterX = this.player.drawX + 0.5;
    for (const h of this.hazards) {
      if (h.motionAxis === 'y') {
        if (Math.abs(h.x - playerCenterX) > 1.2 || Math.abs(h.y - this.player.drawY) > 1.6) continue;
      } else if (Math.abs(h.y - this.player.drawY) >= 1) continue;

      if (this.collisionSystem.overlaps(playerShape, this.getEntityShape(h))) {
        this.kill(h.type === 'maxTrain' ? DEATH_CAUSES.TRAIN : DEATH_CAUSES.CAR);
        return;
      }

      if (lane.type === 'road' && h.y === this.player.y && !h.nearMissAwarded) {
        // A vehicle that passes within a third of a tile of Fig without touching her.
        const edgeGap = Math.abs(h.x - (this.player.fx + 0.5)) - this.getVisibleLengthTiles(h.type) / 2 - 0.25;
        const now = performance.now();
        if (edgeGap < 0.33 && now - this.lastNearMissAt > 120) {
          h.nearMissAwarded = true;
          this.lastNearMissAt = now;
          this.score += 1;
          const bestPulse = this.updateBestIfNeeded();
          this.ui.updateScore(this.score, { pulse: true, bestPulse });
          this.spawnBurst('#7aa58a', 12);
          this.audio.play('score');
        }
      }
    }

    // Water only counts once the hop has landed, so a platform arriving mid-hop still catches Fig.
    if (landed && lane.type === 'water' && !this.findPlatformUnderPoint(this.player.fx + 0.5, this.player.y)) {
      this.attachedPlatformId = null;
      this.kill(DEATH_CAUSES.RIVER);
    }
  }

  kill(cause = DEATH_CAUSES.GENERIC, overrideMessage = null) {
    if (this.state !== GAME_STATES.PLAYING) return;
    this.state = GAME_STATES.GAME_OVER;
    this.audio.play('hit');
    this.triggerScreenShake(GAME_CONFIG.effects.deathShake);
    this.spawnBurst('#c56f5c', 26);
    const message = overrideMessage ?? getDeathMessage(cause);
    this.onGameOver?.({ score: this.score, message, cause });
  }

  maybeTriggerTrainPassShake(hazard) {
    if (hazard.type !== 'maxTrain' || hazard.didShake) return;
    if (Math.abs(hazard.y - this.player.y) > 6) return;

    const prevCenter = hazard.prevX;
    const currentCenter = hazard.x;
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

  spawnSuperJumpTrail() {
    const trailCount = GAME_CONFIG.superJump.energy.trailCount;
    for (let i = 0; i < trailCount; i += 1) {
      this.particles.push({
        x: this.player.drawX + randRange(-0.24, 0.24),
        y: this.player.drawY - randRange(0.15, 0.45),
        vx: randRange(-0.45, 0.45),
        vy: randRange(-0.7, -0.1),
        color: i % 2 === 0 ? '#fff0a8' : '#d9bd70',
        life: GAME_CONFIG.particleLifetime * randRange(0.3, 0.75)
      });
    }
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
    this.drawTerrainDebug();
    ctx.restore();
  }

  worldToScreen(x, y) {
    return { x: x * this.tile, y: this.worldHeight - (y - this.cameraY + 1) * this.tile };
  }

  getLaneScreenY(laneY) {
    return Math.round(this.worldToScreen(0, laneY).y);
  }

  getLaneScreenHeight() {
    return Math.max(1, Math.round(this.tile));
  }

  drawLaneTexture(sprite, { y, height, fallbackColor, laneY = null, anchorX = 0, anchorY = null, tileScale = 1 }) {
    const ctx = this.ctx;
    const tileSettings = GAME_CONFIG.environmentTiles;
    const snap = tileSettings.snapToPixels !== false;
    const overlap = Math.max(0, Math.round(tileSettings.overlapPx ?? 0));
    const drawY = snap ? Math.round(y) : y;
    const drawHeight = Math.max(1, (snap ? Math.round(height) : height) + overlap);

    if (!sprite?.complete || !sprite.naturalWidth || !sprite.naturalHeight) {
      ctx.fillStyle = fallbackColor;
      ctx.fillRect(0, drawY, this.worldWidth, drawHeight);
      return;
    }

    const worldUnits = tileSettings.baseWorldUnits;
    const tileHeight = Math.max(1, Math.round(drawHeight * (worldUnits.height ?? 1) * tileScale));
    const tileWidth = Math.max(
      1,
      Math.round((worldUnits.width ?? 1) * tileHeight * (sprite.naturalWidth / sprite.naturalHeight) * tileScale)
    );
    const anchorWorldX = anchorX;
    const anchorWorldY = anchorY ?? laneY ?? 0;
    const firstTileX = -((((anchorWorldX * this.tile) % tileWidth) + tileWidth) % tileWidth);
    const firstTileY = drawY - ((((anchorWorldY * this.tile) % tileHeight) + tileHeight) % tileHeight);

    for (let x = firstTileX; x < this.worldWidth + tileWidth; x += tileWidth) {
      ctx.drawImage(sprite, x, firstTileY, tileWidth, tileHeight);
    }
  }

  drawGrassLane({ lane, laneY, laneHeight, laneIndex }) {
    const ctx = this.ctx;
    const grassTile = this.environmentSprites.grassTile;
    const grassStyle = GAME_CONFIG.environmentTiles.grass;
    this.drawLaneTexture(grassTile, {
      y: laneY,
      laneY: laneIndex,
      height: laneHeight,
      fallbackColor: '#4a6047',
      anchorY: 0,
      tileScale: grassStyle.baseScale
    });
    this.drawLaneTexture(grassTile, {
      y: laneY,
      laneY: laneIndex,
      height: laneHeight,
      fallbackColor: '#4a6047',
      anchorX: grassStyle.detailOffsetX,
      anchorY: grassStyle.detailOffsetY,
      tileScale: grassStyle.detailScale
    });

    const laneWorldY = laneIndex * this.tile;
    this.fillLaneGradient('grassShade', [
      [0, 'rgba(13, 26, 14, 0.26)'],
      [0.5, 'rgba(55, 92, 50, 0.08)'],
      [1, 'rgba(12, 24, 13, 0.2)']
    ], laneY, laneHeight);

    const undulation = Math.sin((laneWorldY + this.time * 12) * grassStyle.undulationFreq) * grassStyle.undulationAlpha;
    const tonalAlpha = Math.max(0, grassStyle.tonalAlpha + undulation);
    ctx.fillStyle = `rgba(170, 202, 141, ${tonalAlpha})`;
    ctx.fillRect(0, laneY, this.worldWidth, laneHeight);

    this.drawConnectedLaneShading(lane, laneY, laneHeight, {
      capTop: 'rgba(8, 16, 8, 0.3)',
      capBottom: 'rgba(8, 16, 8, 0.28)'
    });
  }

  drawWaterLane({ lane, laneY, laneHeight, laneIndex }) {
    const ctx = this.ctx;
    const waterStyle = GAME_CONFIG.environmentTiles.water;
    const waterTile = this.environmentSprites.riverTile;
    const renderHeight = Math.max(1, Math.round(laneHeight * waterStyle.tileHeightRatio));
    const yInset = Math.round((laneHeight - renderHeight) * 0.5);
    this.drawLaneTexture(waterTile, {
      y: laneY + yInset,
      laneY: laneIndex,
      height: renderHeight,
      fallbackColor: '#34576d'
    });

    this.fillLaneGradient('waterShade', [
      [0, 'rgba(16, 47, 66, 0.72)'],
      [0.48, 'rgba(39, 102, 128, 0.2)'],
      [1, 'rgba(13, 42, 60, 0.74)']
    ], laneY, laneHeight);

    const waveBase = laneY + laneHeight * 0.26;
    const waveAmp = laneHeight * 0.08;
    ctx.strokeStyle = `rgba(231, 243, 253, ${waterStyle.foamAlpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= this.worldWidth; x += 10) {
      const waveY = waveBase + Math.sin(x * 0.02 + this.time * (2 + waterStyle.flowSpeed * 10) + lane.seed) * waveAmp;
      if (x === 0) ctx.moveTo(x, waveY);
      else ctx.lineTo(x, waveY);
    }
    ctx.stroke();

    this.drawConnectedLaneShading(lane, laneY, laneHeight, {
      capTop: 'rgba(8, 18, 26, 0.5)',
      capBottom: 'rgba(8, 18, 26, 0.5)'
    });
  }

  drawBridgeEncounterLane({ lane, laneY, laneHeight, laneIndex }) {
    this.drawWaterLane({ lane, laneY, laneHeight, laneIndex });
    const ctx = this.ctx;
    const playableColumns = this.getBridgePlayableColumns();
    const bridgeStartX = playableColumns[0] * this.tile;
    const bridgeWidth = playableColumns.length * this.tile;

    ctx.fillStyle = 'rgba(122, 100, 75, 0.88)';
    ctx.fillRect(bridgeStartX, laneY, bridgeWidth, laneHeight);
    ctx.strokeStyle = 'rgba(74, 54, 38, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(bridgeStartX, laneY + 1, bridgeWidth, laneHeight - 2);

    ctx.strokeStyle = 'rgba(240, 224, 192, 0.42)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    for (let i = 1; i < playableColumns.length; i += 1) {
      const lineX = bridgeStartX + i * this.tile;
      ctx.beginPath();
      ctx.moveTo(lineX, laneY + 2);
      ctx.lineTo(lineX, laneY + laneHeight - 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  drawRailLane({ lane, laneY, laneHeight, laneIndex }) {
    const ctx = this.ctx;
    const railStyle = GAME_CONFIG.environmentTiles.rail;
    const ballastHeight = Math.max(4, Math.round(laneHeight * railStyle.ballastHeightRatio));
    const ballastY = laneY + Math.round((laneHeight - ballastHeight) * 0.5);

    ctx.fillStyle = '#5b5e51';
    ctx.fillRect(0, laneY, this.worldWidth, laneHeight);
    this.drawLaneTexture(this.environmentSprites.railTile, {
      y: ballastY,
      laneY: laneIndex,
      height: ballastHeight,
      fallbackColor: '#676b5a'
    });

    ctx.fillStyle = 'rgba(30, 33, 29, 0.5)';
    ctx.fillRect(0, ballastY, this.worldWidth, 2);
    ctx.fillRect(0, ballastY + ballastHeight - 2, this.worldWidth, 2);

    const gauge = this.tile * railStyle.trackGaugeRatio;
    const centerY = laneY + laneHeight * 0.5;
    const railOffset = gauge / 2;
    ctx.strokeStyle = '#d3d3cf';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, centerY - railOffset);
    ctx.lineTo(this.worldWidth, centerY - railOffset);
    ctx.moveTo(0, centerY + railOffset);
    ctx.lineTo(this.worldWidth, centerY + railOffset);
    ctx.stroke();

    const tieW = Math.max(10, Math.round(this.tile * railStyle.tieWidthRatio));
    const tieH = Math.max(4, Math.round(gauge + this.tile * 0.12));
    const tieGap = Math.max(16, Math.round(this.tile * railStyle.tieGapRatio));
    const tieOffset = ((((laneIndex * this.tile) % tieGap) + tieGap) % tieGap);
    ctx.fillStyle = 'rgba(49, 38, 27, 0.86)';
    for (let tieX = -tieGap - tieOffset; tieX < this.worldWidth + tieGap; tieX += tieGap) {
      ctx.fillRect(tieX, Math.round(centerY - tieH / 2), tieW, tieH);
    }

    const warning = this.trainWarnings.get(laneIndex);
    if (warning?.active) {
      const alpha = warning.phase > 0 ? 0.42 : 0.16;
      ctx.fillStyle = `rgba(198, 39, 39, ${alpha})`;
      ctx.fillRect(0, ballastY, this.worldWidth, ballastHeight);
      ctx.fillStyle = `rgba(255, 242, 210, ${Math.max(0.2, alpha)})`;
      ctx.fillRect(10, Math.round(centerY - 5), 14, 10);
      ctx.fillRect(this.worldWidth - 24, Math.round(centerY - 5), 14, 10);
    }

    this.drawConnectedLaneShading(lane, laneY, laneHeight, {
      capTop: 'rgba(24, 24, 24, 0.42)',
      capBottom: 'rgba(24, 24, 24, 0.42)'
    });
  }

  // Lane gradients are built once per canvas size and shifted into place instead of rebuilt every frame.
  fillLaneGradient(key, stops, laneY, laneHeight) {
    let gradient = this.laneGradients.get(key);
    if (!gradient) {
      gradient = this.ctx.createLinearGradient(0, 0, 0, laneHeight);
      for (const [offset, color] of stops) gradient.addColorStop(offset, color);
      this.laneGradients.set(key, gradient);
    }
    this.ctx.save();
    this.ctx.translate(0, laneY);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.worldWidth, laneHeight);
    this.ctx.restore();
  }

  isRowOnScreen(y) {
    const screenY = this.worldToScreen(0, y).y;
    return screenY + this.tile * 2 >= 0 && screenY - this.tile <= this.worldHeight;
  }

  drawConnectedLaneShading(lane, laneY, laneHeight, { capTop, capBottom }) {
    const ctx = this.ctx;
    const edgeHeight = Math.max(1, Math.round(laneHeight * 0.12));
    if (!lane.connectedContext?.north) {
      ctx.fillStyle = capTop;
      ctx.fillRect(0, laneY, this.worldWidth, edgeHeight);
    }
    if (!lane.connectedContext?.south) {
      ctx.fillStyle = capBottom;
      ctx.fillRect(0, laneY + laneHeight - edgeHeight, this.worldWidth, edgeHeight);
    }
  }

  drawLanes() {
    const ctx = this.ctx;
    const from = Math.floor(this.cameraY) - 2;
    const to = from + GAME_CONFIG.visibleRows + 5;
    const propsToRender = [];

    for (let y = from; y <= to; y += 1) {
      this.ensureLane(y);
      const lane = this.laneCache.get(y);
      const laneDef = this.getLaneDefinition(lane.type);
      const laneY = this.getLaneScreenY(y);
      const laneHeight = this.getLaneScreenHeight();
      ctx.fillStyle = GAME_CONFIG.lanePalette[lane.terrainType];
      ctx.fillRect(0, laneY, this.worldWidth, laneHeight + 1);

      if (lane.terrainType === 'road') {
        const roadTile = this.environmentSprites.roadTile;
        const sidewalkTile = this.environmentSprites.sidewalkTile;

        this.drawLaneTexture(roadTile, { y: laneY, laneY: y, height: laneHeight, fallbackColor: laneDef.fallbackColor });

        const shoulderHeight = Math.max(1, Math.round(laneHeight * GAME_CONFIG.environmentTiles.roadShoulderHeightRatio));
        if (sidewalkTile?.complete) {
          this.drawLaneTexture(sidewalkTile, { y: laneY, laneY: y, height: shoulderHeight, fallbackColor: '#5f7f69' });
          this.drawLaneTexture(sidewalkTile, {
            y: laneY + laneHeight - shoulderHeight,
            height: shoulderHeight,
            laneY: y,
            fallbackColor: '#5f7f69'
          });
        } else {
          ctx.fillStyle = '#5f7f69';
          ctx.fillRect(0, laneY + Math.round(laneHeight * 0.1), this.worldWidth, shoulderHeight);
          ctx.fillRect(0, laneY + laneHeight - shoulderHeight - Math.round(laneHeight * 0.1), this.worldWidth, shoulderHeight);
        }

        ctx.strokeStyle = 'rgba(245, 245, 245, 0.55)';
        ctx.setLineDash([14, 18]);
        ctx.lineDashOffset = -(this.time * 58 * lane.direction);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, laneY + Math.round(laneHeight * 0.56));
        ctx.lineTo(this.worldWidth, laneY + Math.round(laneHeight * 0.56));
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (lane.type === 'bridgeEncounter') this.drawBridgeEncounterLane({ lane, laneY, laneHeight, laneIndex: y });
      else if (lane.terrainType === 'water') this.drawWaterLane({ lane, laneY, laneHeight, laneIndex: y });
      else if (lane.terrainType === 'rail') this.drawRailLane({ lane, laneY, laneHeight, laneIndex: y });
      else this.drawGrassLane({ lane, laneY, laneHeight, laneIndex: y });

      this.collectLanePropsForRender(lane, laneY, laneDef, propsToRender);
    }

    this.drawCollectedProps(propsToRender);
  }

  collectLanePropsForRender(lane, y, laneDef = this.getLaneDefinition(lane.type), propsToRender = []) {
    if (!laneDef.allowedProps.length) return;
    const props = [...(lane.decorProps ?? [])].sort((a, b) => a.zIndex - b.zIndex);
    for (const prop of props) {
      const sprite = this.environmentSprites[prop.assetKey];
      if (!sprite?.complete || sprite.naturalWidth === 0 || sprite.naturalHeight === 0) continue;
      propsToRender.push({
        sprite,
        x: prop.x * this.tile,
        y: y + this.tile * prop.offsetY,
        width: this.tile * prop.width,
        height: this.tile * prop.height,
        zIndex: prop.zIndex ?? 1,
        laneY: lane.y
      });
    }
  }

  drawCollectedProps(propsToRender = []) {
    if (!propsToRender.length) return;
    const ctx = this.ctx;
    propsToRender.sort((a, b) => (a.laneY - b.laneY) || (a.zIndex - b.zIndex));
    for (const prop of propsToRender) {
      ctx.drawImage(prop.sprite, prop.x, prop.y, prop.width, prop.height);
    }
  }

  drawPlatforms() {
    const ctx = this.ctx;
    for (const p of this.platforms) {
      if (!this.isRowOnScreen(p.y)) continue;
      const { x, y, width, height } = this.getMovingDrawRect(p);

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
      if (!this.isRowOnScreen(h.y)) continue;
      const profile = this.getMovingProfile(h.type);
      const { x, y, width, height } = this.getMovingDrawRect(h, profile);

      const sprite = this.vehicleSprites[h.type];
      if (this.drawSpriteWithRenderProfile(sprite, { x, y, width, height }, h.type, { flipX: this.isEntityFlipped(h, profile) })) {
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
      const visuals = GAME_CONFIG.coinVisuals;
      const bob = Math.sin(this.time * visuals.bobFrequencyHz + coin.bobSeed) * this.tile * visuals.bobAmplitudeRatio;
      const cx = (coin.x + 0.5) * this.tile;
      const cy = pos.y + this.tile * (0.45 + GAME_CONFIG.alignment.collectible.renderOffsetY) + bob;
      const drawSize = this.tile * 0.34;

      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${visuals.shadowAlpha})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy + this.tile * visuals.shadowOffsetRatio, drawSize * 0.24, drawSize * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();

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
      ctx.restore();
    }
  }

  drawPlayer() {
    const ctx = this.ctx;
    const { drawX, drawY, hopLift, stretch } = this.player;
    // The shadow stays on the ground while Fig lifts off it mid-hop.
    const ground = this.getPlayerRect(drawX, drawY, stretch);
    const { x, y, width: w, height: h } = hopLift ? this.getPlayerRect(drawX, drawY + hopLift, stretch) : ground;

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    const shadowScale = (this.superJumpState?.active ? 0.7 : 1) * (1 - hopLift * 1.2);
    ctx.ellipse(ground.x + w / 2, ground.y + h * 0.95, w * 0.4 * shadowScale, h * 0.15 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(this.player.tilt);
    ctx.translate(-(x + w / 2), -(y + h / 2));

    if (this.superJumpState?.active) {
      this.drawSuperJumpEnergy(x + w / 2, y + h * 0.48, w, h, this.player.superJumpEnergy ?? 0);
    }

    if (!this.drawSpriteWithRenderProfile(this.getPlayerSprite(), { x, y, width: w, height: h }, 'player')) {
      ctx.fillStyle = '#f4a261';
      ctx.fillRect(x, y, w, h);
    }

    ctx.restore();
  }

  drawSuperJumpEnergy(cx, cy, w, h, intensity) {
    const ctx = this.ctx;
    const rays = GAME_CONFIG.superJump.energy.rayCount;
    const rings = GAME_CONFIG.superJump.energy.ringCount;
    const alpha = clamp(intensity, 0, 1);
    if (alpha <= 0.02) return;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (let i = 0; i < rays; i += 1) {
      const ang = (Math.PI * 2 * i) / rays + this.time * 2.6;
      const len = this.tile * (0.25 + alpha * 0.45 + Math.sin(this.time * 6 + i) * 0.03);
      const sx = cx + Math.cos(ang) * (w * 0.12);
      const sy = cy + Math.sin(ang) * (h * 0.1);
      const ex = cx + Math.cos(ang) * len;
      const ey = cy + Math.sin(ang) * len;
      ctx.strokeStyle = `rgba(255, 237, 171, ${0.08 + alpha * 0.18})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    for (let i = 0; i < rings; i += 1) {
      const pulse = (this.time * 2.4 + i * 0.3) % 1;
      const radius = this.tile * (0.15 + pulse * 0.32);
      ctx.strokeStyle = `rgba(220, 189, 112, ${(1 - pulse) * 0.26 * alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    const gradient = ctx.createRadialGradient(cx, cy, this.tile * 0.02, cx, cy, this.tile * 0.5);
    gradient.addColorStop(0, `rgba(255, 244, 195, ${0.18 + alpha * 0.32})`);
    gradient.addColorStop(1, 'rgba(255, 244, 195, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, this.tile * 0.5, 0, Math.PI * 2);
    ctx.fill();

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
    ctx.beginPath();
    for (const drop of this.rainDrops) {
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - 2, drop.y + drop.len);
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(41, 52, 59, 0.2)';
    ctx.fillRect(0, 0, this.worldWidth, this.worldHeight);
  }

  drawTerrainDebug() {
    if (!this.terrainDebugEnabled || !this.runtimeLaneLabelsVisible) return;
    const ctx = this.ctx;
    const playerRow = this.player.y;
    ctx.save();
    ctx.font = '12px monospace';
    ctx.textBaseline = 'top';
    for (let y = playerRow - 2; y <= playerRow + 4; y += 1) {
      const lane = this.laneCache.get(y);
      if (!lane) continue;
      const info = this.terrainSystem.createDebugSnapshot(lane);
      const screenY = this.getLaneScreenY(y) + 2;
      const label = `y:${info.y} lane:${info.gameplayType} terrain:${info.terrainType} mask:${info.connectedMask}`;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(4, screenY, Math.min(this.worldWidth - 8, 420), 14);
      ctx.fillStyle = '#f4f6f8';
      ctx.fillText(label, 8, screenY + 1);
    }
    ctx.restore();
  }

  drawCollisionDebug() {
    if (!this.collisionSystem.debugEnabled) return;
    const alpha = clamp(this.runtimeHitboxOpacity, 0.05, 1);
    const color = (r, g, b) => `rgba(${r}, ${g}, ${b}, ${alpha})`;
    // Toggle with the dev key in config (default: C). Filled cells are the real pixel hitboxes;
    // masks are filled near Fig only to keep the overlay cheap.
    const nearPlayer = (y) => Math.abs(y - this.player.drawY) <= 2;
    const entries = [{ shape: this.getPlayerShape(), color: color(245, 219, 111), showMask: true }];
    for (const h of this.hazards) {
      if (!this.isRowOnScreen(h.y)) continue;
      entries.push({ shape: this.getEntityShape(h), color: color(238, 104, 104), showMask: nearPlayer(h.y) });
    }
    for (const p of this.platforms) {
      if (!this.isRowOnScreen(p.y)) continue;
      const attached = p.id === this.attachedPlatformId;
      entries.push({ shape: this.getEntityShape(p), color: attached ? color(107, 236, 146) : color(111, 214, 170), showMask: nearPlayer(p.y) });
    }
    this.collisionSystem.drawDebug(this.ctx, entries);

    // Fig's standing point on the river: her center must be over a platform's visible pixels.
    if (this.laneCache.get(this.player.y)?.type === 'water') {
      const pos = this.worldToScreen(this.player.fx + 0.5, this.player.y);
      this.ctx.fillStyle = color(84, 172, 219);
      this.ctx.fillRect(pos.x - 2, pos.y + this.tile * 0.2, 4, this.tile * 0.6);
    }
  }
}
