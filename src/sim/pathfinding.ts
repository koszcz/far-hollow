import type { GroundRect } from "./structure-kind";
import { groundDistance, type GroundPoint } from "./ground-point";
import { canStep, cellCentre, cellIndexAt, isWalkable, nearestCellWhere, type WalkMap } from "./walk-map";

/** How far apart line-of-sight checks sample a straight walk, as a share of one cell. */
const LINE_OF_SIGHT_STEP_CELLS = 0.1;

/**
 * Finds the spots the player walks through, in order, to get from `from` to `to`.
 * The path goes around blocked cells and blocked edges between cells. It does not include `from`.
 * If `to` cannot be reached, the path ends at the closest spot to it that can. If the player already stands there, the path is empty.
 */
export function findPath(map: WalkMap, from: GroundPoint, to: GroundPoint): GroundPoint[] {
  const startCell = cellIndexAt(map, from);
  if (startCell === undefined) return [];
  if (hasLineOfSight(map, from, to)) return [{ x: to.x, z: to.z }];

  const regions = regionsOf(map);
  const openCell = nearestCellWhere(map, from, (cell) => regions[cell] !== BLOCKED_REGION);
  const startRegion = regions[openCell ?? startCell];
  const goalCell = nearestCellWhere(map, to, (cell) => regions[cell] === startRegion);
  if (goalCell === undefined) return [];
  const reachesTarget = goalCell === cellIndexAt(map, to);
  if (goalCell === startCell) return reachesTarget ? [{ x: to.x, z: to.z }] : [];

  const cells = searchCells(map, startCell, (cell) => cell === goalCell, cellEstimateTo(map, goalCell));
  if (cells.length === 0) {
    // The player can stand where something now blocks walking, with every square around them blocked too,
    // such as after placing a campfire beside them under a lean-to. They step out to the nearest open square, then walk on.
    if (isWalkable(map, from) || openCell === undefined || openCell === startCell) return [];
    const out = cellCentre(map, openCell);
    return [out, ...findPath(map, out, to)];
  }
  const spots = cells.map((cell) => cellCentre(map, cell));
  if (reachesTarget) spots[spots.length - 1] = { x: to.x, z: to.z };
  return smooth(map, from, spots);
}

/**
 * A thing the player walks to: a single spot, such as a campfire's centre, or a rectangle of ground, such as a sled's footprint.
 * Distances to a rectangle are measured to its edge, and are 0 inside it.
 */
export type WalkTarget = GroundPoint | GroundRect;

/** How far a spot lies from a walk target, in metres: from the spot for a point, or from the edge for a rectangle. */
export function distanceToTarget(target: WalkTarget, spot: GroundPoint): number {
  return groundDistance(nearestPointOf(target, spot), spot);
}

/** The point of a walk target nearest `spot`. Inside a rectangle, that is the spot itself. */
function nearestPointOf(target: WalkTarget, spot: GroundPoint): GroundPoint {
  if (!("min" in target)) return { x: target.x, z: target.z };
  return { x: Math.min(target.max.x, Math.max(target.min.x, spot.x)), z: Math.min(target.max.z, Math.max(target.min.z, spot.z)) };
}

/** The middle of a walk target. */
function middleOf(target: WalkTarget): GroundPoint {
  if (!("min" in target)) return { x: target.x, z: target.z };
  return { x: (target.min.x + target.max.x) / 2, z: (target.min.z + target.max.z) / 2 };
}

/**
 * Finds the spots the player walks through, in order, to reach the nearest spot within `distance` of `target`.
 * "Nearest" means the shortest walk, not the shortest straight line, so the player arrives on the side they came from
 * unless something blocks it. The path ends at a spot within `distance` of the target, and does not include `from`.
 * If the player already stands within `distance`, the path is empty.
 * If no spot within `distance` can be reached, the path ends at the closest spot to the target's middle that can, as `findPath` does.
 */
