// What the roof frame and the roof laid on it share: their sizes and slope, the frame layout both follow, and the debarked
// logs both are made from. The frame ("roof-frame" asset) is drawn by roof-frame-meshes.ts, and the bark ("roof") by roof-meshes.ts.
// Heights here are in metres above the foundation's deck, in a section's own frame: drawn unturned, sloping down to +z.
import * as THREE from "three";
import { BUILD_GRID_METRES } from "../sim/build-grid";
import { blueprintEntities, cabinRoofEntities, roofFrameEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { turnOffset } from "../sim/structure-kind";
import { DEBARKED_LOG_COLOUR, DEBARKED_LOG_CUT_COLOUR } from "./debarked-log-shape";
import { EDGE_PIECE_HEIGHT_METRES } from "./edge-piece-meshes";
import { ALONE, gridCell, roofPlaces, type RoofPlace, type RoofShape } from "./roof-layout";

/** How thick a beam is across, in metres: the radius of the beams on walls that run along x. */
export const BEAM_RADIUS_METRES = 0.09;
/** The top of every beam of a frame, above the deck. The beams lie level on the walls, so the frame is flat here. */
export const FRAME_TOP_METRES = EDGE_PIECE_HEIGHT_METRES + 2 * BEAM_RADIUS_METRES;
/** How thick a rafter is across, in metres. */
export const RAFTER_RADIUS_METRES = 0.07;
/** A rafter is this much thinner at one end than the other, in metres, like a log from a young tree. */
const RAFTER_TAPER_METRES = 0.012;
/** A rafter, beam, and fill log has this many flat sides, like the other debarked logs. */
export const LOG_SIDES = 7;
/** The rafters reach this far past the walls at the front and back, in metres. */
const RAFTER_OVERHANG_METRES = 0.12;
/** How thick a strip of roof bark is, in metres. */
export const BARK_THICKNESS_METRES = 0.04;
/** How steeply each roof section slopes down to the front, in radians. */
export const ROOF_SLOPE_RADIANS = THREE.MathUtils.degToRad(12);
/** All roof frames and sections share this seed, so they all have the same ragged bark and crooked rafters, and line up. */
export const ROOF_SEED = 20261112;
/** One section's rise over the section in front of it, in metres. */
export const SECTION_RISE_METRES = BUILD_GRID_METRES * Math.tan(ROOF_SLOPE_RADIANS);
/**
 * Sections in odd columns, across the slope, lie this much higher, in metres. Bark that overlaps a neighbour's at the same height flickers,
 * because the screen cannot tell which is on top.
 */
const ODD_COLUMN_LIFT_METRES = 0.012;
/** The logs that fill the gaps between the beams and the roof are this thick, like the logs of a log wall, in metres. */
const FILL_RADIUS_METRES = 0.1;
/** Logs fill a gap under an edge only where it is this much more than the rafters' thickness, in metres. */
const FILL_GAP_METRES = 0.01;
/** A fill log is cut into this many lengths, so its top can follow the slope of the roof. */
const FILL_LENGTHS = 12;
/** How many points along an edge are checked for the height of the roof and of what is under it. */
const EDGE_SAMPLES = 25;

/**
 * The four edges of a section, drawn unturned: back (-z), front (+z), left (-x), and right (+x).
 * Each runs along `axis`, at `across` half a square from the middle. `startEdge` and `endEdge` are the edges at its -end and +end.
 */
export const EDGES = [
  { axis: "x", across: -1, startEdge: 2, endEdge: 3 },
  { axis: "x", across: 1, startEdge: 2, endEdge: 3 },
  { axis: "z", across: -1, startEdge: 0, endEdge: 1 },
  { axis: "z", across: 1, startEdge: 0, endEdge: 1 },
] as const;

/** The underside of the bark at (x, z), in a section's own frame, drawn unturned. The fill logs reach up to it. */
export function barkUnderside(shape: RoofShape): (x: number, z: number) => number {
  return (x, z) => FRAME_TOP_METRES + 2 * RAFTER_RADIUS_METRES + shapeHeight(shape, x, z);
}

/**
 * How high a section's roof is at (x, z) in its own frame, above its lowest edge, in metres. It carries on past the square's edges,
 * so bark reaching past an edge keeps the slope.
 */
export function shapeHeight(shape: RoofShape, x: number, z: number): number {
  const downZ = 0.5 - z / BUILD_GRID_METRES;
  const downX = 0.5 - x / BUILD_GRID_METRES;
  if (shape === "hip") return Math.min(downZ, downX) * SECTION_RISE_METRES;
  if (shape === "valley") return Math.max(downZ, downX) * SECTION_RISE_METRES;
  return downZ * SECTION_RISE_METRES;
}

/** How much higher a section sits than its deck, in metres: a rise for each section in front of it, and the lift of odd columns. */
export function raisedBy(place: RoofPlace): number {
  return place.inFront * SECTION_RISE_METRES + (place.lifted ? ODD_COLUMN_LIFT_METRES : 0);
}

/** A frame, finished or as a blueprint, or a roof section with no frame under it. */
export type Section = Entity & { position: Vec3 };

/** Where every roof section sits and what shape it takes. Each frame sets them, and the roof on it follows. */
export interface FrameLayout {
  /** The frame or frameless roof over the square holding `point`, if any. */
  sectionAt(point: { x: number; z: number }): Section | undefined;
  /** The place of the frame or frameless roof over the square holding `point`. Alone if there is none. */
  placeAt(point: { x: number; z: number }): RoofPlace;
}

/**
 * Works out the frame layout from every roof frame, finished or as a blueprint. A roof section takes the place of the frame under it.
 * A finished roof with no frame under it, which the game never makes, is laid out by its own turn.
 */
export function frameLayout(entities: EntityStore): FrameLayout {
  const cellName = (point: { x: number; z: number }) => {
    const { column, row } = gridCell(point);
    return `${column},${row}`;
  };
  const byCell = new Map<string, Section>();
  const frameBlueprints = [...blueprintEntities(entities)].filter(({ blueprint }) => blueprint.structure === "roofFrame");
  for (const frame of [...frameBlueprints, ...roofFrameEntities(entities)]) byCell.set(cellName(frame.position), frame);
  for (const roof of cabinRoofEntities(entities)) if (!byCell.has(cellName(roof.position))) byCell.set(cellName(roof.position), roof);
  const laid = [...byCell.values()].map((entity) => ({ entity, position: entity.position, turns: entity.facing?.turns ?? 0 }));
  const places = roofPlaces(laid);
  const placeByCell = new Map(laid.map((section) => [cellName(section.position), places.get(section) ?? ALONE]));
  return {
    sectionAt: (point) => byCell.get(cellName(point)),
    placeAt: (point) => placeByCell.get(cellName(point)) ?? ALONE,
  };
}

/** The section beside each edge of the section at `middle`, in EDGES order, as drawn turned by `place`, or undefined where there is none. */
export function neighboursOf(layout: FrameLayout, middle: { x: number; z: number }, place: RoofPlace): (Section | undefined)[] {
  return EDGES.map(({ axis, across }) => {
    const offset = turnOffset({ x: axis === "x" ? 0 : across * BUILD_GRID_METRES, z: axis === "x" ? across * BUILD_GRID_METRES : 0 }, place.drawTurns);
    return layout.sectionAt({ x: middle.x + offset.x, z: middle.z + offset.z });
  });
}

/**
 * One debarked log lying along z, `length` long, faceted and a little tapered, with pale cut ends.
 * It carries a colour per corner, so draw it with `vertexColors: true` and the material colour set to the log colour.
 */
export function debarkedLog(length: number, radius: number, jitter: (size: number) => number, taper = RAFTER_TAPER_METRES): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(radius - taper, radius, length, LOG_SIDES, 1)
    .rotateY(random01(jitter) * Math.PI)
    .rotateX(Math.PI / 2 + jitter(0.015))
    .rotateY(jitter(0.03));
  // After the turn onto its side, the cut ends face along z.
  return paleLog(geometry, (normal) => Math.abs(normal.z));
}

