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

export const ASSET_GUIDE = [
  {
    id: 'maxTrain',
    name: 'MAX Train',
    preview: ASSET_MANIFEST.vehicles.maxTrain,
    action: 'avoid',
    description: 'A fast train hazard that can instantly end your run, so avoid it.'
  },
  {
    id: 'car1',
    name: 'Car 1',
    preview: ASSET_MANIFEST.vehicles.car1,
    action: 'avoid',
    description: 'Standard road traffic that should always be avoided.'
  },
  {
    id: 'car2',
    name: 'Car 2',
    preview: ASSET_MANIFEST.vehicles.car2,
    action: 'avoid',
    description: 'A slightly wider road car that should always be avoided.'
  },
  {
    id: 'coin',
    name: 'Coin',
    preview: ASSET_MANIFEST.collectibles.coin,
    action: 'collect',
    description: 'A collectible item that helps charge your super jump, so collect it.'
  },
  {
    id: 'raft1',
    name: 'Raft',
    preview: ASSET_MANIFEST.hazards.raft1,
    action: 'ride',
    description: 'A floating platform that helps you cross river lanes safely, so use it.'
  },
  {
    id: 'riverTile',
    name: 'River Tile',
    preview: ASSET_MANIFEST.environment.riverTile,
    action: 'avoid',
    description: 'Dangerous water that should be avoided unless you are on a valid platform.'
  },
  {
    id: 'figForward',
    name: 'figForward',
    preview: ASSET_MANIFEST.player.figForward,
    action: 'ignore',
    description: 'The forward-facing fig sprite is informational only for your current direction.'
  },
  {
    id: 'figLeft',
    name: 'figLeft',
    preview: ASSET_MANIFEST.player.figLeft,
    action: 'ignore',
    description: 'The left-facing fig sprite is informational only for your current direction.'
  },
  {
    id: 'figRight',
    name: 'figRight',
    preview: ASSET_MANIFEST.player.figRight,
    action: 'ignore',
    description: 'The right-facing fig sprite is informational only for your current direction.'
  },
  {
    id: 'figBack',
    name: 'figBack',
    preview: ASSET_MANIFEST.player.figBack,
    action: 'ignore',
    description: 'The back-facing fig sprite is informational only for your current direction.'
  }
];

export const GAME_CONFIG = {
  cols: 9,
  tileSize: 96,
  visibleRows: 14,
  baseMoveCooldown: 92,
  startY: 2,
  safeZones: {
    guaranteedSafeRows: 6,
    spawnClearanceRows: 3
  },
  difficultyRampEvery: 14,
  despawnMargin: 3,
  cameraLerp: 0.22,
  screenShakeDecay: 0.88,
  screenShakeMax: 11,
  particleLifetime: 0.4,
  rainAmount: 90,
  debug: {
    collisionOverlay: false,
    keyToggle: 'KeyC',
    password: '123'
  },
  alignment: {
    player: { renderOffsetY: 0.0, collisionOffsetY: 0.0 },
    platform: { renderOffsetY: -0.02, collisionOffsetY: -0.02 },
    collectible: { renderOffsetY: -0.03, collisionOffsetY: -0.03 }
  },
  movingEntities: {
    anchors: {
      movingObjects: 'center'
    },
    profiles: {
      car1: {
        render: { width: 1.2, height: 0.7, offsetX: 0, offsetY: 0 },
        collision: { type: 'car', width: 1.08, height: 0.56, offsetX: 0, offsetY: 0.01 }
      },
      car2: {
        render: { width: 1.2, height: 0.7, offsetX: 0, offsetY: 0 },
        collision: { type: 'car', width: 1.12, height: 0.58, offsetX: 0, offsetY: 0.01 }
      },
      car3: {
        render: { width: 1.2, height: 0.7, offsetX: 0, offsetY: 0 },
        collision: { type: 'car', width: 1.1, height: 0.56, offsetX: 0, offsetY: 0.01 }
      },
      bike1: {
        render: { width: 0.9, height: 0.7, offsetX: 0, offsetY: 0 },
        collision: { type: 'bike', width: 0.78, height: 0.46, offsetX: 0, offsetY: 0.08 }
      },
      scooter1: {
        render: { width: 1.0, height: 0.7, offsetX: 0, offsetY: 0 },
        collision: { type: 'scooter', width: 0.86, height: 0.44, offsetX: 0, offsetY: 0.08 }
      },
      maxTrain: {
        render: { width: 2.8, height: 0.8, offsetX: 0, offsetY: 0 },
        collision: { type: 'maxTrain', width: 2.72, height: 0.62, offsetX: 0, offsetY: 0.05 }
      },
      log1: {
        render: { width: 1.5, height: 0.52, offsetX: 0, offsetY: -0.02 },
        collision: { type: 'platform', width: 1.4, height: 0.34, offsetX: 0, offsetY: 0 }
      },
      raft1: {
        render: { width: 1.2, height: 0.48, offsetX: 0, offsetY: -0.02 },
        collision: { type: 'platform', width: 1.1, height: 0.32, offsetX: 0, offsetY: 0 }
      },
      kayak1: {
        render: { width: 0.95, height: 0.42, offsetX: 0, offsetY: -0.02 },
        collision: { type: 'platform', width: 0.78, height: 0.25, offsetX: 0, offsetY: 0.02 }
      }
    }
  },
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
  trainWarning: {
    leadTime: 1.25,
    flashHz: 4.5
  },
  riverPlatforms: {
    hitboxPaddingX: 0.03,
    laneTypes: ['log1', 'raft1', 'kayak1'],
    minSpeed: 0.85,
    maxSpeed: 1.75,
    minInterval: 1.35,
    maxInterval: 2.6,
    minLanePlatformCount: 3,
    maxGapSeconds: 1.65,
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
  collisions: {
    maskResolution: 20,
    sampleStridePx: 2,
    profiles: {
      player: {
        width: 0.56,
        height: 0.6,
        broadPadding: { x: 0.015, y: 0.02 }
      },
      car: { width: 1.1, height: 0.58, broadPadding: { x: 0.02, y: 0.03 } },
      bike: { width: 0.78, height: 0.46, broadPadding: { x: 0.015, y: 0.03 } },
      scooter: { width: 0.86, height: 0.44, broadPadding: { x: 0.02, y: 0.03 } },
      maxTrain: { width: 2.72, height: 0.62, broadPadding: { x: 0.015, y: 0.025 } },
      platform: { broadPadding: { x: 0.01, y: 0.02 } },
      collectible: { width: 0.28, height: 0.28, broadPadding: { x: 0.01, y: 0.01 } }
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
