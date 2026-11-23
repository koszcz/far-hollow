// How shutters swing open and closed: the draft "shutter-swing" asset in asset-manifest.json, timed in code.
// The game rules say only whether shutters are open (see sim/shutters.ts). This works out how far each shutter has turned
// on its hinges since it last began to swing. A shutter is pushed open with one easy swing that slows as it folds back
// against the wall. Closing, it is pulled in and slows as it meets the other shutter.
// A swing that starts part way takes a share of the full time, so a shutter that turns back never jumps.
import { easeInOut } from "./easing";

/** How far an open shutter stands turned on its hinges, in radians: folded back almost flat against the wall. */
export const SHUTTER_OPEN_RADIANS = (170 * Math.PI) / 180;
/** How long a shutter takes to swing all the way open or closed, in seconds. */
export const SHUTTER_SWING_SECONDS = 0.6;

/** How long a swing from `fromRadians` toward open or closed lasts, in seconds. */
export function shutterSwingSeconds(fromRadians: number, open: boolean): number {
  const to = open ? SHUTTER_OPEN_RADIANS : 0;
  return SHUTTER_SWING_SECONDS * Math.min(1, Math.abs(to - fromRadians) / SHUTTER_OPEN_RADIANS);
}

/** How far a shutter stands turned on its hinges, in radians from closed, `seconds` after it began to swing from `fromRadians`. */
export function shutterSwingRadians(fromRadians: number, open: boolean, seconds: number): number {
  const to = open ? SHUTTER_OPEN_RADIANS : 0;
  const duration = shutterSwingSeconds(fromRadians, open);
  if (duration <= 0) return to;
  const t = Math.min(1, Math.max(0, seconds) / duration);
  return fromRadians + (to - fromRadians) * easeInOut(t);
}
