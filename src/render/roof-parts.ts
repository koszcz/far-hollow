// What the roof frame and the roof laid on it share: their sizes and slope, the frame layout both follow, and the hewn
// timbers the frame is made from. The frame ("roof-frame" asset) is drawn by roof-frame-meshes.ts, its plank gable ends
// ("gable-end") by gable-end-shape.ts, and the planks of the roof ("roof") by roof-meshes.ts.
// Heights here are in metres above the foundation's deck, in a section's own frame: drawn unturned, sloping down to +z.
import * as THREE from "three";
import { BUILD_GRID_METRES } from "../sim/build-grid";
import { blueprintEntities, cabinRoofEntities, roofFrameEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { turnOffset } from "../sim/structure-kind";
import { DEBARKED_LOG_COLOUR, DEBARKED_LOG_CUT_COLOUR } from "./debarked-log-shape";
import { COURSE_RADIUS_METRES, EDGE_PIECE_HEIGHT_METRES } from "./edge-piece-meshes";
import { ALONE, gridCell, roofPlaces, shapeTop, type RoofPlace, type RoofShape } from "./roof-layout";

/** How thick a beam is across, in metres: the radius of the beams on walls that run along x. */
export const BEAM_RADIUS_METRES = 0.09;
/** The top of every beam of a frame, above the deck. The beams lie level on the walls, so the frame is flat here. */
export const FRAME_TOP_METRES = EDGE_PIECE_HEIGHT_METRES + 2 * BEAM_RADIUS_METRES;
/** How thick a rafter is across, in metres. */
export const RAFTER_RADIUS_METRES = 0.07;
/** A rafter is this much thinner at one end than the other, in metres, like a log from a young tree. */
const RAFTER_TAPER_METRES = 0.012;
/** How thick the planks of a roof are where their rows overlap, in metres: two planks, one on the other. */
export const COVER_THICKNESS_METRES = 0.05;
/** The weathered greys the planks of the roof and its gable ends are painted in, one picked for each plank. */
export const WEATHERED_PLANK_COLOURS = [0x8e8a80, 0x7f7b72, 0x9a968c, 0x86807a, 0x928c82] as const;
/** How wide a plank of the roof or a gable end is, in metres, at most. */
export const PLANK_WIDTH_METRES = 0.17;
/** The gap between two planks side by side, in metres. */
export const PLANK_GAP_METRES = 0.008;
/** How steeply each roof section slopes down to the front, in radians. */
export const ROOF_SLOPE_RADIANS = THREE.MathUtils.degToRad(35);
/** All roof frames and sections share this seed, so they all have the same ragged planks and crooked rafters, and line up. */
export const ROOF_SEED = 20261112;
/** One section's rise over the section in front of it, in metres. */
export const SECTION_RISE_METRES = BUILD_GRID_METRES * Math.tan(ROOF_SLOPE_RADIANS);
/**
 * The roof reaches this far past an edge with no section beside it, in metres, measured from the middle of the wall:
 * 0.5 m past the outside of the wall, over the eaves, the gable ends, and the high side of a shed roof.
 */
export const EAVE_REACH_METRES = 0.5 + COURSE_RADIUS_METRES;
/**
 * Sections in odd columns, across the slope, lie this much higher, in metres. Planks that overlap a neighbour's at the same
 * height flicker, because the screen cannot tell which is on top.
 */
const ODD_COLUMN_LIFT_METRES = 0.012;

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

/** The underside of the planks at (x, z), in a section's own frame, drawn unturned. The gable ends reach up to it. */
export function coverUnderside(shape: RoofShape): (x: number, z: number) => number {
  return (x, z) => FRAME_TOP_METRES + 2 * RAFTER_RADIUS_METRES + shapeHeight(shape, x, z);
}

/**
 * How high a section's roof is at (x, z) in its own frame, above its lowest edge, in metres. It carries on past the square's edges,
 * so planks reaching past an edge keep the slope.
 */
export function shapeHeight(shape: RoofShape, x: number, z: number): number {
  return shapeTop(shape, x / BUILD_GRID_METRES, z / BUILD_GRID_METRES) * SECTION_RISE_METRES;
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

/** A hewn timber's corners are cut off by this share of its half width, leaving four broad faces and four narrow chamfers. */
const CHAMFER_SHARE = 0.3;
/** How deep the shallow adze marks along a hewn timber's faces go, at most, in metres. */
const ADZE_DEPTH_METRES = 0.007;
/** How many adze marks a hewn timber has along each face, per metre. */
const ADZE_MARKS_PER_METRE = 6;

/**
 * One hewn timber lying along z, `length` long: a debarked log squared with an adze, with chamfered corners, shallow adze marks
 * along its faces, and pale cut ends. It is `2 * halfHeight` tall and `2 * halfWidth` wide, and a little thinner at one end.
 * It carries a colour per corner, so draw it with `vertexColors: true`, `flatShading: true`, and the material colour set to the log colour.
 */
export function hewnTimber(
  length: number,
  halfHeight: number,
  jitter: (size: number) => number,
  halfWidth = halfHeight,
  taper = RAFTER_TAPER_METRES,
): THREE.BufferGeometry {
  const faces = 8;
  const marks = Math.max(2, Math.round(length * ADZE_MARKS_PER_METRE));
  // The cylinder stands along y, with its corners half a face round, so its faces look along x and z and the corners between.
  const geometry = new THREE.CylinderGeometry(1, 1, length, faces, marks, false, Math.PI / faces);
  const positions = geometry.getAttribute("position");
  const dents = new Map<string, number>();
  const dent = (key: string) => {
    const known = dents.get(key);
    if (known !== undefined) return known;
    const made = random01(jitter) * ADZE_DEPTH_METRES;
    dents.set(key, made);
    return made;
  };
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    if (Math.hypot(x, z) < 0.5) continue;
    // Snap each corner of the cylinder onto the outline of a squared timber with chamfered corners.
    const angle = Math.atan2(x, z);
    const corner = (((Math.round((angle - Math.PI / faces) / ((2 * Math.PI) / faces)) % faces) + faces) % faces).toString();
    const thin = 1 - (taper / Math.max(halfWidth, halfHeight)) * (y / length + 0.5);
    const deep = Math.abs(y) < length / 2 - 0.001 ? dent(`${y.toFixed(4)}:${corner}`) : 0;
    const width = (halfWidth - deep) * thin;
    const height = (halfHeight - deep) * thin;
    const facesZ = Math.abs(z) > Math.abs(x);
    positions.setXYZ(i, Math.sign(x) * (facesZ ? width * (1 - CHAMFER_SHARE) : width), y, Math.sign(z) * (facesZ ? height : height * (1 - CHAMFER_SHARE)));
  }
  // Laid on its side, the cylinder's x stays the timber's width, and its z becomes the timber's height.
  geometry.rotateX(Math.PI / 2 + jitter(0.012)).rotateY(jitter(0.025));
  // After the turn onto its side, the cut ends face along z.
  return paleLog(geometry, (normal) => Math.abs(normal.z));
}

/** How wide a rafter is across, as a share of its height. A rafter is hewn a little narrower than it is tall. */
const RAFTER_WIDTH_SHARE = 0.85;

/** One rafter: a hewn timber whose middle line runs straight from `from` to `to`, a little narrower than it is tall. */
export function rafterBetween(from: THREE.Vector3, to: THREE.Vector3, jitter: (size: number) => number): THREE.BufferGeometry {
  const halfHeight = RAFTER_RADIUS_METRES;
  const along = new THREE.Vector3().subVectors(to, from);
  const geometry = hewnTimber(along.length(), halfHeight, jitter, halfHeight * RAFTER_WIDTH_SHARE + jitter(0.004));
  // Made along z, tip it to the slope of the line, turn it to face along the line, and move it to the line's middle.
  const flat = Math.hypot(along.x, along.z);
  geometry.rotateX(Math.atan2(-along.y, flat)).rotateY(Math.atan2(along.x, along.z));
  const middle = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
  return geometry.translate(middle.x, middle.y, middle.z);
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

/** Whether a picker and everything holding it are shown. A roof or frame hidden over the player cannot be picked. */
export function isShown(object: THREE.Object3D): boolean {
  for (let at: THREE.Object3D | null = object.parent; at !== null; at = at.parent) if (!at.visible) return false;
  return true;
}
