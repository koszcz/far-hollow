// Times the draft "sit-animation" asset in asset-manifest.json. A rough draft.
// The player steps up to the stool, turns their back to it, and sits down. They rest there, breathing, until they walk or
// act. Then they stand up and step back to where game logic keeps them, beside the stool.
// The body plays KayKit's Sit_Chair_Down, Sit_Chair_Idle, and Sit_Chair_StandUp clips from the player's own model, in
// player-mesh.ts. This file says what shows at each moment, and where the player stands.
import type { SleepSpot } from "./sleep-animation";
import { facingRadians } from "./structure-look";

/** Seconds the player takes to step up to the stool and turn their back to it, before sitting down begins. */
export const SIT_STEP_ON_SECONDS = 0.5;
/** Seconds the Sit_Chair_Down and Sit_Chair_StandUp clips last, as KayKit made them. */
export const SIT_DOWN_CLIP_SECONDS = 0.8;
export const SIT_STAND_UP_CLIP_SECONDS = 0.8;
/** When the player is seated, in seconds from when they reached the stool. From then on the resting clip loops. */
export const SIT_SEATED_AT = SIT_STEP_ON_SECONDS + SIT_DOWN_CLIP_SECONDS;
/** Seconds the player takes to step back from the stool once they stand, after the stand-up clip. */
export const SIT_STEP_OFF_SECONDS = 0.4;
/** When standing up is over, in seconds from when the player began to stand. */
export const STAND_SECONDS = SIT_STAND_UP_CLIP_SECONDS + SIT_STEP_OFF_SECONDS;
/**
 * How far in front of the seat's middle the player's feet stand while they sit, in metres.
 * Sit_Chair_Down moves the hips back by about this much, so the hips land over the middle of the seat.
 */
export const SIT_FEET_FORWARD_METRES = 0.3;
/**
 * How far the whole body sinks while the player sits, in metres. Sit_Chair_Down lifts the feet off the ground, as on a tall
 * chair, so the body sinks to bring the feet back down to the ground in front of a low stool.
 */
export const SIT_SINK_METRES = 0.15;

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

/** What the body does `seconds` after the player reached the stool, while they sit. */
export function sitBodyAt(seconds: number): SitBody {
  if (seconds < SIT_SEATED_AT) return { clip: "sitDown", clipSeconds: Math.max(0, seconds - SIT_STEP_ON_SECONDS) };
  return { clip: "sitIdle", clipSeconds: seconds - SIT_SEATED_AT };
}

/**
 * What the body does `seconds` after the player began to stand up, or undefined once they stand.
 * `seatedFor` is how long they had been sitting, in seconds. A player who stands before they were fully down rises from partway.
 */
export function standBodyAt(seconds: number, seatedFor: number): SitBody | undefined {
  if (seconds >= SIT_STAND_UP_CLIP_SECONDS) return undefined;
  // Halfway down is halfway up, so a player who stands mid-sit does not drop to the seat first.
  const down = Math.min(1, Math.max(0, seatedFor - SIT_STEP_ON_SECONDS) / SIT_DOWN_CLIP_SECONDS);
  const start = (1 - down) * SIT_STAND_UP_CLIP_SECONDS;
  return { clip: "standUp", clipSeconds: Math.min(SIT_STAND_UP_CLIP_SECONDS, start + seconds) };
}

/** How far the body has sunk, in metres, `seconds` after the player reached the stool. It sinks as they sit down. */
export function sitSinkAt(seconds: number): number {
  return SIT_SINK_METRES * settle((seconds - SIT_STEP_ON_SECONDS) / SIT_DOWN_CLIP_SECONDS);
}

/** How far the body has sunk, in metres, `seconds` after the player began to stand, having sat for `seatedFor` seconds. It rises as they stand. */
export function standSinkAt(seconds: number, seatedFor: number): number {
  return sitSinkAt(seatedFor) * (1 - settle(seconds / SIT_STAND_UP_CLIP_SECONDS));
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
 * Where the player stands `seconds` after beginning to stand up from `seat`, stepping back to `to`, where game logic keeps them.
 * They rise in place, then step across, turning to face the way they step.
 */
export function standSpotFrom(seat: SleepSpot, to: { x: number; z: number }, seconds: number): SleepSpot {
  const away = Math.hypot(to.x - seat.x, to.z - seat.z);
  const heading = away > 0.05 ? Math.atan2(to.x - seat.x, to.z - seat.z) : seat.heading;
  return between(seat, { ...to, heading }, settle((seconds - SIT_STAND_UP_CLIP_SECONDS) / SIT_STEP_OFF_SECONDS));
}

/** The spot `t` of the way from `a` to `b`, turning the short way round. */
function between(a: SleepSpot, b: SleepSpot, t: number): SleepSpot {
  const turn = Math.atan2(Math.sin(b.heading - a.heading), Math.cos(b.heading - a.heading));
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, heading: a.heading + turn * t };
}
