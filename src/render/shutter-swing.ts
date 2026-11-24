// How shutters swing open and closed: the approved "shutter-swing" asset in asset-manifest.json, timed in code.
// The game rules say only whether shutters are open (see sim/shutters.ts). This works out how far each leaf has turned
// on its hinges since it last began to swing.
//
// A real person leans out and pushes both leaves with two hands, one a moment behind the other. Each leaf coasts out,
// still moving when it knocks flat against the wall, and bounces back a little twice. Closing, the person pulls both
// leaves in and slows them, so they meet in the middle with a soft tap and ease back a touch.
//
// Phases of a swing open: lag (the second leaf only), travel (a push that coasts into the wall), then knock (one bounce
// off the wall, then a smaller one).
// Phases of a swing closed: lag, travel (pulled in, slowing as the leaves meet), then tap (one small bounce back).
// A swing that starts part way takes a share of the time, and its lag and bounces shrink with it, so a leaf never jumps.

/** How far an open shutter stands turned on its hinges, in radians: folded back almost flat against the wall. */
export const SHUTTER_OPEN_RADIANS = (170 * Math.PI) / 180;
/** How long a leaf takes to travel all the way open or closed, in seconds, before it bounces. */
export const SHUTTER_SWING_SECONDS = 0.6;
/** How long the second (right) leaf starts after the first on a full swing, in seconds: two hands are never quite together. */
export const SHUTTER_LAG_SECONDS = 0.08;

/** How fast a leaf moves as it reaches the wall, as a share of its average speed. Above 0, so it knocks. */
const OPEN_ARRIVAL_SPEED = 0.4;
/** How fast a leaf moves as it meets the other, as a share of its average speed. Small, so the tap is soft. */
const CLOSE_ARRIVAL_SPEED = 0.3;

/** How far a leaf bounces back off the wall after a full swing open, in radians, toward closed. */
export const SHUTTER_KNOCK_RADIANS = (6 * Math.PI) / 180;
/** How long the knock off the wall lasts, in seconds: both bounces. */
export const SHUTTER_KNOCK_SECONDS = 0.3;
/** How far a leaf eases back after meeting the other on a full swing closed, in radians, toward open. */
export const SHUTTER_TAP_RADIANS = (2.5 * Math.PI) / 180;
/** How long the tap where the leaves meet lasts, in seconds: both bounces. */
export const SHUTTER_TAP_SECONDS = 0.18;
/** The first bounce takes this share of a knock or a tap. The second, a fifth as high, takes the rest. */
export const SHUTTER_FIRST_BOUNCE_SHARE = 0.65;

/** The share of a full swing that a swing from `fromRadians` toward open or closed covers, from 0 to 1. */
function swingShare(fromRadians: number, open: boolean): number {
  const to = open ? SHUTTER_OPEN_RADIANS : 0;
  return Math.min(1, Math.abs(to - fromRadians) / SHUTTER_OPEN_RADIANS);
}

/** How long a leaf waits before it moves, in seconds. Only the second (trailing) leaf waits. */
export function shutterLagSeconds(fromRadians: number, open: boolean, trailing: boolean): number {
  return trailing ? SHUTTER_LAG_SECONDS * swingShare(fromRadians, open) : 0;
}

/** How long a swing from `fromRadians` toward open or closed travels, in seconds, before it bounces. */
export function shutterSwingSeconds(fromRadians: number, open: boolean): number {
  return SHUTTER_SWING_SECONDS * swingShare(fromRadians, open);
}

/** Moves from 0 to 1 with no speed at the start and `arrival` (a share of the average speed) at the end. */
function arrive(u: number, arrival: number): number {
  const a = 3 - arrival;
  return u * u * (a + (1 - a) * u);
}

/** A push from rest: quick at first, slowing, but still at `arrival` of the average speed at the end. */
function coast(u: number, arrival: number): number {
  return u * (2 - arrival - (1 - arrival) * u);
}

/** A bounce of `height` at time `u` (0 to 1) through it: one half sine wave, then a smaller one, ending at rest. */
function bounces(u: number, height: number): number {
  if (u <= 0 || u >= 1) return 0;
  if (u < SHUTTER_FIRST_BOUNCE_SHARE) return height * Math.sin((Math.PI * u) / SHUTTER_FIRST_BOUNCE_SHARE);
  return (height / 5) * Math.sin((Math.PI * (u - SHUTTER_FIRST_BOUNCE_SHARE)) / (1 - SHUTTER_FIRST_BOUNCE_SHARE));
}

/**
 * How far a leaf stands turned on its hinges, in radians from closed, `seconds` after the swing began from `fromRadians`.
 * `trailing` is the second leaf, which starts a moment late. Toward open, it coasts into the wall and knocks back twice.
 * Toward closed, it slows into the middle and taps back once, then a little. It never jumps.
 */
export function shutterSwingRadians(fromRadians: number, open: boolean, seconds: number, trailing = false): number {
  const to = open ? SHUTTER_OPEN_RADIANS : 0;
  const share = swingShare(fromRadians, open);
  const travel = shutterSwingSeconds(fromRadians, open);
  if (travel <= 0) return to;
  const t = Math.max(0, seconds - shutterLagSeconds(fromRadians, open, trailing));
  if (t < travel) {
    const u = t / travel;
    return fromRadians + (to - fromRadians) * (open ? coast(u, OPEN_ARRIVAL_SPEED) : arrive(u, CLOSE_ARRIVAL_SPEED));
  }
  if (open) return to - bounces((t - travel) / SHUTTER_KNOCK_SECONDS, SHUTTER_KNOCK_RADIANS * share);
  return to + bounces((t - travel) / SHUTTER_TAP_SECONDS, SHUTTER_TAP_RADIANS * share);
}
