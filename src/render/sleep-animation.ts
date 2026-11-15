// Times the "sleep-animation" asset in asset-manifest.json. A person going to sleep on a bedroll or in a bed sits down,
// lies back on their side, then rolls onto their back and sleeps there, breathing slowly. The view dims to black while
// they sleep, and the night passes. Light comes back on the morning, the person rolls onto their side again, sits up,
// gets their feet under them, and stands. The body plays KayKit's Lie_Down, Lie_Idle, Death_A_Pose (the back-lying pose),
// and Lie_StandUp clips from the player's own model, in player-mesh.ts. This file says what shows at each moment. The owner approved it.

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
/** Seconds the player takes to roll from their side onto their back once lying, and back onto their side before standing. */
export const SLEEP_ROLL_SECONDS = 0.7;
/** Seconds one slow breath takes while asleep on the back. */
export const SLEEP_BREATH_SECONDS = 3.6;
/** Seconds the player lies still on their back, in full light, before the view starts to dim. */
export const SLEEP_SETTLE_SECONDS = 0.6;

/** Where each phase ends, in seconds from when the player reaches the bedroll. */
export const SLEEP_LAID_DOWN_AT = SLEEP_STEP_ON_SECONDS + LIE_DOWN_CLIP_SECONDS / SLEEP_CLIP_SPEED;
/** When the player is flat on their back. */
export const SLEEP_ON_BACK_AT = SLEEP_LAID_DOWN_AT + SLEEP_ROLL_SECONDS;
export const SLEEP_DIM_AT = SLEEP_ON_BACK_AT + SLEEP_SETTLE_SECONDS;
export const SLEEP_DARK_AT = SLEEP_DIM_AT + SLEEP_DIM_SECONDS;
export const SLEEP_MORNING_AT = SLEEP_DARK_AT + SLEEP_DARK_SECONDS / 2;
/** When the view is fully lit again. The player then rolls back onto their side to get up. */
export const SLEEP_LIGHT_AT = SLEEP_DARK_AT + SLEEP_DARK_SECONDS + SLEEP_LIGHTEN_SECONDS;
export const SLEEP_ON_SIDE_AT = SLEEP_LIGHT_AT + SLEEP_ROLL_SECONDS;
/** When the player is standing again and the animation is over. The game waits until then. */
export const SLEEP_SECONDS = SLEEP_ON_SIDE_AT + STAND_UP_CLIP_SECONDS / SLEEP_CLIP_SPEED;

/**
 * Which clip the body plays at one moment of going to sleep, and how far into it, in the clip's own seconds.
 * `onBack` is how far the body has rolled onto its back, from 0 (on its side, as the clip lies it) to 1 (flat on its back).
 */
export interface SleepBody {
  readonly clip: "lieDown" | "lieIdle" | "standUp";
  readonly clipSeconds: number;
  readonly onBack: number;
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
      onBack: 0,
    };
  }
  if (seconds < SLEEP_ON_SIDE_AT) {
    const onBack =
      seconds < SLEEP_LIGHT_AT ? settle((seconds - SLEEP_LAID_DOWN_AT) / SLEEP_ROLL_SECONDS) : 1 - settle((seconds - SLEEP_LIGHT_AT) / SLEEP_ROLL_SECONDS);
    return { clip: "lieIdle", clipSeconds: seconds - SLEEP_LAID_DOWN_AT, onBack };
  }
  return { clip: "standUp", clipSeconds: Math.min(STAND_UP_CLIP_SECONDS, (seconds - SLEEP_ON_SIDE_AT) * SLEEP_CLIP_SPEED), onBack: 0 };
}

/**
 * How far the chest has risen in a slow breath while asleep, from 0 (breathed out) to 1 (breathed in), `seconds` after
 * the player reached the bedroll. Each breath starts and ends breathed out, so breathing joins the roll with no jolt.
 */
export function sleepBreathAt(seconds: number): number {
  return (1 - Math.cos(((seconds - SLEEP_LAID_DOWN_AT) / SLEEP_BREATH_SECONDS) * Math.PI * 2)) / 2;
}

/** How dark the view is `seconds` after the player reached the bedroll, from 0 (as normal) to 1 (black). */
export function sleepDarknessAt(seconds: number): number {
  if (seconds < SLEEP_DIM_AT || seconds >= SLEEP_LIGHT_AT) return 0;
  if (seconds < SLEEP_DARK_AT) return settle((seconds - SLEEP_DIM_AT) / SLEEP_DIM_SECONDS);
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
