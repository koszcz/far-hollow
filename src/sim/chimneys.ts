// Chimneys: stone built up from the cap stone of a finished fireplace, rising through any roof over it.
// A chimney stands on its fireplace's square, at the fireplace's position and facing. It is only for looks: warmth, rooms,
// fuel, and rain work the same with or without one. Drawing works out how tall it is from the roof over it.
import { isOnGridSquare } from "./build-grid";
import { blueprintEntities, chimneyEntities, fireplaceEntities, type Entity, type EntityStore, type Vec3 } from "./entities";
import { nearestWithin, type GroundPoint } from "./ground-point";

/** The finished fireplace on the foundation square with this middle, or undefined if the square holds none. */
export function fireplaceOn(entities: EntityStore, square: GroundPoint): (Entity & { position: Vec3 }) | undefined {
  return fireplaceEntities(entities).entities.find((fireplace) => isOnGridSquare(square, fireplace.position));
}

/** The finished chimney on the foundation square with this middle, if any. */
export function finishedChimneyOn(entities: EntityStore, square: GroundPoint): (Entity & { position: Vec3; chimney: true }) | undefined {
  return chimneyEntities(entities).entities.find((chimney) => isOnGridSquare(square, chimney.position));
}

/** Whether a chimney stands on the foundation square with this middle, finished or as a blueprint. */
export function hasChimney(entities: EntityStore, square: GroundPoint): boolean {
  if (finishedChimneyOn(entities, square) !== undefined) return true;
  return blueprintEntities(entities).entities.some(({ blueprint, position }) => blueprint.structure === "chimney" && isOnGridSquare(square, position));
}

/** The finished fireplace nearest `at` with no chimney, finished or as a blueprint, within `reach` metres of its middle. */
export function nearestBareFireplace(entities: EntityStore, at: GroundPoint, reach: number): (Entity & { position: Vec3 }) | undefined {
  return nearestWithin(
    at,
    fireplaceEntities(entities).entities.filter((fireplace) => !hasChimney(entities, fireplace.position)),
    reach,
  );
}
