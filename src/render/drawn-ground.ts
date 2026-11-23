// Keeps the drawing's copy of the valley's ground types up to date as the ground follows the trees.
// The terrain and the undergrowth both draw from it. It reads the saved ground changes and the game clock, and never changes them.
// While a change is under way, the ground is worked out again every REFRESH_GAME_MINUTES, and only round the changes,
// so drawing stays cheap. See src/sim/ground-changes.ts.
import type { EntityStore } from "../sim/entities";
import { groundChangesBetween, isGroundChangeOver } from "../sim/ground-change";
import { groundChangesOf } from "../sim/ground-changes";
import type { GroundPoint } from "../sim/ground-point";
import { createGroundMap, GROUND_CHANGE_REACH_METRES, groundMapNow, type GroundMap } from "../sim/ground-types";
import type { GroundRect } from "../sim/structure-kind";
import type { Valley } from "../sim/valley";

/**
 * The ground is worked out again this often while a change is under way, in game minutes. A change takes 3 game days,
 * so each refresh moves the ground on by a tiny step that the eye does not see.
 */
export const REFRESH_GAME_MINUTES = 5;

/** The ground as the drawing shows it. */
export interface DrawnGround {
  /** The ground map as of the latest refresh. */
  currentMap(): GroundMap;
  /**
   * Works the ground out again if a change started, or one under way has moved on enough to show.
   * Returns the squares of the valley whose ground changed since the last refresh, or none.
   */
  refresh(): readonly GroundRect[];
}

/** `readClockMinutes` reads the game clock, in game minutes since midnight at the start of day 1. */
export function createDrawnGround(valley: Pick<Valley, "size" | "river" | "trees">, entities: EntityStore, readClockMinutes: () => number): DrawnGround {
  const start = createGroundMap(valley);
  let minutes = readClockMinutes();
  let changes = groundChangesOf(entities).map((change) => ({ ...change }));
  let map = groundMapNow(start, changes, minutes);

  return {
    currentMap: () => map,
    refresh() {
      const now = readClockMinutes();
      const latest = groundChangesOf(entities);
      const started = groundChangesBetween(changes, latest);
      const underWay = changes.filter((change) => !isGroundChangeOver(change, minutes));
      if (started.length === 0 && (underWay.length === 0 || now - minutes < REFRESH_GAME_MINUTES)) return [];
      minutes = now;
      changes = latest.map((change) => ({ ...change }));
      map = groundMapNow(start, changes, now);
      return [...started, ...underWay].map(areaAround);
    },
  };
}

function areaAround(spot: GroundPoint): GroundRect {
  return {
    min: { x: spot.x - GROUND_CHANGE_REACH_METRES, z: spot.z - GROUND_CHANGE_REACH_METRES },
    max: { x: spot.x + GROUND_CHANGE_REACH_METRES, z: spot.z + GROUND_CHANGE_REACH_METRES },
  };
}
