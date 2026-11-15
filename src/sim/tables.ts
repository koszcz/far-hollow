// Eating at a table: food eaten within reach of a finished table fills more hunger.
import { distanceOutside } from "./building";
import { furnitureEntities, type EntityStore } from "./entities";
import { footprintOfEntity } from "./structures";
import type { GroundPoint } from "./valley";

/** The player eats at a table from this far outside its edges, in metres. */
export const TABLE_REACH_METRES = 1.5;
/** Food eaten at a table fills this many times the hunger it fills elsewhere: 25% more. */
export const TABLE_HUNGER_FACTOR = 1.25;

/** Whether a spot is within reach of a finished table. A table blueprint does not count. */
export function isAtTable(entities: EntityStore, at: GroundPoint): boolean {
  for (const table of furnitureEntities(entities)) {
    if (table.furniture === "table" && distanceOutside(footprintOfEntity(table), at) <= TABLE_REACH_METRES) return true;
  }
  return false;
}
