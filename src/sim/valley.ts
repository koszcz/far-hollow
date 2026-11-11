import { createRandom, type Random } from "./random";

/** A spot on the valley floor, in metres from the valley's centre. */
export interface GroundPoint {
  x: number;
  z: number;
}

/** The ground's height on a square grid that covers the whole valley. */
export interface Terrain {
  /** Grid points along each side. There are `pointsPerSide * pointsPerSide` heights in all. */
  readonly pointsPerSide: number;
  /** Distance between neighbouring grid points, in metres. */
  readonly spacing: number;
  /**
   * Ground height at each grid point, in metres, row by row.
   * Row 0 is the edge at z = -size / 2. Column 0 is the edge at x = -size / 2.
   */
  readonly heights: readonly number[];
}

/** The single river. It runs from the valley edge at z = -size / 2 to the edge at z = size / 2. */
export interface River {
  /** The middle of the river, from its upstream end to its downstream end. */
  readonly path: readonly GroundPoint[];
  /** Width of the water, in metres. */
  readonly width: number;
}

/** The layout of a valley. Everything in it comes from the seed. */
export interface Valley {
  readonly seed: number;
  /** Width and depth of the square valley, in metres. Its centre is at x = 0, z = 0. */
  readonly size: number;
  readonly terrain: Terrain;
  readonly river: River;
  /** Where each tree stands. */
  readonly trees: readonly GroundPoint[];
  /** Where each stick lies on the forest floor at the start of a game. */
  readonly sticks: readonly GroundPoint[];
}

/** The valley is a square 1 km on each side, so about 1 km². */
const VALLEY_SIZE_METRES = 1000;
const TERRAIN_SPACING_METRES = 5;

/** Rolling hills: the largest bump spacing and height, then smaller bumps added on top. */
const HILL_SPACING_METRES = 250;
const HILL_HEIGHT_METRES = 12;
const HILL_LAYERS = 3;
/** Hills flatten out within this distance of the river, so the river runs along a flat valley floor. */
const HILL_FADE_METRES = 40;
/** How much higher the valley sides are than its floor. */
const VALLEY_SIDE_HEIGHT_METRES = 40;

const RIVER_POINT_SPACING_METRES = 20;
const RIVER_MIN_WIDTH_METRES = 6;
const RIVER_MAX_WIDTH_METRES = 10;
/** How far the river's middle may wander from the valley's centre line. */
const RIVER_MAX_OFFSET_METRES = 250;
const RIVER_BED_DEPTH_METRES = 2;
/** How far beyond the water the ground slopes down into the riverbed. */
const RIVER_BANK_WIDTH_METRES = 8;

const TREE_COUNT = 4000;
/** Trees stand at least this far from each other. */
const TREE_MIN_SPACING_METRES = 3;
/** Trees stand at least this far from the water's edge. */
const TREE_RIVER_CLEARANCE_METRES = 4;

const STICK_COUNT = 3000;
/** Sticks fall from trees, so each lies within this ring around a tree's trunk, in metres. */
const STICK_MIN_FROM_TREE_METRES = 1.5;
const STICK_MAX_FROM_TREE_METRES = 4;

export function generateValley(seed: number): Valley {
  const random = createRandom(seed);
  const river = generateRiver(random);
  const terrain = generateTerrain(random, river);
  const trees = placeTrees(random, river);
  const sticks = placeSticks(random, river, trees);
  return { seed, size: VALLEY_SIZE_METRES, terrain, river, trees, sticks };
}

/** Ground height at any spot in the valley, blended from the nearest grid points. Spots outside the valley use the nearest edge. */
export function terrainHeightAt(terrain: Terrain, x: number, z: number): number {
  const last = terrain.pointsPerSide - 1;
  const half = (last * terrain.spacing) / 2;
  const column = clamp((x + half) / terrain.spacing, 0, last);
  const row = clamp((z + half) / terrain.spacing, 0, last);
  const column0 = Math.min(Math.floor(column), last - 1);
  const row0 = Math.min(Math.floor(row), last - 1);
  const across = column - column0;
  const down = row - row0;
  const height = (r: number, c: number) => terrain.heights[r * terrain.pointsPerSide + c] ?? 0;
  const top = lerp(height(row0, column0), height(row0, column0 + 1), across);
  const bottom = lerp(height(row0 + 1, column0), height(row0 + 1, column0 + 1), across);
  return lerp(top, bottom, down);
}

