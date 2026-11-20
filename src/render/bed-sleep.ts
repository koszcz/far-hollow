// Where the player is drawn while going to sleep in a bed: part of the approved "bed" asset in asset-manifest.json.
// The body plays the approved sleep animation, timed by sleep-animation.ts, as on a bedroll.
// In a bed, the player steps up onto the mattress, turned to lie along the bed, which may face any of four ways.
// Once standing again, they step back down to where they stood beside the bed. The bed blocks walking, so game logic keeps them there.
import { quarterTurnsToRadians, type QuarterTurns } from "../sim/quarter-turns";
import type { GroundPoint } from "../sim/valley";
import { BED_MATTRESS_TOP_METRES } from "./bed-meshes";
import { SLEEP_FEET_Z, SLEEP_HEADING, SLEEP_SECONDS, SLEEP_STEP_ON_SECONDS, type SleepSpot } from "./sleep-animation";

/** Seconds the player takes to step back down beside the bed once they stand, after the sleep animation. */
export const BED_STEP_OFF_SECONDS = 0.5;
/** When going to sleep in a bed is over, in seconds from when the player reached it. The game waits until then. */
export const BED_SLEEP_SECONDS = SLEEP_SECONDS + BED_STEP_OFF_SECONDS;

/** Where the player is drawn, which way they face, and how high above the ground they stand, in metres. */
export interface BedSleepSpot extends SleepSpot {
  readonly lift: number;
}

/** Eases a share from 0 to 1 so the motion starts and stops gently, with no jolt at either end. */
function settle(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Where the player is drawn `seconds` after reaching the bed whose middle is `bed`, facing `turns`, having reached it at `from`.
 * They step onto the mattress while turning to lie along the bed, stay there through the sleep, then step back down to `from`.
 */
export function bedSleepSpotFrom(from: SleepSpot, bed: GroundPoint, turns: QuarterTurns, seconds: number): BedSleepSpot {
  const facing = quarterTurnsToRadians(turns);
  const heading = SLEEP_HEADING + facing;
  const lying = { x: bed.x + Math.sin(facing) * SLEEP_FEET_Z, z: bed.z + Math.cos(facing) * SLEEP_FEET_Z };
  const turn = Math.atan2(Math.sin(heading - from.heading), Math.cos(heading - from.heading));
  // How far onto the bed the player is: 0 beside it, 1 on the mattress.
  const on = seconds < SLEEP_SECONDS ? settle(seconds / SLEEP_STEP_ON_SECONDS) : 1 - settle((seconds - SLEEP_SECONDS) / BED_STEP_OFF_SECONDS);
  return {
    x: from.x + (lying.x - from.x) * on,
    z: from.z + (lying.z - from.z) * on,
    heading: seconds < SLEEP_SECONDS ? from.heading + turn * on : heading,
    lift: BED_MATTRESS_TOP_METRES * on,
  };
}
