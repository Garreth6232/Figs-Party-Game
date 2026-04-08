export const STORAGE_KEYS = {
  bestScore: 'fig_game_best',
  muted: 'fig_game_muted',
  leaderboard: 'fig_game_leaderboard_v1'
};

export const GAME_STATES = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over'
};

export const LEADERBOARD_LIMIT = 10;
export const STANDARD_ROAD_VEHICLE_KEYS = ['car1', 'car2', 'car3', 'bike1', 'scooter1'];

export const ASSET_METADATA = [
  {
    key: 'figForward',
    path: 'assets/player/figForward.png',
    category: 'player sprites',
    label: 'Fig (Forward)',
    description: 'Default forward-facing player sprite for downward movement.',
    interactionType: 'ignore',
    visibleInInfoMenu: true,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'figLeft',
    path: 'assets/player/figLeft.png',
    category: 'player sprites',
    label: 'Fig (Left)',
    description: 'Player sprite used while moving left.',
    interactionType: 'ignore',
    visibleInInfoMenu: true,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'figRight',
    path: 'assets/player/figRight.png',
    category: 'player sprites',
    label: 'Fig (Right)',
    description: 'Player sprite used while moving right.',
    interactionType: 'ignore',
    visibleInInfoMenu: true,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'figBack',
    path: 'assets/player/figBack.png',
    category: 'player sprites',
    label: 'Fig (Back)',
    description: 'Player sprite used while moving up/lane-forward.',
    interactionType: 'ignore',
    visibleInInfoMenu: true,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'figSJ',
    path: 'assets/player/figSJ.png',
    category: 'super jump sprite',
    label: 'Fig (Super Jump)',
    description: 'Temporary player visual shown while super jump is active.',
    interactionType: 'ignore',
    visibleInInfoMenu: false,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'car1',
    path: 'assets/vehicles/car1.png',
    category: 'vehicles',
    label: 'Car 1',
    description: 'Standard road car hazard.',
    interactionType: 'avoid',
    visibleInInfoMenu: true,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'car2',
    path: 'assets/vehicles/car1.png',
    category: 'vehicles',
    label: 'Car 2 (car1 visual)',
    description: 'Standard road hazard variant using the shared car1 sprite.',
    interactionType: 'avoid',
    visibleInInfoMenu: true,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'car3',
    path: 'assets/vehicles/car1.png',
    category: 'vehicles',
    label: 'Car 3 (car1 visual)',
    description: 'Standard road hazard variant using the shared car1 sprite.',
    interactionType: 'avoid',
    visibleInInfoMenu: false,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'bike1',
    path: 'assets/vehicles/car1.png',
    category: 'vehicles',
    label: 'Bike (car1 visual)',
    description: 'Road hazard profile with bike tuning and shared car1 sprite.',
    interactionType: 'avoid',
    visibleInInfoMenu: false,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'scooter1',
    path: 'assets/vehicles/car1.png',
    category: 'vehicles',
    label: 'Scooter (car1 visual)',
    description: 'Road hazard profile with scooter tuning and shared car1 sprite.',
    interactionType: 'avoid',
    visibleInInfoMenu: false,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'maxTrain',
    path: 'assets/vehicles/maxTrain.png',
    category: 'MAX train',
    label: 'MAX Train',
    description: 'Fast rail hazard that ends runs on contact.',
    interactionType: 'avoid',
    visibleInInfoMenu: true,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'log1',
    path: 'assets/hazards/log1.jpg',
    category: 'river platforms',
    label: 'Log',
    description: 'Floating river platform that can carry the player.',
    interactionType: 'ride',
    visibleInInfoMenu: false,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'raft1',
    path: 'assets/hazards/raft1.jpg',
    category: 'river platforms',
    label: 'Raft',
    description: 'Stable floating platform for crossing water lanes.',
    interactionType: 'ride',
    visibleInInfoMenu: true,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'kayak1',
    path: 'assets/hazards/kayak1.jpg',
    category: 'river platforms',
    label: 'Kayak',
    description: 'Narrow floating platform that still supports river traversal.',
    interactionType: 'ride',
    visibleInInfoMenu: false,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'coin',
    path: 'assets/collectibles/coin.png',
    category: 'collectibles',
    label: 'Coin',
    description: 'Collectible that charges super jump energy.',
    interactionType: 'collect',
    visibleInInfoMenu: true,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'grassTile',
    path: 'assets/environment/grassTile.jpg',
    category: 'environment tiles',
    label: 'Grass Tile',
    description: 'Grass lane tile texture used in all grass/background rows.',
    interactionType: 'ignore',
    visibleInInfoMenu: false,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'riverTile',
    path: 'assets/environment/riverTile.png',
    category: 'environment tiles',
    label: 'River Tile',
    description: 'Water lane tile texture used in all river rows.',
    interactionType: 'avoid',
    visibleInInfoMenu: true,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'roadTile',
    path: 'assets/environment/roadTile.jpg',
    category: 'environment tiles',
    label: 'Road Tile',
    description: 'Road lane base tile texture.',
    interactionType: 'avoid',
    visibleInInfoMenu: false,
    visibleInDevAssetBrowser: true
  },

  {
    key: 'railTile',
    path: 'assets/environment/railTile.jpg',
    category: 'environment tiles',
    label: 'Rail Tile',
    description: 'Track lane tile texture used in all MAX rail rows.',
    interactionType: 'avoid',
    visibleInInfoMenu: true,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'sidewalkTile',
    path: 'assets/environment/SidewalkTile.jpg',
    category: 'environment tiles',
    label: 'Sidewalk Tile',
    description: 'Optional decorative sidewalk tile.',
    interactionType: 'ignore',
    visibleInInfoMenu: false,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'bridgeTile',
    path: 'assets/environment/bridgeTile.svg',
    category: 'environment tiles',
    label: 'Bridge Tile',
    description: 'Bridge texture for optional themed lanes.',
    interactionType: 'ignore',
    visibleInInfoMenu: false,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'tree1',
    path: 'assets/environment/tree1.png',
    category: 'props',
    label: 'Tree',
    description: 'Decorative tree prop rendered on grass lanes.',
    interactionType: 'ignore',
    visibleInInfoMenu: false,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'foodCart',
    path: 'assets/environment/foodcart.png',
    category: 'props',
    label: 'Food Cart',
    description: 'Decorative city food cart prop rendered on road lanes.',
    interactionType: 'ignore',
    visibleInInfoMenu: true,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'benson1',
    path: 'assets/environment/benson1.png',
    category: 'props',
    label: 'Benson Kiosk',
    description: 'Street dressing prop that alternates with food carts on road lanes.',
    interactionType: 'ignore',
    visibleInInfoMenu: true,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'superJumpReady',
    path: 'assets/ui/superJumpReady.svg',
    category: 'UI assets',
    label: 'Super Jump Ready Indicator',
    description: 'UI indicator asset used for super jump readiness styling.',
    interactionType: 'internal',
    visibleInInfoMenu: false,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'trainWarning',
    path: '(canvas-generated)',
    category: 'warning indicators',
    label: 'Train Warning Flash',
    description: 'Canvas-generated lane warning shown before train spawn.',
    interactionType: 'internal',
    visibleInInfoMenu: false,
    visibleInDevAssetBrowser: true
  }
];

