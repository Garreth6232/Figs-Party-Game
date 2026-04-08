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

export const ASSET_MANIFEST = {
  player: {
    figForward: 'assets/player/figForward.svg',
    figLeft: 'assets/player/figLeft.svg',
    figRight: 'assets/player/figRight.svg',
    figBack: 'assets/player/figBack.svg'
  },
  vehicles: {
    car1: 'assets/vehicles/car1.svg',
    car2: 'assets/vehicles/car2.svg',
    car3: 'assets/vehicles/car3.svg',
    bike1: 'assets/vehicles/bike1.svg',
    scooter1: 'assets/vehicles/scooter1.svg',
    maxTrain: 'assets/vehicles/maxTrain.svg'
  },
  hazards: {
    log1: 'assets/hazards/log1.svg',
    raft1: 'assets/hazards/raft1.svg',
    kayak1: 'assets/hazards/kayak1.svg'
  },
  collectibles: {
    coin: 'assets/collectibles/coin.svg'
  },
  environment: {
    riverTile: 'assets/environment/riverTile.svg',
    roadTile: 'assets/environment/roadTile.svg',
    sidewalkTile: 'assets/environment/sidewalkTile.svg',
    bridgeTile: 'assets/environment/bridgeTile.svg',
    tree1: 'assets/environment/tree1.svg',
    foodCart1: 'assets/environment/foodCart1.svg'
  },
  ui: {
    superJumpReady: 'assets/ui/superJumpReady.svg'
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
  safeStartRows: 6,
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
    water: '#3f5d73',
    rail: '#646c55'
  },
  laneWeights: [
    { type: 'grass', weight: 2.2 },
    { type: 'road', weight: 4.0 },
    { type: 'water', weight: 2.0 },
    { type: 'rail', weight: 1.25 }
  ],
  riverPlatforms: {
    hitboxPaddingX: 0.06,
    laneTypes: ['log1', 'raft1', 'kayak1'],
    minSpeed: 0.85,
    maxSpeed: 1.75,
    minInterval: 1.9,
    maxInterval: 3.25,
    widthByType: {
      log1: 1.5,
      raft1: 1.2,
      kayak1: 0.95
    },
    heightByType: {
      log1: 0.52,
      raft1: 0.48,
      kayak1: 0.42
    }
  },
  coins: {
    spawnChancePerSecond: 0.5,
    maxActive: 3,
    spawnAheadMin: 4,
    spawnAheadMax: 15,
    coinsNeededForSuperJump: 10,
    superJumpDistance: 20
  }
};
