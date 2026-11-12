// The plank gable ends of a cabin roof: the "gable-end" asset in asset-manifest.json, a draft built in code (ticket 11).
// A gable end closes the gap between what is under an edge of a roof section and the planks of its roof: the triangle
// between the wall top and the roof at each end of a ridge or a shed roof, and the step where a taller roof stands beside a
// lower one. It is a row of upright sawn planks, grey and weathered like the roof's, standing side by side along the edge
// with a thin gap between them. Each plank stands on the beam or the lower roof and is cut at its top to the slope above,
// so the gable end meets the roof with no gap. The frame under the roof pays for them. The player never builds one alone.
import * as THREE from "three";
import { BUILD_GRID_METRES } from "../sim/build-grid";
import { EDGES, PLANK_GAP_METRES, PLANK_WIDTH_METRES, RAFTER_RADIUS_METRES, WEATHERED_PLANK_COLOURS } from "./roof-parts";

/**
 * An upright plank of a gable end is this much paler than the roof's planks, which face the bright sky. Without it, the
 * gable ends look almost black in the shade of the roof.
 */
const UPRIGHT_PALER = 1.7;
/** How thick an upright plank is, in metres. */
const PLANK_THICKNESS_METRES = 0.03;
/** A plank is left out where it would be shorter than this, in metres. */
const SHORTEST_PLANK_METRES = 0.03;
/** A gable end goes under an edge only where the space there is taller than the rafters by more than this, in metres. */
const CLEARANCE_METRES = 0.01;
/** How many points along an edge are checked for the height of the roof and of what is under it. */
const EDGE_SAMPLES = 25;

/**
 * Which edges of a section need a gable end, and the height each stands on, in the section's own frame.
 * `ceiling` gives the underside of the section's planks at a point. `floorAt` gives the height of what is under a point on
 * an edge, from the section's deck: the beam top, or a lower roof's planks. An edge is left open where the roof already
 * rests on it, with only the rafters between. `raised` is how much the section sits above its deck.
 */
export function gableEndFloors(
  ceiling: (x: number, z: number) => number,
  raised: number,
  floorAt: (edge: number, x: number, z: number) => number,
): (number | undefined)[] {
  const half = BUILD_GRID_METRES / 2;
  return EDGES.map((edge, index) => {
    const points = samples(-half, half).map((t) => (edge.axis === "x" ? { x: t, z: edge.across * half } : { x: edge.across * half, z: t }));
    const floor = Math.min(...points.map(({ x, z }) => floorAt(index, x, z))) - raised;
    const gap = Math.max(...points.map(({ x, z }) => ceiling(x, z))) - floor;
    return gap > 2 * RAFTER_RADIUS_METRES + CLEARANCE_METRES ? floor : undefined;
  });
}

/**
 * The upright planks of every gable end of a section, drawn unturned, as one shape coloured per plank.
 * `floors` gives, for each edge in EDGES order, the height its planks stand on. Undefined leaves that edge open.
 * Draw it with `vertexColors: true` and `flatShading: true`, and the material colour white.
 */
export function gableEndPlanks(ceiling: (x: number, z: number) => number, floors: readonly (number | undefined)[]): THREE.BufferGeometry[] {
  const half = BUILD_GRID_METRES / 2;
  const planks: THREE.BufferGeometry[] = [];
  EDGES.forEach((edge, index) => {
    const floor = floors[index];
    if (floor === undefined) return;
    // The planks reach past an end where the edge meeting it there has a gable end too, so the two meet at the corner.
    const from = -half - (floors[edge.startEdge] === undefined ? 0 : PLANK_THICKNESS_METRES / 2);
    const to = half + (floors[edge.endEdge] === undefined ? 0 : PLANK_THICKNESS_METRES / 2);
    const count = Math.ceil((to - from) / PLANK_WIDTH_METRES);
    const width = (to - from) / count;
    for (let i = 0; i < count; i += 1) {
      const start = from + i * width + PLANK_GAP_METRES / 2;
      const end = from + (i + 1) * width - PLANK_GAP_METRES / 2;
      const plank = uprightPlank(edge.axis, edge.across * half, start, end, floor, ceiling, index * 31 + i);
      if (plank !== undefined) planks.push(plank);
    }
  });
  return planks;
}

/**
 * One upright plank along `axis`, from `start` to `end`, its middle at `across` on the other axis, standing on `floor`
 * and cut at its top to `ceiling`. Undefined where it would be too short to show.
 */
function uprightPlank(
  axis: "x" | "z",
  across: number,
  start: number,
  end: number,
  floor: number,
  ceiling: (x: number, z: number) => number,
  seed: number,
): THREE.BufferGeometry | undefined {
  const at = (t: number) => (axis === "x" ? { x: t, z: across } : { x: across, z: t });
  const tops = [start, end].map((t) => ceiling(at(t).x, at(t).z) - floor);
  if (Math.max(...tops) < SHORTEST_PLANK_METRES) return undefined;
  const width = end - start;
  const geometry = new THREE.BoxGeometry(axis === "x" ? width : PLANK_THICKNESS_METRES, 1, axis === "x" ? PLANK_THICKNESS_METRES : width);
  const middle = at((start + end) / 2);
  geometry.translate(middle.x, floor + 0.5, middle.z);
  // Cut the top of the plank to the planks of the roof above, so it meets them with no gap.
  const positions = geometry.getAttribute("position");
  for (let v = 0; v < positions.count; v += 1) {
    if (positions.getY(v) > floor + 0.25) positions.setY(v, Math.max(floor, ceiling(positions.getX(v), positions.getZ(v))));
  }
  geometry.computeVertexNormals();
  const colour = new THREE.Color(WEATHERED_PLANK_COLOURS[seed % WEATHERED_PLANK_COLOURS.length] ?? WEATHERED_PLANK_COLOURS[0]).multiplyScalar(UPRIGHT_PALER);
  const colours = new Float32Array(positions.count * 3);
  for (let v = 0; v < positions.count; v += 1) colours.set([colour.r, colour.g, colour.b], v * 3);
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return geometry;
}

/** Evenly spaced points from `from` to `to`, both included. */
function samples(from: number, to: number): number[] {
  return Array.from({ length: EDGE_SAMPLES }, (_, i) => from + ((to - from) * i) / (EDGE_SAMPLES - 1));
}
