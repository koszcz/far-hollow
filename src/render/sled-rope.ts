// Builds the "sled-rope" asset in asset-manifest.json: the rope the player drags a sled by. It runs in a V from the two
// runner tips to a knot, and from the knot to the left hand, held low behind the player. A turn of rope wraps the hand,
// and a short tail hangs from it. The rope is light hemp, laid from three strands that twist along it.
// While the player walks, the rope pulls taut. When they stop, it goes slack: the knot drops and the rope sags.
// It eases between the two over a short moment.
// While the sled is dragged it takes the place of the sled's own flat tow rope, so the whole rope lifts off the ground.
// It shows only while the player drags a sled. sled-meshes.ts draws it from where player-motions/sled-drag-animation.ts says the hand is.
// It is built in code. The owner approved it.
import * as THREE from "three";
import type { Vec3 } from "../sim/entities";
import { lerp } from "./easing";

/** How far the middle of the rope between the knot and the hand hangs below a straight line while walking, in metres. */
export const SLED_ROPE_TAUT_SAG_METRES = 0.02;
/** How far it hangs while the player stands still, in metres. */
export const SLED_ROPE_SLACK_SAG_METRES = 0.15;
/** How far each arm of the V hangs in its middle while the player stands still, in metres. Walking pulls it straight. */
const SLED_BRIDLE_SLACK_SAG_METRES = 0.03;
/** How far the knot drops while the player stands still, in metres. */
export const SLED_KNOT_SLACK_DROP_METRES = 0.08;
/** How quickly the rope goes taut or slack: the seconds it takes to get about two thirds of the way. */
const SLED_ROPE_EASE_SECONDS = 0.15;
/** A frame further apart than this, or back in time, jumps straight to taut or slack, as after a pause or a new still. */
const SLED_ROPE_JUMP_SECONDS = 0.1;
/** How far the knot sits from the middle of the runner tips, toward the hand, in metres: as far as on the parked sled. */
export const SLED_KNOT_METRES = 0.34;
/** The rope's thickness, as a radius in metres: the same as the sled's own rope. */
export const SLED_ROPE_RADIUS_METRES = 0.011;
/** The rope's colour: light hemp, so it shows against the dark sled and coat. The parked sled's tow rope uses it too. */
export const SLED_ROPE_COLOUR = 0xb39268;
/** The colour in the grooves between the strands. */
const SLED_ROPE_GROOVE_COLOUR = 0x6e553a;
/** The rope is laid from this many strands. */
const SLED_ROPE_STRANDS = 3;
/** Each strand turns once around the rope over this length, in metres. */
const SLED_ROPE_LAY_METRES = 0.07;
/** The knot where the V meets is a lump this wide, as a radius in metres. */
const SLED_KNOT_RADIUS_METRES = 0.021;
/** The turn of rope around the hand, as a radius in metres to the middle of the rope. */
const SLED_HAND_WRAP_RADIUS_METRES = 0.03;
/** The tail hangs this far below the hand, in metres. */
const SLED_TAIL_METRES = 0.11;

/** Where the player holds the rope: the left hand's grip, as a world point, and whether they walk, pulling it taut. */
export interface RopeHold {
  readonly hand: Vec3;
  readonly walking: boolean;
}

/** Where the rope leaves the front tips of the sled's two runners, as world points. */
export interface RunnerTips {
  readonly left: Vec3;
  readonly right: Vec3;
}

const between = (from: Vec3, to: Vec3, t: number): Vec3 => ({ x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t), z: lerp(from.z, to.z, t) });

/**
 * How slack the rope is after `seconds` more, from 0 (taut) to 1 (slack), when it was `slack` before.
 * Walking pulls it toward taut. Standing lets it toward slack. A jump in time goes straight there.
 */
export function sledRopeSlack(slack: number | undefined, walking: boolean, seconds: number): number {
  const target = walking ? 0 : 1;
  if (slack === undefined || seconds < 0 || seconds > SLED_ROPE_JUMP_SECONDS) return target;
  return lerp(slack, target, 1 - Math.exp(-seconds / SLED_ROPE_EASE_SECONDS));
}

/**
 * Where the V meets: `SLED_KNOT_METRES` from the middle of the runner tips, straight toward the hand.
 * A slack rope lets it drop by up to `SLED_KNOT_SLACK_DROP_METRES`, but never lower than the runner tips.
 */
