// How a door swings open and shut: the draft "door-animation" asset in asset-manifest.json, timed in code.
// Added by floors-and-doors ticket 02. The game rules say only whether a door stands open (see isDoorOpen in sim/doors.ts).
// This works out how far the door has turned on its hinges since it last began to swing, easing in and out.

/** How far an open door stands turned on its hinges, in radians: a little past square to its frame. */
export const DOOR_OPEN_RADIANS = (100 * Math.PI) / 180;
/** How long a door takes to swing all the way open or shut, in seconds. */
export const DOOR_SWING_SECONDS = 0.45;

/**
 * How far a door stands turned on its hinges, in radians from shut, `seconds` after it began to swing from `fromRadians`.
 * It swings toward DOOR_OPEN_RADIANS when `open`, or back to 0 when not, at an even pace across the whole swing,
 * so a door that began part way gets there sooner. It speeds up at the start and slows to a stop.
 */
export function doorSwingRadians(fromRadians: number, open: boolean, seconds: number): number {
  const to = open ? DOOR_OPEN_RADIANS : 0;
  const swingSeconds = (DOOR_SWING_SECONDS * Math.abs(to - fromRadians)) / DOOR_OPEN_RADIANS;
  if (swingSeconds <= 0 || seconds >= swingSeconds) return to;
  const share = Math.max(0, seconds) / swingSeconds;
  const eased = share * share * (3 - 2 * share);
  return fromRadians + (to - fromRadians) * eased;
}
