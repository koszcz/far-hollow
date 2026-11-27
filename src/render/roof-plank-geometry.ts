// The shapes of the planks of a cabin roof section: rows of weathered planks, valley boards, and how far they reach past
// the section edges. roof-meshes.ts draws them. See there for how the roof looks and is built.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BUILD_GRID_METRES } from "../sim/build-grid";
import { type Vec3 } from "../sim/entities";
import { areOpposite, quarterTurnsToRadians } from "../sim/quarter-turns";
import { ROOF_PLANK_COST } from "../sim/structure-cabin-shell";
import { seededRandom } from "./lean-to-meshes";
import { gridCell, type RoofPlace, type RoofShape } from "./roof-layout";
import {
  EAVE_REACH_METRES,
  FRAME_TOP_METRES,
  PLANK_GAP_METRES,
  RAFTER_RADIUS_METRES,
  ROOF_SEED,
  ROOF_SLOPE_RADIANS,
  shapeHeight,
  WEATHERED_PLANK_COLOURS,
} from "./roof-parts";

/** How many rows of planks a section has: one for each plank it costs, laid one per stage. */
export const ROWS = ROOF_PLANK_COST;
/** How thick a plank is, in metres. Thick enough that the edge of the roof shows over the eaves. */
export const PLANK_THICKNESS_METRES = 0.03;
/** The narrowest and widest a plank of the roof is, in metres, before the gap between planks. Each plank is picked between them. */
const PLANK_WIDTHS_METRES = { least: 0.2, most: 0.32 } as const;
/** How much the shade of one plank differs from its paint colour, at most, as a share. Kept small so the roof reads calm. */
const SHADE_SHARE = 0.025;
/** How many different layouts of planks a straight section has. Each square picks one, so squares side by side differ. */
const LAYOUTS = 4;
/** Each plank is this much longer than its row's share of the slope, so the rows overlap. */
const ROW_OVERLAP = 1.6;
/** Each plank lies this much less steep than the roof, in radians, so its lower end lifts over the row below it. */
const PLANK_KICK_RADIANS = 0.06;
/** How far the lower ends of planks side by side are staggered up and down the slope, at most, in metres. */
const STAGGER_METRES = 0.035;
/** How far each corner of a plank's lower end is torn ragged, at most, in metres. */
const RAGGED_METRES = 0.012;
/** The lower end of a plank is this much darker than the rest, worn by the weather. */
const WORN_END_SHARE = 0.82;
/** The planks reach this far past an edge with a section beside it, in metres, so the two overlap. */
const NEIGHBOUR_LAP_METRES = 0.06;
/** At a ridge, the planks of the slope down to +z or +x reach this far past it, in metres, over the other slope. */
const RIDGE_LAP_METRES = 0.07;
/**
 * In a valley, the planks of each slope stop this far short of the line where the slopes meet, in metres, measured along
 * the slope's own rows, so the valley boards show between them.
 */
const VALLEY_GAP_METRES = 0.1;
/** How far the cut ends of valley planks wander either side of their line, at most, in metres, so the cut looks sawn by hand. */
const VALLEY_RAGGED_METRES = 0.012;
/** How wide each of the two valley boards is, in metres, across the valley. The planks lap over its outer edge. */
const VALLEY_BOARD_WIDTH_METRES = 0.16;
/** How thick a valley board is, in metres. */
const VALLEY_BOARD_THICKNESS_METRES = 0.015;
/**
 * The valley boards lie this much higher than the rafters' line, in metres. The corner-to-corner rafter slopes less
 * steeply than the roof, so its top stands a little above that line. The boards rest on it, and it stays hidden under them.
 */
const VALLEY_BOARD_LIFT_METRES = RAFTER_RADIUS_METRES * (1 / Math.cos(Math.atan(Math.tan(ROOF_SLOPE_RADIANS) / Math.SQRT2)) - 1) + 0.002;
/** The valley boards are darker than the roof planks, stained by the water that runs down them. */
const VALLEY_BOARD_COLOUR = 0x5f5a52;

