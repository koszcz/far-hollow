// The shape of a foundation: a deck of logs over one building-grid square, held level on a leg at each corner.
// On sloped ground the deck sits just above the highest corner, so the legs on the low side grow longer.
import { BUILD_GRID_METRES, isOnGridSquare } from "./build-grid";
import { blueprintEntities, foundationEntities, type EntityStore } from "./entities";
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
  return highestGroundUnder(terrain, middle) + FOUNDATION_DECK_LIFT_METRES;
}

/** The height of the highest ground under the middle and legs of a foundation over this grid square, in metres. */
function highestGroundUnder(terrain: Terrain, middle: GroundPoint): number {
  return Math.max(...[middle, ...legSpots(middle)].map(({ x, z }) => terrainHeightAt(terrain, x, z)));
}

/**
 * The height of the top of the deck for a new foundation over the grid square with this middle, in metres.
 * Foundations that share an edge make one flat floor. So a new foundation beside others, finished or blueprints, takes their deck height.
 * On its own, it sits just above its highest ground, as `foundationDeckTop` gives.
 * Undefined if it cannot join a flat floor: the foundations beside it stand at different heights,
 * or the ground under it rises so high that the deck would not fit above it.
 */
export function floorDeckTop(entities: EntityStore, terrain: Terrain, middle: GroundPoint): number | undefined {
  const beside = foundationsBeside(entities, middle);
  const floor = beside[0];
  if (floor === undefined) return foundationDeckTop(terrain, middle);
  if (beside.some((height) => !isClose(height, floor))) return undefined;
  // The whole deck must fit above the ground, so the legs are never shorter than nothing.
  return highestGroundUnder(terrain, middle) + FOUNDATION_DECK_THICKNESS_METRES <= floor + CLOSE_METRES ? floor : undefined;
}

/** Two heights or distances closer than this, in metres, count as the same. */
const CLOSE_METRES = 1e-6;

function isClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= CLOSE_METRES;
}

/** The deck heights of the foundations, finished or blueprints, on the four grid squares that share an edge with this one. */
function foundationsBeside(entities: EntityStore, middle: GroundPoint): number[] {
  const isBeside = (spot: GroundPoint) => {
    const dx = Math.abs(spot.x - middle.x);
    const dz = Math.abs(spot.z - middle.z);
    return (isClose(dx, BUILD_GRID_METRES) && isClose(dz, 0)) || (isClose(dx, 0) && isClose(dz, BUILD_GRID_METRES));
  };
  const finished = foundationEntities(entities).entities.filter(({ position }) => isBeside(position));
  const planned = blueprintEntities(entities).entities.filter(({ blueprint, position }) => blueprint.structure === "foundation" && isBeside(position));
  return [...finished, ...planned].map(({ position }) => position.y);
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
