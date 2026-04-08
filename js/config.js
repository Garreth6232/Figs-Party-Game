export const STORAGE_KEYS = {
  bestScore: 'fig_game_best',
  muted: 'fig_game_muted'
};

export const GAME_STATES = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over'
};

export const ASSET_PATHS = {
  manifest: 'assets/data/asset-manifest.json',
  images: {
    playerSprites: {
      forward: 'assets/images/player-forward.svg',
      left: 'assets/images/player-left.svg',
      right: 'assets/images/player-right.svg',
      back: 'assets/images/player-back.svg'
    },
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
  baseMoveCooldown: 92,
  startY: 2,
  difficultyRampEvery: 14,
  despawnMargin: 3,
  cameraLerp: 0.22,
  screenShakeDecay: 0.88,
  screenShakeMax: 11,
  particleLifetime: 0.4,
  rainAmount: 90,
  lanePalette: {
    grass: '#425942',
    road: '#4c5660',
    water: '#546a7b',
    rail: '#646c55'
  },
  laneWeights: [
    { type: 'grass', weight: 2.2 },
    { type: 'road', weight: 4.0 },
    { type: 'water', weight: 2.0 },
    { type: 'rail', weight: 1.25 }
  ]
};
