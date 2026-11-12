import { layDeadfall, layLoneStick, rollDeadfallSize, STICK_MIN_FROM_TREE_METRES, type SpotIsOpen } from "./deadfall";
import { createRandom, type Random } from "./random";

/** A spot on the valley floor, in metres from the valley's centre. */
export interface GroundPoint {
  x: number;
  z: number;
}

/** How far apart two spots are across the ground, in metres. Height is ignored. */
export function groundDistance(a: GroundPoint, b: GroundPoint): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** The candidate nearest `spot`, if any lies within `reach` metres of it. */
export function nearestWithin<T extends { position: GroundPoint }>(spot: GroundPoint, candidates: Iterable<T>, reach: number): T | undefined {
  let nearest: T | undefined;
  let nearestDistance = reach;
  for (const candidate of candidates) {
    const distance = groundDistance(candidate.position, spot);
    if (distance <= nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }
  return nearest;
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
  /** Where each stick lies on the forest floor at the start of a game, both in deadfalls and alone. */
  readonly sticks: readonly GroundPoint[];
  /** The deadfalls among the sticks: each is the spots of a few sticks that fell together under one tree. */
  readonly deadfalls: readonly (readonly GroundPoint[])[];
  /** Where each berry bush grows. */
  readonly berryBushes: readonly GroundPoint[];
  /** Where each patch of mushrooms grows. */
  readonly mushrooms: readonly GroundPoint[];
}

/** The valley is a square 300 m on each side: small enough to know well, with thick forest. */
const VALLEY_SIZE_METRES = 300;
const TERRAIN_SPACING_METRES = 2.5;

/** Rolling hills: the largest bump spacing and height, then smaller bumps added on top. */
const HILL_SPACING_METRES = 100;
const HILL_HEIGHT_METRES = 6;
const HILL_LAYERS = 3;
/** Hills flatten out within this distance of the river, so the river runs along a flat valley floor. */
const HILL_FADE_METRES = 20;
/** How much higher the valley sides are than its floor. */
const VALLEY_SIDE_HEIGHT_METRES = 12;

const RIVER_POINT_SPACING_METRES = 10;
const RIVER_MIN_WIDTH_METRES = 6;
const RIVER_MAX_WIDTH_METRES = 10;
/** How far the river's middle may wander from the valley's centre line. */
const RIVER_MAX_OFFSET_METRES = 70;
const RIVER_BED_DEPTH_METRES = 2;
/** How far beyond the water the ground slopes down into the riverbed. */
export const RIVER_BANK_WIDTH_METRES = 8;

/** The valley holds this many trees, packed into groves. Gives trees about 4 to 5 m apart inside a grove. */
const TREE_COUNT = 2600;
/** Trees stand at least this far from each other. */
const TREE_MIN_SPACING_METRES = 3;
/** Groves and clearings change over about this distance, in metres. */
const GROVE_SPACING_METRES = 45;
/**
 * Trees grow only where the grove noise, from -1 to 1, is above this. Lower values leave fewer, smaller clearings.
 * About a third of the valley away from the river is clearing.
 */
const CLEARING_BELOW = -0.15;
/** No tree grows this close to where the player starts, so there is room for a first camp. */
const START_CLEARING_METRES = 16;
/** The player starts this far from the water's edge, in metres. Far enough to stand above the sloping riverbank. */
const START_FROM_WATER_METRES = 10;
/** Trees stand at least this far from the water's edge. */
const TREE_RIVER_CLEARANCE_METRES = 4;

/** A new valley has this many deadfalls of 3 to 6 sticks, and this many lone sticks. About 1,300 sticks in all. */
const DEADFALL_COUNT = 250;
const LONE_STICK_COUNT = 200;

const BERRY_BUSH_COUNT = 60;
/** Berry bushes grow at the forest's edge, this far from a tree's trunk, in metres. */
const BERRY_BUSH_MIN_FROM_TREE_METRES = 2.5;
const BERRY_BUSH_MAX_FROM_TREE_METRES = 6;
const MUSHROOM_COUNT = 80;
/** Mushrooms grow in the shade, close to a tree's trunk, in metres. */
const MUSHROOM_MIN_FROM_TREE_METRES = 1.5;
const MUSHROOM_MAX_FROM_TREE_METRES = 3;

export function generateValley(seed: number): Valley {
  const random = createRandom(seed);
  const river = generateRiver(random);
  const terrain = generateTerrain(random, river);
  const trees = placeTrees(random, river);
  const { sticks, deadfalls } = placeSticks(random, trees, openSpotCheck(river, trees, STICK_MIN_FROM_TREE_METRES));
  // Food is placed last, so adding it did not move the trees of any valley.
  const berryBushes = placeNearTrees(random, river, trees, BERRY_BUSH_COUNT, BERRY_BUSH_MIN_FROM_TREE_METRES, BERRY_BUSH_MAX_FROM_TREE_METRES);
  const mushrooms = placeNearTrees(random, river, trees, MUSHROOM_COUNT, MUSHROOM_MIN_FROM_TREE_METRES, MUSHROOM_MAX_FROM_TREE_METRES);
  return { seed, size: VALLEY_SIZE_METRES, terrain, river, trees, sticks, deadfalls, berryBushes, mushrooms };
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

/** Where the player starts: on the west bank, beside the middle of the river. Ground near it may be blocked. */
export function startSpotBeside(river: River): GroundPoint {
  const middle = river.path[Math.floor(river.path.length / 2)] ?? { x: 0, z: 0 };
  return { x: middle.x - river.width / 2 - START_FROM_WATER_METRES, z: middle.z };
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
        hills += (layer.height * (bump + 1)) / 2;
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

/**
 * Packs trees into groves, with clearings between them where seeded noise is low.
 * Trees keep clear of the river, of each other, and of the spot where the player starts.
 */
function placeTrees(random: Random, river: River): GroundPoint[] {
  const half = VALLEY_SIZE_METRES / 2;
  const cellsPerSide = Math.ceil(VALLEY_SIZE_METRES / TREE_MIN_SPACING_METRES);
  // Each cell is one minimum spacing wide, so only the 3 × 3 cells around a spot can hold a tree that is too close.
  const treesByCell = new Map<number, GroundPoint[]>();
  const cellOf = (value: number) => clamp(Math.floor((value + half) / TREE_MIN_SPACING_METRES), 0, cellsPerSide - 1);
  const riverClearance = river.width / 2 + TREE_RIVER_CLEARANCE_METRES;
  const groves = createValueNoise(random, Math.ceil(VALLEY_SIZE_METRES / GROVE_SPACING_METRES) + 2);
  const inClearing = (point: GroundPoint) => groves((point.x + half) / GROVE_SPACING_METRES, (point.z + half) / GROVE_SPACING_METRES) < CLEARING_BELOW;
  const start = startSpotBeside(river);

  function tooCloseToAnotherTree(point: GroundPoint): boolean {
    const column = cellOf(point.x);
    const row = cellOf(point.z);
    for (let r = row - 1; r <= row + 1; r += 1) {
      for (let c = column - 1; c <= column + 1; c += 1) {
        for (const other of treesByCell.get(r * cellsPerSide + c) ?? []) {
          if (groundDistance(other, point) < TREE_MIN_SPACING_METRES) return true;
        }
      }
    }
    return false;
  }

  const trees: GroundPoint[] = [];
  // Give up after this many tries, in case the groves are too small to hold every tree.
  let triesLeft = TREE_COUNT * 200;
  while (trees.length < TREE_COUNT && triesLeft > 0) {
    triesLeft -= 1;
    const point = { x: (random() * 2 - 1) * half, z: (random() * 2 - 1) * half };
    if (inClearing(point) || groundDistance(point, start) < START_CLEARING_METRES) continue;
    if (distanceToRiver(river, point) <= riverClearance || tooCloseToAnotherTree(point)) continue;
    trees.push(point);
    const key = cellOf(point.z) * cellsPerSide + cellOf(point.x);
    const cell = treesByCell.get(key);
    if (cell) cell.push(point);
    else treesByCell.set(key, [point]);
  }
  return trees;
}

/** Lays the valley's first sticks: deadfalls under random trees first, then lone sticks. */
function placeSticks(random: Random, trees: readonly GroundPoint[], isOpen: SpotIsOpen): { sticks: GroundPoint[]; deadfalls: GroundPoint[][] } {
  const deadfalls: GroundPoint[][] = [];
  const loneSticks: GroundPoint[] = [];
  const firstTree = trees[0];
  if (firstTree === undefined) return { sticks: [], deadfalls };
  const randomTree = () => trees[Math.floor(random() * trees.length)] ?? firstTree;
  while (deadfalls.length < DEADFALL_COUNT) {
    const size = rollDeadfallSize(random);
    const deadfall = layDeadfall(random, randomTree(), size, isOpen);
    if (deadfall) deadfalls.push(deadfall);
  }
  while (loneSticks.length < LONE_STICK_COUNT) {
    const stick = layLoneStick(random, randomTree(), isOpen);
    if (stick) loneSticks.push(...stick);
  }
  return { sticks: [...deadfalls.flat(), ...loneSticks], deadfalls };
}

/** A check for spots where a stick may lie: inside the valley, out of the water, and clear of every tree trunk. */
export function stickSpotCheck(valley: Valley): SpotIsOpen {
  return openSpotCheck(valley.river, valley.trees, STICK_MIN_FROM_TREE_METRES);
}

/**
 * Makes a check for spots inside the valley, out of the water, and at least `minFromTree` metres from every trunk,
 * so the player can reach them.
 */
function openSpotCheck(river: River, trees: readonly GroundPoint[], minFromTree: number): SpotIsOpen {
  const half = VALLEY_SIZE_METRES / 2;
  const cellSize = minFromTree;
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
          if (groundDistance(tree, point) < minFromTree) return true;
        }
      }
    }
    return false;
  }
  return (point) => {
    if (Math.abs(point.x) > half || Math.abs(point.z) > half) return false;
    return distanceToRiver(river, point) > river.width / 2 + 1 && !tooCloseToATree(point);
  };
}