/** Shortest distance from a spot to the middle of the river. */
export function distanceToRiver(river: River, point: GroundPoint): number {
  let best = Infinity;
  for (let i = 1; i < river.path.length; i += 1) {
    const a = river.path[i - 1];
    const b = river.path[i];
    if (a === undefined || b === undefined) continue;
    best = Math.min(best, distanceToSegment(point, a, b));
  }
  return best;
}

function generateRiver(random: Random): River {
  const half = VALLEY_SIZE_METRES / 2;
  const width = lerp(RIVER_MIN_WIDTH_METRES, RIVER_MAX_WIDTH_METRES, random());
  // The river's sideways wander is the sum of a few slow waves, each with a seeded size and starting point.
  const waves = [1, 2, 3].map((bends) => ({
    bends,
    phase: random() * Math.PI * 2,
    size: random() / bends,
  }));
  const totalWaveSize = waves.reduce((sum, wave) => sum + wave.size, 0);
  const centreOffset = (random() * 2 - 1) * 0.3;

  const path: GroundPoint[] = [];
  const pointCount = VALLEY_SIZE_METRES / RIVER_POINT_SPACING_METRES + 1;
  for (let i = 0; i < pointCount; i += 1) {
    const along = i / (pointCount - 1);
    let wander = 0;
    for (const wave of waves) wander += wave.size * Math.sin(along * Math.PI * wave.bends + wave.phase);
    const offset = clamp(centreOffset + (0.7 * wander) / totalWaveSize, -1, 1);
    path.push({ x: offset * RIVER_MAX_OFFSET_METRES, z: -half + along * VALLEY_SIZE_METRES });
  }
  return { path, width };
}

function generateTerrain(random: Random, river: River): Terrain {
  const pointsPerSide = VALLEY_SIZE_METRES / TERRAIN_SPACING_METRES + 1;
  const half = VALLEY_SIZE_METRES / 2;
  const hillLayers = Array.from({ length: HILL_LAYERS }, (_, layer) => ({
    noise: createValueNoise(random, Math.ceil(VALLEY_SIZE_METRES / (HILL_SPACING_METRES / 2 ** layer)) + 2),
    spacing: HILL_SPACING_METRES / 2 ** layer,
    height: HILL_HEIGHT_METRES / 2 ** layer,
  }));

  const heights: number[] = [];
  for (let row = 0; row < pointsPerSide; row += 1) {
    for (let column = 0; column < pointsPerSide; column += 1) {
      const point = { x: -half + column * TERRAIN_SPACING_METRES, z: -half + row * TERRAIN_SPACING_METRES };
      const fromRiver = distanceToRiver(river, point);
      // Hills only add height, so no ground away from the river sits lower than the riverbed.
      let hills = 0;
      for (const layer of hillLayers) {
        const bump = layer.noise((point.x + half) / layer.spacing, (point.z + half) / layer.spacing);
        hills += layer.height * (bump + 1) / 2;
      }
      let height = hills * smoothstep(fromRiver / HILL_FADE_METRES);
      // The ground rises away from the river, so the river runs along the valley floor.
      height += VALLEY_SIDE_HEIGHT_METRES * smoothstep(fromRiver / VALLEY_SIZE_METRES);
      // Carve the riverbed below the banks.
      height -= RIVER_BED_DEPTH_METRES * (1 - smoothstep((fromRiver - river.width / 2) / RIVER_BANK_WIDTH_METRES));
      heights.push(height);
    }
  }
  return { pointsPerSide, spacing: TERRAIN_SPACING_METRES, heights };
}

function placeTrees(random: Random, river: River): GroundPoint[] {
  const half = VALLEY_SIZE_METRES / 2;
  const cellsPerSide = Math.ceil(VALLEY_SIZE_METRES / TREE_MIN_SPACING_METRES);
  // Each cell is one minimum spacing wide, so only the 3 × 3 cells around a spot can hold a tree that is too close.
  const treesByCell = new Map<number, GroundPoint[]>();
  const cellOf = (value: number) => clamp(Math.floor((value + half) / TREE_MIN_SPACING_METRES), 0, cellsPerSide - 1);
  const riverClearance = river.width / 2 + TREE_RIVER_CLEARANCE_METRES;

  function tooCloseToAnotherTree(point: GroundPoint): boolean {
    const column = cellOf(point.x);
    const row = cellOf(point.z);
    for (let r = row - 1; r <= row + 1; r += 1) {
      for (let c = column - 1; c <= column + 1; c += 1) {
        for (const other of treesByCell.get(r * cellsPerSide + c) ?? []) {
          if (Math.hypot(other.x - point.x, other.z - point.z) < TREE_MIN_SPACING_METRES) return true;
        }
      }
    }
    return false;
  }

  const trees: GroundPoint[] = [];
  while (trees.length < TREE_COUNT) {
    const point = { x: (random() * 2 - 1) * half, z: (random() * 2 - 1) * half };
    if (distanceToRiver(river, point) <= riverClearance || tooCloseToAnotherTree(point)) continue;
    trees.push(point);
    const key = cellOf(point.z) * cellsPerSide + cellOf(point.x);
    const cell = treesByCell.get(key);
    if (cell) cell.push(point);
    else treesByCell.set(key, [point]);
  }
  return trees;
}

