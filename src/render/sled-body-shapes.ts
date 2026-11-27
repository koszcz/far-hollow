// The shapes a sled is built from, in code: the "sled" asset in asset-manifest.json. The owner approved the asset.
// Two runners, each the approved log from log-shape.ts stretched to the sled's length with its front curved up like a skid.
// Four crooked cross pieces with dark rope lashings, and a tow rope in a V from the runner tips to a loop at the front.
// The parts come in the order construction lays them. sled-meshes.ts draws them.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { SLED_ROPE_COLOUR, type RunnerTips } from "./sled-rope";
import type { Vec3 } from "../sim/entities";
import { SLED_LENGTH_METRES, SLED_WIDTH_METRES } from "../sim/structure-shapes";
import { SLED_LOG_COST, SLED_STICK_COST } from "../sim/structure-freely-placed";
import { LOG_LENGTH_METRES, type LogShape } from "./log-shape";
import { createStickSegment } from "./stick-shape";

/** How far each runner's middle sits above the ground, in metres: its radius. */
export const RUNNER_RADIUS_METRES = 0.1;
/** Each runner starts to curve up this far from its middle, in metres. */
const RUNNER_BEND_START_METRES = 0.62;
/** The front tip of each runner rises this far above the rest of it, in metres. */
const RUNNER_TIP_LIFT_METRES = 0.13;
/** The front tip of each runner is this much thinner than the rest, as a share of its thickness. */
const RUNNER_TIP_TAPER = 0.3;
/** The runner is cut into this many rings along its bend, so the bend is smooth. */
const RUNNER_BEND_RINGS = 6;
/** The radius of each cross piece at its thick end, in metres. Its thin end is a little thinner. */
export const CROSS_RADIUS_METRES = 0.032;
/** Each cross piece has this many sides. */
const CROSS_SIDES = 6;
/** The cross pieces stand this far in from the ends of the runners, in metres. */
const CROSS_INSET_METRES = 0.3;
/** How far each cross piece bends sideways at its middle, in metres, one per cross piece, so they look like branches. */
const CROSS_BENDS: readonly number[] = [0.025, -0.02, 0.015, -0.025];
/** The rope colour: darker than the bark, so the lashings show. */
const ROPE_COLOUR = 0x3d3128;
/** The thickness of the rope, as a radius in metres. */
const ROPE_RADIUS_METRES = 0.011;
/** Each lashing crosses the runner at this angle from straight across, in radians, so the two wraps make an X. */
const LASHING_TILT = 0.45;
/** The tow rope's V meets this far in front of the sled's middle, in metres. */
const TOW_KNOT_METRES = SLED_LENGTH_METRES / 2 + 0.3;
/** The radius of the loop at the end of the tow rope, in metres. */
const TOW_LOOP_RADIUS_METRES = 0.06;
/** Where each tow rope leaves its runner tip, from the sled's middle, in metres. */
const TOW_TIP_METRES = SLED_LENGTH_METRES / 2 - 0.04;
const TOW_TIP_HEIGHT_METRES = RUNNER_RADIUS_METRES + RUNNER_TIP_LIFT_METRES;
/** How far apart the runners' middles are across the sled, from the middle, in metres. */
const RUNNER_SIDE_METRES = SLED_WIDTH_METRES / 2 - RUNNER_RADIUS_METRES;

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Where the tow rope leaves the two runner tips, as world points, for a sled whose middle is at `position`, turned by
 * `heading` radians about the up axis.
 */
export function runnerTipsAt(position: Vec3, heading: number): RunnerTips {
  const at = (side: number): Vec3 => {
    const tip = new THREE.Vector3(TOW_TIP_METRES, TOW_TIP_HEIGHT_METRES, side * RUNNER_SIDE_METRES).applyAxisAngle(UP, heading);
    return { x: position.x + tip.x, y: position.y + tip.y, z: position.z + tip.z };
  };
  return { left: at(-1), right: at(1) };
}

