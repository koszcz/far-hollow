// The shape of a foundation: a deck of logs over one building-grid square, held level on a leg at each corner.
// On sloped ground the deck sits just above the highest corner, so the legs on the low side grow longer.
import { BUILD_GRID_METRES, isOnGridSquare } from "./build-grid";
import { foundationEntities, type EntityStore } from "./entities";
import { terrainHeightAt, type GroundPoint, type Terrain } from "./valley";

/** How far the top of the deck sits above the highest ground under the foundation, in metres. */
export const FOUNDATION_DECK_LIFT_METRES = 0.35;
/** How thick the deck is: one debarked log across, in metres. The legs hold it up from underneath. */
export const FOUNDATION_DECK_THICKNESS_METRES = 0.25;
/** Each leg stands this far in from its corner of the square, in metres. */
const LEG_INSET_METRES = 0.12;

/** One leg of a foundation: where it stands, and the heights of its top and its foot, in metres. */
export interface FoundationLeg {
  readonly x: number;
  readonly z: number;
  /** The underside of the deck. */
  readonly top: number;
  /** The ground under the leg. */
  readonly bottom: number;
}

/** The height of the top of the deck of a foundation over the grid square with this middle, in metres. */
export function foundationDeckTop(terrain: Terrain, middle: GroundPoint): number {
  const highest = Math.max(...[middle, ...legSpots(middle)].map(({ x, z }) => terrainHeightAt(terrain, x, z)));
  return highest + FOUNDATION_DECK_LIFT_METRES;
}

/**
 * The four legs of a foundation, each reaching from under its deck down to the ground.
 * `deck` is the middle of the top of the deck. `groundAt` gives the height of the ground at a spot.
 */
export function foundationLegs(deck: GroundPoint & { y: number }, groundAt: (x: number, z: number) => number): FoundationLeg[] {
  const top = deck.y - FOUNDATION_DECK_THICKNESS_METRES;
  return legSpots(deck).map(({ x, z }) => ({ x, z, top, bottom: groundAt(x, z) }));
}

/** How high the player stands at a spot: on the deck of a finished foundation if one covers it, or else on the ground. */
export function standingHeightAt(entities: EntityStore, terrain: Terrain, spot: GroundPoint): number {
  for (const foundation of foundationEntities(entities)) {
    if (isOnGridSquare(foundation.position, spot)) return foundation.position.y;
  }
  return terrainHeightAt(terrain, spot.x, spot.z);
}

/** The finished foundation on the grid square with this middle, if any. */
export function foundationOn(entities: EntityStore, square: GroundPoint) {
  return foundationEntities(entities).entities.find((built) => isOnGridSquare(square, built.position));
}

function legSpots(middle: GroundPoint): GroundPoint[] {
  const out = BUILD_GRID_METRES / 2 - LEG_INSET_METRES;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx = 0, dz = 0]) => ({ x: middle.x + dx * out, z: middle.z + dz * out }));
}
