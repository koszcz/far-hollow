// Roofs: whether a spot is under one, and which cabin roof covers which foundation square.
// Any entity with a `roof` component counts as a roof overhead: a lean-to, or a cabin roof section.
import { isOnGridSquare } from "./build-grid";
import { cabinRoofEntities, roofEntities, type Entity, type EntityStore } from "./entities";
import { isInRect } from "./structure-kind";
import type { GroundPoint } from "./ground-point";

/** Whether a spot on the ground is under any roof, so rain does not fall on it. */
export function isUnderRoof(entities: EntityStore, spot: GroundPoint): boolean {
  for (const { roof } of roofEntities(entities)) if (isInRect(roof, spot)) return true;
  return false;
}

/** The finished cabin roof section over the foundation square with this middle, or undefined if the square is open to the sky. */
export function cabinRoofOn(entities: EntityStore, square: GroundPoint): (Entity & { position: NonNullable<Entity["position"]> }) | undefined {
  for (const section of cabinRoofEntities(entities)) if (isOnGridSquare(square, section.position)) return section;
  return undefined;
}