/** How far the planks reach past each edge of a section, drawn unturned, in metres: back (-z), front (+z), left (-x), and right (+x). */
export interface Reach {
  readonly back: number;
  readonly front: number;
  readonly left: number;
  readonly right: number;
}

/** The underside of the planks above the deck where the roof is lowest, in metres: on the rafters. */
export const COVER_BASE_METRES = FRAME_TOP_METRES + 2 * RAFTER_RADIUS_METRES;

/**
 * The rows of planks of a section of `shape`, drawn unturned, reaching past its edges as `reach` says, from the eaves up.
 * A straight section lays its planks in layout `layout`, from 0 to LAYOUTS - 1, so squares side by side can differ.
 * Each is one shape coloured per plank. Draw them with `vertexColors: true`, `flatShading: true`, and the material colour white.
 */
export function plankRows(shape: RoofShape, reach: Reach, layout = 0): THREE.BufferGeometry[] {
  const half = BUILD_GRID_METRES / 2;
  if (shape === "straight") {
    const random = seededRandom(ROOF_SEED + 101 * layout);
    return Array.from({ length: ROWS }, (_, row) =>
      slopeRow(row, { x0: -half - reach.left, x1: half + reach.right, z0: -half - reach.back, z1: half + reach.front }, random),
    );
  }
  if (shape === "ridge") {
    // Two half slopes, each laid like a straight section from the edge up to the ridge along the middle. The one down to
    // -z is laid facing +z, then turned half round. The planks of the one down to +z reach a little past the ridge, over it.
    const random = seededRandom(ROOF_SEED + 101 * layout);
    return Array.from({ length: ROWS }, (_, row) => {
      const front = slopeRow(row, { x0: -half - reach.left, x1: half + reach.right, z0: -RIDGE_LAP_METRES, z1: half + reach.front }, random);
      const back = slopeRow(row, { x0: -half - reach.right, x1: half + reach.left, z0: 0, z1: half + reach.back }, random).rotateY(quarterTurnsToRadians(2));
      const geometry = mergeGeometries([front, back]);
      front.dispose();
      back.dispose();
      return geometry;
    });
  }
  // A valley: the slope down to +z covers the part of the square right of the line x = z, and the slope down to +x the
  // part left of it. Each is laid like a straight section, the one down to +x turned a quarter round to face +x.
  // Two dark valley boards lie in the gutter under them, one on each slope, laid with the first row.
  const random = seededRandom(ROOF_SEED + 5);
  const ragged = (along: number) => VALLEY_RAGGED_METRES * Math.sin(along * 41 + 1.3) * Math.cos(along * 17);
  return Array.from({ length: ROWS }, (_, row) => {
    const alongZ = slopeRow(row, { x0: -half - reach.left, x1: half + reach.right, z0: -half - reach.back, z1: half + reach.front }, random);
    const alongX = slopeRow(row, { x0: -half - reach.front, x1: half + reach.back, z0: -half - reach.left, z1: half + reach.right }, random).rotateY(
      quarterTurnsToRadians(3),
    );
    // Cut each slope short of the line where they meet. Moving a point across its own slope keeps its height.
    clip(alongZ, (x, z) => ({ x: Math.max(x, z + VALLEY_GAP_METRES + ragged(z)), z }));
    clip(alongX, (x, z) => ({ x, z: Math.max(z, x + VALLEY_GAP_METRES + ragged(x + 0.5)) }));
    const parts = row === 0 ? [alongZ, alongX, ...valleyBoards(reach)] : [alongZ, alongX];
    const geometry = mergeGeometries(parts);
    for (const part of parts) part.dispose();
    return geometry;
  });
}

/**
 * The two boards that line the gutter of a valley, drawn unturned. Each lies on one slope with its inner edge on the line
 * x = z, where the slopes meet, so the two make a shallow V. They run from the high corner of the square to the low one,
 * and on under the eaves. They rest on the rafters, under the planks.
 */