/** One part of the sled: its shape, the materials it draws with when solid, and where its middle sits. */
export interface Part {
  readonly geometry: THREE.BufferGeometry;
  readonly solid: THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
  readonly middle: THREE.Vector3;
}
/**
 * Splits every triangle of `geometry` that crosses one of the planes x = `cuts`, so the shape gets a ring of corners there.
 * `geometry` must not be indexed. Every attribute is blended along each cut edge. Groups are kept.
 */
function sliceAcrossX(geometry: THREE.BufferGeometry, cuts: readonly number[]): THREE.BufferGeometry {
  const names = Object.keys(geometry.attributes);
  const attributes = names.map((name) => geometry.getAttribute(name));
  const sizes = attributes.map((attribute) => attribute.itemSize);
  const width = sizes.reduce((sum, size) => sum + size, 0);
  type Corner = number[];
  const cornerAt = (index: number): Corner =>
    attributes.flatMap((attribute) => Array.from({ length: attribute.itemSize }, (_, k) => attribute.array[index * attribute.itemSize + k] ?? 0));
  const blend = (a: Corner, b: Corner, t: number): Corner => a.map((value, k) => value + ((b[k] ?? 0) - value) * t);
  const xAt = sizes.slice(0, names.indexOf("position")).reduce((sum, size) => sum + size, 0);
  const xOf = (corner: Corner): number => corner[xAt] ?? 0;

  function split(triangle: Corner[], cut: number): Corner[][] {
    const above = triangle.map((corner) => xOf(corner) > cut);
    const count = above.filter(Boolean).length;
    if (count === 0 || count === 3) return [triangle];
    // Turn the triangle, keeping its winding, so its lone corner comes first.
    const lone = above.findIndex((side) => side === (count === 1));
    const [a, b, c] = [0, 1, 2].map((k) => triangle[(lone + k) % 3] ?? []) as [Corner, Corner, Corner];
    const ab = blend(a, b, (cut - xOf(a)) / (xOf(b) - xOf(a)));
    const ac = blend(a, c, (cut - xOf(a)) / (xOf(c) - xOf(a)));
    return [
      [a, ab, ac],
      [ab, b, c],
      [ab, c, ac],
    ];
  }

  const groups = geometry.groups.length > 0 ? geometry.groups : [{ start: 0, count: geometry.getAttribute("position").count, materialIndex: 0 }];
  const corners: Corner[] = [];
  const result = new THREE.BufferGeometry();
  for (const group of groups) {
    const first = corners.length;
    for (let i = group.start; i < group.start + group.count; i += 3) {
      let triangles: Corner[][] = [[cornerAt(i), cornerAt(i + 1), cornerAt(i + 2)]];
      for (const cut of cuts) triangles = triangles.flatMap((triangle) => split(triangle, cut));
      for (const triangle of triangles) corners.push(...triangle);
    }
    result.addGroup(first, corners.length - first, group.materialIndex ?? 0);
  }
  let offset = 0;
  names.forEach((name, n) => {
    const size = sizes[n] ?? 1;
    const array = new Float32Array(corners.length * size);
    corners.forEach((corner, i) => {
      array.set(corner.slice(offset, offset + size), i * size);
    });
    result.setAttribute(name, new THREE.BufferAttribute(array, size));
    offset += size;
  });
  if (offset !== width) throw new Error("sliceAcrossX lost an attribute");
  return result;
}

/**
 * One runner, centred on the origin and lying along x, with its front at +x: the log shape stretched to the sled's length.
 * Its front curves up and narrows like a skid. `rolled` turns it half over, so the two runners' branch stubs point outwards.
 */
