// How a door swings open and shut: the approved "door-animation" asset in asset-manifest.json, timed in code.
// The game rules say only whether a door stands open (see isDoorOpen in sim/doors.ts).
// This works out how far the door has turned on its hinges since it last began to swing, and how far the iron ring on
// its latch has lifted off the door's face.
//
// A real plank door is pushed open with one quick shove. It coasts, slows on its hinges, drifts a little past where it
// comes to rest, and settles back. Shutting, it gathers speed into the frame, hits the stop, and bounces back a little
// twice. The ring on the latch hangs loose: the shove flings it off the face and it taps back, and the slam rattles it.
//
// Phases of a swing open: travel (a shove that coasts to a stop just past open), then settle (back to open).
// Phases of a swing shut: travel (speeding up into the frame), then rebound (one bounce off the stop, then a smaller one).
// A swing that starts part way travels for less time, and its overshoot, rebound, and ring all shrink with it.

/** How far an open door stands turned on its hinges, in radians: a little past square to its frame. */
export const DOOR_OPEN_RADIANS = (100 * Math.PI) / 180;
/** How long a door takes to travel all the way open or shut, in seconds, before it settles or rebounds. */
export const DOOR_SWING_SECONDS = 0.45;
/** How far past open a door coasts on a full swing open, in radians, before it settles back. */
export const DOOR_OVERSHOOT_RADIANS = (5 * Math.PI) / 180;
/** How long a door takes to settle back from its overshoot to open, in seconds. */
export const DOOR_SETTLE_SECONDS = 0.3;
/** How far a door bounces back off its frame after a full swing shut, in radians, toward open. */
export const DOOR_REBOUND_RADIANS = (4 * Math.PI) / 180;
/** How long the rebound off the frame lasts, in seconds: both bounces. */
export const DOOR_REBOUND_SECONDS = 0.28;
/** The first bounce takes this share of the rebound. The second, a fifth as high, takes the rest. */
export const DOOR_FIRST_BOUNCE_SHARE = 0.65;

/** How far the shove of a full swing open lifts the latch ring off the door's face at most, in radians. */
export const RING_SHOVE_RADIANS = (35 * Math.PI) / 180;
/** How long each lift and tap back of the ring takes after a shove, in seconds. */
export const RING_SHOVE_TAP_SECONDS = 0.22;
/** How fast the ring's lifts die away after a shove: the time for them to shrink to about a third, in seconds. */
export const RING_SHOVE_FADE_SECONDS = 0.3;
/** How far the slam of a full swing shut lifts the latch ring off the door's face at most, in radians. */
export const RING_SLAM_RADIANS = (25 * Math.PI) / 180;
/** How long each rattle of the ring takes after a slam, in seconds. */
export const RING_SLAM_TAP_SECONDS = 0.1;
/** How fast the ring's rattles die away after a slam, in seconds, as for a shove. */
export const RING_SLAM_FADE_SECONDS = 0.14;
/** How long a lift the ring had when the door turned back takes to die away, in seconds. */
export const RING_CARRY_SECONDS = 0.15;

/** The share of a full swing that a swing from `fromRadians` toward open or shut covers, from 0 to 1. */
function swingShare(fromRadians: number, open: boolean): number {
  const to = open ? DOOR_OPEN_RADIANS : 0;
  return Math.min(1, Math.abs(to - fromRadians) / DOOR_OPEN_RADIANS);
}

/** How long a swing from `fromRadians` travels before it settles or rebounds, in seconds. */
export function doorTravelSeconds(fromRadians: number, open: boolean): number {
  return DOOR_SWING_SECONDS * swingShare(fromRadians, open);
}

/** How long a swing from `fromRadians` lasts in all, in seconds, until the door is still. */
export function doorSwingSeconds(fromRadians: number, open: boolean): number {
  const travel = doorTravelSeconds(fromRadians, open);
  if (travel <= 0) return 0;
  return travel + (open ? DOOR_SETTLE_SECONDS : DOOR_REBOUND_SECONDS);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * How far a door stands turned on its hinges, in radians from shut, `seconds` after it began to swing from `fromRadians`.
 * Toward open, a shove eases out to just past DOOR_OPEN_RADIANS, then it settles back. Toward shut, it speeds up into the
 * frame at 0, then bounces back twice. The door turns the same way all through, so it never shows a jump.
 */
export function doorSwingRadians(fromRadians: number, open: boolean, seconds: number): number {
  const to = open ? DOOR_OPEN_RADIANS : 0;
  const share = swingShare(fromRadians, open);
  const travel = doorTravelSeconds(fromRadians, open);
  if (travel <= 0) return to;
  const t = Math.max(0, seconds);
  if (open) {
    const peak = to + DOOR_OVERSHOOT_RADIANS * share;
    if (t < travel) {
      const u = t / travel;
      return fromRadians + (peak - fromRadians) * (1 - (1 - u) ** 2);
    }
    const settled = Math.min(1, (t - travel) / DOOR_SETTLE_SECONDS);
    return peak + (to - peak) * smoothstep(settled);
  }
  if (t < travel) {
    const u = t / travel;
    return fromRadians + (to - fromRadians) * u * u;
  }
  const u = (t - travel) / DOOR_REBOUND_SECONDS;
  if (u >= 1) return to;
  const height = DOOR_REBOUND_RADIANS * share;
  if (u < DOOR_FIRST_BOUNCE_SHARE) return height * Math.sin((Math.PI * u) / DOOR_FIRST_BOUNCE_SHARE);
  return (height / 5) * Math.sin((Math.PI * (u - DOOR_FIRST_BOUNCE_SHARE)) / (1 - DOOR_FIRST_BOUNCE_SHARE));
}

/** A ring knocked off the face at time 0: lifts that die away, each ending as it taps back on the face. */
function taps(seconds: number, lift: number, tapSeconds: number, fadeSeconds: number): number {
  if (seconds <= 0) return 0;
  return lift * Math.exp(-seconds / fadeSeconds) * Math.abs(Math.sin((Math.PI * seconds) / tapSeconds));
}

/**
 * How far the latch ring has lifted off the door's face, in radians, `seconds` after the door began to swing from
 * `fromRadians`. The shove of a swing open flings it off. The slam of a swing shut rattles it when the door hits the frame.
 * `carriedRadians` is how far it had lifted when this swing began, which dies away smoothly, so the ring never jumps.
 */
export function latchRingRadians(fromRadians: number, open: boolean, seconds: number, carriedRadians = 0): number {
  const share = swingShare(fromRadians, open);
  const carryLeft = 1 - smoothstep(Math.min(1, Math.max(0, seconds) / RING_CARRY_SECONDS));
  const carried = carriedRadians * carryLeft;
  if (open) return carried + taps(seconds, RING_SHOVE_RADIANS * share, RING_SHOVE_TAP_SECONDS, RING_SHOVE_FADE_SECONDS);
  const sinceSlam = seconds - doorTravelSeconds(fromRadians, open);
  return carried + taps(sinceSlam, RING_SLAM_RADIANS * share, RING_SLAM_TAP_SECONDS, RING_SLAM_FADE_SECONDS);
}
