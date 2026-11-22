// The shape of a foundation: a deck of logs over one building-grid square, held level on a leg at each corner.
// On sloped ground the deck sits just above the highest corner, so the legs on the low side grow longer.
import { BUILD_GRID_METRES, isOnGridSquare } from "./build-grid";
import { blueprintEntities, foundationEntities, type Entity, type EntityStore, type Vec3 } from "./entities";
import { terrainHeightAt, type Terrain } from "./valley";
import { addGroundPoints, type GroundPoint, scaleGroundPoint } from "./ground-point";

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
 * How a new foundation joins the floors beside it.
 * `deckTop` is the height of the top of its deck, in metres.
 * `rising` lists the foundations, finished or blueprints, of the floors beside it that must rise to that height.
 */
export interface FloorJoin {
  readonly deckTop: number;
  readonly rising: readonly (Entity & { position: Vec3 })[];
}

/**
 * How a new foundation over the grid square with this middle joins the floors beside it. Foundations that share an edge make one flat floor.
 * On its own, the deck sits just above its highest ground, as `foundationDeckTop` gives.
 * Beside others, finished or blueprints, it takes their deck height. Where its ground is too high for that, or two floors at
 * different heights meet at it, the lower floors rise to the lowest height that fits them all. The floor levels itself.
 * `canRise` says whether the foundation on a square may rise: nothing but a floor of planks stands on it.
 * Undefined if a floor must rise, but one of its foundations may not.
 */
export function floorJoin(entities: EntityStore, terrain: Terrain, middle: GroundPoint, canRise: (square: GroundPoint) => boolean): FloorJoin | undefined {
  const floors = floorsBeside(entities, middle);
  if (floors.length === 0) return { deckTop: foundationDeckTop(terrain, middle), rising: [] };
  // The whole deck must fit above the ground, so the legs are never shorter than nothing.
  const fits = highestGroundUnder(terrain, middle) + FOUNDATION_DECK_THICKNESS_METRES;
  const deckTop = Math.max(fits, ...floors.flat().map(({ position }) => position.y));
  const rising = floors.flat().filter(({ position }) => position.y < deckTop - CLOSE_METRES);
  return rising.every(({ position }) => canRise(position)) ? { deckTop, rising } : undefined;
}

/**
 * Raises the floors a new foundation joins to its deck height, as `floorJoin` worked out.
 * Everything on the deck rises with it: a floor of planks, things lying there, a sled, and the player.
 */
export function raiseFloors(entities: EntityStore, { deckTop, rising }: FloorJoin): void {
  const onDecks = [...entities.with("position").entities].filter((entity) => !rising.includes(entity));
  for (const foundation of rising) {
    const before = foundation.position.y;
    for (const entity of onDecks) {
      if (isOnGridSquare(foundation.position, entity.position) && isCloseToDeck(entity.position.y, before)) entity.position.y = deckTop;
    }
  }
  for (const foundation of rising) foundation.position.y = deckTop;
}

/** Two heights or distances closer than this, in metres, count as the same. */
const CLOSE_METRES = 1e-6;
/** Something this close to a deck's height, in metres, rests on the deck. */
const ON_DECK_METRES = 0.01;

function isClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= CLOSE_METRES;
}

function isCloseToDeck(height: number, deck: number): boolean {
  return Math.abs(height - deck) <= ON_DECK_METRES;
}

/** The foundations, finished or blueprints, on the grid squares that share an edge with this one, and every foundation joined to them. One list per floor. */
function floorsBeside(entities: EntityStore, middle: GroundPoint): (Entity & { position: Vec3 })[][] {
  const all = [
    ...foundationEntities(entities).entities,
    ...blueprintEntities(entities).entities.filter(({ blueprint }) => blueprint.structure === "foundation"),
  ];
  const seen = new Set<Entity>();
  const floors: (Entity & { position: Vec3 })[][] = [];
  for (const start of all.filter(({ position }) => sharesEdge(position, middle))) {
    if (seen.has(start)) continue;
    const floor = [start];
    seen.add(start);
    for (let i = 0; i < floor.length; i += 1) {
      const at = floor[i];
      if (at === undefined) continue;
      for (const next of all) {
        if (seen.has(next) || !sharesEdge(next.position, at.position)) continue;
        seen.add(next);
        floor.push(next);
      }
    }
    floors.push(floor);
  }
  return floors;
}

/** Whether two grid squares, given by their middles, share an edge. */
function sharesEdge(a: GroundPoint, b: GroundPoint): boolean {
  const dx = Math.abs(a.x - b.x);
  const dz = Math.abs(a.z - b.z);
  return (isClose(dx, BUILD_GRID_METRES) && isClose(dz, 0)) || (isClose(dx, 0) && isClose(dz, BUILD_GRID_METRES));
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
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([dx = 0, dz = 0]) => addGroundPoints(middle, scaleGroundPoint({ x: dx, z: dz }, out)));
}