export function findPathWithin(map: WalkMap, from: GroundPoint, target: WalkTarget, distance: number): GroundPoint[] {
  const nearestPoint = nearestPointOf(target, from);
  const away = groundDistance(from, nearestPoint);
  if (away <= distance) return [];
  const startCell = cellIndexAt(map, from);
  if (startCell === undefined) return [];

  // On open ground, the shortest walk is straight towards the target's nearest point, stopping `distance` short of it.
  // Keeps raw numbers: dividing by `away` before scaling rounds differently from the ground point functions.
  const nearest = {
    x: nearestPoint.x + ((from.x - nearestPoint.x) / away) * distance,
    z: nearestPoint.z + ((from.z - nearestPoint.z) / away) * distance,
  };
  if (hasLineOfSight(map, from, nearest)) return [nearest];

  const regions = regionsOf(map);
  const openCell = nearestCellWhere(map, from, (cell) => regions[cell] !== BLOCKED_REGION);
  const startRegion = regions[openCell ?? startCell];
  const isGoal = (cell: number) => map.blockerCounts[cell] === 0 && distanceToTarget(target, cellCentre(map, cell)) <= distance;
  // Check first that some cell within reach shares the player's region, so a hopeless search does not cover the whole region.
  const closest = nearestCellWhere(map, nearestPoint, (cell) => regions[cell] === startRegion);
  if (closest === undefined || !isGoal(closest)) return findPath(map, from, middleOf(target));
  if (isGoal(startCell)) return [cellCentre(map, startCell)];

  const cells = searchCells(map, startCell, isGoal, (cell) => Math.max(0, distanceToTarget(target, cellCentre(map, cell)) - distance) / map.cellSize);
  if (cells.length === 0) {
    // The player stands where something now blocks walking, with every square around them blocked too. They step out first.
    if (isWalkable(map, from) || openCell === undefined || openCell === startCell) return [];
    const out = cellCentre(map, openCell);
    return [out, ...findPathWithin(map, out, target, distance)];
  }
  return smooth(
    map,
    from,
    cells.map((cell) => cellCentre(map, cell)),
  );
}

const BLOCKED_REGION = 0;

interface Regions {
  version: number;
  /** For each cell, a number shared by every walkable cell that can reach it. Blocked cells are 0. */
  readonly labels: Int32Array;
  /** Cells waiting to be labelled. Kept between splits, so a split allocates nothing. */
  readonly stack: Int32Array;
}

const regionsByMap = new WeakMap<WalkMap, Regions>();

/**
 * Splits the map's walkable cells into regions the player can walk between. Reuses the last split until a cell changes.
 * A split visits every cell of the map, so it is written for speed: typed arrays and no function call per cell.
 * A step between side-by-side cells is open when the cell it enters is walkable and no wall stands on the edge between
 * them, the same rule as canStep.
 */
function regionsOf(map: WalkMap): Int32Array {
  const cellCount = map.blockerCounts.length;
  let regions = regionsByMap.get(map);
  if (regions?.version === map.version) return regions.labels;
  if (regions === undefined) {
    regions = { version: map.version, labels: new Int32Array(cellCount), stack: new Int32Array(cellCount) };
    regionsByMap.set(map, regions);
  }
  regions.version = map.version;
  const { labels, stack } = regions;
  labels.fill(BLOCKED_REGION);

  const side = map.cellsPerSide;
  const blockers = map.blockerCounts;
  // The edge between a cell and the next one along x is at cell * 2. The edge to the next one along z is at cell * 2 + 1.
  const edges = map.edgeBlockerCounts;
  let region = BLOCKED_REGION;
  for (let first = 0; first < cellCount; first += 1) {
    if (labels[first] !== BLOCKED_REGION || blockers[first] !== 0) continue;
    region += 1;
    labels[first] = region;
    let size = 0;
    stack[size++] = first;
    while (size > 0) {
      const cell = stack[--size] ?? 0;
      const column = cell % side;
      let next = cell - 1;
      if (column > 0 && labels[next] === BLOCKED_REGION && blockers[next] === 0 && edges[next * 2] === 0) {
        labels[next] = region;
        stack[size++] = next;
      }
      next = cell + 1;
      if (column < side - 1 && labels[next] === BLOCKED_REGION && blockers[next] === 0 && edges[cell * 2] === 0) {
        labels[next] = region;
        stack[size++] = next;
      }
      next = cell - side;
      if (next >= 0 && labels[next] === BLOCKED_REGION && blockers[next] === 0 && edges[next * 2 + 1] === 0) {
        labels[next] = region;
        stack[size++] = next;
      }
      next = cell + side;
      if (next < cellCount && labels[next] === BLOCKED_REGION && blockers[next] === 0 && edges[cell * 2 + 1] === 0) {
        labels[next] = region;
        stack[size++] = next;
      }
    }
  }
  return labels;
}

