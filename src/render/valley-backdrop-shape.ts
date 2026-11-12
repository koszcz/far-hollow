// Shapes the "valley-backdrop" asset in asset-manifest.json (draft): the land around the valley that the player sees but
// cannot reach. valley-backdrop-meshes.ts draws it.
// - Wooded ridges rise from the valley's edge on all four sides, 40 m above the valley floor. The ridge starts at the
//   height of the valley's ground at each point along the edge, so the two meet with no step.
// - The river runs out through a gorge in the ridge at each end. In the gorge, the valley's edge profile carries on
//   outward along the river, so its bed and banks carry on too.
// - Beyond the ridges lies low land, with two rings of mountains about 1.4 km and 2.7 km away.
// Everything comes from the valley's seed.
import * as THREE from "three";
import { createRandom, type Random } from "../sim/random";
import { terrainHeightAt, type GroundPoint, type Valley } from "../sim/valley";

/** How far the ridge crest rises above the valley floor, in metres. The owner chose 40 m. */
export const RIDGE_HEIGHT_METRES = 40;
/** The crest rises and dips by up to this much along its length, in metres. */
const RIDGE_WOBBLE_METRES = 3;
/** The ridge climbs from the valley's edge to its crest over this distance, in metres. */
const RIDGE_RISE_METRES = 60;
/** The crest runs flat-ish until this far from the valley's edge, then the ridge's back slopes down to the far land. */
const RIDGE_CREST_END_METRES = 95;
/** The ridge's outer edge is this far from the valley's edge, in metres. The far land carries on from there. */
export const RIDGE_REACH_METRES = 200;
/** Distances from the valley's edge of each row of the ridge mesh, in metres. Close rows near the valley, for a smooth seam. */
const RIDGE_ROWS_METRES = [0, 1.25, 2.5, 5, 7.5, 10, 15, 20, 25, 30, 37.5, 45, 52.5, 60, 70, 80, 95, 115, 140, 170, RIDGE_REACH_METRES];
/** How many slices fan around each corner of the valley, where the ridge turns. */
const CORNER_SLICES = 8;

/** The gorge floor reaches this far from the river's middle line, in metres. Wider than the water and its pebble bank. */
const GORGE_HALF_WIDTH_METRES = 14;
/** The gorge's walls climb to the ridge over this distance, in metres. */
const GORGE_WALL_METRES = 25;
/** The river leaves the valley at most this far from straight out, in radians, so its gorge stays on one side. */
const GORGE_MAX_TURN = (20 * Math.PI) / 180;

/** Height of the low land between the ridges and the mountains, in metres. */
const FAR_PLAIN_METRES = 18;
/** The river's channel carries on into the far land at this height, in metres, for this far from the valley's middle. */
const FAR_CHANNEL_FLOOR_METRES = -3.5;
const FAR_CHANNEL_HALF_WIDTH_METRES = 20;
const FAR_CHANNEL_WALL_METRES = 80;
const FAR_CHANNEL_END_METRES = 900;
/** Each ring of mountains: its distance from the valley's middle, its width, its lowest and highest peaks, in metres. */
const MOUNTAIN_RINGS = [
  { distance: 1400, width: 330, lowest: 110, highest: 320, wander: 180, bends: [5, 8, 13, 21, 34, 47] },
  { distance: 2700, width: 520, lowest: 260, highest: 620, wander: 300, bends: [4, 7, 11, 17, 26, 39] },
] as const;
/** The far land ends this far from the valley's middle, in metres, inside the camera's 4,000 m draw distance. */
export const FAR_LAND_REACH_METRES = 3600;
/** The far land mesh starts this far from the valley's middle, in metres, hidden under the ridge. */
const FAR_LAND_START_METRES = 330;
/** The far land sits this far below the ridge where the two overlap, so the ridge always draws on top. */
const FAR_LAND_UNDER_RIDGE_METRES = 0.5;
/** Spokes of the far land mesh around the valley. */
const FAR_LAND_SPOKES = 256;
/** Distances from the valley's middle of each ring of the far land mesh, in metres. Closer where the mountains are. */
const FAR_LAND_RINGS_METRES = [
  FAR_LAND_START_METRES,
  420,
  540,
  700,
  880,
  1030,
  1160,
  1280,
  1400,
  1520,
  1640,
  1780,
  1950,
  2150,
  2350,
  2550,
  2700,
  2850,
  3000,
  3200,
  3400,
  FAR_LAND_REACH_METRES,
];

