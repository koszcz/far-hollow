// Roofs: whether a spot is under one, and which cabin roof covers which foundation square.
// Any entity with a `roof` component counts as a roof overhead: a lean-to, or a cabin roof section.
import { BUILD_GRID_METRES, isOnGridSquare, snapToGridSquare } from "./build-grid";
import { cabinRoofEntities, roofEntities, roofFrameEntities, type Entity, type EntityStore } from "./entities";
import { isInRect, SIDES } from "./structure-kind";
import { turnOffset } from "./quarter-turns";
import { addGroundPoints, type GroundPoint } from "./ground-point";

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
 * The roof above a player standing at `spot`: every finished cabin roof section and roof frame over the player's square,
 * and over every square joined to it side by side. A cabin with only its frames up counts, as one with its roof on does.
 * The renderer hides it, so the player stays in view inside a cabin. It is empty in the open or under a lean-to.
 */
export function roofAbove(entities: EntityStore, spot: GroundPoint): Entity[] {
  const coverOn = (square: GroundPoint): Entity[] => {
    const cover: Entity[] = [];
    for (const section of cabinRoofEntities(entities)) if (isOnGridSquare(square, section.position)) cover.push(section);
    for (const frame of roofFrameEntities(entities)) if (isOnGridSquare(square, frame.position)) cover.push(frame);
    return cover;
  };
  const first = snapToGridSquare(spot);
  const joined = new Set<Entity>(coverOn(first));
  if (joined.size === 0) return [];
  const visited: GroundPoint[] = [first];
  const waiting = [first];
  for (let square = waiting.pop(); square !== undefined; square = waiting.pop()) {
    for (const side of SIDES) {
      const { x, z } = turnOffset({ x: 0, z: BUILD_GRID_METRES }, side);
      const next = addGroundPoints(square, { x, z });
      if (visited.some((seen) => isOnGridSquare(next, seen))) continue;
      visited.push(next);
      const cover = coverOn(next);
      if (cover.length === 0) continue;
      for (const piece of cover) joined.add(piece);
      waiting.push(next);
    }
  }
  return [...joined];
}
