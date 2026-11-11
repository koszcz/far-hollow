// Answers "which ground type is here?" for any spot in the valley: forest floor, clearing, or river bank.
// Ground types come from where trees stand when the valley is made and from where the river runs.
// Felling a tree does not change them, because the map is built once from the valley's starting trees.
// The terrain drawing blends ground types with groundTypeWeightsAt. Undergrowth picks what grows with groundTypeAt.
import { groundDistance, RIVER_BANK_WIDTH_METRES, type GroundPoint, type Valley } from "./valley";

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
  /** Starting trees, grouped into square cells row by row, so a lookup only checks the trees nearby. */
  readonly treesByCell: readonly (readonly GroundPoint[] | undefined)[];
  readonly cellsPerSide: number;
  /** Each river segment with the box around it where the river bank can reach, so far segments are skipped quickly. */
  readonly riverSegments: readonly RiverSegment[];
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
/** Each lookup cell is as wide as the forest floor's reach, so only the 3 × 3 cells around a spot matter. */
const CELL_METRES = FOREST_FLOOR_EDGE_METRES;

/** Builds the ground map from the valley as it is made. Pass the valley's starting trees, never the trees still standing. */
export function createGroundMap(valley: Pick<Valley, "size" | "river" | "trees">): GroundMap {
  const cellsPerSide = Math.ceil(valley.size / CELL_METRES);
  const treesByCell: (GroundPoint[] | undefined)[] = Array.from({ length: cellsPerSide * cellsPerSide }, () => undefined);
  for (const tree of valley.trees) {
    const key = cellKey(valley.size, cellsPerSide, tree);
    const cell = treesByCell[key];
    if (cell) cell.push(tree);
    else treesByCell[key] = [tree];
  }
  const reach = valley.river.width / 2 + RIVER_BANK_EDGE_METRES;
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

/** The ground type that shows most at a spot. */
export function groundTypeAt(map: GroundMap, spot: GroundPoint): GroundType {
  const weights = groundTypeWeightsAt(map, spot);
  if (weights.riverBank >= weights.forestFloor && weights.riverBank >= weights.clearing) return "riverBank";
  return weights.forestFloor > weights.clearing ? "forestFloor" : "clearing";
}

/** How much of each ground type shows at a spot. Weights change smoothly from spot to spot, so ground types blend softly. */
export function groundTypeWeightsAt(map: GroundMap, spot: GroundPoint): GroundTypeWeights {
  const fromWater = distanceToRiverNear(map, spot) - map.river.width / 2;
  const riverBank = 1 - smoothstep((fromWater - RIVER_BANK_FULL_METRES) / (RIVER_BANK_EDGE_METRES - RIVER_BANK_FULL_METRES));
  const fromTree = distanceToNearestTree(map, spot);
  const forest = 1 - smoothstep((fromTree - FOREST_FLOOR_FULL_METRES) / (FOREST_FLOOR_EDGE_METRES - FOREST_FLOOR_FULL_METRES));
  return {
    riverBank,
    forestFloor: (1 - riverBank) * forest,
    clearing: (1 - riverBank) * (1 - forest),
  };
}

/** Distance to the nearest starting tree, or Infinity when none stands within the forest floor's reach. */
function distanceToNearestTree(map: GroundMap, spot: GroundPoint): number {
  const half = map.size / 2;
  const column = Math.floor((spot.x + half) / CELL_METRES);
  const row = Math.floor((spot.z + half) / CELL_METRES);
  let best = Infinity;
  for (let r = row - 1; r <= row + 1; r += 1) {
    for (let c = column - 1; c <= column + 1; c += 1) {
      if (r < 0 || c < 0 || r >= map.cellsPerSide || c >= map.cellsPerSide) continue;
      for (const tree of map.treesByCell[r * map.cellsPerSide + c] ?? []) {
        best = Math.min(best, groundDistance(tree, spot));
      }
    }
  }
  return best;
}

/** Distance from a spot to the middle of the river, or Infinity when the spot is beyond the river bank's reach. */
function distanceToRiverNear(map: GroundMap, spot: GroundPoint): number {
  let best = Infinity;
  for (const { a, b, minX, maxX, minZ, maxZ } of map.riverSegments) {
    if (spot.z < minZ || spot.z > maxZ || spot.x < minX || spot.x > maxX) continue;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lengthSquared = dx * dx + dz * dz;
    const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((spot.x - a.x) * dx + (spot.z - a.z) * dz) / lengthSquared));
    best = Math.min(best, Math.hypot(spot.x - (a.x + t * dx), spot.z - (a.z + t * dz)));
  }
  return best;
}

function cellKey(size: number, cellsPerSide: number, point: GroundPoint): number {
  const half = size / 2;
  const clampCell = (value: number) => Math.min(cellsPerSide - 1, Math.max(0, Math.floor((value + half) / CELL_METRES)));
  return clampCell(point.z) * cellsPerSide + clampCell(point.x);
}

/** Eases a value from 0 to 1 so it starts and ends gently. */
function smoothstep(amount: number): number {
  const t = Math.min(1, Math.max(0, amount));
  return t * t * (3 - 2 * t);
}