function valleyBoards(reach: Reach): THREE.BufferGeometry[] {
  const half = BUILD_GRID_METRES / 2;
  // Past the low corner they reach on under the eaves only where both low edges are eaves. Over a section beside them,
  // they would stand proud of its planks.
  const lowReach = Math.min(reach.front, reach.right);
  const start = -half;
  const end = half + (lowReach > NEIGHBOUR_LAP_METRES ? lowReach : 0);
  // The line runs at 45 degrees, so a board reaches this far out from it along both x and z.
  const out = VALLEY_BOARD_WIDTH_METRES / Math.SQRT2;
  const colour = new THREE.Color(VALLEY_BOARD_COLOUR);
  // The slope down to +z, right of the line, rises as z falls. The slope down to +x, left of it, rises as x falls.
  const sides = [
    { across: { x: out, z: -out }, height: (_x: number, z: number) => shapeHeight("straight", 0, z), shade: 1 },
    { across: { x: -out, z: out }, height: (x: number) => shapeHeight("straight", 0, x), shade: 0.94 },
  ];
  return sides.map(({ across, height, shade }) => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const positions = geometry.getAttribute("position");
    for (let v = 0; v < positions.count; v += 1) {
      // A unit box: its z runs along the line, its x out across it, and its y from the board's underside to its top.
      const along = start + (positions.getZ(v) + 0.5) * (end - start);
      const share = positions.getX(v) + 0.5;
      const x = along + across.x * share;
      const z = along + across.z * share;
      // It rests on the corner-to-corner rafter. It is thinner than a plank, so where a plank laps over it, it stays hidden inside.
      const underside = COVER_BASE_METRES + VALLEY_BOARD_LIFT_METRES + height(x, z);
      positions.setXYZ(v, x, positions.getY(v) > 0 ? underside + VALLEY_BOARD_THICKNESS_METRES : underside, z);
    }
    geometry.computeVertexNormals();
    const tint = colour.clone().multiplyScalar(shade);
    const colours = new Float32Array(positions.count * 3);
    for (let v = 0; v < positions.count; v += 1) colours.set([tint.r, tint.g, tint.b], v * 3);
    geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    return geometry;
  });
}

/** Moves every corner of `geometry` across the ground as `to` says, keeping its height. */
function clip(geometry: THREE.BufferGeometry, to: (x: number, z: number) => { x: number; z: number }): void {
  const positions = geometry.getAttribute("position");
  for (let v = 0; v < positions.count; v += 1) {
    const moved = to(positions.getX(v), positions.getZ(v));
    positions.setX(v, moved.x);
    positions.setZ(v, moved.z);
  }
  geometry.computeVertexNormals();
}

/**
 * Row `row` of planks, counted from the front, on a slope down to +z covering x0 to x1 across and z0 (the high back) to z1
 * (the low front), as one shape. The planks of each row reach up under the row above. The top row stops at the back.
 */
function slopeRow(row: number, area: { x0: number; x1: number; z0: number; z1: number }, random: () => number): THREE.BufferGeometry {
  const jitter = (size: number) => (random() * 2 - 1) * size;
  const share = (area.z1 - area.z0) / ROWS;
  const low = area.z1 - row * share;
  const high = Math.max(area.z0, low - share * ROW_OVERLAP);
  // Pick a width for each plank until the row is covered, then stretch them all a little so they fill it exactly.
  const span = area.x1 - area.x0;
  const widths: number[] = [];
  for (let covered = 0; covered < span;) {
    const width = PLANK_WIDTHS_METRES.least + random() * (PLANK_WIDTHS_METRES.most - PLANK_WIDTHS_METRES.least);
    widths.push(width);
    covered += width;
  }
  const stretch = span / widths.reduce((sum, width) => sum + width, 0);
  let left = area.x0;
  const planks = widths.map((width) => {
    const fitted = width * stretch;
    const middle = left + fitted / 2;
    left += fitted;
    return plank(middle, fitted - PLANK_GAP_METRES, high, low + jitter(STAGGER_METRES), jitter);
  });
  const geometry = mergeGeometries(planks);
  for (const one of planks) one.dispose();
  return geometry;
}