function createRunnerGeometry(logShape: LogShape, rolled: boolean): THREE.BufferGeometry {
  const thickness = RUNNER_RADIUS_METRES / logShape.restHeight;
  const log = logShape.geometry.clone();
  // The log shape lies along z and is 1 m long. Stretch it to the sled's length, then lay it along x.
  log.scale(thickness, thickness, SLED_LENGTH_METRES / LOG_LENGTH_METRES);
  log.rotateY(Math.PI / 2);
  if (rolled) log.rotateX(Math.PI);
  const flat = log.index === null ? log : log.toNonIndexed();
  const tip = SLED_LENGTH_METRES / 2;
  const cuts = Array.from({ length: RUNNER_BEND_RINGS }, (_, i) => RUNNER_BEND_START_METRES + ((tip - RUNNER_BEND_START_METRES) * i) / RUNNER_BEND_RINGS);
  const runner = sliceAcrossX(flat, cuts);
  for (const geometry of new Set([log, flat])) geometry.dispose();
  const position = runner.getAttribute("position");
  for (let i = 0; i < position.count; i += 1) {
    const along = Math.min(1, Math.max(0, (position.getX(i) - RUNNER_BEND_START_METRES) / (tip - RUNNER_BEND_START_METRES)));
    const shrink = 1 - RUNNER_TIP_TAPER * along;
    position.setY(i, position.getY(i) * shrink + RUNNER_TIP_LIFT_METRES * along * along);
    position.setZ(i, position.getZ(i) * shrink);
  }
  runner.computeVertexNormals();
  return runner;
}

/**
 * The bark colour of the sled's cross pieces. It keeps the approved sled's look,
 * so it stays the old brown stick colour when the "sticks" asset changes.
 */
export const SLED_STICK_COLOUR = 0x8a6440;

/** The colour that, multiplied by the stick colour, gives `colour`. Stick parts draw with vertex colours on the stick material. */
function tintOverStick(colour: number): THREE.Color {
  const target = new THREE.Color(colour);
  const stick = new THREE.Color(SLED_STICK_COLOUR);
  return new THREE.Color(target.r / stick.r, target.g / stick.g, target.b / stick.b);
}

/** Gives every corner of `geometry` the colour `colour`, and drops attributes the stick parts do not share. */
function paint(geometry: THREE.BufferGeometry, colour: THREE.Color): THREE.BufferGeometry {
  geometry.deleteAttribute("uv");
  const count = geometry.getAttribute("position").count;
  const colours = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) colours.set([colour.r, colour.g, colour.b], i * 3);
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return geometry;
}

/** A straight length of rope from `from` to `to`. */
function ropeBetween(from: THREE.Vector3, to: THREE.Vector3): THREE.BufferGeometry {
  const direction = to.clone().sub(from);
  const rope = new THREE.CylinderGeometry(ROPE_RADIUS_METRES, ROPE_RADIUS_METRES, direction.length(), 5);
  rope.translate(0, direction.length() / 2, 0);
  rope.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
  rope.translate(from.x, from.y, from.z);
  return paint(rope, tintOverStick(SLED_ROPE_COLOUR));
}

/** Two wraps of rope in an X around a runner and the cross piece on it, centred where they cross, at height 0. */
function lashing(runnerZ: number): THREE.BufferGeometry[] {
  const top = 2 * RUNNER_RADIUS_METRES + 2 * CROSS_RADIUS_METRES;
  return [LASHING_TILT, -LASHING_TILT].map((tilt) => {
    // The wrap stands across the runner, around it and the cross piece, from just under the ground to just over the stick.
    const across = RUNNER_RADIUS_METRES * 1.3;
    const up = top / 2 + ROPE_RADIUS_METRES;
    const points = Array.from({ length: 12 }, (_, k) => {
      const angle = (2 * Math.PI * k) / 12;
      return new THREE.Vector3(0, Math.sin(angle) * up, Math.cos(angle) * across);
    });
    const wrap = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 16, ROPE_RADIUS_METRES, 4, true);
    wrap.rotateY(tilt);
    wrap.translate(0, top / 2, runnerZ);
    return paint(wrap, tintOverStick(ROPE_COLOUR));
  });
}

