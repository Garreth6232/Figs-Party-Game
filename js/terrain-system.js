const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const hash01 = (value) => {
  const x = Math.sin(value * 12.9898 + 78.233) * 43758.5453123;
  return x - Math.floor(x);
};

const weightedSelectWithHistory = ({ entries, roll, history = [], historyPenalty = 0.35 }) => {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const weightedEntries = entries.map((entry) => {
    const repeats = history.reduce((count, past) => (past === entry.type ? count + 1 : count), 0);
    const penalty = repeats > 0 ? Math.max(0.05, 1 - repeats * historyPenalty) : 1;
    return {
      ...entry,
      effectiveWeight: Math.max(0.001, entry.weight * penalty)
    };
  });

  const total = weightedEntries.reduce((sum, entry) => sum + entry.effectiveWeight, 0);
  let cursor = roll * total;
  for (const entry of weightedEntries) {
    cursor -= entry.effectiveWeight;
    if (cursor <= 0) return entry.type;
  }
  return weightedEntries[0].type;
};

const pushHistory = (history, value, maxSize) => {
  if (!maxSize) return;
  history.push(value);
  while (history.length > maxSize) history.shift();
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
    this.zoneSpan = Math.max(1, Math.floor(this.config.generation?.zoneSpan ?? 3));
    this.generationState = {
      zoneCache: new Map(),
      builtZoneIndex: -1,
      recentLaneTypes: [],
      roadArchetypeCache: new Map(),
      lastRoadLaneY: null,
      recentRoadArchetypes: [],
      waterArchetypeCache: new Map(),
      lastWaterLaneY: null,
      recentWaterArchetypes: []
    };
    this.firstBridgeEncounter = this.buildFirstBridgeEncounter();
  }

  buildFirstBridgeEncounter() {
    const bridge = this.config.bridgeEncounter;
    const maxDistance = Math.max(0, Math.floor(bridge.firstBridgeMaxDistance ?? 0));
    if (maxDistance <= 0) return null;

    const safeRows = this.config.safeZones.guaranteedSafeRows + 1;
    const minStartByConfig = safeRows + bridge.startOffsetMin;
    const minStartByTile = Math.max(safeRows, Math.floor(bridge.minSpawnTile ?? 0));
    const minStartY = Math.max(minStartByConfig, minStartByTile);
    const maxAllowedY = this.config.startY + maxDistance;
    if (maxAllowedY < minStartY + bridge.lengthMin - 1) return null;

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
    const minSpawnTile = Math.max(safeRows, Math.floor(bridge.minSpawnTile ?? 0));
    if (y < minSpawnTile) return null;

    const regionIndex = Math.floor((y - safeRows) / bridge.regionSpan);
    const regionStartY = safeRows + regionIndex * bridge.regionSpan;
    const startGuard = Math.max(regionStartY, minSpawnTile);
    const maxStartBound = regionStartY + bridge.startOffsetMax;
    if (maxStartBound < startGuard) return null;

    const regionRoll = hash01(this.worldSeed * 0.917 + regionIndex * 2.173);
    if (regionRoll > bridge.rarityPerRegion) return null;

    const startRoll = hash01(this.worldSeed * 1.41 + regionIndex * 3.19);
    const lengthRoll = hash01(this.worldSeed * 2.07 + regionIndex * 4.71);
    const rawStartOffset = Math.floor(bridge.startOffsetMin + startRoll * (bridge.startOffsetMax - bridge.startOffsetMin + 1));
    const startY = Math.max(regionStartY + rawStartOffset, startGuard);
    const length = Math.floor(bridge.lengthMin + lengthRoll * (bridge.lengthMax - bridge.lengthMin + 1));
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

  buildZoneCacheUntil(zoneIndex) {
    const generationConfig = this.config.generation ?? {};
    const laneHistorySize = Math.max(1, Math.floor(generationConfig.laneHistorySize ?? 4));
    const laneHistoryPenalty = clamp(generationConfig.laneHistoryPenalty ?? 0.35, 0, 0.9);
    for (let index = this.generationState.builtZoneIndex + 1; index <= zoneIndex; index += 1) {
      const laneRoll = hash01(this.worldSeed * 1.97 + index * 0.917);
      const laneType = weightedSelectWithHistory({
        entries: this.config.laneWeights,
        roll: laneRoll,
        history: this.generationState.recentLaneTypes,
        historyPenalty: laneHistoryPenalty
      });
      this.generationState.zoneCache.set(index, laneType);
      pushHistory(this.generationState.recentLaneTypes, laneType, laneHistorySize);
      this.generationState.builtZoneIndex = index;
    }
  }

  laneTypeForY(y) {
    if (this.getBridgeEncounterForY(y)) return 'bridgeEncounter';
    if (y <= this.config.safeZones.guaranteedSafeRows) return 'grass';

    const safeRows = this.config.safeZones.guaranteedSafeRows + 1;
    const zoneIndex = Math.floor((y - safeRows) / this.zoneSpan);
    if (!this.generationState.zoneCache.has(zoneIndex)) this.buildZoneCacheUntil(zoneIndex);

    const laneType = this.generationState.zoneCache.get(zoneIndex) ?? 'grass';
    return this.laneDefinitions[laneType] ? laneType : 'grass';
  }

  getRoadArchetype(y) {
    const config = this.config.trafficArchetypes;
    if (!config?.length) return null;

    const state = this.generationState;
    const expectedNextY = (state.lastRoadLaneY ?? (y - 1)) + 1;
    if (y !== expectedNextY || y < (state.lastRoadLaneY ?? y) - 1) {
      state.recentRoadArchetypes = [];
    }

    if (state.roadArchetypeCache.has(y)) {
      state.lastRoadLaneY = y;
      return state.roadArchetypeCache.get(y);
    }

    const generationConfig = this.config.generation ?? {};
    const historySize = Math.max(1, Math.floor(generationConfig.trafficHistorySize ?? 3));
    const historyPenalty = clamp(generationConfig.trafficHistoryPenalty ?? 0.45, 0, 0.9);
    const roll = hash01(this.worldSeed * 2.11 + y * 1.337);
    const type = weightedSelectWithHistory({
      entries: config,
      roll,
      history: state.recentRoadArchetypes,
      historyPenalty
    });
    const archetype = config.find((entry) => entry.type === type) ?? config[0];

    state.roadArchetypeCache.set(y, archetype);
    pushHistory(state.recentRoadArchetypes, archetype.type, historySize);
    state.lastRoadLaneY = y;

    return archetype;
  }

  getRiverArchetype(y) {
    const config = this.config.riverArchetypes;
    if (!config?.length) return null;

    const state = this.generationState;
    const expectedNextY = (state.lastWaterLaneY ?? (y - 1)) + 1;
    if (y !== expectedNextY || y < (state.lastWaterLaneY ?? y) - 1) {
      state.recentWaterArchetypes = [];
    }

    if (state.waterArchetypeCache.has(y)) {
      state.lastWaterLaneY = y;
      return state.waterArchetypeCache.get(y);
    }

    const generationConfig = this.config.generation ?? {};
    const historySize = Math.max(1, Math.floor(generationConfig.riverHistorySize ?? 3));
    const historyPenalty = clamp(generationConfig.riverHistoryPenalty ?? 0.45, 0, 0.9);
    const roll = hash01(this.worldSeed * 2.47 + y * 1.719);
    const type = weightedSelectWithHistory({
      entries: config,
      roll,
      history: state.recentWaterArchetypes,
      historyPenalty
    });
    const archetype = config.find((entry) => entry.type === type) ?? config[0];

    state.waterArchetypeCache.set(y, archetype);
    pushHistory(state.recentWaterArchetypes, archetype.type, historySize);
    state.lastWaterLaneY = y;

    return archetype;
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
      const trafficProfile = this.getRoadArchetype(y);
      const speedFloor = this.config.roadTraffic?.minSpeed ?? 1.35;
      const speedCeil = this.config.roadTraffic?.maxSpeed ?? 4.2;
      lane.speed = clamp(1.35 + hash01(y * 0.77 + this.worldSeed) * 1.35 + score * 0.012, speedFloor, speedCeil);
      lane.interval = 1.75 + hash01(y * 0.37 + this.worldSeed * 3.1) * 1.05;
      if (trafficProfile) {
        const intervalMultiplier = clamp(
          (trafficProfile.intervalMultiplierMin ?? 1) + hash01(this.worldSeed * 1.87 + y * 0.491) * ((trafficProfile.intervalMultiplierMax ?? 1) - (trafficProfile.intervalMultiplierMin ?? 1)),
          0.55,
          1.8
        );
        lane.interval *= intervalMultiplier;

        const speedMultiplier = clamp(
          (trafficProfile.speedMultiplierMin ?? 1) + hash01(this.worldSeed * 2.39 + y * 0.911) * ((trafficProfile.speedMultiplierMax ?? 1) - (trafficProfile.speedMultiplierMin ?? 1)),
          0.75,
          1.25
        );
        lane.speed = clamp(lane.speed * speedMultiplier, speedFloor, speedCeil);

        lane.trafficArchetype = trafficProfile.type;
      }
    } else if (gameplayType === 'water') {
      const riverProfile = this.getRiverArchetype(y);
      lane.speed = this.config.riverPlatforms.minSpeed + hash01(y * 0.29 + this.worldSeed * 1.9) * (this.config.riverPlatforms.maxSpeed - this.config.riverPlatforms.minSpeed);
      const platformIndex = Math.floor(hash01(y * 0.61 + this.worldSeed * 1.1) * lane.allowedPlatforms.length);
      lane.platformType = lane.allowedPlatforms[platformIndex] ?? lane.allowedPlatforms[0];
      lane.interval = this.config.riverPlatforms.minInterval + hash01(y * 0.71 + this.worldSeed * 2.9) * (this.config.riverPlatforms.maxInterval - this.config.riverPlatforms.minInterval);
      if (riverProfile) {
        const intervalMultiplier = clamp(
          (riverProfile.intervalMultiplierMin ?? 1) + hash01(this.worldSeed * 2.83 + y * 0.377) * ((riverProfile.intervalMultiplierMax ?? 1) - (riverProfile.intervalMultiplierMin ?? 1)),
          0.65,
          1.55
        );
        lane.interval *= intervalMultiplier;

        const speedMultiplier = clamp(
          (riverProfile.speedMultiplierMin ?? 1) + hash01(this.worldSeed * 3.31 + y * 0.547) * ((riverProfile.speedMultiplierMax ?? 1) - (riverProfile.speedMultiplierMin ?? 1)),
          0.8,
          1.2
        );
        lane.speed = clamp(
          lane.speed * speedMultiplier,
          this.config.riverPlatforms.minSpeed,
          this.config.riverPlatforms.maxSpeed
        );

        const platformTypes = Array.isArray(riverProfile.platformTypes) ? riverProfile.platformTypes : lane.allowedPlatforms;
        if (platformTypes.length) {
          const riverPlatformIndex = Math.floor(hash01(this.worldSeed * 4.07 + y * 0.619) * platformTypes.length);
          lane.platformType = platformTypes[riverPlatformIndex] ?? lane.platformType;
        }

        lane.seedPlatformCount = Math.max(1, Math.round(
          (riverProfile.initialPlatformCountMin ?? this.config.riverPlatforms.minLanePlatformCount)
          + hash01(this.worldSeed * 4.49 + y * 0.883)
            * ((riverProfile.initialPlatformCountMax ?? this.config.riverPlatforms.minLanePlatformCount)
            - (riverProfile.initialPlatformCountMin ?? this.config.riverPlatforms.minLanePlatformCount))
        ));
        lane.riverArchetype = riverProfile.type;
      }
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