/** Spacing of the trees on the ridge's inner slope and crest, and beyond the crest, in metres. */
const RIDGE_TREE_SPACING_METRES = 5;
const BACK_TREE_SPACING_METRES = 11;
/** Trees grow no closer to the valley's edge than this, so they do not crowd the valley's own trees. */
const RIDGE_TREE_FROM_EDGE_METRES = 1.5;
/** Ridge trees are this much smaller and larger than their shape. */
const RIDGE_TREE_MIN_SCALE = 0.8;
const RIDGE_TREE_MAX_SCALE = 1.25;
/** Ridge trees sink this far into the ground, so their trunks never float above a slope. */
const RIDGE_TREE_SINK_METRES = 0.3;

/** Where the river crosses the valley's edge, and the direction it runs on outward. */
interface RiverExit {
  readonly x: number;
  /** -1 for the edge at z = -size / 2, 1 for the edge at z = size / 2. */
  readonly side: -1 | 1;
  /** The outward direction along the ground, as a unit vector. */
  readonly dx: number;
  readonly dz: number;
}

/** One tree on the ridge, with its turn in radians and its size. */
export interface RidgeTree {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly turn: number;
  readonly scale: number;
}

export interface ValleyBackdrop {
  /** Height of the backdrop's ground at a spot on or outside the valley's edge, in metres. Inside, it is the valley edge's height. */
  heightAt(x: number, z: number): number;
  /** The ridge and far land's height outside the valley, and the valley's own ground inside it. */
  groundHeightAt(x: number, z: number): number;
  /** Where the river runs out of the valley at its upstream end, then at its downstream end, as paths away from the edge. */
  readonly riverRuns: readonly (readonly GroundPoint[])[];
  readonly trees: readonly RidgeTree[];
}