const buildAssetGroup = (keys) =>
  keys.reduce((group, key) => {
    const asset = ASSET_METADATA.find((entry) => entry.key === key);
    if (asset) group[key] = asset.path;
    return group;
  }, {});

export const ASSET_MANIFEST = {
  player: buildAssetGroup(['figForward', 'figLeft', 'figRight', 'figBack', 'figSJ']),
  vehicles: buildAssetGroup(['car1', 'car2', 'car3', 'bike1', 'scooter1', 'maxTrain']),
  hazards: buildAssetGroup(['log1', 'raft1', 'kayak1']),
  collectibles: buildAssetGroup(['coin']),
  environment: buildAssetGroup(['grassTile', 'riverTile', 'roadTile', 'railTile', 'sidewalkTile', 'bridgeTile', 'tree1', 'foodCart', 'benson1']),
  ui: buildAssetGroup(['superJumpReady']),
  warnings: buildAssetGroup(['trainWarning']),
  audio: {
    hop: 'assets/audio/hop.wav',
    hit: 'assets/audio/hit.wav',
    score: 'assets/audio/score.wav',
    ui: 'assets/audio/ui.wav'
  }
};

export const STANDARD_ROAD_VEHICLE_ASSET_KEY = 'car1';

export const ASSET_GUIDE = ASSET_METADATA.filter((item) => item.visibleInInfoMenu).map((item) => ({
  id: item.key,
  name: item.label,
  preview: item.path,
  action: item.interactionType,
  description: item.description
}));

