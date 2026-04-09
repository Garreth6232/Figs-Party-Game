import { ASSET_MANIFEST, GAME_CONFIG, GAME_STATES, LANE_DEFINITIONS, STANDARD_ROAD_VEHICLE_ASSET_KEY, STORAGE_KEYS } from './config.js';
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

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

const DEFAULT_MOVING_PROFILE = {
  render: { width: 1, height: 0.6, offsetX: 0, offsetY: 0 },
  collision: { type: 'car', width: 1, height: 0.5, offsetX: 0, offsetY: 0 }
};


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
    this.worldSeed = Math.floor(Math.random() * 1000000);
    this.terrainSystem = new TerrainSystem({
      gameConfig: GAME_CONFIG,
      laneDefinitions: LANE_DEFINITIONS,
      worldSeed: this.worldSeed
    });
    this.terrainDebugEnabled = false;
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
    this.missingAssets = new Set();
    this.resize();
    this.loadSprites();
    window.addEventListener('resize', () => this.resize());
    this.reset();
  }

  loadSprites() {
    const registerImage = (bucket, key, src) => {
      const image = new Image();
      image.src = src;
      image.decoding = 'async';
      image.loading = 'eager';
      image.onerror = () => {
        const record = `${key}:${src}`;
        this.missingAssets.add(record);
        if (/localhost|127\\.0\\.0\\.1/.test(window.location.hostname)) {
          throw new Error(`[Asset Missing] ${record}`);
        } else {
          console.error(`[Asset Missing] ${record}`);
        }
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
    this.runtimeSettings?.applyToGame(this);
    this.player = {
      x: Math.floor(GAME_CONFIG.cols / 2),
      fx: Math.floor(GAME_CONFIG.cols / 2),
      y: GAME_CONFIG.startY,
      drawX: Math.floor(GAME_CONFIG.cols / 2),
      drawY: GAME_CONFIG.startY,
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
    this.nearMisses = new Set();
    this.lastNearMissAt = 0;
    this.lastMoveAt = 0;
    this.time = 0;
    this.superJumpVisualTimer = 0;
    this.superJumpState = null;
    this.cameraY = this.player.y - 3;
    this.shake = 0;
    this.shakeTimer = 0;
    this.nextHazardId = 1;
    this.nextPlatformId = 1;
    this.nextCoinId = 1;
    this.attachedPlatformId = null;
    this.laneCache = new Map();
    this.trainWarnings = new Map();
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

    const facingMap = { up: 'back', down: 'forward', left: 'left', right: 'right' };
    this.player.facing = facingMap[dir] ?? this.player.facing;

    const now = performance.now();
    if (now - this.lastMoveAt < this.baseConfig.baseMoveCooldown) return;

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
    this.spawnBurst('#d9bd70', 24);
    this.spawnBurst('#9fb8aa', 10);

    this.handleProgressScore();
    this.collectCoinAtPlayer();
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

    const runtimeScale =
      renderProfileKey === 'player'
        ? this.runtimeRenderScale.player
        : renderProfileKey === 'maxTrain'
          ? this.runtimeRenderScale.train
          : ['car1', 'car2', 'car3', 'bike1', 'scooter1'].includes(renderProfileKey)
            ? this.runtimeRenderScale.car
            : 1;
    const drawWidth = targetRect.width * (renderProfile.scaleX ?? 1) * runtimeScale;
    const drawHeight = targetRect.height * (renderProfile.scaleY ?? 1) * runtimeScale;
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

  getLaneDefinition(laneType) {
    return LANE_DEFINITIONS[laneType] ?? LANE_DEFINITIONS.grass;
  }

  createPropRuntimeState() {
    const early = GAME_CONFIG.props.earlyLandmarkDistance;
    const large = GAME_CONFIG.props.largeLandmarkDistance;
    const earlyLandmarkY = this.player.y + Math.round(randRange(early.min, early.max));
    const bookstoreY = this.player.y + Math.round(randRange(large.min, large.max));
    const signs = [...GAME_CONFIG.props.rules.streetSigns.family];
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
      this.propRuntime.streetSignBag = [...GAME_CONFIG.props.rules.streetSigns.family];
    }
    let key = this.propRuntime.streetSignBag.shift();
    if (key === this.propRuntime.lastStreetSign && this.propRuntime.streetSignBag.length > 0) {
      this.propRuntime.streetSignBag.push(key);
      key = this.propRuntime.streetSignBag.shift();
    }
    this.propRuntime.lastStreetSign = key;
    return key;
  }

  createDecorProp(assetKey, lane, options = {}) {
    const anchor = options.anchor ?? (lane.direction > 0 ? 'right' : 'left');
    const edgePadding = options.edgePadding ?? 0.28;
    const x =
      anchor === 'right'
        ? GAME_CONFIG.cols - (options.width ?? 0.6) - edgePadding
        : edgePadding;
    return {
      assetKey,
      x,
      width: options.width ?? 0.5,
      height: options.height ?? 0.5,
      offsetY: options.offsetY ?? 0.5,
      zIndex: options.zIndex ?? 1
    };
  }

  generateLaneProps(lane) {
    const laneDef = this.getLaneDefinition(lane.type);
    const props = [];
    const density = this.runtimePropDensity * GAME_CONFIG.props.laneDecorationDensity;
    const laneRoll = hash01(this.worldSeed * 0.81 + lane.y * 0.327);

    if (laneDef.key === 'grass' && laneRoll < 0.9 * density) {
      const treeCount = laneRoll < 0.4 * density ? 2 : 1;
      for (let i = 0; i < treeCount; i += 1) {
        const leftSide = (i + Math.floor(lane.seed * 10)) % 2 === 0;
        props.push(
          this.createDecorProp('tree1', lane, {
            anchor: leftSide ? 'left' : 'right',
            width: GAME_CONFIG.props.render.tree1.width,
            height: GAME_CONFIG.props.render.tree1.height,
            offsetY: GAME_CONFIG.props.render.tree1.offsetY,
            edgePadding: 0.2 + i * 0.3
          })
        );
      }
    }

    if (laneDef.key === 'road' && laneRoll < 0.42 * density) {
      const variant = Math.floor(lane.seed * 1000) % 2 === 0 ? 'foodCart' : 'benson1';
      const profile = GAME_CONFIG.props.render[variant];
      props.push(this.createDecorProp(variant, lane, { ...profile, edgePadding: 0.2 }));
    }

    if (['grass', 'road'].includes(laneDef.key) && laneRoll < GAME_CONFIG.props.roadSignSpawnChance * density) {
      const sign = this.nextStreetSignAsset();
      const profile = GAME_CONFIG.props.render[sign];
      props.push(this.createDecorProp(sign, lane, { ...profile, edgePadding: 0.08 + hash01(lane.y) * 0.5, zIndex: 2 }));
    }

    if (!this.propRuntime.landmarksSpawned.has('portland') && lane.y === this.propRuntime.earlyLandmarkY && ['grass', 'road'].includes(laneDef.key)) {
      this.propRuntime.landmarksSpawned.add('portland');
      const profile = GAME_CONFIG.props.render.portlandOregonSign;
      props.push(this.createDecorProp('portlandOregonSign', lane, { ...profile, anchor: 'left', edgePadding: 0.18, zIndex: 3 }));
    }

    if (!this.propRuntime.landmarksSpawned.has('bookstore') && lane.y === this.propRuntime.bookstoreY && ['grass', 'road'].includes(laneDef.key)) {
      this.propRuntime.landmarksSpawned.add('bookstore');
      const profile = GAME_CONFIG.props.render.bookstore1;
      props.push(this.createDecorProp('bookstore1', lane, { ...profile, anchor: 'right', edgePadding: 0.05, zIndex: 0 }));
    }

    return props;
  }

  laneSupportsHazards(lane) {
    return this.getLaneDefinition(lane?.type).allowedHazards.length > 0;
  }

  laneSupportsPlatforms(lane) {
    return this.getLaneDefinition(lane?.type).allowedPlatforms.length > 0;
  }

  isHazardCompatibleWithLane(hazard) {
    const lane = this.laneCache.get(hazard.y);
    if (!lane) return false;
    const laneDef = this.getLaneDefinition(lane.type);
    return laneDef.allowedHazards.includes(hazard.type);
  }

  isPlatformCompatibleWithLane(platform) {
    const lane = this.laneCache.get(platform.y);
    if (!lane) return false;
    const laneDef = this.getLaneDefinition(lane.type);
    return laneDef.allowedPlatforms.includes(platform.type);
  }

  ensureLane(y) {
    if (this.laneCache.has(y)) return;
    const lane = this.terrainSystem.createLane(y, this.score);
    lane.decorProps = this.generateLaneProps(lane);
    if (lane.type === 'water') {
      const platformW = this.getMovingProfile(lane.platformType).render.width;
      lane.speed *= this.runtimeRiverDensity;
      const maxIntervalByGap = GAME_CONFIG.riverPlatforms.maxGapSeconds - platformW / lane.speed;
      lane.interval = clamp(lane.interval, GAME_CONFIG.riverPlatforms.minInterval, Math.max(GAME_CONFIG.riverPlatforms.minInterval, maxIntervalByGap));
      this.seedWaterLanePlatforms(lane);
    }
    if (lane.type === 'road') lane.speed *= this.runtimeTrafficSpeedMultiplier;
    if (lane.type === 'rail') lane.warningLead = this.runtimeTrainWarningLead;
    this.laneCache.set(y, lane);
    this.terrainSystem.updateConnectedContextForLane(y, this.laneCache);
    this.terrainSystem.updateConnectedContextForLane(y - 1, this.laneCache);
    this.terrainSystem.updateConnectedContextForLane(y + 1, this.laneCache);
  }

  seedWaterLanePlatforms(lane) {
    const count = Math.max(1, Math.round(GAME_CONFIG.riverPlatforms.minLanePlatformCount * this.runtimeRiverDensity));
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
    const laneDef = this.getLaneDefinition(lane?.type);
    if (laneDef.allowedHazards.length === 0) return;
    const startX = lane.direction > 0 ? -1.4 : GAME_CONFIG.cols + 1.4;
    const vehicleType = randomFrom(laneDef.allowedHazards);
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
    const laneDef = this.getLaneDefinition(lane?.type);
    if (laneDef.allowedPlatforms.length === 0) return;
    const platformType = lane.platformType ?? randomFrom(laneDef.allowedPlatforms);
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
      if (!lane || !this.getLaneDefinition(lane.type).allowsCoins) continue;

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
    this.ui.showToast(`Cheat activated: +${GAME_CONFIG.cheats.rewardCoins} coins`, 'info');
  }

  update(dt) {
    this.time += dt;
    if (this.superJumpState?.active) {
      this.updateSuperJump(dt);
    } else {
      this.player.drawX += (this.player.fx - this.player.drawX) * 0.45;
      this.player.drawY += (this.player.y - this.player.drawY) * 0.34;
      this.player.tilt *= 0.86;
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

    this.cameraY += (this.player.y - this.runtimeCameraOffsetRows - this.cameraY) * GAME_CONFIG.cameraLerp;

    const stage = this.score / GAME_CONFIG.difficultyRampEvery;
    const difficulty = clamp(1 + stage * 0.06 + Math.sqrt(stage) * 0.05, 1, 2.35);

    for (const lane of this.laneCache.values()) {
      if (!this.laneSupportsHazards(lane) && !this.laneSupportsPlatforms(lane)) continue;
      lane.timer += dt;
      let minInterval = 1.1;
      if (this.laneSupportsPlatforms(lane)) minInterval = GAME_CONFIG.riverPlatforms.minInterval;
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
        if (this.laneSupportsPlatforms(lane)) this.spawnPlatform(lane);
        else if (this.laneSupportsHazards(lane)) this.spawnHazard(lane);
      }
    }

    this.coinSpawnTimer += dt;
    if (this.coinSpawnTimer >= 1) {
      this.coinSpawnTimer = 0;
      if (Math.random() < this.runtimeCoinSpawnChance) this.spawnCoin();
    }

    for (const hazard of this.hazards) {
      hazard.prevX = hazard.x;
      hazard.x += hazard.speed * hazard.dir * dt;
      this.maybeTriggerTrainPassShake(hazard);
    }
    this.hazards = this.hazards.filter((h) => this.isHazardCompatibleWithLane(h) && h.x > -5 && h.x < GAME_CONFIG.cols + 5);

    for (const platform of this.platforms) {
      platform.prevX = platform.x;
      platform.x += platform.speed * platform.dir * dt;
    }
    this.platforms = this.platforms.filter((p) => this.isPlatformCompatibleWithLane(p) && p.x > -5 && p.x < GAME_CONFIG.cols + 5);

    this.updateRiverAttachment(dt);

    const minCoinY = this.player.y - 2;
    this.coins = this.coins.filter((coin) => coin.y >= minCoinY);

    if (!this.superJumpState?.active) {
      this.handleCollisions(dt);
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
      this.kill(DEATH_CAUSES.OFF_PLATFORM);
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
        this.kill(h.type === 'maxTrain' ? DEATH_CAUSES.TRAIN : DEATH_CAUSES.CAR);
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
        this.kill(DEATH_CAUSES.RIVER);
      }
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
    const shadeTop = ctx.createLinearGradient(0, laneY, 0, laneY + laneHeight);
    shadeTop.addColorStop(0, 'rgba(13, 26, 14, 0.26)');
    shadeTop.addColorStop(0.5, 'rgba(55, 92, 50, 0.08)');
    shadeTop.addColorStop(1, 'rgba(12, 24, 13, 0.2)');
    ctx.fillStyle = shadeTop;
    ctx.fillRect(0, laneY, this.worldWidth, laneHeight);

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

    const overlay = ctx.createLinearGradient(0, laneY, 0, laneY + laneHeight);
    overlay.addColorStop(0, 'rgba(16, 47, 66, 0.72)');
    overlay.addColorStop(0.48, 'rgba(39, 102, 128, 0.2)');
    overlay.addColorStop(1, 'rgba(13, 42, 60, 0.74)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, laneY, this.worldWidth, laneHeight);

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
      } else if (lane.terrainType === 'water') this.drawWaterLane({ lane, laneY, laneHeight, laneIndex: y });
      else if (lane.terrainType === 'rail') this.drawRailLane({ lane, laneY, laneHeight, laneIndex: y });
      else this.drawGrassLane({ lane, laneY, laneHeight, laneIndex: y });

      this.drawProps(lane, laneY, laneDef);
    }
  }

  drawProps(lane, y, laneDef = this.getLaneDefinition(lane.type)) {
    const ctx = this.ctx;
    if (!laneDef.allowedProps.length) return;
    const props = [...(lane.decorProps ?? [])].sort((a, b) => a.zIndex - b.zIndex);
    for (const prop of props) {
      const sprite = this.environmentSprites[prop.assetKey];
      if (!sprite?.complete) continue;
      ctx.drawImage(sprite, prop.x * this.tile, y + this.tile * prop.offsetY, this.tile * prop.width, this.tile * prop.height);
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
    const shadowScale = this.superJumpState?.active ? 0.7 : 1;
    ctx.ellipse(x + w / 2, y + h * 0.95, w * 0.4 * shadowScale, h * 0.15 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.superJumpState?.active) {
      this.drawSuperJumpEnergy(x + w / 2, y + h * 0.48, w, h, this.player.superJumpEnergy ?? 0);
    }

    const sprite = this.player.visualState === 'superJump' ? this.playerSprites.superJump : this.playerSprites[this.player.facing];
    if (!this.drawSpriteWithRenderProfile(sprite, { x, y, width: w, height: h }, 'player')) {
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
    for (const drop of this.rainDrops) {
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - 2, drop.y + drop.len);
      ctx.stroke();
    }

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
    const debugOpacity = this.runtimeHitboxOpacity;
    const withOpacity = (color, alpha) => color.replace(/0\.\d+\)$/, `${Math.max(0.05, Math.min(1, alpha * debugOpacity))})`);
    // Toggle with the dev key in config (default: C) to visualize broad boxes, mask footprint, and ride zones.
    const entries = [
      { entity: this.getPlayerCollisionEntity(), type: 'player', orientation: this.player.facing, color: withOpacity('rgba(245, 219, 111, 0.7)', 0.7), showMask: true }
    ];

    for (const h of this.hazards) {
      const profile = this.getMovingProfile(h.type);
      entries.push({
        entity: this.getHazardCollisionEntity(h),
        type: profile.collision.type,
        color: withOpacity('rgba(238, 104, 104, 0.7)', 0.7),
        swept: true,
        showMask: false
      });
    }

    for (const p of this.platforms) {
      entries.push({
        entity: this.getPlatformCollisionEntity(p),
        type: 'platform',
        color: p.id === this.attachedPlatformId ? withOpacity('rgba(107, 236, 146, 0.9)', 0.9) : withOpacity('rgba(111, 214, 170, 0.7)', 0.7),
        showMask: false
      });
    }

    for (const coin of this.coins) {
      entries.push({ entity: this.getCoinCollisionEntity(coin), type: 'collectible', color: withOpacity('rgba(255, 221, 111, 0.7)', 0.7), showMask: false });
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