/**
 * One plank lying down the slope, `width` wide, its middle at `x`, from `high` at the back to `low` at the front, along z.
 * Its lower end is torn ragged and darker. It lies a little less steep than the roof, its upper end on the rafters.
 */
function plank(x: number, width: number, high: number, low: number, jitter: (size: number) => number): THREE.BufferGeometry {
  const run = low - high;
  const length = run / Math.cos(ROOF_SLOPE_RADIANS);
  const geometry = new THREE.BoxGeometry(width + jitter(0.006), PLANK_THICKNESS_METRES, length);
  const positions = geometry.getAttribute("position");
  // Tear the lower end, at +z: each of its two corners, top and bottom face alike, sits a different way along the plank.
  const tears = [jitter(RAGGED_METRES), jitter(RAGGED_METRES)];
  for (let v = 0; v < positions.count; v += 1) {
    if (positions.getZ(v) > 0) positions.setZ(v, positions.getZ(v) + (tears[positions.getX(v) < 0 ? 0 : 1] ?? 0));
  }
  const colour = new THREE.Color(WEATHERED_PLANK_COLOURS[Math.floor((jitter(1) + 1) * 2.5) % WEATHERED_PLANK_COLOURS.length] ?? WEATHERED_PLANK_COLOURS[0]);
  colour.multiplyScalar(1 + jitter(SHADE_SHARE));
  const worn = colour.clone().multiplyScalar(WORN_END_SHARE);
  const colours = new Float32Array(positions.count * 3);
  for (let v = 0; v < positions.count; v += 1) {
    const one = positions.getZ(v) > length / 2 - 0.05 ? worn : colour;
    colours.set([one.r, one.g, one.b], v * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geometry.rotateX(ROOF_SLOPE_RADIANS - PLANK_KICK_RADIANS + jitter(0.01));
  geometry.rotateY(jitter(0.012));
  const middle = (high + low) / 2;
  // Lift it so its upper end rests on the rafters, and its lower end stands clear of the row below.
  const y = COVER_BASE_METRES + shapeHeight("straight", 0, middle) + PLANK_THICKNESS_METRES / 2 + (length / 2) * Math.sin(PLANK_KICK_RADIANS);
  geometry.translate(x + jitter(0.004), y, middle);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * How far the planks of a section placed at `place` reach past each edge, from the sections beside it.
 * `neighbours` are the places of the sections beside each edge in EDGES order (back, front, left, right), undefined where there are none.
 */
export function plankReach(place: RoofPlace, neighbours: readonly (RoofPlace | undefined)[]): Reach {
  const [back, front, left, right] = neighbours;
  const side = (beside: RoofPlace | undefined) => (beside === undefined ? EAVE_REACH_METRES : NEIGHBOUR_LAP_METRES);
  // A ridge section slopes down both ways, so its planks lap over the sections in front and behind, as over those beside it.
  if (place.shape === "ridge") return { back: side(back), front: side(front), left: side(left), right: side(right) };
  // Behind a section is the one above it on the same slope, which laps over it, or the other slope of a ridge. A ridge
  // section behind it carries its slope on up, and laps over it too.
  const ridge = back !== undefined && back.shape === "straight" && areOpposite(back.drawTurns, place.drawTurns);
  const lapsRidge = place.drawTurns === 0 || place.drawTurns === 3;
  return {
    back: back === undefined ? EAVE_REACH_METRES : ridge && lapsRidge ? RIDGE_LAP_METRES : 0,
    front: side(front),
    left: side(left),
    right: side(right),
  };
}

/** Which layout of planks the section on the square at `position` uses. Squares side by side get different ones. */
export function layoutOf(position: Vec3): number {
  const { column, row } = gridCell(position);
  return (((column * 3 + row * 2) % LAYOUTS) + LAYOUTS) % LAYOUTS;
}
