export const STORAGE_KEYS = {
  bestScore: 'fig_game_best',
  muted: 'fig_game_muted',
  leaderboard: 'fig_game_leaderboard_v1',
  localTuning: 'fig_game_local_tuning_v1'
};

export const GAME_STATES = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over'
};

export const LEADERBOARD_LIMIT = 10;
export const STANDARD_ROAD_VEHICLE_KEYS = ['car1', 'car2', 'car3', 'scooter1'];

const MOVING_ENTITY_TUNING = Object.freeze({
  trainRenderScale: 1.5,
  carRenderScale: 1.25
});

const PROP_RENDER_TUNING = Object.freeze({
  streetSignRenderScale: 2,
  portlandOregonSignRenderScale: 1.5,
  powellsOnBurnsideRenderScale: 3
});

const scaleRenderProfile = (profile, scale) => ({
  ...profile,
  render: {
    ...profile.render,
    width: profile.render.width * scale,
    height: profile.render.height * scale
  }
});

const scalePropRenderProfile = (profile, scale) => ({
  ...profile,
  width: profile.width * scale,
  height: profile.height * scale
});

export const ASSET_METADATA = [
  {
    key: 'figForward',
    path: 'assets/player/figForward.png',
    category: 'player sprites',
    label: 'Fig (Forward)',
    description: '',
    interactionType: 'ignore',
    visibleInInfoMenu: true,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'figLeft',
    path: 'assets/player/figLeft.png',
    category: 'player sprites',
    label: 'Fig (Left)',
    description: '',
    interactionType: 'ignore',
    visibleInInfoMenu: true,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'figRight',
    path: 'assets/player/figRight.png',
    category: 'player sprites',
    label: 'Fig (Right)',
    description: '',
    interactionType: 'ignore',
    visibleInInfoMenu: true,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'figBack',
    path: 'assets/player/figBack.png',
    category: 'player sprites',
    label: 'Fig (Back)',
    description: '',
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
    description: 'a 2019 grey toyota chr, may have slight damage to the passenger side',
    interactionType: 'avoid',
    visibleInInfoMenu: true,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'car2',
    path: 'assets/vehicles/car2.png',
    category: 'vehicles',
    label: 'Car 2',
    description: 'ugly ugly ugly car. evil car',
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
    label: 'The Max',
    description: 'do NOT get hit',
    interactionType: 'avoid',
    visibleInInfoMenu: true,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'log1',
    path: 'assets/hazards/log1.png',
    category: 'river platforms',
    label: 'Log',
    description: 'Floating river platform that can carry the player.',
    interactionType: 'ride',
    visibleInInfoMenu: false,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'raft1',
    path: 'assets/hazards/raft1.png',
    category: 'river platforms',
    label: 'Raft',
    description: 'use this to get across the river',
    interactionType: 'ride',
    visibleInInfoMenu: true,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'kayak1',
    path: 'assets/hazards/kayak1.png',
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
    label: 'The Pickle',
    description: 'you gotta get the pickle',
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
    path: 'assets/environment/riverTile.jpg',
    category: 'environment tiles',
    label: 'Willamette',
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
    label: 'Max Track',
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
    label: 'Benson Bubbler',
    description: 'the famous benson bubbler, delicious water!',
    interactionType: 'ignore',
    visibleInInfoMenu: true,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'portlandOregonSign',
    path: 'assets/environment/portlandsign1.png',
    category: 'props',
    label: 'Portland Oregon Sign',
    description: 'Opening landmark sign prop intended to appear once near the start of a run.',
    interactionType: 'ignore',
    visibleInInfoMenu: true,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'sign1',
    path: 'assets/environment/sign1.png',
    category: 'props',
    label: 'Street Sign 1',
    description: 'Decorative street sign variant used in rotating roadside prop spawns.',
    interactionType: 'ignore',
    visibleInInfoMenu: false,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'sign2',
    path: 'assets/environment/sign2.png',
    category: 'props',
    label: 'Street Sign 2',
    description: 'Decorative street sign variant used in rotating roadside prop spawns.',
    interactionType: 'ignore',
    visibleInInfoMenu: false,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'sign3',
    path: 'assets/environment/sign3.png',
    category: 'props',
    label: 'Street Sign 3',
    description: 'Decorative street sign variant used in rotating roadside prop spawns.',
    interactionType: 'ignore',
    visibleInInfoMenu: false,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'sign4',
    path: 'assets/environment/sign4.png',
    category: 'props',
    label: 'Street Sign 4',
    description: 'Decorative street sign variant used in rotating roadside prop spawns.',
    interactionType: 'ignore',
    visibleInInfoMenu: false,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'sign5',
    path: 'assets/environment/sign5.png',
    category: 'props',
    label: 'Street Sign 5',
    description: 'Decorative street sign variant used in rotating roadside prop spawns.',
    interactionType: 'ignore',
    visibleInInfoMenu: false,
    visibleInDevAssetBrowser: true
  },
  {
    key: 'bookstore1',
    path: 'assets/environment/bookstore1.png',
    category: 'props',
    label: 'Powells on Burnside',
    description: 'the biggest book store in north america. WATCH OUT!',
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
  environment: buildAssetGroup([
    'grassTile',
    'riverTile',
    'roadTile',
    'railTile',
    'sidewalkTile',
    'tree1',
    'foodCart',
    'benson1',
    'portlandOregonSign',
    'sign1',
    'sign2',
    'sign3',
    'sign4',
    'sign5',
    'bookstore1'
  ]),
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

export const LANE_DEFINITIONS = Object.freeze({
  grass: Object.freeze({
    key: 'grass',
    category: 'safe',
    surface: 'grassTile',
    renderMode: 'grass',
    fallbackColor: '#4a6047',
    allowedProps: ['tree1'],
    allowedHazards: [],
    allowedPlatforms: [],
    allowsCoins: true,
    trainWarning: false
  }),
  road: Object.freeze({
    key: 'road',
    category: 'traffic',
    surface: 'roadTile',
    shoulderSurface: 'sidewalkTile',
    renderMode: 'road',
    fallbackColor: '#505962',
    allowedProps: ['foodCart', 'benson1'],
    allowedHazards: ['car1', 'car2', 'car3', 'scooter1'],
    allowedPlatforms: [],
    allowsCoins: false,
    trainWarning: false
  }),
  water: Object.freeze({
    key: 'water',
    category: 'river',
    surface: 'riverTile',
    renderMode: 'water',
    fallbackColor: '#34576d',
    allowedProps: ['waterMarker'],
    allowedHazards: [],
    allowedPlatforms: ['log1', 'raft1', 'kayak1'],
    allowsCoins: false,
    trainWarning: false
  }),
  rail: Object.freeze({
    key: 'rail',
    category: 'max',
    surface: 'railTile',
    renderMode: 'rail',
    fallbackColor: '#676b5a',
    allowedProps: ['railSignal'],
    allowedHazards: ['maxTrain'],
    allowedPlatforms: [],
    allowsCoins: false,
    trainWarning: true
  }),
  bridgeEncounter: Object.freeze({
    key: 'bridgeEncounter',
    category: 'encounter',
    surface: 'riverTile',
    renderMode: 'bridgeEncounter',
    fallbackColor: '#34576d',
    allowedProps: [],
    allowedHazards: ['car1', 'car2', 'car3'],
    allowedPlatforms: [],
    allowsCoins: false,
    trainWarning: false
  })
});

export const ENTITY_LANE_RULES = Object.freeze({
  hazards: Object.freeze({
    car1: Object.freeze(['road', 'bridgeEncounter']),
    car2: Object.freeze(['road', 'bridgeEncounter']),
    car3: Object.freeze(['road', 'bridgeEncounter']),
    scooter1: Object.freeze(['road']),
    bike1: Object.freeze(['road']),
    maxTrain: Object.freeze(['rail'])
  }),
  platforms: Object.freeze({
    log1: Object.freeze(['water']),
    raft1: Object.freeze(['water']),
    kayak1: Object.freeze(['water'])
  })
});

export const GAME_CONFIG = {
  cols: 9,
  tileSize: 96,
  visibleRows: 14,
  // The Start button waits for images up to this long; after that the game starts with what it has.
  assetLoadTimeoutMs: 10000,
  baseMoveCooldown: 92,
  movement: {
    hopDuration: 0.1,
    hopHeight: 0.18,
    // A tap that lands during the cooldown is remembered for this long instead of being dropped.
    inputBufferMs: 180
  },
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
    terrainDebugKeyToggle: 'KeyV',
    password: '1234'
  },
  alignment: {
    player: { renderOffsetY: 0.0 },
    collectible: { renderOffsetY: -0.03 }
  },
  movingEntities: {
    // Hitboxes come from each sprite's visible pixels inside this render box (see collision.js).
    // Car sprites face left; they are mirrored when driving right.
    profiles: {
      car1: { render: { width: 1.2, height: 0.7, offsetX: 0, offsetY: 0 }, facesLeft: true },
      car2: { render: { width: 1.2, height: 0.7, offsetX: 0, offsetY: 0 }, facesLeft: true },
      car3: { render: { width: 1.2, height: 0.7, offsetX: 0, offsetY: 0 }, facesLeft: true },
      bike1: { render: { width: 0.9, height: 0.7, offsetX: 0, offsetY: 0 }, facesLeft: true },
      scooter1: { render: { width: 1.0, height: 0.7, offsetX: 0, offsetY: 0 }, facesLeft: true },
      maxTrain: { render: { width: 2.8, height: 0.8, offsetX: 0, offsetY: 0 } },
      log1: { render: { width: 1.5, height: 0.52, offsetX: 0, offsetY: -0.02 } },
      raft1: { render: { width: 1.2, height: 0.48, offsetX: 0, offsetY: -0.02 } },
      kayak1: { render: { width: 0.95, height: 0.42, offsetX: 0, offsetY: -0.02 } }
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
  // tileWorldSize: how many tiles wide one copy of a ground texture spans on screen.
  environmentTiles: {
    grass: { tileWorldSize: 2.4, tint: 'rgba(16, 34, 14, 0.2)' },
    road: { tileWorldSize: 2, sidewalkWorldSize: 1.6, sidewalkHeightRatio: 0.14 },
    // flowFactor: how fast the water texture drifts compared with the boats on that lane.
    water: { tileWorldSize: 4.5, flowFactor: 0.35, tint: 'rgba(18, 52, 70, 0.38)' },
    // The rail photo is 2:1, so 2 tiles wide makes one copy exactly one lane tall.
    rail: { tileWorldSize: 2 }
  },
  stJohnsBridge: {
    girderWidth: 0.3,
    // Where the two Gothic towers stand, as a share of the bridge's length.
    towerAt: [0.22, 0.78],
    towerHeight: 4.4,
    colors: { main: '#3f7f69', light: '#6fae95', dark: '#244a3e' }
  },
  coinVisuals: {
    bobAmplitudeRatio: 0.05,
    bobFrequencyHz: 5.2,
    shadowAlpha: 0.22,
    shadowOffsetRatio: 0.12
  },
  generation: {
    zoneSpan: 3,
    laneHistorySize: 5,
    laneHistoryPenalty: 0.38,
    trafficHistorySize: 3,
    trafficHistoryPenalty: 0.45,
    riverHistorySize: 3,
    riverHistoryPenalty: 0.45
  },
  roadTraffic: {
    minSpeed: 1.35,
    maxSpeed: 4.2,
    // Every gap between two vehicles is at least clearWidth tiles plus however far traffic
    // moves in minCrossWindow seconds, so there is always time to hop through.
    clearWidth: 0.95,
    minCrossWindow: 0.42,
    // Higher difficulty tightens gaps by up to this share (never below the minimum).
    difficultyGapSqueeze: 0.45
  },
  flowLanes: {
    // Road and river entities spawn with their centers this far past the screen edge.
    entryOffset: 1.4
  },
  laneWeights: [
    { type: 'grass', weight: 2.2 },
    { type: 'road', weight: 4.0 },
    { type: 'water', weight: 2.0 },
    { type: 'rail', weight: 1.25 }
  ],
  // Gaps are in tiles between the visible ends of neighbouring vehicles.
  trafficArchetypes: [
    { type: 'sparse', weight: 1.0, gap: [3.4, 5.8], speedMultiplierMin: 0.92, speedMultiplierMax: 1.03 },
    { type: 'regular', weight: 1.25, gap: [2.3, 3.4], speedMultiplierMin: 0.96, speedMultiplierMax: 1.08 },
    // Bunches of 2-3 cars running nose to tail (tight but passable), then a long break.
    { type: 'platoon', weight: 0.95, gap: [4.6, 7.2], platoonSize: [2, 4], platoonGapScale: [1.0, 1.25], speedMultiplierMin: 0.9, speedMultiplierMax: 1.01 },
    // Alternates short and long gaps so the lane has a beat to it.
    { type: 'rhythm', weight: 0.8, gap: [1.9, 2.6], altGap: [4.2, 5.4], speedMultiplierMin: 0.94, speedMultiplierMax: 1.05 },
    { type: 'fastLight', weight: 0.55, gap: [4.2, 6.8], speedMultiplierMin: 1.05, speedMultiplierMax: 1.15 }
  ],
  bridgeEncounter: {
    firstBridgeMaxDistance: 130,
    minSpawnTile: 100,
    rarityPerRegion: 0.075,
    regionSpan: 72,
    startOffsetMin: 10,
    startOffsetMax: 20,
    lengthMin: 30,
    lengthMax: 40,
    laneCount: 3,
    trafficDirection: 'down',
    trafficStopMode: 'onBridgeEndVisible',
    trafficSpawnRateMultiplier: 1.25,
    trafficSpeedMultiplier: 0.99,
    trafficSpeed: 3.6,
    trafficSpawnInterval: 1.05,
    trafficActiveUntilExit: true,
    trafficStopAfterEncounterRows: 0,
    warningText: 'St. Johns Bridge - oncoming traffic!',
    warningDurationSeconds: 2.4,
    warningFlash: {
      color: '220, 58, 58',
      maxOpacity: 0.2,
      inDurationMs: 90,
      outDurationMs: 230
    },
    activationMode: 'onPlayerEntry',
    jumpCooldownMultiplier: 1.6,
    pickleSpawnChanceMultiplier: 2,
    minimumPickles: 5
  },
  trainWarning: {
    leadTime: 1.8
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
    minSpeed: 0.85,
    maxSpeed: 1.75,
    // No gap between platforms takes longer than this to drift past a point, so a ride always comes.
    maxGapSeconds: 1.65,
    minGap: 0.3,
    maxGap: 2.6,
    // Neighbouring river lanes always flow opposite ways so you never wait on a parallel current.
    alternateDirections: true,
    difficultyGapStretch: 0.3,
    // Share of spawns that use the lane's main platform type; the rest pick from the archetype.
    primaryTypeShare: 0.6
  },
  riverArchetypes: [
    { type: 'wideLogs', weight: 1.05, platformTypes: ['log1', 'raft1'], gap: [0.9, 2.1], convoyChance: 0.15, speedMultiplierMin: 0.88, speedMultiplierMax: 1.02 },
    // convoyChance: the next platform trails almost touching, making a longer walkway.
    { type: 'mixedCurrent', weight: 1.45, platformTypes: ['log1', 'raft1', 'kayak1'], gap: [0.7, 2.4], convoyChance: 0.3, speedMultiplierMin: 0.95, speedMultiplierMax: 1.08 },
    { type: 'tightCrossing', weight: 0.95, platformTypes: ['raft1', 'kayak1'], gap: [0.45, 1.5], convoyChance: 0.2, speedMultiplierMin: 0.84, speedMultiplierMax: 0.97 }
  ],
  collisions: {
    alphaThreshold: 96,
    maskLongSide: 48,
    sampleStridePx: 2,
    // Fig's hitbox is her visible pixels shrunk to this share, so a one-pixel graze is not a death.
    playerForgiveness: 0.86,
    // How far past a platform's visible edge Fig's center can be and still stand on it.
    platformGraceTiles: 0.1
  },
  coins: {
    spawnChancePerSecond: 0.7875,
    maxActive: 3,
    spawnAheadMin: 4,
    spawnAheadMax: 15,
    coinsNeededForSuperJump: 5,
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
  },
  cheats: {
    rewardCoins: 1000,
    keyboardSequence: ['up', 'down', 'up', 'down', 'left', 'right', 'up']
  },
  tuning: {
    movingEntities: MOVING_ENTITY_TUNING
  },
  props: {
    roadSignSpawnChance: 0.3,
    laneDecorationDensity: 1,
    earlyLandmarkDistance: { min: 7, max: 11 },
    largeLandmarkDistance: { min: 18, max: 26 },
    rules: {
      portlandOregonSign: { oncePerRun: true, placement: 'earlyLandmark', lanes: ['grass'] },
      streetSigns: { family: ['sign1', 'sign2', 'sign3', 'sign4', 'sign5'], placement: 'rotatingFamily', lanes: ['grass', 'road'] },
      bookstore1: { oncePerRun: true, placement: 'largeLandmark', lanes: ['grass'] },
      mutualExclusions: {
        foodCart: ['streetSigns']
      }
    },
    render: {
      tree1: { width: 0.32, height: 0.44, offsetY: 0.15, anchor: 'center' },
      foodCart: { width: 0.46, height: 0.36, offsetY: 0.54, anchor: 'edge' },
      benson1: { width: 0.5, height: 0.38, offsetY: 0.54, anchor: 'edge' },
      portlandOregonSign: { width: 1.2, height: 0.68, offsetY: 0.24, anchor: 'edge' },
      bookstore1: { width: 2.4, height: 2.3, offsetY: -1.08, anchor: 'edge' },
      sign1: { width: 0.34, height: 0.46, offsetY: 0.22, anchor: 'edge' },
      sign2: { width: 0.34, height: 0.46, offsetY: 0.22, anchor: 'edge' },
      sign3: { width: 0.34, height: 0.46, offsetY: 0.22, anchor: 'edge' },
      sign4: { width: 0.34, height: 0.46, offsetY: 0.22, anchor: 'edge' },
      sign5: { width: 0.34, height: 0.46, offsetY: 0.22, anchor: 'edge' }
    }
  }
};

// Game modes. A mode with a theme plays exactly the same; the theme only swaps the art.
// Sizes are in tiles; sprite widths follow each image's own shape.
const crow = (index, facing) => ({ path: `assets/brother/crows/crow${index}.png`, facing });
export const GAME_THEMES = {
  brother: {
    key: 'brother',
    collectibleLabel: 'Babies',
    collectibleName: 'babies',
    player: {
      sprites: {
        forward: 'assets/brother/player/heroForward.png',
        back: 'assets/brother/player/heroBack.png',
        left: 'assets/brother/player/heroLeft.png',
        right: 'assets/brother/player/heroRight.png',
        superJump: 'assets/brother/player/heroSJ.png'
      },
      height: 0.92
    },
    collectible: { path: 'assets/brother/collectibles/brother.png', height: 0.56 },
    // Every vehicle is a crow, picked at random per spawn. facing: which way the bird looks in
    // the art; it is mirrored to face the way it travels.
    obstacles: {
      height: 0.82,
      maxWidth: 1.25,
      offsetY: -0.04,
      // The MAX becomes a flock of this many crows sweeping across the track.
      flockSize: 4,
      flockSpacing: 1.05,
      pool: [
        crow(1, 'left'), crow(2, 'left'), crow(3, 'right'), crow(4, 'left'), crow(5, 'right'),
        crow(6, 'right'), crow(7, 'right'), crow(8, 'right'), crow(9, 'right'), crow(10, 'right'),
        crow(11, 'right'), crow(12, 'right'), crow(13, 'right'), crow(14, 'right')
      ]
    },
    deathMessages: {
      car: 'the crows got you :(',
      train: 'a whole murder of crows!'
    },
    // A forest instead of the city: forest floor for grass, dirt trails for roads, undergrowth for
    // sidewalks, a darker creek, trees instead of city props, and dappled canopy shade.
    environment: {
      textures: {
        grassTile: 'assets/brother/environment/forestFloor.jpg',
        roadTile: 'assets/brother/environment/trail.jpg',
        sidewalkTile: 'assets/brother/environment/undergrowth.jpg'
      },
      grassTint: 'rgba(6, 16, 8, 0.12)',
      waterTint: 'rgba(8, 38, 30, 0.5)',
      railTint: 'rgba(18, 36, 14, 0.38)',
      // 'painted' (dashed road lines) or 'soft' (a worn edge between trail rows)
      laneDividers: 'soft',
      canopy: { path: 'assets/brother/environment/canopyShade.png', tileWorldSize: 7, alpha: 0.55, sway: 0.15 },
      props: 'forest'
    },
    // The St. Johns Bridge starts on one of these rows, i.e. within the first ~15 points of a run.
    firstBridgeStartRange: [8, 13],
    // Fog rolls over the St. Johns Bridge as you start across and burns off by the halfway point.
    bridgeFog: {
      density: 0.62,
      clearFrom: 0.25,
      clearBy: 0.5,
      color: '206, 214, 219'
    }
  }
};

for (const carKey of ['car1', 'car2', 'car3']) {
  GAME_CONFIG.movingEntities.profiles[carKey] = scaleRenderProfile(GAME_CONFIG.movingEntities.profiles[carKey], MOVING_ENTITY_TUNING.carRenderScale);
}
GAME_CONFIG.movingEntities.profiles.maxTrain = scaleRenderProfile(GAME_CONFIG.movingEntities.profiles.maxTrain, MOVING_ENTITY_TUNING.trainRenderScale);

// Stand a landmark's visible bottom edge (a share of the image height) on the bottom of its own lane,
// so it never hangs over the row below.
const standOnLane = (profile, visibleBottom) => ({ ...profile, offsetY: 1 - profile.height * visibleBottom });
GAME_CONFIG.props.render.portlandOregonSign = standOnLane(
  scalePropRenderProfile(GAME_CONFIG.props.render.portlandOregonSign, PROP_RENDER_TUNING.portlandOregonSignRenderScale),
  0.92
);
GAME_CONFIG.props.render.bookstore1 = standOnLane(
  scalePropRenderProfile(GAME_CONFIG.props.render.bookstore1, PROP_RENDER_TUNING.powellsOnBurnsideRenderScale),
  0.7
);

for (const signKey of GAME_CONFIG.props.rules.streetSigns.family) {
  const profile = GAME_CONFIG.props.render[signKey];
  if (!profile) continue;
  GAME_CONFIG.props.render[signKey] = scalePropRenderProfile(profile, PROP_RENDER_TUNING.streetSignRenderScale);
}