export const DEV_ASSET_BROWSER_ITEMS = ASSET_METADATA.filter((item) => item.visibleInDevAssetBrowser);

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
  screenShakeDecay: 0.84,
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
  renderProfiles: {
    car1: {
      offsetX: 0,
      offsetY: 0,
      scaleX: 0.96,
      scaleY: 0.86,
      anchor: 'center',
      crop: { left: 0.04, right: 0.04, top: 0.12, bottom: 0.08 }
    },
    maxTrain: {
      offsetX: 0,
      offsetY: 0.02,
      scaleX: 0.98,
      scaleY: 0.88,
      anchor: 'center',
      crop: { left: 0.01, right: 0.01, top: 0.08, bottom: 0.08 }
    },
    player: {
      offsetX: 0,
      offsetY: 0.01,
      scaleX: 1.06,
      scaleY: 1.06,
      anchor: 'center',
      crop: { left: 0.03, right: 0.03, top: 0.05, bottom: 0.04 }
    },
    coin: {
      offsetX: 0,
      offsetY: 0,
      scaleX: 0.95,
      scaleY: 0.95,
      anchor: 'center',
      crop: { left: 0.02, right: 0.02, top: 0.02, bottom: 0.02 }
    }
  },
  lanePalette: {
    grass: '#425942',
    road: '#4c5660',
    water: '#3f5d73',
    rail: '#646c55'
  },
  environmentTiles: {
    baseWorldUnits: { width: 1, height: 1 },
    roadShoulderHeightRatio: 0.14,
    snapToPixels: true,
    overlapPx: 1,
    grass: {
      baseScale: 1.8,
      detailScale: 1.25,
      detailOffsetX: 0.37,
      detailOffsetY: 0.61,
      tonalAlpha: 0.05,
      undulationFreq: 0.0028,
      undulationAlpha: 0.025
    },
    water: {
      tileHeightRatio: 0.9,
      flowSpeed: 0.08,
      foamAlpha: 0.22
    },
    rail: {
      ballastHeightRatio: 0.82,
      tieGapRatio: 0.64,
      tieWidthRatio: 0.2,
      trackGaugeRatio: 0.36
    }
  },
  coinVisuals: {
    bobAmplitudeRatio: 0.05,
    bobFrequencyHz: 5.2,
    shadowAlpha: 0.22,
    shadowOffsetRatio: 0.12
  },
  laneWeights: [
    { type: 'grass', weight: 2.2 },
    { type: 'road', weight: 4.0 },
    { type: 'water', weight: 2.0 },
    { type: 'rail', weight: 1.25 }
  ],
  trainWarning: {
    leadTime: 1.8,
    flashHz: 4.5
  },
  railHazard: {
    minSpeed: 9.5625,
    maxSpeed: 13.5,
    scoreScale: 0.05625,
    minInterval: 4.9,
    maxInterval: 7.8
  },
  effects: {
    maxTrainPassShake: {
      intensity: 3.8,
      duration: 0.18
    },
    deathShake: {
      intensity: 10.5,
      duration: 0.28
    }
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
        width: 0.504,
        height: 0.54,
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
    spawnChancePerSecond: 0.75,
    maxActive: 3,
    spawnAheadMin: 4,
    spawnAheadMax: 15,
    coinsNeededForSuperJump: 10,
    superJumpDistance: 20
  },
  superJump: {
    totalDuration: 2.5,
    phases: {
      charge: 0.75,
      lift: 0.6,
      launch: 0.65,
      settle: 0.5
    },
    liftHeight: 1.15,
    launchDistance: 20,
    inputLocked: true,
    cameraPunch: 0.12,
    energy: {
      rayCount: 8,
      ringCount: 2,
      trailCount: 4
    }
  }
};