/** True if a straight walk between two spots crosses only walkable cells, and no blocked edge between them. */
function hasLineOfSight(map: WalkMap, a: GroundPoint, b: GroundPoint): boolean {
  const steps = Math.ceil(groundDistance(b, a) / (map.cellSize * LINE_OF_SIGHT_STEP_CELLS));
  let cell = cellIndexAt(map, a);
  for (let s = 0; s <= steps; s += 1) {
    const amount = steps === 0 ? 0 : s / steps;
    // Raw numbers on purpose: this runs at every step of every line-of-sight check, so it makes one new spot, not three.
    const spot = { x: a.x + (b.x - a.x) * amount, z: a.z + (b.z - a.z) * amount };
    if (!isWalkable(map, spot)) return false;
    const next = cellIndexAt(map, spot);
    if (cell !== undefined && next !== undefined && next !== cell && !canStep(map, cell, next)) return false;
    cell = next;
  }
  return true;
}

/** Drops each spot the player can skip by walking straight from an earlier one. */
function smooth(map: WalkMap, from: GroundPoint, spots: readonly GroundPoint[]): GroundPoint[] {
  const result: GroundPoint[] = [];
  let standing = from;
  let index = 0;
  while (index < spots.length) {
    // Find the furthest spot still in a straight line from where the player stands.
    let furthest = index;
    for (let next = spots.length - 1; next > index; next -= 1) {
      const spot = spots[next];
      if (spot !== undefined && hasLineOfSight(map, standing, spot)) {
        furthest = next;
        break;
      }
    }
    const spot = spots[furthest];
    if (spot === undefined) break;
    result.push(spot);
    standing = spot;
    index = furthest + 1;
  }
  return result;
}

interface SearchScratch {
  /** Walking distance from the start to each cell along the best route found so far. */
  readonly distance: Float64Array;
  /** The cell each cell was reached from. */
  readonly cameFrom: Int32Array;
  /** Which search last touched each cell, so the arrays need no clearing between searches. */
  readonly searchOf: Uint32Array;
  readonly closedInSearch: Uint32Array;
  search: number;
}

const scratchByMap = new WeakMap<WalkMap, SearchScratch>();

