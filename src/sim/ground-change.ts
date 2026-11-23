// A slow change of ground type around one tree spot: a value object (ADR 0009).
// Where a tree goes for good, forest floor turns into clearing. Around a new full tree, clearing turns into forest floor.
// Each change takes GROUND_CHANGE_MINUTES. See .scratch/forest-floor/spec.md.
import { MINUTES_PER_DAY } from "./clock";
import { groundDistance, type GroundPoint } from "./ground-point";
import { smoothStep } from "./share";

/** Which ground type the ground around the spot turns into. */
export type GroundChangeToward = "clearing" | "forestFloor";

/** A change of ground type around a tree spot, and the game minute it started. It is plain data, so it can be saved. */
export interface GroundChange {
  /** The tree spot the change spreads from, in metres from the valley's centre. */
  readonly x: number;
  readonly z: number;
  readonly toward: GroundChangeToward;
  /** The game minute the change started, counted like the clock: from midnight at the start of day 1. */
  readonly startedAtMinutes: number;
}

/** A change of ground type takes this many game minutes: 3 game days. */
export const GROUND_CHANGE_MINUTES = 3 * MINUTES_PER_DAY;

/** Two spots closer than this, in metres, are the same tree spot. */
const SAME_SPOT_METRES = 0.01;

/** How far through the change is at `nowMinutes`, from 0 when it starts to 1 when it is over. */
export function groundChangeProgress(change: GroundChange, nowMinutes: number): number {
  return Math.min(1, Math.max(0, (nowMinutes - change.startedAtMinutes) / GROUND_CHANGE_MINUTES));
}

/** Whether the change is over at `nowMinutes`. */
export function isGroundChangeOver(change: GroundChange, nowMinutes: number): boolean {
  return groundChangeProgress(change, nowMinutes) >= 1;
}

/**
 * How much of a tree's forest floor shows at `nowMinutes`, from 0 (none) to 1 (all of it), given the latest change at its spot.
 * It eases in and out, so the ground does not jump when the change starts or ends.
 */
export function treeCover(change: GroundChange, nowMinutes: number): number {
  const eased = smoothStep(groundChangeProgress(change, nowMinutes));
  return change.toward === "forestFloor" ? eased : 1 - eased;
}

/** Whether two changes are the same: same spot, same way, started at the same minute. */
export function isSameGroundChange(a: GroundChange, b: GroundChange): boolean {
  return a.x === b.x && a.z === b.z && a.toward === b.toward && a.startedAtMinutes === b.startedAtMinutes;
}

/** The changes in `before` or `after` but not both: each change that started, turned, or went between the two lists. */
export function groundChangesBetween(before: readonly GroundChange[], after: readonly GroundChange[]): GroundChange[] {
  return [
    ...after.filter((change) => !before.some((old) => isSameGroundChange(old, change))),
    ...before.filter((old) => !after.some((change) => isSameGroundChange(old, change))),
  ];
}

/** Whether two spots are the same tree spot. */
export function isSameTreeSpot(a: GroundPoint, b: GroundPoint): boolean {
  return groundDistance(a, b) < SAME_SPOT_METRES;
}

/**
 * A new change at the spot of `latest`, toward `toward`, starting at `nowMinutes`. If `latest` is still under way the other way,
 * the new change picks up from the ground as it shows now, so the ground does not jump.
 */
export function startGroundChange(spot: GroundPoint, toward: GroundChangeToward, nowMinutes: number, latest: GroundChange | undefined): GroundChange {
  if (latest?.toward === toward) return latest;
  if (latest === undefined || isGroundChangeOver(latest, nowMinutes)) {
    return { x: spot.x, z: spot.z, toward, startedAtMinutes: nowMinutes };
  }
  // The easing is the same forwards and backwards, so the turned change at 1 - progress shows the same cover now.
  const left = 1 - groundChangeProgress(latest, nowMinutes);
  return { x: spot.x, z: spot.z, toward, startedAtMinutes: nowMinutes - left * GROUND_CHANGE_MINUTES };
}