export function createValleyBackdrop(valley: Valley): ValleyBackdrop {
  const half = valley.size / 2;
  // A random stream of its own, so the backdrop never moves the valley's trees.
  const random = createRandom((valley.seed ^ 0x5bd1e995) >>> 0);
  const crestWobble = createLoopNoise(random, [3, 5, 8, 13]);
  const mountainPeaks = MOUNTAIN_RINGS.map((ring) => ({ ring, peaks: createLoopNoise(random, ring.bends), wander: createLoopNoise(random, [2, 3, 5]) }));
  const exits = riverExits(valley);

  /** How open the river's way out is at a spot: 1 on the gorge or channel floor, 0 well away from it. */
  function openness(x: number, z: number, halfWidth: number, wall: number): { open: number; exit: RiverExit | undefined } {
    for (const exit of exits) {
      if (exit.side * z <= half) continue;
      const fromEdge = exit.side * z - half;
      const along = fromEdge / Math.abs(exit.dz);
      const sideways = Math.abs(x - (exit.x + exit.dx * along));
      return { open: 1 - smoothstep((sideways - halfWidth) / wall), exit };
    }
    return { open: 0, exit: undefined };
  }

  /** The valley edge's height at the spot where a line along the river's way out, through this spot, meets the edge. */
  function edgeProfileAt(x: number, z: number, exit: RiverExit): number {
    const along = (exit.side * z - half) / Math.abs(exit.dz);
    return terrainHeightAt(valley.terrain, clamp(x - exit.dx * along, -half, half), exit.side * half);
  }

  function farLandHeightAt(x: number, z: number): number {
    const distance = Math.hypot(x, z);
    const angle = Math.atan2(z, x);
    let height = FAR_PLAIN_METRES;
    for (const { ring, peaks, wander } of mountainPeaks) {
      const peak = THREE.MathUtils.lerp(ring.lowest, ring.highest, (peaks(angle) + 1) / 2);
      const across = (distance - ring.distance - wander(angle) * ring.wander) / ring.width;
      height += peak * Math.exp(-across * across * 4);
    }
    const channel = openness(x, z, FAR_CHANNEL_HALF_WIDTH_METRES, FAR_CHANNEL_WALL_METRES).open * (1 - smoothstep((distance - FAR_CHANNEL_END_METRES) / 300));
    return THREE.MathUtils.lerp(height, FAR_CHANNEL_FLOOR_METRES, channel);
  }

  function heightAt(x: number, z: number): number {
    const edgeX = clamp(x, -half, half);
    const edgeZ = clamp(z, -half, half);
    const fromEdge = Math.hypot(x - edgeX, z - edgeZ);
    const edge = terrainHeightAt(valley.terrain, edgeX, edgeZ);
    if (fromEdge > RIDGE_REACH_METRES) return farLandHeightAt(x, z);
    const crest = RIDGE_HEIGHT_METRES + RIDGE_WOBBLE_METRES * crestWobble(Math.atan2(z, x));
    const ridge =
      fromEdge <= RIDGE_CREST_END_METRES
        ? THREE.MathUtils.lerp(edge, crest, smoothstep(fromEdge / RIDGE_RISE_METRES))
        : THREE.MathUtils.lerp(crest, farLandHeightAt(x, z), smoothstep((fromEdge - RIDGE_CREST_END_METRES) / (RIDGE_REACH_METRES - RIDGE_CREST_END_METRES)));
    const { open, exit } = openness(x, z, GORGE_HALF_WIDTH_METRES, GORGE_WALL_METRES);
    if (exit === undefined || open === 0) return ridge;
    return THREE.MathUtils.lerp(ridge, edgeProfileAt(x, z, exit), open);
  }

  function groundHeightAt(x: number, z: number): number {
    if (Math.abs(x) <= half && Math.abs(z) <= half) return terrainHeightAt(valley.terrain, x, z);
    return heightAt(x, z);
  }

  const riverRuns = exits.map((exit) => {
    const start = { x: exit.x, z: exit.side * half };
    const steps = RIDGE_REACH_METRES / 10;
    const run = Array.from({ length: steps + 1 }, (_, step) => {
      const along = (step / steps) * (RIDGE_REACH_METRES / Math.abs(exit.dz));
      return { x: start.x + exit.dx * along, z: start.z + exit.dz * along };
    });
    // The water flows towards the valley at the upstream end, and away from it at the downstream end.
    return exit === exits[0] ? run.reverse() : run;
  });

  return {
    heightAt,
    groundHeightAt,
    riverRuns,
    trees: placeRidgeTrees(random, half, heightAt, (x, z) => openness(x, z, GORGE_HALF_WIDTH_METRES, 0).open > 0),
  };
}

/** The river's way out at its upstream end, at z = -size / 2, then at its downstream end. */
function riverExits(valley: Valley): RiverExit[] {
  const path = valley.river.path;
  const exitAt = (end: GroundPoint | undefined, before: GroundPoint | undefined, side: -1 | 1): RiverExit[] => {
    if (end === undefined || before === undefined) return [];
    const turn = clamp(Math.atan2(end.x - before.x, side * (end.z - before.z)), -GORGE_MAX_TURN, GORGE_MAX_TURN);
    return [{ x: end.x, side, dx: Math.sin(turn), dz: side * Math.cos(turn) }];
  };
  return [...exitAt(path[0], path[1], -1), ...exitAt(path[path.length - 1], path[path.length - 2], 1)];
}

/**
 * Trees on a jittered grid over the ridge: close on its inner slope and crest, sparser on its back, where the camera
 * sees them only from far off. None stand on the gorge floor.
 */
