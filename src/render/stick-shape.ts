// The code-built shape listed in asset-manifest.json as "sticks" (draft). forest-meshes.ts places one on each stick's spot.
// The approved "campfire" in campfire-meshes.ts stands these sticks up, so changing this shape or colour changes the campfire too.
// The approved "lean-to" in lean-to-meshes.ts builds its poles from createStickSegment in STICK_COLOUR, so changing either changes the lean-to too.
// Each stick is a crooked branch: three tapered segments with small bends, two side twigs, and pale cut ends.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** The bark colour: pale grey-tan, like weathered dead wood. Much lighter than the brown forest floor and the trunks, so sticks stand out. */
export const STICK_COLOUR = 0xa89a84;
/** The two cut ends show pale wood. */
const CUT_END_COLOUR = 0xd8b88a;
export const STICK_LENGTH_METRES = 0.9;
/** Sticks float this far above their spot, so the ground's slope does not swallow them. */
const STICK_LIFT_METRES = 0.03;
const BRANCH_SIDES = 6;
const TWIG_SIDES = 5;

/**
 * The bend points of the main branch, from its thick foot to its thin tip, along x.
 * Each point's height equals its radius, so the whole branch rests on y = 0.
 */
const BRANCH_POINTS: readonly { x: number; z: number; radius: number }[] = [
  { x: -0.45, z: 0, radius: 0.0625 },
  { x: -0.14, z: 0.05, radius: 0.054 },
  { x: 0.16, z: -0.02, radius: 0.045 },
  { x: 0.45, z: 0.04, radius: 0.0325 },
];

/** Side twigs. Each starts part-way along one branch segment and points mostly forward and to the side. */
const TWIGS: readonly { segment: number; along: number; direction: THREE.Vector3; length: number; radius: number }[] = [
  { segment: 1, along: 0.4, direction: new THREE.Vector3(0.6, 0.12, 0.75).normalize(), length: 0.28, radius: 0.029 },
  { segment: 2, along: 0.5, direction: new THREE.Vector3(0.7, 0.08, -0.7).normalize(), length: 0.18, radius: 0.022 },
];

/**
 * A crooked stick lying along x, from x = -0.45 to x = 0.45, resting on y = 0.
 * It carries a colour per corner: white on the bark and a pale tint on the two cut ends.
 * Draw it with `vertexColors: true` and the material colour set to STICK_COLOUR.
 */
export function createStickGeometry(): THREE.BufferGeometry {
  // Each segment runs from one bend point to the next.
  const segments = BRANCH_POINTS.slice(1).map((to, i) => ({ from: BRANCH_POINTS[i] ?? to, to }));
  const ends = segments.map(({ from, to }) => ({
    from: new THREE.Vector3(from.x, from.radius, from.z),
    to: new THREE.Vector3(to.x, to.radius, to.z),
  }));
  const parts: THREE.BufferGeometry[] = [];
  segments.forEach(({ from, to }, i) => {
    const { from: fromPoint, to: toPoint } = ends[i] ?? { from: new THREE.Vector3(), to: new THREE.Vector3() };
    const first = i === 0;
    const last = i === segments.length - 1;
    // Inner segments start a little inside the previous one, so no notch shows at the bends.
    const start = first ? fromPoint : fromPoint.clone().addScaledVector(toPoint.clone().sub(fromPoint).normalize(), -from.radius * 0.6);
    parts.push(createStickSegment(start, toPoint, from.radius, to.radius, BRANCH_SIDES, first, last));
  });
  for (const twig of TWIGS) {
    const host = ends[twig.segment];
    if (host === undefined) continue;
    const start = host.from.clone().lerp(host.to, twig.along);
    const end = start.clone().addScaledVector(twig.direction, twig.length);
    parts.push(createStickSegment(start, end, twig.radius, twig.radius * 0.5, TWIG_SIDES, false, false));
  }
  const stick = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  stick.translate(0, STICK_LIFT_METRES, 0);
  return stick;
}

/**
 * A tapered cylinder from `from` to `to`, with bark-coloured sides and optionally pale cut ends.
 * The lean-to in lean-to-meshes.ts builds its crooked posts and ridge pole from these.
 * Draw it in a material coloured `barkColour`. The sled in sled-meshes.ts passes its own bark colour.
 */
export function createStickSegment(
  from: THREE.Vector3,
  to: THREE.Vector3,
  fromRadius: number,
  toRadius: number,
  sides: number,
  paleFrom: boolean,
  paleTo: boolean,
  barkColour: number = STICK_COLOUR,
): THREE.BufferGeometry {
  const direction = to.clone().sub(from);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(toRadius, fromRadius, length, sides);
  // Vertex colours multiply the material colour, so the cut-end colour is divided by the bark colour first.
  const bark = new THREE.Color(barkColour);
  const cut = new THREE.Color(CUT_END_COLOUR);
  const pale = new THREE.Color(cut.r / bark.r, cut.g / bark.g, cut.b / bark.b);
  const normals = geometry.getAttribute("normal");
  const colours = new Float32Array(normals.count * 3);
  for (let i = 0; i < normals.count; i += 1) {
    // Cap corners face straight along the cylinder's axis. The top cap is the `to` end.
    const capFacing = normals.getY(i);
    const isPale = (capFacing > 0.99 && paleTo) || (capFacing < -0.99 && paleFrom);
    const colour = isPale ? pale : WHITE;
    colours.set([colour.r, colour.g, colour.b], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geometry.translate(0, length / 2, 0);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
  geometry.translate(from.x, from.y, from.z);
  return geometry;
}

const WHITE = new THREE.Color(1, 1, 1);
