// Roofs: whether a spot is under one, and which cabin roof covers which foundation square.
// Any entity with a `roof` component counts as a roof overhead: a lean-to, or a cabin roof section.
import { BUILD_GRID_METRES, isOnGridSquare, snapToGridSquare } from "./build-grid";
import { cabinRoofEntities, roofEntities, type Entity, type EntityStore } from "./entities";
import { isInRect, SIDES, turnOffset } from "./structure-kind";
import type { GroundPoint } from "./valley";

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

/**
 * The roof above a player standing at `spot`: the cabin roof section over them and every section joined to it side by side.
 * The renderer hides it, so the player stays in view inside a cabin. It is empty in the open or under a lean-to.
 */
export function roofAbove(entities: EntityStore, spot: GroundPoint): Entity[] {
  const first = cabinRoofOn(entities, snapToGridSquare(spot));
  if (first === undefined) return [];
  const joined = new Set<Entity>([first]);
  const waiting = [first];
  for (let section = waiting.pop(); section !== undefined; section = waiting.pop()) {
    for (const side of SIDES) {
      const { x, z } = turnOffset({ x: 0, z: BUILD_GRID_METRES }, side);
      const next = cabinRoofOn(entities, { x: section.position.x + x, z: section.position.z + z });
      if (next === undefined || joined.has(next)) continue;
      joined.add(next);
      waiting.push(next);
    }
  }
  return [...joined];
}

