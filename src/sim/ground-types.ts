// Answers "which ground type is here?" for any spot in the valley: forest floor, clearing, or river bank.
// Ground types come from where trees stand when the valley is made and from where the river runs.
// After that, the ground follows the trees that stand for good. groundMapNow applies each ground change (ground-change.ts)
// to the starting map. Felling a tree alone changes nothing, because a growing stump still counts as a tree.
// The terrain drawing blends ground types with groundTypeWeightsAt. Undergrowth picks what grows with groundTypeAt.
import { distanceToSegment, RIVER_BANK_WIDTH_METRES, type Valley } from "./valley";
import { groundDistance, type GroundPoint } from "./ground-point";
import { isSameTreeSpot, treeCover, type GroundChange } from "./ground-change";

export type GroundType = "forestFloor" | "clearing" | "riverBank";

/** How much of each ground type a spot shows, from 0 to 1. The three always add up to 1. */
export interface GroundTypeWeights {
  readonly forestFloor: number;
  readonly clearing: number;
  readonly riverBank: number;
}

/** The trees and river that ground types come from, with a quick lookup of the trees near any spot. */
export interface GroundMap {
  readonly river: Valley["river"];
  readonly size: number;
  /** Tree spots, grouped into square cells row by row, so a lookup only checks the trees nearby. */
  readonly treesByCell: readonly (readonly TreeSpot[] | undefined)[];
  readonly cellsPerSide: number;
  /** Each river segment with the box around it where the river bank can reach, so far segments are skipped quickly. */
  readonly riverSegments: readonly RiverSegment[];
}

/** A spot whose tree spreads forest floor around it. */
interface TreeSpot extends GroundPoint {
  /** Whether a tree stood here when the valley was made. The river bank's edge is worked out from these alone, so it never changes. */
  readonly starting: boolean;
  /**
   * How many metres nearer the trunk the forest floor's edge has drawn in, from 0 for a tree's whole forest floor
   * to CELL_METRES for none at all. It is 0 for a starting tree with no change at its spot.
   */
  readonly drawnIn: number;
}

