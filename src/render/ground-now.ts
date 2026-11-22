// Keeps the drawing's copy of the valley's ground types up to date as the ground follows the trees.
// The terrain and the undergrowth both draw from it. It reads the saved ground changes and the game clock, and never changes them.
// While a change is under way, the ground is worked out again every REFRESH_GAME_MINUTES, and only round the changes,
// so drawing stays cheap. See src/sim/ground-changes.ts.
import type { EntityStore } from "../sim/entities";
import { isGroundChangeOver, type GroundChange } from "../sim/ground-change";
import { groundChangesOf } from "../sim/ground-changes";
import type { GroundPoint } from "../sim/ground-point";
import { createGroundMap, GROUND_CHANGE_REACH_METRES, groundMapNow, type GroundMap } from "../sim/ground-types";
import type { Valley } from "../sim/valley";

/**
 * The ground is worked out again this often while a change is under way, in game minutes. A change takes 3 game days,
 * so each refresh moves the ground on by a tiny step that the eye does not see.
 */
export const REFRESH_GAME_MINUTES = 5;

/** A square of the valley whose ground changed, in metres from the valley's centre. */
export interface GroundArea {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface GroundNow {
  /** The ground map as of the latest refresh. */
  map(): GroundMap;
  /**
   * Works the ground out again if a change started, or one under way has moved on enough to show.
   * Returns the areas whose ground changed since the last refresh, or none.
   */
  refresh(): readonly GroundArea[];
}

/** `readClockMinutes` reads the game clock, in game minutes since midnight at the start of day 1. */
export function createGroundNow(valley: Pick<Valley, "size" | "river" | "trees">, entities: EntityStore, readClockMinutes: () => number): GroundNow {
  const start = createGroundMap(valley);
  let minutes = readClockMinutes();
  let changes = groundChangesOf(entities).map((change) => ({ ...change }));
  let map = groundMapNow(start, changes, minutes);

  return {
    map: () => map,
    refresh() {
      const now = readClockMinutes();
      const latest = groundChangesOf(entities);
      const started = [
        ...latest.filter((change) => !changes.some((old) => sameChange(old, change))),
        ...changes.filter((old) => !latest.some((change) => sameChange(old, change))),
      ];
      const underWay = changes.filter((change) => !isGroundChangeOver(change, minutes));
      if (started.length === 0 && (underWay.length === 0 || now - minutes < REFRESH_GAME_MINUTES)) return [];
      minutes = now;
      changes = latest.map((change) => ({ ...change }));
      map = groundMapNow(start, changes, now);
      return [...started, ...underWay].map(areaAround);
    },
  };
}

function sameChange(a: GroundChange, b: GroundChange): boolean {
  return a.x === b.x && a.z === b.z && a.toward === b.toward && a.startedAtMinutes === b.startedAtMinutes;
}

function areaAround(spot: GroundPoint): GroundArea {
  return {
    minX: spot.x - GROUND_CHANGE_REACH_METRES,
    maxX: spot.x + GROUND_CHANGE_REACH_METRES,
    minZ: spot.z - GROUND_CHANGE_REACH_METRES,
    maxZ: spot.z + GROUND_CHANGE_REACH_METRES,
  };
}