function placeRidgeTrees(
  random: Random,
  half: number,
  heightAt: (x: number, z: number) => number,
  onGorgeFloor: (x: number, z: number) => boolean,
): RidgeTree[] {
  const trees: RidgeTree[] = [];
  const reach = half + RIDGE_REACH_METRES;
  for (const [spacing, from, to] of [
    [RIDGE_TREE_SPACING_METRES, RIDGE_TREE_FROM_EDGE_METRES, RIDGE_CREST_END_METRES],
    [BACK_TREE_SPACING_METRES, RIDGE_CREST_END_METRES, RIDGE_REACH_METRES - 5],
  ] as const) {
    for (let gridZ = -reach; gridZ <= reach; gridZ += spacing) {
      for (let gridX = -reach; gridX <= reach; gridX += spacing) {
        const x = gridX + (random() - 0.5) * spacing * 0.8;
        const z = gridZ + (random() - 0.5) * spacing * 0.8;
        const turn = random() * Math.PI * 2;
        const scale = THREE.MathUtils.lerp(RIDGE_TREE_MIN_SCALE, RIDGE_TREE_MAX_SCALE, random());
        const fromEdge = Math.hypot(x - clamp(x, -half, half), z - clamp(z, -half, half));
        if (fromEdge < from || fromEdge >= to || onGorgeFloor(x, z)) continue;
        trees.push({ x, y: heightAt(x, z) - RIDGE_TREE_SINK_METRES, z, turn, scale });
      }
    }
  }
  return trees;
}

/**
 * The ridge's ground: a strip that runs all the way around the valley, from its edge out to RIDGE_REACH_METRES.
 * Its inner edge uses the valley's own edge grid points and heights, so it meets the valley's ground exactly.
 * At each corner, slices fan out from the corner point, so the ridge turns the corner smoothly.
 * Each point also carries `beyondEdge`, its distance from the valley's edge, and texture coordinates that carry on
 * from the valley ground's, so its textures line up across the seam.
 */
