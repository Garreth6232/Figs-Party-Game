export const STORAGE_KEYS = {
  bestScore: 'neon_hopper_best',
  muted: 'neon_hopper_muted'
};

export const ASSET_PATHS = {
  manifest: 'assets/data/asset-manifest.json',
  images: {
    player: 'assets/images/player-placeholder.svg',
    vehicle: 'assets/images/vehicle-placeholder.svg',
    log: 'assets/images/log-placeholder.svg'
  },
  audio: {
    hop: 'assets/audio/hop.wav',
    hit: 'assets/audio/hit.wav',
    score: 'assets/audio/score.wav',
    ui: 'assets/audio/ui.wav'
  }
};

export const GAME_CONFIG = {
  cols: 9,
  tileSize: 96,
  visibleRows: 14,
  baseMoveCooldown: 105,
  startY: 2,
  difficultyRampEvery: 12,
  despawnMargin: 3,
  cameraLerp: 0.2,
  screenShakeDecay: 0.86,
  screenShakeMax: 14,
  particleLifetime: 0.35,
  lanePalette: {
    grass: '#14532d',
    road: '#1f2937',
    water: '#0c4a6e',
    rail: '#3f3f46'
  },
  laneWeights: [
    { type: 'grass', weight: 2.4 },
    { type: 'road', weight: 4.1 },
    { type: 'water', weight: 2.6 },
    { type: 'rail', weight: 1.3 }
  ]
};