export function sledRopeKnot(hold: RopeHold, tips: RunnerTips, slack: number): Vec3 {
  const middle = between(tips.left, tips.right, 0.5);
  const toHand = new THREE.Vector3(hold.hand.x - middle.x, hold.hand.y - middle.y, hold.hand.z - middle.z);
  const reach = Math.min(SLED_KNOT_METRES, toHand.length() / 2);
  toHand.setLength(reach);
  const y = middle.y + toHand.y;
  return { x: middle.x + toHand.x, y: Math.max(Math.min(y, middle.y), y - slack * SLED_KNOT_SLACK_DROP_METRES), z: middle.z + toHand.z };
}

/** `count` points from `from` to `to` that hang `sag` metres below a straight line in the middle. */
function hanging(from: Vec3, to: Vec3, count: number, sag: number): Vec3[] {
  const last = count - 1;
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return { ...from };
    if (index === last) return { ...to };
    const t = index / last;
    const point = between(from, to, t);
    return { ...point, y: point.y - sag * 4 * t * (1 - t) };
  });
}

/** `count` points along the rope from the knot to the hand. All are world points. It sags more the slacker it is. */
export function sledRopePoints(hold: RopeHold, knot: Vec3, count: number, slack: number): Vec3[] {
  return hanging(knot, hold.hand, count, lerp(SLED_ROPE_TAUT_SAG_METRES, SLED_ROPE_SLACK_SAG_METRES, slack));
}

/** `count` points along the V: from the left runner tip to the knot, and on to the right runner tip. Taut, it runs straight. */
export function sledBridlePoints(tips: RunnerTips, knot: Vec3, count: number, slack: number): Vec3[] {
  const half = Math.floor((count - 1) / 2);
  const sag = slack * SLED_BRIDLE_SLACK_SAG_METRES;
  return [...hanging(tips.left, knot, half + 1, sag), ...hanging(knot, tips.right, count - half, sag).slice(1)];
}

/** A rope that bends through points that `setPoints` moves each frame, with its strands twisting along it. */
interface RopeTube {
  readonly mesh: THREE.Mesh;
  readonly pointCount: number;
  setPoints(points: readonly Vec3[]): void;
  dispose(): void;
}

const ROPE_SIDES = 8;

function createRopeTube(pieces: number, material: THREE.Material): RopeTube {
  const pointCount = pieces + 1;
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(new Float32Array(pointCount * ROPE_SIDES * 3), 3);
  const colour = new THREE.BufferAttribute(new Float32Array(pointCount * ROPE_SIDES * 3), 3);
  geometry.setAttribute("position", position);
  geometry.setAttribute("color", colour);
  const indices: number[] = [];
  for (let piece = 0; piece < pieces; piece++) {
    for (let side = 0; side < ROPE_SIDES; side++) {
      const a = piece * ROPE_SIDES + side;
      const b = piece * ROPE_SIDES + ((side + 1) % ROPE_SIDES);
      indices.push(a, a + ROPE_SIDES, b, b, a + ROPE_SIDES, b + ROPE_SIDES);
    }
  }
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, material);
  // The rope moves every frame with the player, so it is always drawn.
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  const strand = new THREE.Color(SLED_ROPE_COLOUR);
  const groove = new THREE.Color(SLED_ROPE_GROOVE_COLOUR);
  const shade = new THREE.Color();
  const point = new THREE.Vector3();
  const before = new THREE.Vector3();
  const after = new THREE.Vector3();
  const along = new THREE.Vector3();
  const across = new THREE.Vector3();
  const over = new THREE.Vector3();
  const sideways = new THREE.Vector3(1, 0, 0);
  const upward = new THREE.Vector3(0, 1, 0);
  return {
    mesh,
    pointCount,
    setPoints(points) {
      let travelled = 0;
      for (let index = 0; index < pointCount; index++) {
        const here = points[index];
        const previous = points[Math.max(0, index - 1)];
        const next = points[Math.min(pointCount - 1, index + 1)];
        if (here === undefined || previous === undefined || next === undefined) continue;
        point.set(here.x, here.y, here.z);
        before.set(previous.x, previous.y, previous.z);
        after.set(next.x, next.y, next.z);
        if (index > 0) travelled += point.distanceTo(before);
        along.subVectors(after, before);
        if (along.lengthSq() < 1e-12) along.set(0, -1, 0);
        along.normalize();
        across.crossVectors(along, Math.abs(along.y) > 0.9 ? sideways : upward).normalize();
        over.crossVectors(along, across);
        const twist = (2 * Math.PI * travelled) / SLED_ROPE_LAY_METRES;
        for (let side = 0; side < ROPE_SIDES; side++) {
          const angle = (2 * Math.PI * side) / ROPE_SIDES;
          const corner = index * ROPE_SIDES + side;
          position.setXYZ(
            corner,
            point.x + SLED_ROPE_RADIUS_METRES * (Math.cos(angle) * across.x + Math.sin(angle) * over.x),
            point.y + SLED_ROPE_RADIUS_METRES * (Math.cos(angle) * across.y + Math.sin(angle) * over.y),
            point.z + SLED_ROPE_RADIUS_METRES * (Math.cos(angle) * across.z + Math.sin(angle) * over.z),
          );
          // Each strand is light across its middle and dark where it meets the next one.
          const light = Math.pow(0.5 + 0.5 * Math.cos(SLED_ROPE_STRANDS * (angle - twist)), 0.6);
          shade.lerpColors(groove, strand, light);
          colour.setXYZ(corner, shade.r, shade.g, shade.b);
        }
      }
      position.needsUpdate = true;
      colour.needsUpdate = true;
      geometry.computeVertexNormals();
    },
    dispose() {
      geometry.dispose();
    },
  };
}

