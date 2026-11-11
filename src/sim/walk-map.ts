import { groundDistance, type GroundPoint } from "./valley";

/**
 * Which parts of the valley floor the player can walk on, as a square grid of cells.
 * Anything that blocks walking, such as a tree or the river, marks the cells it covers.
 * Each cell counts how many things block it, so removing one blocker never frees a cell that another still covers.
 */
export interface WalkMap {
  /** Width and depth of the square area the map covers, in metres. Its centre is at x = 0, z = 0. */
  readonly size: number;
  /** Width of one cell, in metres. */
  readonly cellSize: number;
  readonly cellsPerSide: number;
  /** How many blockers cover each cell, row by row. Row 0 is the edge at z = -size / 2. */
  readonly blockerCounts: Uint8Array;
  /** Goes up each time a cell changes between walkable and blocked. */
  version: number;
}

export interface WalkMapOptions {
  size: number;
  /** Defaults to 1 m. */
  cellSize?: number;
}

const DEFAULT_CELL_SIZE_METRES = 1;

export function createWalkMap({ size, cellSize = DEFAULT_CELL_SIZE_METRES }: WalkMapOptions): WalkMap {
  const cellsPerSide = Math.ceil(size / cellSize);
  return { size, cellSize, cellsPerSide, blockerCounts: new Uint8Array(cellsPerSide * cellsPerSide), version: 0 };
}

/** Marks every cell whose centre lies within `radius` of a spot as blocked. */
export function blockCircle(map: WalkMap, centre: GroundPoint, radius: number): void {
  changeCircle(map, centre, radius, 1);
}

/** Undoes one earlier `blockCircle` with the same spot and radius. */
export function unblockCircle(map: WalkMap, centre: GroundPoint, radius: number): void {
  changeCircle(map, centre, radius, -1);
}

/** Marks the cell that holds each spot as blocked. Spots outside the map are skipped. */
export function blockSpots(map: WalkMap, spots: readonly GroundPoint[]): void {
  changeSpots(map, spots, 1);
}

/** Undoes one earlier `blockSpots` with the same spots. */
export function unblockSpots(map: WalkMap, spots: readonly GroundPoint[]): void {
  changeSpots(map, spots, -1);
}

/** Marks every cell for which `isBlocked` says yes, given the cell's centre. Only cells inside the box from `min` to `max` are checked. */
export function blockWhere(map: WalkMap, min: GroundPoint, max: GroundPoint, isBlocked: (centre: GroundPoint) => boolean): void {
  forEachCellIn(map, min, max, (index, centre) => {
    if (isBlocked(centre)) changeCell(map, index, 1);
  });
}

/** True if the spot is inside the map and no blocker covers its cell. */
export function isWalkable(map: WalkMap, point: GroundPoint): boolean {
  const index = cellIndexAt(map, point);
  return index !== undefined && map.blockerCounts[index] === 0;
}

/** The cell that holds a spot, or undefined if the spot is outside the map. */
export function cellIndexAt(map: WalkMap, point: GroundPoint): number | undefined {
  const half = map.size / 2;
  const column = Math.floor((point.x + half) / map.cellSize);
  const row = Math.floor((point.z + half) / map.cellSize);
  if (column < 0 || row < 0 || column >= map.cellsPerSide || row >= map.cellsPerSide) return undefined;
  return row * map.cellsPerSide + column;
}

/** The centre of a cell. */
export function cellCentre(map: WalkMap, index: number): GroundPoint {
  const half = map.size / 2;
  const column = index % map.cellsPerSide;
  const row = Math.floor(index / map.cellsPerSide);
  return { x: -half + (column + 0.5) * map.cellSize, z: -half + (row + 0.5) * map.cellSize };
}

/** The cell closest to a spot that passes `accept`, searching outward in square rings. */
export function nearestCellWhere(map: WalkMap, spot: GroundPoint, accept: (cell: number) => boolean): number | undefined {
  const side = map.cellsPerSide;
  const half = map.size / 2;
  const centreColumn = Math.min(side - 1, Math.max(0, Math.floor((spot.x + half) / map.cellSize)));
  const centreRow = Math.min(side - 1, Math.max(0, Math.floor((spot.z + half) / map.cellSize)));
  let best: number | undefined;
  let bestDistance = Infinity;
  for (let ring = 0; ring < side; ring += 1) {
    // Every cell in this ring is at least (ring - 1) cells away, so stop once that is further than the best found.
    if ((ring - 1) * map.cellSize > bestDistance) break;
    for (let row = centreRow - ring; row <= centreRow + ring; row += 1) {
      if (row < 0 || row >= side) continue;
      const onEdgeRow = row === centreRow - ring || row === centreRow + ring;
      const step = onEdgeRow ? 1 : ring * 2;
      for (let column = centreColumn - ring; column <= centreColumn + ring; column += Math.max(1, step)) {
        if (column < 0 || column >= side) continue;
        const cell = row * side + column;
        if (!accept(cell)) continue;
        const centre = cellCentre(map, cell);
        const distance = groundDistance(centre, spot);
        if (distance < bestDistance) {
          best = cell;
          bestDistance = distance;
        }
      }
    }
  }
  return best;
}

/** The centre of the walkable cell closest to a spot, or undefined if no cell is walkable. */
export function nearestWalkableSpot(map: WalkMap, spot: GroundPoint): GroundPoint | undefined {
  const cell = nearestCellWhere(map, spot, (index) => map.blockerCounts[index] === 0);
  return cell === undefined ? undefined : cellCentre(map, cell);
}

function changeCircle(map: WalkMap, centre: GroundPoint, radius: number, change: 1 | -1): void {
  const min = { x: centre.x - radius, z: centre.z - radius };
  const max = { x: centre.x + radius, z: centre.z + radius };
  forEachCellIn(map, min, max, (index, cell) => {
    if (groundDistance(cell, centre) <= radius) changeCell(map, index, change);
  });
}

function changeSpots(map: WalkMap, spots: readonly GroundPoint[], change: 1 | -1): void {
  for (const spot of spots) {
    const index = cellIndexAt(map, spot);
    if (index !== undefined) changeCell(map, index, change);
  }
}

function changeCell(map: WalkMap, index: number, change: 1 | -1): void {
  const before = map.blockerCounts[index] ?? 0;
  const after = Math.max(0, before + change);
  map.blockerCounts[index] = after;
  if ((before === 0) !== (after === 0)) map.version += 1;
}

function forEachCellIn(map: WalkMap, min: GroundPoint, max: GroundPoint, visit: (index: number, centre: GroundPoint) => void): void {
  const half = map.size / 2;
  const last = map.cellsPerSide - 1;
  const firstColumn = Math.max(0, Math.floor((min.x + half) / map.cellSize));
  const lastColumn = Math.min(last, Math.floor((max.x + half) / map.cellSize));
  const firstRow = Math.max(0, Math.floor((min.z + half) / map.cellSize));
  const lastRow = Math.min(last, Math.floor((max.z + half) / map.cellSize));
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const index = row * map.cellsPerSide + column;
      visit(index, cellCentre(map, index));
    }
  }
}
