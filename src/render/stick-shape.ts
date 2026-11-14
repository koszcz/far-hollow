// The code-built shapes listed in asset-manifest.json as "sticks" (approved). forest-meshes.ts places one of the four ground shapes on each stick's spot.
// The approved "campfire" in campfire-meshes.ts stands these sticks up, so changing this shape or colour changes the campfire too.
// The approved "lean-to" in lean-to-meshes.ts builds its poles from createStickSegment in STICK_COLOUR, so changing either changes the lean-to too.
// Each stick is a crooked branch: tapered segments with small bends, side twigs, and pale cut ends.
// Sticks on the ground come in four shapes, with broken-off knots and a darker streak along the bark.
// The campfire uses only the first shape, without knots or streaks.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** The bark colour: pale grey-tan, like weathered dead wood. Much lighter than the brown forest floor and the trunks, so sticks stand out. */
export const STICK_COLOUR = 0xa89a84;
/** The two cut ends show pale wood. */
const CUT_END_COLOUR = 0xd8b88a;
/** The broken ends of knots show dark, old wood. */
const KNOT_END_COLOUR = 0x5e5040;
/** The streak along one side of each ground-stick segment is this share of the bark's brightness. */
const STREAK_SHADE = 0.78;
export const STICK_LENGTH_METRES = 0.9;
/** Sticks float this far above their spot, so the ground's slope does not swallow them. */
const STICK_LIFT_METRES = 0.03;
const BRANCH_SIDES = 6;
const TWIG_SIDES = 5;

/** One bend point of a main branch. Its height equals its radius, so the branch rests on y = 0. */
interface BendPoint {
  x: number;
  z: number;
  radius: number;
}

/** A side twig or a knot. It starts part-way along one branch segment and points mostly forward and to the side. */
interface Offshoot {
  segment: number;
  along: number;
  direction: THREE.Vector3;
  length: number;
  radius: number;
}

/** One stick shape: a main branch, its side twigs, and its broken-off knots. */
interface StickShape {
  /** The main branch, from its thick foot to its thin tip, along x. */
  points: readonly BendPoint[];
  twigs: readonly Offshoot[];
  /** Short stubs of snapped twigs, with dark broken ends. Only ground sticks show them. */
  knots: readonly Offshoot[];
}

const towards = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize();
const knot = (segment: number, along: number, direction: THREE.Vector3, radius = 0.02): Offshoot => ({
  segment,
  along,
  direction,
  length: 0.045,
  radius,
});

