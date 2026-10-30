const DEATH_MESSAGES = Object.freeze({
  car: 'you got flattened:(',
  train: "Oh no you missed your train! don't worry there will be another one in like 15 minutes",
  river: 'glub glub glub'
});

export const DEATH_CAUSES = Object.freeze({
  CAR: 'car',
  TRAIN: 'train',
  RIVER: 'river',
  OFF_PLATFORM: 'off_platform',
  CRUSHED: 'crushed',
  TIMEOUT: 'timeout',
  GENERIC: 'generic'
});

// overrides: a theme's own messages, e.g. { car: '...', train: '...' }
export function getDeathMessage(cause = DEATH_CAUSES.GENERIC, overrides = {}) {
  const messages = { ...DEATH_MESSAGES, ...overrides };
  if (cause === DEATH_CAUSES.TRAIN) return messages.train;
  if (cause === DEATH_CAUSES.RIVER || cause === DEATH_CAUSES.OFF_PLATFORM) return messages.river;
  return messages.car;
}

export { DEATH_MESSAGES };