function scratchFor(map: WalkMap): SearchScratch {
  let scratch = scratchByMap.get(map);
  if (scratch === undefined) {
    const cellCount = map.blockerCounts.length;
    scratch = {
      distance: new Float64Array(cellCount),
      cameFrom: new Int32Array(cellCount),
      searchOf: new Uint32Array(cellCount),
      closedInSearch: new Uint32Array(cellCount),
      search: 0,
    };
    scratchByMap.set(map, scratch);
  }
  return scratch;
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** The fewest cells' walk from any cell to `goalCell` on open ground, for A* to estimate how far is left. */
function cellEstimateTo(map: WalkMap, goalCell: number): (cell: number) => number {
  const side = map.cellsPerSide;
  const goalColumn = goalCell % side;
  const goalRow = Math.floor(goalCell / side);
  return (cell) => {
    const dx = Math.abs((cell % side) - goalColumn);
    const dz = Math.abs(Math.floor(cell / side) - goalRow);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  };
}

/**
 * A* search over the grid, from the start to the first cell that `isGoal` accepts, in walking order.
 * `estimate` must never say more cells are left to walk than really are.
 * Moves go to any of the 8 neighbouring cells, but never cross a blocked edge or cut a blocked corner.
 * Returns the cells from just after the start up to the goal, or nothing if no goal can be reached.
 */
function searchCells(map: WalkMap, startCell: number, isGoal: (cell: number) => boolean, estimate: (cell: number) => number): number[] {
  const scratch = scratchFor(map);
  scratch.search += 1;
  const search = scratch.search;
  const { distance, cameFrom, searchOf, closedInSearch } = scratch;
  const side = map.cellsPerSide;
  const open = new MinHeap();

  distance[startCell] = 0;
  cameFrom[startCell] = -1;
  searchOf[startCell] = search;
  open.push(startCell, estimate(startCell));

  while (open.size > 0) {
    const cell = open.pop();
    if (isGoal(cell)) return routeTo(cameFrom, startCell, cell);
    if (closedInSearch[cell] === search) continue;
    closedInSearch[cell] = search;
    const column = cell % side;
    const row = Math.floor(cell / side);
    const here = distance[cell] ?? 0;
    for (const [dx, dz] of NEIGHBOURS) {
      const nextColumn = column + dx;
      const nextRow = row + dz;
      if (nextColumn < 0 || nextRow < 0 || nextColumn >= side || nextRow >= side) continue;
      const next = nextRow * side + nextColumn;
      if (closedInSearch[next] === search || !canStep(map, cell, next)) continue;
      const diagonal = dx !== 0 && dz !== 0;
      const nextDistance = here + (diagonal ? Math.SQRT2 : 1);
      if (searchOf[next] === search && nextDistance >= (distance[next] ?? Infinity)) continue;
      searchOf[next] = search;
      distance[next] = nextDistance;
      cameFrom[next] = cell;
      open.push(next, nextDistance + estimate(next));
    }
  }
  return [];
}

function routeTo(cameFrom: Int32Array, startCell: number, goalCell: number): number[] {
  const route: number[] = [];
  for (let cell = goalCell; cell !== startCell && cell !== -1; cell = cameFrom[cell] ?? -1) route.push(cell);
  return route.reverse();
}

/** A binary heap that hands back the cell with the lowest score first. */
class MinHeap {
  private readonly cells: number[] = [];
  private readonly scores: number[] = [];

  get size(): number {
    return this.cells.length;
  }

  push(cell: number, score: number): void {
    let index = this.cells.length;
    this.cells.push(cell);
    this.scores.push(score);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if ((this.scores[parent] ?? 0) <= score) break;
      this.swap(index, parent);
      index = parent;
    }
  }

  pop(): number {
    const top = this.cells[0] ?? -1;
    const lastCell = this.cells.pop();
    const lastScore = this.scores.pop();
    if (this.cells.length > 0 && lastCell !== undefined && lastScore !== undefined) {
      this.cells[0] = lastCell;
      this.scores[0] = lastScore;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < this.cells.length && (this.scores[left] ?? 0) < (this.scores[smallest] ?? 0)) smallest = left;
        if (right < this.cells.length && (this.scores[right] ?? 0) < (this.scores[smallest] ?? 0)) smallest = right;
        if (smallest === index) break;
        this.swap(index, smallest);
        index = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    const cell = this.cells[a] ?? 0;
    const score = this.scores[a] ?? 0;
    this.cells[a] = this.cells[b] ?? 0;
    this.scores[a] = this.scores[b] ?? 0;
    this.cells[b] = cell;
    this.scores[b] = score;
  }
}