/** The tow rope: a V from the two runner tips, meeting in a knot in front of the sled, with a loop beyond it. Height 0 is the ground. */
function towRope(runnerZ: number): THREE.BufferGeometry[] {
  const tipX = TOW_TIP_METRES;
  const tipY = TOW_TIP_HEIGHT_METRES;
  const knot = new THREE.Vector3(TOW_KNOT_METRES, ROPE_RADIUS_METRES, 0);
  const loop = new THREE.TorusGeometry(TOW_LOOP_RADIUS_METRES, ROPE_RADIUS_METRES, 4, 10);
  loop.rotateX(Math.PI / 2);
  loop.translate(TOW_KNOT_METRES + TOW_LOOP_RADIUS_METRES, ROPE_RADIUS_METRES, 0);
  return [
    ropeBetween(new THREE.Vector3(tipX, tipY, -runnerZ), knot),
    ropeBetween(new THREE.Vector3(tipX, tipY, runnerZ), knot),
    paint(loop, tintOverStick(SLED_ROPE_COLOUR)),
  ];
}

/**
 * The parts in the order construction lays them: a runner for each log, then a cross piece for each stick.
 * Each cross piece comes with its lashings, and the last one with the tow rope, unless `withTowRope` is false.
 */
export function sledParts(
  logShape: LogShape,
  materials: { bark: THREE.MeshStandardMaterial; cut: THREE.MeshStandardMaterial; stick: THREE.MeshStandardMaterial },
  withTowRope = true,
): Part[] {
  const runnerZ = RUNNER_SIDE_METRES;
  const runners = Array.from({ length: SLED_LOG_COST }, (_, i): Part => {
    const side = -1 + (2 * i) / Math.max(1, SLED_LOG_COST - 1);
    return {
      geometry: createRunnerGeometry(logShape, side > 0),
      solid: [materials.bark, materials.cut],
      middle: new THREE.Vector3(0, RUNNER_RADIUS_METRES, side * runnerZ),
    };
  });
  const span = SLED_LENGTH_METRES - 2 * CROSS_INSET_METRES;
  const crossY = 2 * RUNNER_RADIUS_METRES;
  const crosses = Array.from({ length: SLED_STICK_COST }, (_, i): Part => {
    const x = -span / 2 + (span * i) / Math.max(1, SLED_STICK_COST - 1);
    const bend = CROSS_BENDS[i % CROSS_BENDS.length] ?? 0;
    // Thick ends alternate sides, like sticks laid by hand. Each piece rests on the runners at height 0.
    const flip = i % 2 === 0 ? 1 : -1;
    const half = SLED_WIDTH_METRES / 2;
    const thin = CROSS_RADIUS_METRES * 0.8;
    const foot = new THREE.Vector3(0, CROSS_RADIUS_METRES, -flip * half);
    const knee = new THREE.Vector3(bend, (CROSS_RADIUS_METRES + thin) / 2, 0);
    const end = new THREE.Vector3(0, thin, flip * half);
    const pieces = [
      createStickSegment({
        from: foot,
        to: knee,
        fromRadius: CROSS_RADIUS_METRES,
        toRadius: (CROSS_RADIUS_METRES + thin) / 2,
        sides: CROSS_SIDES,
        paleFrom: true,
        barkColour: SLED_STICK_COLOUR,
      }),
      createStickSegment({
        from: knee.clone().addScaledVector(knee.clone().sub(foot).normalize(), -0.02),
        to: end,
        fromRadius: (CROSS_RADIUS_METRES + thin) / 2,
        toRadius: thin,
        sides: CROSS_SIDES,
        paleTo: true,
        barkColour: SLED_STICK_COLOUR,
      }),
      ...[-runnerZ, runnerZ].flatMap((z) => lashing(z).map((wrap) => wrap.translate(0, -crossY, 0))),
      ...(withTowRope && i === SLED_STICK_COST - 1 ? towRope(runnerZ).map((rope) => rope.translate(-x, -crossY, 0)) : []),
    ];
    for (const piece of pieces) if (piece.hasAttribute("uv")) piece.deleteAttribute("uv");
    const geometry = mergeGeometries(pieces);
    for (const piece of pieces) piece.dispose();
    return { geometry, solid: materials.stick, middle: new THREE.Vector3(x, crossY, 0) };
  });
  return [...runners, ...crosses];
}