interface RiverSegment {
  readonly a: GroundPoint;
  readonly b: GroundPoint;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** Ground within this distance of a trunk is all forest floor, in metres. */
const FOREST_FLOOR_FULL_METRES = 3;
/** Forest floor fades into clearing until this distance from a trunk, in metres. */
const FOREST_FLOOR_EDGE_METRES = 7;
/** River bank covers the ground from the water out to this far up the bank's slope, in metres from the water's edge. */
const RIVER_BANK_FULL_METRES = RIVER_BANK_WIDTH_METRES - 2;
/** River bank fades into the next ground type until this far from the water's edge, in metres. */
const RIVER_BANK_EDGE_METRES = RIVER_BANK_WIDTH_METRES + 2;
/**
 * The edges of the forest floor and the river bank wobble by up to this many metres, so patches are not perfect circles
 * and the bank's edge is not a straight line.
 */
const EDGE_WOBBLE_METRES = 1.5;
/** The wobble changes over about this many metres along an edge. */
const EDGE_WOBBLE_SPACING_METRES = 5;
/**
 * Each lookup cell is as wide as the forest floor's reach plus its wobble, so only the 3 × 3 cells around a spot matter.
 */
const CELL_METRES = FOREST_FLOOR_EDGE_METRES + EDGE_WOBBLE_METRES;

/** Builds the ground map from the valley as it is made. Pass the valley's starting trees, never the trees still standing. */
export function createGroundMap(valley: Pick<Valley, "size" | "river" | "trees">): GroundMap {
  const cellsPerSide = Math.ceil(valley.size / CELL_METRES);
  const treesByCell: (TreeSpot[] | undefined)[] = Array.from({ length: cellsPerSide * cellsPerSide }, () => undefined);
  for (const tree of valley.trees) {
    const key = cellKey(valley.size, cellsPerSide, tree);
    const spot: TreeSpot = { x: tree.x, z: tree.z, starting: true, drawnIn: 0 };
    const cell = treesByCell[key];
    if (cell) cell.push(spot);
    else treesByCell[key] = [spot];
  }
  const reach = valley.river.width / 2 + RIVER_BANK_EDGE_METRES + EDGE_WOBBLE_METRES;
  const riverSegments: RiverSegment[] = [];
  for (let i = 1; i < valley.river.path.length; i += 1) {
    const a = valley.river.path[i - 1];
    const b = valley.river.path[i];
    if (a === undefined || b === undefined) continue;
    riverSegments.push({
      a,
      b,
      minX: Math.min(a.x, b.x) - reach,
      maxX: Math.max(a.x, b.x) + reach,
      minZ: Math.min(a.z, b.z) - reach,
      maxZ: Math.max(a.z, b.z) + reach,
    });
  }
  return { river: valley.river, size: valley.size, treesByCell, cellsPerSide, riverSegments };
}

/** A change of ground type reaches at most this far from its tree spot, in metres. Drawing redraws this much ground round a change. */
export const GROUND_CHANGE_REACH_METRES = CELL_METRES;

/**
 * The ground map at `nowMinutes`: the starting map with every ground change applied, as far as each has got.
 * Pass the latest change at each spot, at most one per spot. The starting map is left as it was.
 */
export function groundMapNow(start: GroundMap, changes: readonly GroundChange[], nowMinutes: number): GroundMap {
  if (changes.length === 0) return start;
  const treesByCell = [...start.treesByCell];
  for (const change of changes) {
    const key = cellKey(start.size, start.cellsPerSide, change);
    const cell = treesByCell[key] ?? [];
    const starting = cell.some((tree) => tree.starting && isSameTreeSpot(change, tree));
    const drawnIn = (1 - treeCover(change, nowMinutes)) * CELL_METRES;
    treesByCell[key] = [...cell.filter((tree) => !isSameTreeSpot(change, tree)), { x: change.x, z: change.z, starting, drawnIn }];
  }
  return { ...start, treesByCell };
}

/** The ground type that shows most at a spot. Where river bank shows most is worked out from the starting trees, so it never changes. */
export function groundTypeAt(map: GroundMap, spot: GroundPoint): GroundType {
  const { weights, startingForest } = weighGround(map, spot);
  const startingForestFloor = (1 - weights.riverBank) * startingForest;
  const startingClearing = 1 - weights.riverBank - startingForestFloor;
  if (weights.riverBank >= startingForestFloor && weights.riverBank >= startingClearing) return "riverBank";
  return weights.forestFloor > weights.clearing ? "forestFloor" : "clearing";
}

/** How much of each ground type shows at a spot. Weights change smoothly from spot to spot, so ground types blend softly. */
export function groundTypeWeightsAt(map: GroundMap, spot: GroundPoint): GroundTypeWeights {
  return weighGround(map, spot).weights;
}

/** The weights at a spot, and how much forest floor the starting trees alone would give it, from 0 to 1, leaving the river bank aside. */
function weighGround(map: GroundMap, spot: GroundPoint): { weights: GroundTypeWeights; startingForest: number } {
  const wobble = (offset: number) => EDGE_WOBBLE_METRES * smoothNoise(spot.x / EDGE_WOBBLE_SPACING_METRES + offset, spot.z / EDGE_WOBBLE_SPACING_METRES);
  const fromWater = distanceToRiverNear(map, spot) - map.river.width / 2 + wobble(0);
  const riverBank = 1 - smoothstep((fromWater - RIVER_BANK_FULL_METRES) / (RIVER_BANK_EDGE_METRES - RIVER_BANK_FULL_METRES));
  const treeWobble = wobble(57.3);
  const { now, starting } = distancesToNearestTree(map, spot);
  const forest = forestFloorAt(now + treeWobble);
  return {
    weights: {
      riverBank,
      forestFloor: (1 - riverBank) * forest,
      clearing: (1 - riverBank) * (1 - forest),
    },
    startingForest: forestFloorAt(starting + treeWobble),
  };
}

/** How much forest floor shows this far from a trunk, from 0 to 1, leaving the river bank aside. */
function forestFloorAt(fromTree: number): number {
  return 1 - smoothstep((fromTree - FOREST_FLOOR_FULL_METRES) / (FOREST_FLOOR_EDGE_METRES - FOREST_FLOOR_FULL_METRES));
}

/**
 * Distance to the nearest tree spot, counting how far each one's forest floor has drawn in, and distance to the nearest
 * starting tree spot as the valley was made. Each is Infinity when no such spot lies within the forest floor's reach.
 */
function distancesToNearestTree(map: GroundMap, spot: GroundPoint): { now: number; starting: number } {
  const half = map.size / 2;
  const column = Math.floor((spot.x + half) / CELL_METRES);
  const row = Math.floor((spot.z + half) / CELL_METRES);
  let now = Infinity;
  let starting = Infinity;
  for (let r = row - 1; r <= row + 1; r += 1) {
    for (let c = column - 1; c <= column + 1; c += 1) {
      if (r < 0 || c < 0 || r >= map.cellsPerSide || c >= map.cellsPerSide) continue;
      for (const tree of map.treesByCell[r * map.cellsPerSide + c] ?? []) {
        const distance = groundDistance(tree, spot);
        now = Math.min(now, distance + tree.drawnIn);
        if (tree.starting) starting = Math.min(starting, distance);
      }
    }
  }
  return { now, starting };
}

/**
 * Distance from a spot to the middle of the river, or Infinity when the spot is beyond the river bank's reach.
 * It works like distanceToRiver in valley.ts, but skips segments whose box does not hold the spot.
 * The skip matters because every undergrowth plant and every ground texture pixel asks this.
 */
function distanceToRiverNear(map: GroundMap, spot: GroundPoint): number {
  let best = Infinity;
  for (const { a, b, minX, maxX, minZ, maxZ } of map.riverSegments) {
    if (spot.z < minZ || spot.z > maxZ || spot.x < minX || spot.x > maxX) continue;
    best = Math.min(best, distanceToSegment(spot, a, b));
  }
  return best;
}

function cellKey(size: number, cellsPerSide: number, point: GroundPoint): number {
  const half = size / 2;
  const clampCell = (value: number) => Math.min(cellsPerSide - 1, Math.max(0, Math.floor((value + half) / CELL_METRES)));
  return clampCell(point.z) * cellsPerSide + clampCell(point.x);
}

/**
 * Smooth random bumps from -1 to 1, the same for the same spot in every game.
 * Values are picked at whole-number spots and blended smoothly between them.
 */
export function smoothNoise(u: number, v: number): number {
  const column = Math.floor(u);
  const row = Math.floor(v);
  const across = smoothstep(u - column);
  const down = smoothstep(v - row);
  const top = lerp(latticeValue(column, row), latticeValue(column + 1, row), across);
  const bottom = lerp(latticeValue(column, row + 1), latticeValue(column + 1, row + 1), across);
  return lerp(top, bottom, down);
}

/** A fixed random value from -1 to 1 for a whole-number spot. */
function latticeValue(column: number, row: number): number {
  let hash = Math.imul(column, 374761393) + Math.imul(row, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  hash ^= hash >>> 16;
  return ((hash >>> 0) / 4294967295) * 2 - 1;
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

/** Eases a value from 0 to 1 so it starts and ends gently. */
function smoothstep(amount: number): number {
  const t = Math.min(1, Math.max(0, amount));
  return t * t * (3 - 2 * t);
}