export function createRidgeGeometry(valley: Valley, backdrop: Pick<ValleyBackdrop, "heightAt">): THREE.BufferGeometry {
  const { pointsPerSide, spacing, heights } = valley.terrain;
  const last = pointsPerSide - 1;
  const half = valley.size / 2;
  /** One slice across the ridge: its point on the valley's edge, its grid index there, and its outward direction. */
  const slices: { x: number; z: number; grid: number; outX: number; outZ: number }[] = [];
  // The four sides in turn, each with its grid points and its outward direction.
  const sides = [
    { outX: 0, outZ: -1, point: (step: number) => ({ row: 0, column: step }) },
    { outX: 1, outZ: 0, point: (step: number) => ({ row: step, column: last }) },
    { outX: 0, outZ: 1, point: (step: number) => ({ row: last, column: last - step }) },
    { outX: -1, outZ: 0, point: (step: number) => ({ row: last - step, column: 0 }) },
  ];
  sides.forEach((side, sideIndex) => {
    for (let step = 0; step <= last; step += 1) {
      const { row, column } = side.point(step);
      slices.push({ x: -half + column * spacing, z: -half + row * spacing, grid: row * pointsPerSide + column, outX: side.outX, outZ: side.outZ });
    }
    // Fan around the corner at the end of this side, turning from this side's outward direction to the next one's.
    const next = sides[(sideIndex + 1) % sides.length] ?? side;
    const corner = slices[slices.length - 1];
    if (corner === undefined) return;
    const from = Math.atan2(side.outZ, side.outX);
    let to = Math.atan2(next.outZ, next.outX);
    if (to < from) to += Math.PI * 2;
    for (let slice = 1; slice < CORNER_SLICES; slice += 1) {
      const angle = THREE.MathUtils.lerp(from, to, slice / CORNER_SLICES);
      slices.push({ ...corner, outX: Math.cos(angle), outZ: Math.sin(angle) });
    }
  });

  const rows = RIDGE_ROWS_METRES.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const beyondEdge: number[] = [];
  for (const slice of slices) {
    for (const distance of RIDGE_ROWS_METRES) {
      const x = slice.x + slice.outX * distance;
      const z = slice.z + slice.outZ * distance;
      const y = distance === 0 ? (heights[slice.grid] ?? 0) : backdrop.heightAt(x, z);
      positions.push(x, y, z);
      // The same texture coordinates the valley ground's plane gives: u runs with x, v against z.
      uvs.push(0.5 + x / valley.size, 0.5 - z / valley.size);
      beyondEdge.push(distance);
    }
  }
  const indices: number[] = [];
  for (let slice = 0; slice < slices.length; slice += 1) {
    const next = (slice + 1) % slices.length;
    for (let row = 0; row + 1 < rows; row += 1) {
      const a = slice * rows + row;
      const b = next * rows + row;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("beyondEdge", new THREE.Float32BufferAttribute(beyondEdge, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The far land and its mountains: rings of points around the valley, from under the ridge out to FAR_LAND_REACH_METRES.
 * Where it lies under the ridge, it stays just below it. Each point is coloured by its height: forest low down, grey rock
 * higher up, and snow on the highest peaks.
 */
export function createFarLandGeometry(valley: Valley, backdrop: Pick<ValleyBackdrop, "heightAt">): THREE.BufferGeometry {
  const half = valley.size / 2;
  const positions: number[] = [];
  const colours: number[] = [];
  const colour = new THREE.Color();
  for (let spoke = 0; spoke < FAR_LAND_SPOKES; spoke += 1) {
    const angle = (spoke / FAR_LAND_SPOKES) * Math.PI * 2;
    for (const distance of FAR_LAND_RINGS_METRES) {
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const fromEdge = Math.hypot(x - clamp(x, -half, half), z - clamp(z, -half, half));
      const height = backdrop.heightAt(x, z) - (fromEdge <= RIDGE_REACH_METRES ? FAR_LAND_UNDER_RIDGE_METRES : 0);
      positions.push(x, height, z);
      farLandColour(height, colour);
      colours.push(colour.r, colour.g, colour.b);
    }
  }
  const rings = FAR_LAND_RINGS_METRES.length;
  const indices: number[] = [];
  for (let spoke = 0; spoke < FAR_LAND_SPOKES; spoke += 1) {
    const next = (spoke + 1) % FAR_LAND_SPOKES;
    for (let ring = 0; ring + 1 < rings; ring += 1) {
      const a = spoke * rings + ring;
      const b = next * rings + ring;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** The far land's colours, in sRGB, from the forest low down to snow on the highest peaks, with the height each starts at. */
const FAR_LAND_COLOURS = [
  { from: -Infinity, colour: 0x34472f },
  { from: 120, colour: 0x4a5546 },
  { from: 260, colour: 0x6c7277 },
  { from: 480, colour: 0xd9dee4 },
] as const;
/** Colours blend into the next one over this many metres of height. */
const FAR_LAND_COLOUR_BLEND_METRES = 60;

function farLandColour(height: number, out: THREE.Color): THREE.Color {
  out.setHex(FAR_LAND_COLOURS[0].colour, THREE.SRGBColorSpace);
  const next = new THREE.Color();
  for (const band of FAR_LAND_COLOURS.slice(1)) {
    next.setHex(band.colour, THREE.SRGBColorSpace);
    out.lerp(next, smoothstep((height - band.from) / FAR_LAND_COLOUR_BLEND_METRES + 0.5));
  }
  return out;
}

/**
 * Smooth random bumps around a loop. Returns a function that gives a value from about -1 to 1 for any angle,
 * the same at 0 and a full turn. `bends` says how many bumps each layer has around the loop.
 */
function createLoopNoise(random: Random, bends: readonly number[]): (angle: number) => number {
  const layers = bends.map((count) => ({ count, phase: random() * Math.PI * 2, size: 1 / Math.sqrt(count) }));
  const total = layers.reduce((sum, layer) => sum + layer.size, 0);
  return (angle) => layers.reduce((sum, layer) => sum + layer.size * Math.sin(angle * layer.count + layer.phase), 0) / total;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Eases a value from 0 to 1 so it starts and ends gently. */
function smoothstep(amount: number): number {
  const t = clamp(amount, 0, 1);
  return t * t * (3 - 2 * t);
}
