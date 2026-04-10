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

export function getDeathMessage(cause = DEATH_CAUSES.GENERIC) {
  if (cause === DEATH_CAUSES.TRAIN) return DEATH_MESSAGES.train;
  if (cause === DEATH_CAUSES.RIVER || cause === DEATH_CAUSES.OFF_PLATFORM) return DEATH_MESSAGES.river;
  if (cause === DEATH_CAUSES.CAR || cause === DEATH_CAUSES.CRUSHED) return DEATH_MESSAGES.car;
  return DEATH_MESSAGES.car;
}

export { DEATH_MESSAGES };
