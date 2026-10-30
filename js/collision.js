import { GAME_CONFIG } from './config.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// Masks are built from the real sprite pixels, so a hitbox is exactly what the player sees.
// A shape is { x, y, width, height, mask, flipX, scale } in screen pixels, where x/y/width/height
// is the rectangle the sprite is drawn into and scale shrinks the solid area around its center.
function buildMaskFromImage(image, crop = {}) {
  const { alphaThreshold, maskLongSide } = GAME_CONFIG.collisions;
  const sx = image.naturalWidth * (crop.left ?? 0);
  const sy = image.naturalHeight * (crop.top ?? 0);
  const sw = image.naturalWidth * (1 - (crop.left ?? 0) - (crop.right ?? 0));
  const sh = image.naturalHeight * (1 - (crop.top ?? 0) - (crop.bottom ?? 0));
  if (sw <= 0 || sh <= 0) return null;

  const aspect = sw / sh;
  const cols = Math.max(4, Math.round(aspect >= 1 ? maskLongSide : maskLongSide * aspect));
  const rows = Math.max(4, Math.round(aspect >= 1 ? maskLongSide / aspect : maskLongSide));
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, cols, rows);
  const pixels = ctx.getImageData(0, 0, cols, rows).data;

  const data = new Uint8Array(cols * rows);
  let minCol = cols;
  let maxCol = -1;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (pixels[(row * cols + col) * 4 + 3] < alphaThreshold) continue;
      data[row * cols + col] = 1;
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
    }
  }
  if (maxCol < 0) return null;

  return { cols, rows, data, minU: minCol / cols, maxU: (maxCol + 1) / cols };
}

// Used until a sprite has loaded (or if the browser blocks reading its pixels).
const FALLBACK_MASK = (() => {
  const cols = 10;
  const rows = 10;
  const data = new Uint8Array(cols * rows);
  for (let row = 2; row < 8; row += 1) {
    for (let col = 1; col < 9; col += 1) data[row * cols + col] = 1;
  }
  return { cols, rows, data, minU: 0.1, maxU: 0.9 };
})();

export class CollisionSystem {
  constructor() {
    this.debugEnabled = GAME_CONFIG.debug.collisionOverlay;
    this.maskCache = new WeakMap();
    this.pixelReadBlocked = false;
  }

  toggleDebug() {
    this.debugEnabled = !this.debugEnabled;
    return this.debugEnabled;
  }

  getMask(image, crop) {
    if (!image?.complete || !image.naturalWidth || this.pixelReadBlocked) return FALLBACK_MASK;
    const cropKey = `${crop?.left ?? 0},${crop?.right ?? 0},${crop?.top ?? 0},${crop?.bottom ?? 0}`;
    let byCrop = this.maskCache.get(image);
    if (!byCrop) {
      byCrop = new Map();
      this.maskCache.set(image, byCrop);
    }
    if (!byCrop.has(cropKey)) {
      try {
        byCrop.set(cropKey, buildMaskFromImage(image, crop) ?? FALLBACK_MASK);
      } catch {
        // Opening index.html straight from disk blocks pixel reads; fall back to box hitboxes.
        this.pixelReadBlocked = true;
        return FALLBACK_MASK;
      }
    }
    return byCrop.get(cropKey);
  }

  // Horizontal extent of the visible pixels, in screen pixels.
  getVisibleSpan(shape) {
    const { minU, maxU } = shape.mask;
    const left = shape.flipX ? 1 - maxU : minU;
    const right = shape.flipX ? 1 - minU : maxU;
    return { left: shape.x + left * shape.width, right: shape.x + right * shape.width };
  }

  getBounds(shape) {
    const scale = shape.scale ?? 1;
    const width = shape.width * scale;
    const height = shape.height * scale;
    const left = shape.x + (shape.width - width) / 2;
    const top = shape.y + (shape.height - height) / 2;
    return { left, top, right: left + width, bottom: top + height };
  }

  isSolidAt(shape, bounds, px, py) {
    const { mask } = shape;
    let u = (px - bounds.left) / (bounds.right - bounds.left);
    const v = (py - bounds.top) / (bounds.bottom - bounds.top);
    if (shape.flipX) u = 1 - u;
    const col = clamp(Math.floor(u * mask.cols), 0, mask.cols - 1);
    const row = clamp(Math.floor(v * mask.rows), 0, mask.rows - 1);
    return mask.data[row * mask.cols + col] === 1;
  }

  overlaps(a, b) {
    const boundsA = this.getBounds(a);
    const boundsB = this.getBounds(b);
    const left = Math.max(boundsA.left, boundsB.left);
    const right = Math.min(boundsA.right, boundsB.right);
    const top = Math.max(boundsA.top, boundsB.top);
    const bottom = Math.min(boundsA.bottom, boundsB.bottom);
    if (left >= right || top >= bottom) return false;

    const stride = GAME_CONFIG.collisions.sampleStridePx;
    for (let y = top + stride / 2; y < bottom; y += stride) {
      for (let x = left + stride / 2; x < right; x += stride) {
        if (this.isSolidAt(a, boundsA, x, y) && this.isSolidAt(b, boundsB, x, y)) return true;
      }
    }
    return false;
  }

  drawDebug(ctx, entries) {
    if (!this.debugEnabled) return;
    for (const { shape, color, showMask } of entries) {
      const bounds = this.getBounds(shape);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
      if (!showMask) continue;

      const { mask } = shape;
      const cellW = (bounds.right - bounds.left) / mask.cols;
      const cellH = (bounds.bottom - bounds.top) / mask.rows;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.35;
      for (let row = 0; row < mask.rows; row += 1) {
        for (let col = 0; col < mask.cols; col += 1) {
          if (!mask.data[row * mask.cols + col]) continue;
          const drawCol = shape.flipX ? mask.cols - 1 - col : col;
          ctx.fillRect(bounds.left + drawCol * cellW, bounds.top + row * cellH, cellW, cellH);
        }
      }
      ctx.globalAlpha = 1;
    }
  }
}
