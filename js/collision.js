import { GAME_CONFIG } from './config.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function createMask(resolution, painter) {
  const mask = Array.from({ length: resolution }, () => Array(resolution).fill(false));
  for (let y = 0; y < resolution; y += 1) {
    for (let x = 0; x < resolution; x += 1) {
      const nx = (x + 0.5) / resolution;
      const ny = (y + 0.5) / resolution;
      mask[y][x] = painter(nx, ny);
    }
  }
  return mask;
}

const orientationMasks = {
  forward: createMask(GAME_CONFIG.collisions.maskResolution, (x, y) => {
    const body = ((x - 0.5) ** 2) / 0.09 + ((y - 0.58) ** 2) / 0.14 <= 1;
    const head = ((x - 0.5) ** 2) / 0.03 + ((y - 0.2) ** 2) / 0.04 <= 1;
    return body || head;
  }),
  back: createMask(GAME_CONFIG.collisions.maskResolution, (x, y) => {
    const body = ((x - 0.5) ** 2) / 0.085 + ((y - 0.58) ** 2) / 0.13 <= 1;
    const hood = ((x - 0.5) ** 2) / 0.035 + ((y - 0.28) ** 2) / 0.035 <= 1;
    return body || hood;
  }),
  left: createMask(GAME_CONFIG.collisions.maskResolution, (x, y) => {
    const body = ((x - 0.56) ** 2) / 0.12 + ((y - 0.54) ** 2) / 0.14 <= 1;
    const head = ((x - 0.24) ** 2) / 0.03 + ((y - 0.35) ** 2) / 0.03 <= 1;
    return body || head;
  }),
  right: createMask(GAME_CONFIG.collisions.maskResolution, (x, y) => {
    const body = ((x - 0.44) ** 2) / 0.12 + ((y - 0.54) ** 2) / 0.14 <= 1;
    const head = ((x - 0.76) ** 2) / 0.03 + ((y - 0.35) ** 2) / 0.03 <= 1;
    return body || head;
  })
};

const staticMasks = {
  car: createMask(GAME_CONFIG.collisions.maskResolution, (x, y) => x > 0.06 && x < 0.94 && y > 0.24 && y < 0.84),
  bike: createMask(
    GAME_CONFIG.collisions.maskResolution,
    (x, y) => (x > 0.08 && x < 0.92 && y > 0.4 && y < 0.72) || ((x - 0.18) ** 2 + (y - 0.75) ** 2 < 0.02)
  ),
  scooter: createMask(
    GAME_CONFIG.collisions.maskResolution,
    (x, y) => (x > 0.08 && x < 0.92 && y > 0.36 && y < 0.72) || ((x - 0.85) ** 2 + (y - 0.28) ** 2 < 0.01)
  ),
  maxTrain: createMask(GAME_CONFIG.collisions.maskResolution, (x, y) => x > 0.02 && x < 0.98 && y > 0.18 && y < 0.9),
  platform: createMask(GAME_CONFIG.collisions.maskResolution, (x, y) => x > 0.06 && x < 0.94 && y > 0.24 && y < 0.86),
  collectible: createMask(GAME_CONFIG.collisions.maskResolution, (x, y) => (x - 0.5) ** 2 + (y - 0.5) ** 2 < 0.18)
};

export class CollisionSystem {
  constructor() {
    this.debugEnabled = GAME_CONFIG.debug.collisionOverlay;
  }

  toggleDebug() {
    this.debugEnabled = !this.debugEnabled;
    return this.debugEnabled;
  }

  getProfile(type) {
    return GAME_CONFIG.collisions.profiles[type] ?? GAME_CONFIG.collisions.profiles.player;
  }

  getMask(type, orientation = 'forward') {
    if (type === 'player') return orientationMasks[orientation] ?? orientationMasks.forward;
    return staticMasks[type] ?? staticMasks.car;
  }

  getAABB(entity, type, tile, { swept = false } = {}) {
    const profile = this.getProfile(type);
    const width = (entity.w ?? profile.width) * tile;
    const height = (entity.h ?? profile.height) * tile;
    const centerX = (entity.x + 0.5) * tile;
    const centerY = entity.screenY + tile * 0.5;
    const padX = (profile.broadPadding?.x ?? 0) * tile;
    const padY = (profile.broadPadding?.y ?? 0) * tile;

    let left = centerX - width * 0.5 - padX;
    let right = centerX + width * 0.5 + padX;

    if (swept && Number.isFinite(entity.prevX)) {
      const prevCenterX = (entity.prevX + 0.5) * tile;
      left = Math.min(left, prevCenterX - width * 0.5 - padX);
      right = Math.max(right, prevCenterX + width * 0.5 + padX);
    }

    return {
      left,
      right,
      top: centerY - height * 0.5 - padY,
      bottom: centerY + height * 0.5 + padY,
      width,
      height,
      centerX,
      centerY
    };
  }

  broadPhase(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  narrowPhase(entityA, typeA, orientA, entityB, typeB, orientB, tile) {
    const aabbA = this.getAABB(entityA, typeA, tile);
    const aabbB = this.getAABB(entityB, typeB, tile);
    if (!this.broadPhase(aabbA, aabbB)) return false;

    const left = Math.max(aabbA.left, aabbB.left);
    const top = Math.max(aabbA.top, aabbB.top);
    const right = Math.min(aabbA.right, aabbB.right);
    const bottom = Math.min(aabbA.bottom, aabbB.bottom);
    const maskA = this.getMask(typeA, orientA);
    const maskB = this.getMask(typeB, orientB);
    const stride = GAME_CONFIG.collisions.sampleStridePx;

    for (let y = top; y <= bottom; y += stride) {
      for (let x = left; x <= right; x += stride) {
        const ax = clamp(Math.floor(((x - aabbA.left) / (aabbA.right - aabbA.left)) * maskA.length), 0, maskA.length - 1);
        const ay = clamp(Math.floor(((y - aabbA.top) / (aabbA.bottom - aabbA.top)) * maskA.length), 0, maskA.length - 1);
        if (!maskA[ay][ax]) continue;
        const bx = clamp(Math.floor(((x - aabbB.left) / (aabbB.right - aabbB.left)) * maskB.length), 0, maskB.length - 1);
        const by = clamp(Math.floor(((y - aabbB.top) / (aabbB.bottom - aabbB.top)) * maskB.length), 0, maskB.length - 1);
        if (maskB[by][bx]) return true;
      }
    }
    return false;
  }

  drawDebug(ctx, entries, tile) {
    if (!this.debugEnabled) return;
    for (const entry of entries) {
      const broad = this.getAABB(entry.entity, entry.type, tile, { swept: entry.swept });
      ctx.strokeStyle = entry.color ?? 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(broad.left, broad.top, broad.right - broad.left, broad.bottom - broad.top);

      if (!entry.showMask) continue;
      const mask = this.getMask(entry.type, entry.orientation);
      ctx.fillStyle = (entry.color ?? 'rgba(255,255,255,0.7)').replace('0.7', '0.18');
      const cellW = (broad.right - broad.left) / mask.length;
      const cellH = (broad.bottom - broad.top) / mask.length;
      for (let y = 0; y < mask.length; y += 1) {
        for (let x = 0; x < mask.length; x += 1) {
          if (!mask[y][x]) continue;
          ctx.fillRect(broad.left + x * cellW, broad.top + y * cellH, cellW, cellH);
        }
      }
    }
  }
}
