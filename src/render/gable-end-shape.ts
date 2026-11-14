// The log gable ends of a cabin roof: the "gable-end" asset in asset-manifest.json, built in code and approved by the owner.
// A gable end closes the gap between what is under an edge of a roof section and the planks of its roof: the triangle
// between the wall top and the roof at each end of a ridge or a shed roof, and the step where a taller roof stands beside a
// lower one. It is a stack of debarked logs laid along the edge, like the log wall below it. Each course is a little
// shorter than the one below, and the roof's slope cuts its ends and its top, so the gable end meets the roof with no gap.
// Where two gable ends meet at a corner, their logs reach past it and take turns, like the corners of the log walls.
// The frame under the roof pays for them. The player never builds one alone.
import * as THREE from "three";
import { BUILD_GRID_METRES } from "../sim/build-grid";
import { DEBARKED_LOG_COLOUR, DEBARKED_LOG_CUT_COLOUR } from "./debarked-log-shape";
import { COURSE_RADIUS_METRES } from "./edge-piece-meshes";
import { EDGES, RAFTER_RADIUS_METRES } from "./roof-parts";

/** How much of its thickness each course sinks into the notch along the top of the course below, as in a log wall. */
const NOTCH_SHARE = 0.12;
/** How far a plain course rises above the one below it, in metres. */
const COURSE_RISE_METRES = 2 * COURSE_RADIUS_METRES * (1 - NOTCH_SHARE);
/**
 * How each course differs from a plain one, from the bottom up: its thickness as a share of a plain course, how far it
 * is turned about its length, in radians, and how much lighter or darker its wood is. Fixed, so every gable end looks
 * the same, and the halves of a gable end on two sections line up.
 */
const COURSE_LOOKS = [
  { thickness: 1.04, turn: 0.3, shade: 1 },
  { thickness: 0.96, turn: 1.1, shade: 0.94 },
  { thickness: 1.02, turn: 0.6, shade: 1.03 },
  { thickness: 0.94, turn: 1.6, shade: 0.97 },
  { thickness: 1, turn: 0.9, shade: 1.02 },
  { thickness: 0.97, turn: 0.1, shade: 0.95 },
] as const;
/** How many flat sides a log has, as in a log wall. */
const LOG_SIDES = 9;
/** A log is cut into pieces about this long, in metres, so the roof's slope can cut its top cleanly. */
const PIECE_METRES = 0.04;
/** A course stops where less than this share of its thickness would show below the roof. */
const SHOWING_SHARE = 0.35;
/** A course shorter than this, in metres, is left out. */
const SHORTEST_LOG_METRES = 0.08;
/** How far a log reaches past a corner where another gable end crosses it, in metres, as at a log wall's corners. */
const CORNER_REACH_METRES = COURSE_RADIUS_METRES + 0.06;
/** A gable end goes under an edge only where the space there is taller than the rafters by more than this, in metres. */
const CLEARANCE_METRES = 0.01;
/** How many points along an edge are checked for the height of the roof and of what is under it. */
const EDGE_SAMPLES = 25;
/** How many points along a course are checked to find where the roof cuts it. */
const COURSE_SAMPLES = 97;

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
 * The logs of every gable end of a section, drawn unturned, one shape per log, coloured on its corners.
 * `floors` gives, for each edge in EDGES order, the height its logs stand on. Undefined leaves that edge open.
 * Draw it with `vertexColors: true` and `flatShading: true`, and the material colour white.
 */
