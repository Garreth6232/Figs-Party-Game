const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const hash01 = (value) => {
  const x = Math.sin(value * 12.9898 + 78.233) * 43758.5453123;
  return x - Math.floor(x);
};

const weightedSelect = (entries, roll) => {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = roll * total;
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.type;
  }
  return entries[0].type;
};

export const TERRAIN_VISUAL_RULES = Object.freeze({
  grass: Object.freeze({
    terrainType: 'grass',
    connectedFamily: 'grass',
    hazardFamily: 'none',
    overlayFamily: 'natural',
    supportsProps: true
  }),
  road: Object.freeze({
    terrainType: 'road',
    connectedFamily: 'road',
    hazardFamily: 'traffic',
    overlayFamily: 'roadShoulders',
    supportsProps: true
  }),
  water: Object.freeze({
    terrainType: 'water',
    connectedFamily: 'water',
    hazardFamily: 'river',
    overlayFamily: 'waterFoam',
    supportsProps: true
  }),
  rail: Object.freeze({
    terrainType: 'rail',
    connectedFamily: 'rail',
    hazardFamily: 'max',
    overlayFamily: 'trainWarning',
    supportsProps: true
  })
});

export class TerrainSystem {
  constructor({ gameConfig, laneDefinitions, worldSeed = 1 }) {
    this.config = gameConfig;
    this.laneDefinitions = laneDefinitions;
    this.worldSeed = worldSeed;
  }

  laneTypeForY(y) {
    if (y <= this.config.safeZones.guaranteedSafeRows) return 'grass';
    const safeRows = this.config.safeZones.guaranteedSafeRows + 1;
    const zoneSpan = 3;
    const zoneIndex = Math.floor((y - safeRows) / zoneSpan);
    const zoneRoll = hash01(this.worldSeed + zoneIndex * 0.917);
    const laneType = weightedSelect(this.config.laneWeights, zoneRoll);
    return this.laneDefinitions[laneType] ? laneType : 'grass';
  }

  createLane(y, score = 0) {
    const gameplayType = this.laneTypeForY(y);
    const laneDef = this.laneDefinitions[gameplayType] ?? this.laneDefinitions.grass;
    const visualRule = TERRAIN_VISUAL_RULES[gameplayType] ?? TERRAIN_VISUAL_RULES.grass;

    const phaseRoll = hash01(this.worldSeed * 1.73 + y * 0.113);
    const direction = phaseRoll > 0.5 ? 1 : -1;

    const lane = {
      y,
      type: gameplayType,
      gameplayType,
      terrainType: visualRule.terrainType,
      connectedFamily: visualRule.connectedFamily,
      hazardFamily: visualRule.hazardFamily,
      overlayFamily: visualRule.overlayFamily,
      allowedProps: [...laneDef.allowedProps],
      allowedHazards: [...laneDef.allowedHazards],
      allowedPlatforms: [...laneDef.allowedPlatforms],
      allowsCoins: laneDef.allowsCoins,
      direction,
      speed: 0,
      timer: 0,
      interval: 2,
      warningLead: 0,
      warningActive: false,
      pendingSpawn: false,
      seed: hash01(this.worldSeed * 0.53 + y * 0.123),
      connectedContext: {
        north: false,
        east: true,
        south: false,
        west: true,
        mask: 0
      }
    };

    if (gameplayType === 'road') {
      lane.speed = clamp(1.35 + hash01(y * 0.77 + this.worldSeed) * 1.35 + score * 0.012, 1.35, 4.2);
      lane.interval = 1.75 + hash01(y * 0.37 + this.worldSeed * 3.1) * 1.05;
    } else if (gameplayType === 'water') {
      lane.speed = this.config.riverPlatforms.minSpeed + hash01(y * 0.29 + this.worldSeed * 1.9) * (this.config.riverPlatforms.maxSpeed - this.config.riverPlatforms.minSpeed);
      const platformIndex = Math.floor(hash01(y * 0.61 + this.worldSeed * 1.1) * lane.allowedPlatforms.length);
      lane.platformType = lane.allowedPlatforms[platformIndex] ?? lane.allowedPlatforms[0];
      lane.interval = this.config.riverPlatforms.minInterval + hash01(y * 0.71 + this.worldSeed * 2.9) * (this.config.riverPlatforms.maxInterval - this.config.riverPlatforms.minInterval);
    } else if (gameplayType === 'rail') {
      lane.speed = this.config.railHazard.minSpeed + hash01(y * 0.47 + this.worldSeed * 2.7) * (this.config.railHazard.maxSpeed - this.config.railHazard.minSpeed);
      lane.speed += score * this.config.railHazard.scoreScale;
      lane.interval = this.config.railHazard.minInterval + hash01(y * 0.83 + this.worldSeed * 2.2) * (this.config.railHazard.maxInterval - this.config.railHazard.minInterval);
      lane.warningLead = this.config.trainWarning.leadTime;
    }

    return lane;
  }

  updateConnectedContextForLane(y, laneCache) {
    const lane = laneCache.get(y);
    if (!lane) return;
    const north = laneCache.get(y + 1);
    const south = laneCache.get(y - 1);
    const northConnected = Boolean(north && north.connectedFamily === lane.connectedFamily);
    const southConnected = Boolean(south && south.connectedFamily === lane.connectedFamily);
    const mask = (northConnected ? 1 : 0) | 2 | (southConnected ? 4 : 0) | 8;

    lane.connectedContext = {
      north: northConnected,
      east: true,
      south: southConnected,
      west: true,
      mask
    };
  }

  createDebugSnapshot(lane) {
    return {
      y: lane.y,
      gameplayType: lane.gameplayType,
      terrainType: lane.terrainType,
      connectedMask: lane.connectedContext.mask,
      hazardFamily: lane.hazardFamily
    };
  }
}
