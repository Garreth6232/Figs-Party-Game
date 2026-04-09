const DEATH_MESSAGE_POOLS = Object.freeze({
  car: Object.freeze([
    'You stepped into a gap that looked safe for half a second, and traffic used the other half.',
    'That lane had one clean opening. You picked the moment right after it.',
    'Crosswalk confidence was high, but lane timing still won the argument.',
    'You committed to the crossing and the road committed to saying no.',
    'The car line stayed in sync while your rhythm slipped one beat behind.',
    'You read the lane, then a fast mover rewrote the ending.',
    'Great forward momentum, rough traffic judgment at the final step.',
    'You cleared the first threat and walked straight into the second wave.',
    'Road pressure built fast, and the opening closed before your hop finished.',
    'The lane looked manageable until the timing window folded shut.'
  ]),
  train: Object.freeze([
    'MAX right-of-way is absolute. You found that out at full speed.',
    'Warning lights flashed, rails hummed, and the train kept perfect schedule.',
    'You challenged a full-length train in its own lane. The lane answered loudly.',
    'The tracks gave you a warning. The train delivered the conclusion.',
    'Momentum met steel, and steel did not negotiate.',
    'You hesitated on the rail line one heartbeat too long for MAX timing.',
    'The crossing plan was close, but train velocity was closer.',
    'Those rails are all business. The run ended on impact.',
    'You were brave at the crossing and very late by train standards.',
    'The platform trembled, the horn hit, and the route ended instantly.'
  ]),
  river: Object.freeze([
    'The current looked calm until your footing disappeared and the lane carried you off.',
    'You tried to thread the river without a stable ride and got claimed by the flow.',
    'One missed step over moving water, and the current wrote the final scoreline.',
    'The crossing drifted out from under you before the next hop came online.',
    'You aimed for a clean water lane transfer, but the river moved first.',
    'That platform gap was wider than it looked once the current kicked in.',
    'You rode the line too long and the river took the handoff.',
    'A fast current plus a small miss equals a cold restart.',
    'You reached for the next platform and the water reached you sooner.',
    'The river never stops moving, and this time you ran out of surface.'
  ]),
  off_platform: Object.freeze([
    'You stayed on the platform until the edge arrived first and dropped you out.',
    'The ride kept drifting sideways while your recovery window vanished.',
    'You held the crossing, but the platform carried you straight off safe bounds.',
    'A clean ride became an edge slide, and the river finished the job.',
    'You trusted the drift too long and stepped into open water.',
    'That was almost a save, but the platform left the playable line.',
    'You surfed the lane to the border and slipped off at the worst moment.',
    'One more correction would have saved it; the edge got there first.',
    'You rode confidently until the platform drifted past your escape angle.',
    'The platform moved on. You did not move soon enough.'
  ]),
  crushed: Object.freeze([
    'The hazard closed in from both sides and left no route through.',
    'You got pinned in a bad lane state with no time to reset position.',
    'Everything converged at once and the run got compressed out of existence.',
    'You were boxed by momentum and clipped by the closing line.',
    'A tight squeeze turned into a hard stop before the next hop could resolve.',
    'The lane stack collapsed on your position and ended the attempt.',
    'No clean exits, no spare frames, no survival angle.',
    'You got trapped by overlapping danger timing and paid for it immediately.'
  ]),
  timeout: Object.freeze([
    'The camera pace kept climbing, and your route fell behind the advancing field.',
    'You paused at the wrong time and the run scrolled past your position.',
    'Forward pressure never relaxed, and the screen left you behind.',
    'You needed one more clean push, but the camera deadline arrived first.',
    'The world moved on schedule. You missed the tempo and got outpaced.',
    'Momentum stalled long enough for the backline to catch you.',
    'You played safe too long and the run pace expired your lane.',
    'The race is always forward. Standing still became the losing move.'
  ]),
  generic: Object.freeze([
    'The run ended in a narrow failure window, but the score still counts.',
    'Close call after close call, then one final miss ended the streak.',
    'You were deep in rhythm until a single mistake broke the chain.',
    'Pressure stayed high and the lane finally took the advantage.',
    'A strong run, a hard finish, and a better restart waiting.',
    'Everything looked recoverable until the last second closed out.',
    'You pushed the route hard and the margin finally ran out.',
    'Arcade law remains undefeated: one miss is all it takes.'
  ])
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
  const pool = DEATH_MESSAGE_POOLS[cause] ?? DEATH_MESSAGE_POOLS.generic;
  const roll = Math.floor(Math.random() * pool.length);
  return pool[roll];
}

export { DEATH_MESSAGE_POOLS };
