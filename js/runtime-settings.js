import { GAME_CONFIG, STORAGE_KEYS } from './config.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const SETTING_DEFINITIONS = {
  moveCooldownMs: {
    label: 'Hop Cooldown',
    group: 'Player / Movement',
    type: 'range',
    min: 60,
    max: 180,
    step: 1,
    defaultValue: GAME_CONFIG.baseMoveCooldown,
    apply: ({ game }, value) => {
      game.baseConfig.baseMoveCooldown = value;
    }
  },
  cameraFollowOffsetRows: {
    label: 'Camera Follow Offset',
    group: 'Player / Movement',
    type: 'range',
    min: 2,
    max: 6,
    step: 0.1,
    defaultValue: 3,
    apply: ({ game }, value) => {
      game.runtimeCameraOffsetRows = value;
    }
  },
  superJumpDistance: {
    label: 'Super Jump Distance',
    group: 'Player / Movement',
    type: 'range',
    min: 8,
    max: 32,
    step: 1,
    defaultValue: GAME_CONFIG.superJump.launchDistance,
    apply: ({ game }, value) => {
      game.runtimeSuperJumpDistance = value;
    }
  },
  superJumpCoinCost: {
    label: 'Super Jump Coin Cost',
    group: 'Player / Movement',
    type: 'range',
    min: 2,
    max: 12,
    step: 1,
    defaultValue: GAME_CONFIG.coins.coinsNeededForSuperJump,
    apply: ({ game }, value) => {
      game.runtimeCoinsPerSuperJump = value;
      game.coinCount = Math.min(game.coinCount, value - 1);
      game.ui.updateCoins(game.coinCount, value);
    }
  },
  coinSpawnChance: {
    label: 'Coin Spawn Chance/s',
    group: 'Spawn / Difficulty',
    type: 'range',
    min: 0.2,
    max: 1,
    step: 0.01,
    defaultValue: GAME_CONFIG.coins.spawnChancePerSecond,
    apply: ({ game }, value) => {
      game.runtimeCoinSpawnChance = value;
    }
  },
  trafficSpeedMultiplier: {
    label: 'Traffic Speed Multiplier',
    group: 'Spawn / Difficulty',
    type: 'range',
    min: 0.6,
    max: 2,
    step: 0.05,
    defaultValue: 1,
    apply: ({ game }, value) => {
      game.runtimeTrafficSpeedMultiplier = value;
    }
  },
  trainWarningLead: {
    label: 'Train Warning Duration',
    group: 'Spawn / Difficulty',
    type: 'range',
    min: 0.8,
    max: 3.5,
    step: 0.1,
    defaultValue: GAME_CONFIG.trainWarning.leadTime,
    apply: ({ game }, value) => {
      game.runtimeTrainWarningLead = value;
    }
  },
  riverPlatformDensity: {
    label: 'River Platform Density',
    group: 'Spawn / Difficulty',
    type: 'range',
    min: 0.6,
    max: 1.5,
    step: 0.05,
    defaultValue: 1,
    apply: ({ game }, value) => {
      game.runtimeRiverDensity = value;
    }
  },
  playerRenderScale: {
    label: 'Player Render Scale',
    group: 'Render / Asset Tuning',
    type: 'range',
    min: 0.8,
    max: 1.4,
    step: 0.01,
    defaultValue: 1,
    apply: ({ game }, value) => {
      game.runtimeRenderScale.player = value;
    }
  },
  carRenderScale: {
    label: 'Car Render Scale',
    group: 'Render / Asset Tuning',
    type: 'range',
    min: 0.8,
    max: 1.4,
    step: 0.01,
    defaultValue: 1,
    apply: ({ game }, value) => {
      game.runtimeRenderScale.car = value;
    }
  },
  trainRenderScale: {
    label: 'Train Render Scale',
    group: 'Render / Asset Tuning',
    type: 'range',
    min: 0.8,
    max: 1.5,
    step: 0.01,
    defaultValue: 1,
    apply: ({ game }, value) => {
      game.runtimeRenderScale.train = value;
    }
  },
  propSpawnDensity: {
    label: 'Prop Spawn Density',
    group: 'Render / Asset Tuning',
    type: 'range',
    min: 0.4,
    max: 1.6,
    step: 0.05,
    defaultValue: 1,
    apply: ({ game }, value) => {
      game.runtimePropDensity = value;
    }
  },
  hitboxOpacity: {
    label: 'Hitbox Opacity',
    group: 'Debug / Visibility',
    type: 'range',
    min: 0.1,
    max: 1,
    step: 0.05,
    defaultValue: 0.7,
    apply: ({ game }, value) => {
      game.runtimeHitboxOpacity = value;
    }
  },
  laneLabelsVisible: {
    label: 'Lane Labels',
    group: 'Debug / Visibility',
    type: 'toggle',
    defaultValue: true,
    apply: ({ game }, value) => {
      game.runtimeLaneLabelsVisible = Boolean(value);
    }
  }
};

const deepClone = (value) => JSON.parse(JSON.stringify(value));

export class RuntimeSettings {
  constructor(storageKey = STORAGE_KEYS.localTuning) {
    this.storageKey = storageKey;
    this.definitions = SETTING_DEFINITIONS;
    this.overrides = this.loadOverrides();
  }

  loadOverrides() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
      return {};
    }
  }

  saveOverrides() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.overrides));
  }

  getValue(key) {
    const definition = this.definitions[key];
    if (!definition) return undefined;
    const raw = this.overrides[key];
    if (raw === undefined) return deepClone(definition.defaultValue);
    if (definition.type === 'toggle') return Boolean(raw);
    return clamp(Number(raw), definition.min, definition.max);
  }

  getAllValues() {
    return Object.keys(this.definitions).reduce((acc, key) => {
      acc[key] = this.getValue(key);
      return acc;
    }, {});
  }

  setValue(key, value) {
    const definition = this.definitions[key];
    if (!definition) return;
    if (definition.type === 'toggle') this.overrides[key] = Boolean(value);
    else this.overrides[key] = clamp(Number(value), definition.min, definition.max);
    this.saveOverrides();
  }

  clearAll() {
    this.overrides = {};
    localStorage.removeItem(this.storageKey);
  }

  hasOverrides() {
    return Object.keys(this.overrides).length > 0;
  }

  applyToGame(game) {
    const values = this.getAllValues();
    for (const [key, value] of Object.entries(values)) {
      this.definitions[key]?.apply?.({ game }, value);
    }
  }

  getUIModel() {
    return Object.entries(this.definitions).map(([key, definition]) => ({
      key,
      ...definition,
      value: this.getValue(key)
    }));
  }
}