/**
 * Scatters `count` spots in a ring from `minFromTree` to `maxFromTree` metres around random trees, such as where berry bushes grow.
 * A spot is never in the water or closer than `minFromTree` to any trunk, so the player can reach it.
 */
function placeNearTrees(random: Random, river: River, trees: readonly GroundPoint[], count: number, minFromTree: number, maxFromTree: number): GroundPoint[] {
  const isOpen = openSpotCheck(river, trees, minFromTree);
  const spots: GroundPoint[] = [];
  if (trees.length === 0) return spots;
  while (spots.length < count) {
    const tree = trees[Math.floor(random() * trees.length)];
    const angle = random() * Math.PI * 2;
    const distance = lerp(minFromTree, maxFromTree, random());
    if (tree === undefined) continue;
    const point = { x: tree.x + Math.sin(angle) * distance, z: tree.z + Math.cos(angle) * distance };
    if (isOpen(point)) spots.push(point);
  }
  return spots;
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

/** The spot on the middle line of the river nearest to a point. */
export function nearestRiverPoint(river: River, point: GroundPoint): GroundPoint {
  let best = river.path[0] ?? point;
  let bestDistance = Infinity;
  for (let i = 1; i < river.path.length; i += 1) {
    const a = river.path[i - 1];
    const b = river.path[i];
    if (a === undefined || b === undefined) continue;
    const nearest = nearestOnSegment(point, a, b);
    const distance = groundDistance(point, nearest);
    if (distance < bestDistance) {
      best = nearest;
      bestDistance = distance;
    }
  }
  return best;
}

/** Shortest distance from a spot to the straight line between a and b. */
export function distanceToSegment(point: GroundPoint, a: GroundPoint, b: GroundPoint): number {
  return groundDistance(point, nearestOnSegment(point, a, b));
}

function nearestOnSegment(point: GroundPoint, a: GroundPoint, b: GroundPoint): GroundPoint {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared === 0 ? 0 : clamp(((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSquared, 0, 1);
  return { x: a.x + t * dx, z: a.z + t * dz };
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