export interface SledRope {
  readonly group: THREE.Group;
  /**
   * Draws the rope from the runner tips `tips` to `hold` at `nowSeconds`, or hides it when either is undefined.
   * It eases taut or slack from how it was drawn last.
   */
  show(hold: RopeHold | undefined, tips: RunnerTips | undefined, nowSeconds: number): void;
  dispose(): void;
}

export function createSledRope(): SledRope {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const solid = new THREE.MeshStandardMaterial({ color: SLED_ROPE_COLOUR, roughness: 1 });
  const lead = createRopeTube(64, material);
  const bridle = createRopeTube(48, material);
  const tail = createRopeTube(8, material);
  const knotGeometry = new THREE.IcosahedronGeometry(SLED_KNOT_RADIUS_METRES, 0);
  const knotMesh = new THREE.Mesh(knotGeometry, solid);
  const wrapGeometry = new THREE.TorusGeometry(SLED_HAND_WRAP_RADIUS_METRES, SLED_ROPE_RADIUS_METRES, 5, 12);
  const wrapMesh = new THREE.Mesh(wrapGeometry, solid);
  for (const mesh of [knotMesh, wrapMesh]) mesh.castShadow = true;
  const group = new THREE.Group();
  group.visible = false;
  group.add(lead.mesh, bridle.mesh, tail.mesh, knotMesh, wrapMesh);
  let slack: number | undefined;
  let shownAt: number | undefined;
  const pull = new THREE.Vector3();
  const flat = new THREE.Vector3();
  return {
    group,
    show(hold, tips, nowSeconds) {
      group.visible = hold !== undefined && tips !== undefined;
      if (hold === undefined || tips === undefined) {
        slack = undefined;
        return;
      }
      slack = sledRopeSlack(slack, hold.walking, shownAt === undefined ? Infinity : nowSeconds - shownAt);
      shownAt = nowSeconds;
      const knot = sledRopeKnot(hold, tips, slack);
      const leadPoints = sledRopePoints(hold, knot, lead.pointCount, slack);
      lead.setPoints(leadPoints);
      bridle.setPoints(sledBridlePoints(tips, knot, bridle.pointCount, slack));
      knotMesh.position.set(knot.x, knot.y, knot.z);
      // The turn of rope stands across the pull, around the fist.
      const nearHand = leadPoints.at(-2) ?? knot;
      pull.set(hold.hand.x - nearHand.x, hold.hand.y - nearHand.y, hold.hand.z - nearHand.z).normalize();
      wrapMesh.position.set(hold.hand.x, hold.hand.y, hold.hand.z);
      wrapMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pull);
      // The tail leaves the hand on the far side from the sled, then hangs down.
      flat.set(pull.x, 0, pull.z).normalize().multiplyScalar(0.03);
      const tailEnd = { x: hold.hand.x + flat.x * 1.5, y: hold.hand.y - SLED_TAIL_METRES, z: hold.hand.z + flat.z * 1.5 };
      const tailPoints = Array.from({ length: tail.pointCount }, (_, index) => {
        const t = index / (tail.pointCount - 1);
        // It bends out of the fist, then falls straight.
        const out = Math.sin((t * Math.PI) / 2);
        return { x: hold.hand.x + (tailEnd.x - hold.hand.x) * out, y: lerp(hold.hand.y, tailEnd.y, t * t), z: hold.hand.z + (tailEnd.z - hold.hand.z) * out };
      });
      tail.setPoints(tailPoints);
    },
    dispose() {
      lead.dispose();
      bridle.dispose();
      tail.dispose();
      knotGeometry.dispose();
      wrapGeometry.dispose();
      material.dispose();
      solid.dispose();
    },
  };
}
