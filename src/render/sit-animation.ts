// Times the approved "sit-animation" asset in asset-manifest.json.
// The player steps up to the stool, turns their back to it, and sits down. They rest there, breathing, until they walk or
// act. Then they stand up and step back to where game logic keeps them, beside the stool.
// The body plays KayKit's Sit_Chair_Down, Sit_Chair_Idle, and Sit_Chair_StandUp clips from the player's own model, in
// player-mesh.ts. This file says what shows at each moment, and where the player stands.
import type { SleepSpot } from "./sleep-animation";
import { STOOL_SEAT_TOP_METRES } from "./stool-meshes";
import { facingRadians } from "./structure-look";

/** Seconds the player takes to step up to the stool and turn their back to it, before sitting down begins. */
export const SIT_STEP_ON_SECONDS = 0.5;
/**
 * Seconds Sit_Chair_Down takes to lower the body onto the seat. KayKit's clip lasts 0.8 seconds, but the body is still
 * for its last 0.2 seconds, so the seated pose starts here.
 */
export const SIT_DOWN_SECONDS = 0.6;
/** Seconds the Sit_Chair_StandUp clip lasts, as KayKit made it. */
export const SIT_STAND_UP_CLIP_SECONDS = 0.8;
/** When the player is seated, in seconds from when they reached the stool. From then on the resting clip loops. */
export const SIT_SEATED_AT = SIT_STEP_ON_SECONDS + SIT_DOWN_SECONDS;
/** Seconds the player takes to step back from the stool once they stand, after rising. */
export const SIT_STEP_OFF_SECONDS = 0.4;
/** When standing up from a full sit is over, in seconds from when the player began to stand. */
export const STAND_SECONDS = SIT_STAND_UP_CLIP_SECONDS + SIT_STEP_OFF_SECONDS;
/**
 * How far in front of the seat's middle the player's feet stand while they sit, in metres.
 * Sit_Chair_Down moves the hips back by about this much, so the hips land over the middle of the seat.
 */
export const SIT_FEET_FORWARD_METRES = 0.3;
/**
 * How high the bottom of the seated body is above the ground the feet stood on, in metres, in Sit_Chair_Idle.
 * Measured from the lowest point of the hips in public/assets/player/barbarian.glb, at the player's size.
 */
export const SIT_SEAT_CONTACT_METRES = 0.35;
/**
 * How far the whole body sinks while the player sits, in metres, so the seated body rests on the stool's seat.
 * Sit_Chair_Down poses the body for a taller chair. The player's short legs hang above the ground on a stool this tall.
 */
export const SIT_SINK_METRES = Math.max(0, SIT_SEAT_CONTACT_METRES - STOOL_SEAT_TOP_METRES);

/** Which clip the body plays at one moment of sitting or standing up, and how far into it, in the clip's own seconds. */
export interface SitBody {
  readonly clip: "sitDown" | "sitIdle" | "standUp";
  readonly clipSeconds: number;
}

/** Settles into a pose with no jolt at either end: smoothstep. */
function settle(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}

/** How far into Sit_Chair_Down the body is, in seconds, `seatedFor` seconds after the player reached the stool. */
function downSeconds(seatedFor: number): number {
  return Math.min(SIT_DOWN_SECONDS, Math.max(0, seatedFor - SIT_STEP_ON_SECONDS));
}

/** What the body does `seconds` after the player reached the stool, while they sit. */
export function sitBodyAt(seconds: number): SitBody {
  if (seconds < SIT_SEATED_AT) return { clip: "sitDown", clipSeconds: downSeconds(seconds) };
  return { clip: "sitIdle", clipSeconds: seconds - SIT_SEATED_AT };
}

/**
 * Seconds the player takes to rise, having sat for `seatedFor` seconds. A seated player plays the whole stand-up clip.
 * A player still sitting down plays the sitting-down clip backwards from where it was, so the body never jumps.
 */
function riseSeconds(seatedFor: number): number {
  return seatedFor >= SIT_SEATED_AT ? SIT_STAND_UP_CLIP_SECONDS : downSeconds(seatedFor);
}

/** When standing up is over, in seconds from when the player began to stand, having sat for `seatedFor` seconds. */
export function standSecondsAfter(seatedFor: number): number {
  return riseSeconds(seatedFor) + SIT_STEP_OFF_SECONDS;
}

/**
 * What the body does `seconds` after the player began to stand up, or undefined once they stand.
 * `seatedFor` is how long they had been sitting, in seconds.
 */
export function standBodyAt(seconds: number, seatedFor: number): SitBody | undefined {
  if (seconds >= riseSeconds(seatedFor)) return undefined;
  if (seatedFor >= SIT_SEATED_AT) return { clip: "standUp", clipSeconds: seconds };
  return { clip: "sitDown", clipSeconds: downSeconds(seatedFor) - seconds };
}

/** How far the body has sunk, in metres, `seconds` after the player reached the stool. It sinks as they sit down. */
export function sitSinkAt(seconds: number): number {
  return SIT_SINK_METRES * settle(downSeconds(seconds) / SIT_DOWN_SECONDS);
}

/** How far the body has sunk, in metres, `seconds` after the player began to stand, having sat for `seatedFor` seconds. It rises as they stand. */
export function standSinkAt(seconds: number, seatedFor: number): number {
  const rise = riseSeconds(seatedFor);
  return rise === 0 ? 0 : sitSinkAt(seatedFor) * (1 - settle(seconds / rise));
}

/** Where the player's feet stand while seated on a stool whose middle is `stool`, facing `turns`, and which way they face. */
export function seatedSpot(stool: { x: number; z: number }, turns: number): SleepSpot {
  const heading = facingRadians(turns);
  return {
    x: stool.x + Math.sin(heading) * SIT_FEET_FORWARD_METRES,
    z: stool.z + Math.cos(heading) * SIT_FEET_FORWARD_METRES,
    heading,
  };
}

/**
 * Where the player stands `seconds` after reaching the stool, having reached it at `from`.
 * They step across to the seated spot while turning their back to the stool, then stay there.
 */
export function sitSpotFrom(from: SleepSpot, seat: SleepSpot, seconds: number): SleepSpot {
  return between(from, seat, settle(seconds / SIT_STEP_ON_SECONDS));
}

/**
 * Where the player stands `seconds` after beginning to stand up from `seat`, having sat for `seatedFor` seconds, stepping
 * back to `to`, where game logic keeps them. They rise in place, then step across, turning to face the way they step.
 */
export function standSpotFrom(seat: SleepSpot, to: { x: number; z: number }, seconds: number, seatedFor: number): SleepSpot {
  const away = Math.hypot(to.x - seat.x, to.z - seat.z);
  const heading = away > 0.05 ? Math.atan2(to.x - seat.x, to.z - seat.z) : seat.heading;
  return between(seat, { ...to, heading }, settle((seconds - riseSeconds(seatedFor)) / SIT_STEP_OFF_SECONDS));
}

/** The spot `t` of the way from `a` to `b`, turning the short way round. */
function between(a: SleepSpot, b: SleepSpot, t: number): SleepSpot {
  const turn = Math.atan2(Math.sin(b.heading - a.heading), Math.cos(b.heading - a.heading));
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, heading: a.heading + turn * t };
}