export function gableEndLogs(ceiling: (x: number, z: number) => number, floors: readonly (number | undefined)[]): THREE.BufferGeometry[] {
  const half = BUILD_GRID_METRES / 2;
  const logs: THREE.BufferGeometry[] = [];
  EDGES.forEach((edge, index) => {
    const floor = floors[index];
    if (floor === undefined) return;
    const at = (t: number) => (edge.axis === "x" ? { x: t, z: edge.across * half } : { x: edge.across * half, z: t });
    const roofAt = (t: number) => ceiling(at(t).x, at(t).z);
    const from = -half - (floors[edge.startEdge] === undefined ? 0 : CORNER_REACH_METRES);
    const to = half + (floors[edge.endEdge] === undefined ? 0 : CORNER_REACH_METRES);
    const highest = Math.max(...samples(from, to, COURSE_SAMPLES).map(roofAt));
    // Logs along z sit half a course lower, so where two gable ends cross at a corner their logs take turns.
    let bottom = floor - (edge.axis === "z" ? COURSE_RISE_METRES / 2 : 0);
    for (let course = 0; bottom < highest; course += 1) {
      const look = COURSE_LOOKS[course % COURSE_LOOKS.length] ?? COURSE_LOOKS[0];
      const radius = COURSE_RADIUS_METRES * look.thickness;
      const floorOfLog = bottom;
      const span = spanUnderRoof(from, to, (t) => roofAt(t) - floorOfLog - SHOWING_SHARE * 2 * radius);
      if (span !== undefined && span.end - span.start >= SHORTEST_LOG_METRES) {
        logs.push(gableLog(edge.axis, edge.across * half, span, bottom, radius, look, ceiling));
      }
      bottom += 2 * radius * (1 - NOTCH_SHARE);
    }
  });
  return logs;
}

/**
 * Where along a course, from `from` to `to`, enough of it shows below the roof: where `showing` is above zero.
 * Each end is found between two sample points, so the log ends right where the roof cuts it. Undefined where none shows.
 */
function spanUnderRoof(from: number, to: number, showing: (t: number) => number): { start: number; end: number } | undefined {
  const points = samples(from, to, COURSE_SAMPLES);
  const first = points.findIndex((t) => showing(t) > 0);
  if (first === -1) return undefined;
  let last = points.length - 1;
  while (showing(points[last] ?? to) <= 0) last -= 1;
  const crossing = (outside: number, inside: number) => {
    const a = showing(outside);
    const b = showing(inside);
    return outside + ((inside - outside) * -a) / (b - a);
  };
  const start = first === 0 ? from : crossing(points[first - 1] ?? from, points[first] ?? from);
  const end = last === points.length - 1 ? to : crossing(points[last + 1] ?? to, points[last] ?? to);
  return { start, end };
}

/**
 * One log of a gable end along `axis`, over `span`, its middle at `across` on the other axis, its bottom at `bottom`,
 * with its top cut to `ceiling`. Its sides are stripped wood and its ends the paler cut wood.
 */
function gableLog(
  axis: "x" | "z",
  across: number,
  span: { start: number; end: number },
  bottom: number,
  radius: number,
  look: (typeof COURSE_LOOKS)[number],
  ceiling: (x: number, z: number) => number,
): THREE.BufferGeometry {
  const length = span.end - span.start;
  const pieces = Math.max(1, Math.ceil(length / PIECE_METRES));
  const geometry = new THREE.CylinderGeometry(radius, radius, length, LOG_SIDES, pieces);
  geometry.rotateY(look.turn);
  if (axis === "x") geometry.rotateZ(Math.PI / 2);
  else geometry.rotateX(Math.PI / 2);
  const middle = (span.start + span.end) / 2;
  geometry.translate(axis === "x" ? middle : across, bottom + radius, axis === "x" ? across : middle);
  // Cut the log where it reaches into the roof, so it meets the planks with no gap.
  const positions = geometry.getAttribute("position");
  for (let v = 0; v < positions.count; v += 1) {
    const roof = Math.max(bottom, ceiling(positions.getX(v), positions.getZ(v)));
    if (positions.getY(v) > roof) positions.setY(v, roof);
  }
  geometry.computeVertexNormals();
  const side = new THREE.Color(DEBARKED_LOG_COLOUR).multiplyScalar(look.shade);
  const cut = new THREE.Color(DEBARKED_LOG_CUT_COLOUR).multiplyScalar(look.shade);
  const index = geometry.getIndex();
  const colours = new Float32Array(positions.count * 3);
  // A cylinder has three groups: the sides, then its two ends.
  geometry.groups.forEach((part, partIndex) => {
    const colour = partIndex === 0 ? side : cut;
    for (let i = part.start; i < part.start + part.count; i++) colour.toArray(colours, (index?.getX(i) ?? i) * 3);
  });
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geometry.clearGroups();
  return geometry;
}

/** Evenly spaced points from `from` to `to`, both included. */
function samples(from: number, to: number, count = EDGE_SAMPLES): number[] {
  return Array.from({ length: count }, (_, i) => from + ((to - from) * i) / (count - 1));
}
