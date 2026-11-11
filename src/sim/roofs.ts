// Whether a spot is under a roof. Any entity with a `roof` component counts: a lean-to now, and cabin roofs later.
import { roofEntities, type EntityStore } from "./entities";
import { isInRect } from "./structure-kind";
import type { GroundPoint } from "./valley";

/** Whether a spot on the ground is under any roof, so rain does not fall on it. */
export function isUnderRoof(entities: EntityStore, spot: GroundPoint): boolean {
  for (const { roof } of roofEntities(entities)) if (isInRect(roof, spot)) return true;
  return false;
}