/** One rafter: a debarked log lying along z, reaching `span` plus an overhang at each end. */
export function rafterLog(jitter: (size: number) => number, span = BUILD_GRID_METRES): THREE.BufferGeometry {
  return debarkedLog(span + 2 * RAFTER_OVERHANG_METRES + jitter(0.04), RAFTER_RADIUS_METRES + jitter(0.006), jitter);
}

/**
 * Colours a debarked log's corners: its cut ends pale, where `endness` of a corner's normal is near 1, and its sides plain.
 * Draw it with `vertexColors: true` and the material colour set to the log colour.
 */
export function paleLog(geometry: THREE.BufferGeometry, endness: (normal: THREE.Vector3) => number): THREE.BufferGeometry {
  const normals = geometry.getAttribute("normal");
  const side = new THREE.Color(1, 1, 1);
  const log = new THREE.Color(DEBARKED_LOG_COLOUR);
  const cutColour = new THREE.Color(DEBARKED_LOG_CUT_COLOUR);
  const cut = new THREE.Color(cutColour.r / log.r, cutColour.g / log.g, cutColour.b / log.b);
  const colours = new Float32Array(normals.count * 3);
  const normal = new THREE.Vector3();
  for (let i = 0; i < normals.count; i += 1) {
    const colour = endness(normal.fromBufferAttribute(normals, i)) > 0.9 ? cut : side;
    colours.set([colour.r, colour.g, colour.b], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return geometry;
}

/** A number from 0 up to 1, from a jitter that gives numbers from -size to size. */
function random01(jitter: (size: number) => number): number {
  return (jitter(1) + 1) / 2;
}

/**
 * Which edges of a section need fill logs, and the height each rests on, in the section's own frame.
 * `floorAt` gives the height of what is under a point on an edge, from the section's deck: the beam top, or a lower roof's
 * bark. An edge is left open where the roof already rests on it, with only the rafters between.
 */
export function fillFloors(shape: RoofShape, raised: number, floorAt: (edge: number, x: number, z: number) => number): (number | undefined)[] {
  const ceiling = barkUnderside(shape);
  const half = BUILD_GRID_METRES / 2;
  return EDGES.map((edge, index) => {
    const points = samples(-half, half).map((t) => (edge.axis === "x" ? { x: t, z: edge.across * half } : { x: edge.across * half, z: t }));
    const floor = Math.min(...points.map(({ x, z }) => floorAt(index, x, z))) - raised;
    const gap = Math.max(...points.map(({ x, z }) => ceiling(x, z))) - floor;
    return gap > 2 * RAFTER_RADIUS_METRES + FILL_GAP_METRES ? floor : undefined;
  });
}

/**
 * The logs that fill the gaps between the roof and what is under its edges, for a section of `shape`, drawn unturned.
 * `floors` gives, for each edge in EDGES order, the height the logs rest on in the section's own frame. Undefined leaves that edge open.
 */
export function fillLogs(shape: RoofShape, floors: readonly (number | undefined)[]): THREE.BufferGeometry[] {
  const ceiling = barkUnderside(shape);
  const half = BUILD_GRID_METRES / 2;
  const logs: THREE.BufferGeometry[] = [];
  EDGES.forEach((edge, index) => {
    const floor = floors[index];
    if (floor === undefined) return;
    // A log reaches past an end where the edge meeting it there is filled too, so the two stacks meet at the corner.
    const from = -half - (floors[edge.startEdge] === undefined ? 0 : FILL_RADIUS_METRES);
    const to = half + (floors[edge.endEdge] === undefined ? 0 : FILL_RADIUS_METRES);
    const across = edge.across * half;
    const under = (t: number) => (edge.axis === "x" ? ceiling(t, across) : ceiling(across, t));
    const top = Math.max(...samples(from, to).map(under));
    for (let bottom = floor; bottom < top - 0.005; bottom += 2 * FILL_RADIUS_METRES) {
      // The log stops where the bark comes down to its bottom.
      const reach = stretchAbove(from, to, (t) => under(t) - bottom);
      if (reach !== undefined) logs.push(cutLog(bottom, reach.from, reach.to, edge.axis, across, ceiling));
    }
  });
  return logs;
}

/** Evenly spaced points from `from` to `to`, both included. */
function samples(from: number, to: number): number[] {
  return Array.from({ length: EDGE_SAMPLES }, (_, i) => from + ((to - from) * i) / (EDGE_SAMPLES - 1));
}

/**
 * The stretch from `from` to `to` where `height` is above 0, with its ends where it crosses 0, or undefined if it never is.
 * A gap in the middle is filled over, so a log runs the whole stretch.
 */
function stretchAbove(from: number, to: number, height: (t: number) => number): { from: number; to: number } | undefined {
  const points = samples(from, to);
  const above = points.map((t) => height(t) > FILL_GAP_METRES / 2);
  const first = above.indexOf(true);
  const last = above.lastIndexOf(true);
  if (first < 0) return undefined;
  /** Where the height crosses 0 between a point that is not above, `outside`, and the next point that is, `inside`. */
  const crossing = (outside: number, inside: number) => {
    const out = height(outside);
    const into = height(inside);
    return outside + ((inside - outside) * out) / (out - into);
  };
  const step = (to - from) / (EDGE_SAMPLES - 1);
  const firstPoint = from + first * step;
  const lastPoint = from + last * step;
  const start = first === 0 ? from : crossing(firstPoint - step, firstPoint);
  const end = last === points.length - 1 ? to : crossing(lastPoint + step, lastPoint);
  return end - start > FILL_RADIUS_METRES ? { from: start, to: end } : undefined;
}

/**
 * A fill log resting at height `bottom`, running along `axis` from `from` to `to`, its middle at `across` on the other axis.
 * Its top is cut down to the bark's underside, so the top log of a stack fills the gap under the slope exactly.
 */
function cutLog(bottom: number, from: number, to: number, axis: "x" | "z", across: number, ceiling: (x: number, z: number) => number): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(FILL_RADIUS_METRES, FILL_RADIUS_METRES, to - from, LOG_SIDES, FILL_LENGTHS);
  // The cylinder stands along y. Lay it along its axis.
  if (axis === "x") geometry.rotateZ(Math.PI / 2);
  else geometry.rotateX(Math.PI / 2);
  const middle = (from + to) / 2;
  geometry.translate(axis === "x" ? middle : across, bottom + FILL_RADIUS_METRES, axis === "x" ? across : middle);
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i += 1) {
    positions.setY(i, Math.max(bottom, Math.min(positions.getY(i), ceiling(positions.getX(i), positions.getZ(i)))));
  }
  geometry.computeVertexNormals();
  return paleLog(geometry, (normal) => Math.abs(axis === "x" ? normal.x : normal.z));
}

/** Whether a picker and everything holding it are shown. A roof or frame hidden over the player cannot be picked. */
export function isShown(object: THREE.Object3D): boolean {
  for (let at: THREE.Object3D | null = object.parent; at !== null; at = at.parent) if (!at.visible) return false;
  return true;
}
