// Floors: planks laid flush across the deck of one finished foundation square. A square holds one floor.
// The floor's structure definition is in structures.ts. Rooms ask here whether a square has a finished floor.
import { isOnGridSquare } from "./build-grid";
import { blueprintEntities, floorEntities, type Entity, type EntityStore, type Vec3 } from "./entities";
import type { GroundPoint } from "./ground-point";

/** The finished floor on the foundation square with this middle, if any. */
export function finishedFloorOn(entities: EntityStore, square: GroundPoint): (Entity & { position: Vec3 }) | undefined {
  return floorEntities(entities).entities.find(({ position }) => isOnGridSquare(square, position));
}

/** The finished floor or floor blueprint on the foundation square with this middle, if any. */
export function floorOn(entities: EntityStore, square: GroundPoint): Entity | undefined {
  return (
    finishedFloorOn(entities, square) ??
    blueprintEntities(entities).entities.find(({ blueprint, position }) => blueprint.structure === "floor" && isOnGridSquare(square, position))
  );
}