/** The four stick shapes. The first is the campfire's stick, and the length the tests and pick box use. */
const STICK_SHAPES: readonly StickShape[] = [
  // Crooked, with two twigs.
  {
    points: [
      { x: -0.45, z: 0, radius: 0.0625 },
      { x: -0.14, z: 0.05, radius: 0.054 },
      { x: 0.16, z: -0.02, radius: 0.045 },
      { x: 0.45, z: 0.04, radius: 0.0325 },
    ],
    twigs: [
      {
        segment: 1,
        along: 0.4,
        direction: towards(0.6, 0.12, 0.75),
        length: 0.28,
        radius: 0.029,
      },
      {
        segment: 2,
        along: 0.5,
        direction: towards(0.7, 0.08, -0.7),
        length: 0.18,
        radius: 0.022,
      },
    ],
    knots: [knot(0, 0.45, towards(0.2, 0.9, -0.4)), knot(2, 0.75, towards(0.3, 0.7, 0.65), 0.016)],
  },
  // Long and gently bowed, with one twig near the tip.
  {
    points: [
      { x: -0.5, z: 0, radius: 0.06 },
      { x: -0.17, z: -0.04, radius: 0.054 },
      { x: 0.16, z: -0.06, radius: 0.046 },
      { x: 0.5, z: -0.02, radius: 0.032 },
    ],
    twigs: [
      {
        segment: 2,
        along: 0.6,
        direction: towards(0.5, 0.1, -0.85),
        length: 0.22,
        radius: 0.022,
      },
    ],
    knots: [knot(0, 0.6, towards(0.1, 0.6, 0.8)), knot(1, 0.5, towards(0.2, 0.95, -0.2)), knot(2, 0.2, towards(0.3, 0.5, 0.8), 0.017)],
  },
  // Short and forked: a thick twig splits off near the middle.
  {
    points: [
      { x: -0.35, z: 0, radius: 0.058 },
      { x: -0.05, z: 0.03, radius: 0.05 },
      { x: 0.35, z: -0.03, radius: 0.036 },
    ],
    twigs: [
      {
        segment: 0,
        along: 0.92,
        direction: towards(0.75, 0.06, 0.65),
        length: 0.3,
        radius: 0.03,
      },
      {
        segment: 1,
        along: 0.55,
        direction: towards(0.5, 0.1, -0.85),
        length: 0.12,
        radius: 0.018,
      },
    ],
    knots: [knot(0, 0.35, towards(0.1, 0.8, -0.6))],
  },
  // Zig-zag, with three small twigs.
  {
    points: [
      { x: -0.42, z: 0, radius: 0.06 },
      { x: -0.15, z: -0.06, radius: 0.052 },
      { x: 0.1, z: 0.04, radius: 0.045 },
      { x: 0.42, z: -0.02, radius: 0.03 },
    ],
    twigs: [
      {
        segment: 0,
        along: 0.5,
        direction: towards(0.5, 0.1, -0.85),
        length: 0.16,
        radius: 0.02,
      },
      {
        segment: 1,
        along: 0.6,
        direction: towards(0.65, 0.1, 0.75),
        length: 0.22,
        radius: 0.024,
      },
      {
        segment: 2,
        along: 0.7,
        direction: towards(0.8, 0.08, -0.6),
        length: 0.14,
        radius: 0.018,
      },
    ],
    knots: [knot(1, 0.2, towards(0.15, 0.85, 0.5)), knot(2, 0.35, towards(0.2, 0.9, -0.4), 0.017)],
  },
];

/** How many shapes sticks on the ground come in. */
export const GROUND_STICK_SHAPE_COUNT = STICK_SHAPES.length;

/**
 * The campfire's stick: the first shape, lying along x from x = -0.45 to x = 0.45, resting on y = 0, with no knots or streaks.
 * It carries a colour per corner: white on the bark and a pale tint on the two cut ends.
 * Draw it with `vertexColors: true` and the material colour set to STICK_COLOUR.
 */
export function createStickGeometry(): THREE.BufferGeometry {
  return buildStick(STICK_SHAPES[0] ?? { points: [], twigs: [], knots: [] }, false);
}

/**
 * The stick lying on the ground in shape `shape`, from 0 to GROUND_STICK_SHAPE_COUNT - 1.
 * Each shape lies along x, centred on x = 0, resting on y = 0. It has knots with dark broken ends and a darker streak along the bark.
 * Draw it like createStickGeometry.
 */
export function createGroundStickGeometry(shape: number): THREE.BufferGeometry {
  return buildStick(STICK_SHAPES[shape] ?? STICK_SHAPES[0] ?? { points: [], twigs: [], knots: [] }, true);
}

function buildStick({ points, twigs, knots }: StickShape, weathered: boolean): THREE.BufferGeometry {
  // Each segment runs from one bend point to the next.
  const segments = points.slice(1).map((to, i) => ({ from: points[i] ?? to, to }));
  const ends = segments.map(({ from, to }) => ({
    from: new THREE.Vector3(from.x, from.radius, from.z),
    to: new THREE.Vector3(to.x, to.radius, to.z),
  }));
  const parts: THREE.BufferGeometry[] = [];
  segments.forEach(({ from, to }, i) => {
    const { from: fromPoint, to: toPoint } = ends[i] ?? {
      from: new THREE.Vector3(),
      to: new THREE.Vector3(),
    };
    const first = i === 0;
    const last = i === segments.length - 1;
    // Inner segments start a little inside the previous one, so no notch shows at the bends.
    const start = first ? fromPoint : fromPoint.clone().addScaledVector(toPoint.clone().sub(fromPoint).normalize(), -from.radius * 0.6);
    parts.push(
      createStickSegment({
        from: start,
        to: toPoint,
        fromRadius: from.radius,
        toRadius: to.radius,
        sides: BRANCH_SIDES,
        paleFrom: first,
        paleTo: last,
        streak: weathered,
      }),
    );
  });
  const offshoot = (twig: Offshoot, isKnot: boolean) => {
    const host = ends[twig.segment];
    if (host === undefined) return;
    // Knots start just inside the branch, so their foot does not float.
    const start = host.from.clone().lerp(host.to, twig.along);
    if (isKnot) start.addScaledVector(twig.direction, -twig.radius);
    const end = start.clone().addScaledVector(twig.direction, twig.length + (isKnot ? twig.radius : 0));
    parts.push(
      createStickSegment({
        from: start,
        to: end,
        fromRadius: twig.radius,
        toRadius: twig.radius * (isKnot ? 0.8 : 0.5),
        sides: TWIG_SIDES,
        knotTo: isKnot,
      }),
    );
  };
  for (const twig of twigs) offshoot(twig, false);
  if (weathered) for (const k of knots) offshoot(k, true);
  const stick = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  stick.translate(0, STICK_LIFT_METRES, 0);
  return stick;
}

