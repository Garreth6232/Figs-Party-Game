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
  }),
  bridgeEncounter: Object.freeze({
    terrainType: 'water',
    connectedFamily: 'water',
    hazardFamily: 'traffic',
    overlayFamily: 'bridgeTraffic',
    supportsProps: false
  })
});

export class TerrainSystem {
  constructor({ gameConfig, laneDefinitions, worldSeed = 1 }) {
    this.config = gameConfig;
    this.laneDefinitions = laneDefinitions;
    this.worldSeed = worldSeed;
    this.firstBridgeEncounter = this.buildFirstBridgeEncounter();
  }

  buildFirstBridgeEncounter() {
    const bridge = this.config.bridgeEncounter;
    const maxDistance = Math.max(0, Math.floor(bridge.firstBridgeMaxDistance ?? 0));
    if (maxDistance <= 0) return null;

    const safeRows = this.config.safeZones.guaranteedSafeRows + 1;
    const minStartY = safeRows + bridge.startOffsetMin;
    const maxAllowedY = this.config.startY + maxDistance;
    const maxStartY = Math.max(minStartY, maxAllowedY - bridge.lengthMin + 1);
    const startSpan = Math.max(0, maxStartY - minStartY);
    const startRoll = hash01(this.worldSeed * 5.11 + 0.71);
    const lengthRoll = hash01(this.worldSeed * 6.41 + 1.37);
    const startY = minStartY + Math.floor(startRoll * (startSpan + 1));
    const maxLengthByDistance = Math.max(bridge.lengthMin, maxAllowedY - startY + 1);
    const targetLengthMax = Math.min(bridge.lengthMax, maxLengthByDistance);
    const length = bridge.lengthMin + Math.floor(lengthRoll * (targetLengthMax - bridge.lengthMin + 1));
    const endY = startY + length - 1;

    return {
      id: 'bridge-first-guaranteed',
      regionIndex: -1,
      startY,
      endY,
      length
    };
  }

  getBridgeEncounterForY(y) {
    if (this.firstBridgeEncounter && y >= this.firstBridgeEncounter.startY && y <= this.firstBridgeEncounter.endY) {
      return this.firstBridgeEncounter;
    }

    const bridge = this.config.bridgeEncounter;
    const safeRows = this.config.safeZones.guaranteedSafeRows + 1;
    if (y < safeRows) return null;
    const regionIndex = Math.floor((y - safeRows) / bridge.regionSpan);
    const regionStartY = safeRows + regionIndex * bridge.regionSpan;
    const regionRoll = hash01(this.worldSeed * 0.917 + regionIndex * 2.173);
    if (regionRoll > bridge.rarityPerRegion) return null;

    const startRoll = hash01(this.worldSeed * 1.41 + regionIndex * 3.19);
    const lengthRoll = hash01(this.worldSeed * 2.07 + regionIndex * 4.71);
    const startOffset = Math.floor(bridge.startOffsetMin + startRoll * (bridge.startOffsetMax - bridge.startOffsetMin + 1));
    const length = Math.floor(bridge.lengthMin + lengthRoll * (bridge.lengthMax - bridge.lengthMin + 1));
    const startY = regionStartY + startOffset;
    const endY = startY + length - 1;
    if (y < startY || y > endY) return null;

    return {
      id: `bridge-${regionIndex}`,
      regionIndex,
      startY,
      endY,
      length
    };
  }

  laneTypeForY(y) {
    if (this.getBridgeEncounterForY(y)) return 'bridgeEncounter';
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
    } else if (gameplayType === 'bridgeEncounter') {
      const encounter = this.getBridgeEncounterForY(y);
      const bridgeTrafficDirection = this.config.bridgeEncounter.trafficDirection === 'down' ? -1 : 1;
      const bridgeSpawnMultiplier = Math.max(0.1, this.config.bridgeEncounter.trafficSpawnRateMultiplier ?? 1);
      const bridgeSpeedMultiplier = Math.max(0.1, this.config.bridgeEncounter.trafficSpeedMultiplier ?? 1);
      lane.direction = bridgeTrafficDirection;
      lane.speed = this.config.bridgeEncounter.trafficSpeed * bridgeSpeedMultiplier;
      lane.interval = this.config.bridgeEncounter.trafficSpawnInterval / bridgeSpawnMultiplier;
      lane.bridgeEncounter = encounter;
      lane.bridgeLaneCount = this.config.bridgeEncounter.laneCount;
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