/**
 * Scatters sticks near trees, where they would fall.
 * A stick never lies in the water or so close to a trunk that the player cannot reach it.
 */
function placeSticks(random: Random, river: River, trees: readonly GroundPoint[]): GroundPoint[] {
  const half = VALLEY_SIZE_METRES / 2;
  const cellSize = STICK_MIN_FROM_TREE_METRES;
  const cellsPerSide = Math.ceil(VALLEY_SIZE_METRES / cellSize);
  const cellOf = (value: number) => clamp(Math.floor((value + half) / cellSize), 0, cellsPerSide - 1);
  // Each cell is one clearance wide, so only the 3 × 3 cells around a spot can hold a trunk that is too close.
  const treesByCell = new Map<number, GroundPoint[]>();
  for (const tree of trees) {
    const key = cellOf(tree.z) * cellsPerSide + cellOf(tree.x);
    const cell = treesByCell.get(key);
    if (cell) cell.push(tree);
    else treesByCell.set(key, [tree]);
  }
  function tooCloseToATree(point: GroundPoint): boolean {
    const column = cellOf(point.x);
    const row = cellOf(point.z);
    for (let r = row - 1; r <= row + 1; r += 1) {
      for (let c = column - 1; c <= column + 1; c += 1) {
        for (const tree of treesByCell.get(r * cellsPerSide + c) ?? []) {
          if (Math.hypot(tree.x - point.x, tree.z - point.z) < STICK_MIN_FROM_TREE_METRES) return true;
        }
      }
    }
    return false;
  }

  const sticks: GroundPoint[] = [];
  if (trees.length === 0) return sticks;
  while (sticks.length < STICK_COUNT) {
    const tree = trees[Math.floor(random() * trees.length)];
    const angle = random() * Math.PI * 2;
    const distance = lerp(STICK_MIN_FROM_TREE_METRES, STICK_MAX_FROM_TREE_METRES, random());
    if (tree === undefined) continue;
    const point = { x: tree.x + Math.sin(angle) * distance, z: tree.z + Math.cos(angle) * distance };
    if (Math.abs(point.x) > half || Math.abs(point.z) > half) continue;
    if (distanceToRiver(river, point) <= river.width / 2 + 1 || tooCloseToATree(point)) continue;
    sticks.push(point);
  }
  return sticks;
}

/**
 * Smooth random bumps. Returns a function that gives a value from -1 to 1 for any spot on a lattice
 * `latticeSize` points across, blending smoothly between seeded random values at the lattice points.
 */
function createValueNoise(random: Random, latticeSize: number): (u: number, v: number) => number {
  const values = Array.from({ length: latticeSize * latticeSize }, () => random() * 2 - 1);
  const at = (column: number, row: number) => values[row * latticeSize + column] ?? 0;
  return (u, v) => {
    const column = Math.floor(u);
    const row = Math.floor(v);
    const across = smoothstep(u - column);
    const down = smoothstep(v - row);
    const top = lerp(at(column, row), at(column + 1, row), across);
    const bottom = lerp(at(column, row + 1), at(column + 1, row + 1), across);
    return lerp(top, bottom, down);
  };
}

function distanceToSegment(point: GroundPoint, a: GroundPoint, b: GroundPoint): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared === 0 ? 0 : clamp(((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSquared, 0, 1);
  return Math.hypot(point.x - (a.x + t * dx), point.z - (a.z + t * dz));
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Eases a value from 0 to 1 so it starts and ends gently. */
function smoothstep(amount: number): number {
  const t = clamp(amount, 0, 1);
  return t * t * (3 - 2 * t);
}