/** The shape of one stick segment. */
export interface StickSegmentOptions {
  from: THREE.Vector3;
  to: THREE.Vector3;
  fromRadius: number;
  toRadius: number;
  /** How many flat sides the cylinder has. */
  sides: number;
  /** Whether the `from` end shows pale cut wood. No by default. */
  paleFrom?: boolean;
  /** Whether the `to` end shows pale cut wood. No by default. */
  paleTo?: boolean;
  /** Whether the `to` end shows the dark wood of a snapped knot. No by default. */
  knotTo?: boolean;
  /** Whether one side of the bark is darker, like a weathered streak. No by default. */
  streak?: boolean;
  /** The bark colour of the material the segment is drawn in. STICK_COLOUR by default. */
  barkColour?: number;
}

/**
 * A tapered cylinder from `from` to `to`, with bark-coloured sides and optionally pale cut ends.
 * The lean-to in lean-to-meshes.ts builds its crooked posts and ridge pole from these.
 * Draw it in a material coloured `barkColour`. The sled in sled-meshes.ts passes its own bark colour.
 */
export function createStickSegment({
  from,
  to,
  fromRadius,
  toRadius,
  sides,
  paleFrom = false,
  paleTo = false,
  knotTo = false,
  streak = false,
  barkColour = STICK_COLOUR,
}: StickSegmentOptions): THREE.BufferGeometry {
  const direction = to.clone().sub(from);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(toRadius, fromRadius, length, sides);
  // Vertex colours multiply the material colour, so the cut-end colour is divided by the bark colour first.
  const bark = new THREE.Color(barkColour);
  const cut = new THREE.Color(CUT_END_COLOUR);
  const pale = new THREE.Color(cut.r / bark.r, cut.g / bark.g, cut.b / bark.b);
  const old = new THREE.Color(KNOT_END_COLOUR);
  const dark = new THREE.Color(old.r / bark.r, old.g / bark.g, old.b / bark.b);
  const streaked = new THREE.Color(STREAK_SHADE, STREAK_SHADE, STREAK_SHADE);
  const normals = geometry.getAttribute("normal");
  const colours = new Float32Array(normals.count * 3);
  // The side corners come first, in rings of `sides + 1`. The first and last corner of each ring meet at the seam.
  const sideCorners = (sides + 1) * 2;
  for (let i = 0; i < normals.count; i += 1) {
    // Cap corners face straight along the cylinder's axis. The top cap is the `to` end.
    const capFacing = i < sideCorners ? 0 : normals.getY(i);
    const isPale = (capFacing > 0.99 && paleTo) || (capFacing < -0.99 && paleFrom);
    const isDark = capFacing > 0.99 && knotTo;
    const onSeam = i < sideCorners && (i % (sides + 1) === 0 || i % (sides + 1) === sides);
    const colour = isPale ? pale : isDark ? dark : streak && onSeam ? streaked : WHITE;
    colours.set([colour.r, colour.g, colour.b], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geometry.translate(0, length / 2, 0);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
  geometry.translate(from.x, from.y, from.z);
  return geometry;
}

const WHITE = new THREE.Color(1, 1, 1);
