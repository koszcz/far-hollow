// Times the "sleep-animation" asset in asset-manifest.json. The owner approved it. A person going to sleep on a bedroll sits down on it,
// lies back, and settles. The view dims to black while they sleep, and the night passes. Light comes back on the
// morning, and the person sits up, gets their feet under them, and stands. The body plays KayKit's Lie_Down, Lie_Idle,
// and Lie_StandUp clips from the player's own model, in player-mesh.ts. This file says what shows at each moment.

/** Seconds the player takes to step onto the bedroll and turn to lie along it, before lying down begins. */
export const SLEEP_STEP_ON_SECONDS = 0.4;
/** How much faster than KayKit made them the lie-down and stand-up clips play. */
export const SLEEP_CLIP_SPEED = 1.25;
/** Seconds the Lie_Down clip lasts, as KayKit made it. */
export const LIE_DOWN_CLIP_SECONDS = 3;
/** Seconds the Lie_StandUp clip lasts, as KayKit made it. */
export const STAND_UP_CLIP_SECONDS = 2.3333;
/** Seconds the view takes to dim to black once the player lies still. */
export const SLEEP_DIM_SECONDS = 1.1;
/** Seconds the view stays black. The sky changes to the morning halfway through. */
export const SLEEP_DARK_SECONDS = 0.7;
/** Seconds the view takes to light up again on the morning. */
export const SLEEP_LIGHTEN_SECONDS = 1.1;

/** Where each phase ends, in seconds from when the player reaches the bedroll. */
export const SLEEP_LAID_DOWN_AT = SLEEP_STEP_ON_SECONDS + LIE_DOWN_CLIP_SECONDS / SLEEP_CLIP_SPEED;
export const SLEEP_DARK_AT = SLEEP_LAID_DOWN_AT + SLEEP_DIM_SECONDS;
export const SLEEP_MORNING_AT = SLEEP_DARK_AT + SLEEP_DARK_SECONDS / 2;
export const SLEEP_LIGHT_AT = SLEEP_DARK_AT + SLEEP_DARK_SECONDS + SLEEP_LIGHTEN_SECONDS;
/** When the player is standing again and the animation is over. The game waits until then. */
export const SLEEP_SECONDS = SLEEP_LIGHT_AT + STAND_UP_CLIP_SECONDS / SLEEP_CLIP_SPEED;

/** Which clip the body plays at one moment of going to sleep, and how far into it, in the clip's own seconds. */
export interface SleepBody {
  readonly clip: "lieDown" | "lieIdle" | "standUp";
  readonly clipSeconds: number;
}

/** Settles into a pose with no jolt at either end: smoothstep. */
function settle(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}

/** What the body does `seconds` after the player reached the bedroll. */
export function sleepBodyAt(seconds: number): SleepBody {
  if (seconds < SLEEP_LAID_DOWN_AT) {
    return {
      clip: "lieDown",
      clipSeconds: Math.max(0, seconds - SLEEP_STEP_ON_SECONDS) * SLEEP_CLIP_SPEED,
    };
  }
  if (seconds < SLEEP_LIGHT_AT) return { clip: "lieIdle", clipSeconds: seconds - SLEEP_LAID_DOWN_AT };
  return { clip: "standUp", clipSeconds: Math.min(STAND_UP_CLIP_SECONDS, (seconds - SLEEP_LIGHT_AT) * SLEEP_CLIP_SPEED) };
}

/** How dark the view is `seconds` after the player reached the bedroll, from 0 (as normal) to 1 (black). */
export function sleepDarknessAt(seconds: number): number {
  if (seconds < SLEEP_LAID_DOWN_AT || seconds >= SLEEP_LIGHT_AT) return 0;
  if (seconds < SLEEP_DARK_AT) return settle((seconds - SLEEP_LAID_DOWN_AT) / SLEEP_DIM_SECONDS);
  if (seconds < SLEEP_DARK_AT + SLEEP_DARK_SECONDS) return 1;
  return 1 - settle((seconds - SLEEP_DARK_AT - SLEEP_DARK_SECONDS) / SLEEP_LIGHTEN_SECONDS);
}

/**
 * Which way the player faces while lying on a bedroll, in radians from the +z axis toward +x, and where their feet
 * stand when lying down begins, in metres from the bedroll's middle. Lie_Down lies the body back, so the head lands
 * behind the feet, at the rolled blanket at the bedroll's head end (-z).
 */
export const SLEEP_HEADING = 0;
export const SLEEP_FEET_Z = 0.3;

/** A spot on the ground and which way the player faces there, in radians from the +z axis toward +x. */
export interface SleepSpot {
  readonly x: number;
  readonly z: number;
  readonly heading: number;
}

/**
 * Where the player stands `seconds` after reaching the bedroll at `bedroll`, having reached it at `from`.
 * They step across to the lying spot while turning to face along the bedroll, then stay there.
 */
export function sleepSpotFrom(from: SleepSpot, bedroll: { x: number; z: number }, seconds: number): SleepSpot {
  const stepped = settle(seconds / SLEEP_STEP_ON_SECONDS);
  const turn = Math.atan2(Math.sin(SLEEP_HEADING - from.heading), Math.cos(SLEEP_HEADING - from.heading));
  return {
    x: from.x + (bedroll.x - from.x) * stepped,
    z: from.z + (bedroll.z + SLEEP_FEET_Z - from.z) * stepped,
    heading: from.heading + turn * stepped,
  };
}

/** Dims a canvas towards black, from 0 (as normal) to 1 (black). */
export function darkenView(canvas: HTMLCanvasElement, darkness: number): void {
  canvas.style.filter = darkness > 0 ? `brightness(${1 - darkness})` : "";
}
