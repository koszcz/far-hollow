// Builds the "sled-rope" asset in asset-manifest.json: the rope the player drags a sled by. It runs in a V from the two
// runner tips to a knot, and from the knot up to the left hand, held low behind the player, sagging a little.
// While the sled is dragged it takes the place of the sled's own flat tow rope, so the whole rope lifts off the ground.
// It shows only while the player drags a sled. sled-meshes.ts draws it from where player-mesh.ts says the hand is.
// It is a draft built in code.
import * as THREE from "three";
import type { Vec3 } from "../sim/entities";
import { createFishingLine } from "./fishing-tackle";
import { lerp } from "./easing";

/** How far the middle of the rope between the knot and the hand hangs below a straight line, in metres. */
export const SLED_ROPE_SAG_METRES = 0.06;
/** How far the knot sits from the middle of the runner tips, toward the hand, in metres: as far as on the parked sled. */
export const SLED_KNOT_METRES = 0.34;
/** The rope's thickness, as a radius in metres: the same as the sled's own rope. */
const SLED_ROPE_RADIUS_METRES = 0.011;
/** The rope's colour: the same as the sled's own rope. */
const SLED_ROPE_COLOUR = 0x3d3128;

/** Where the player holds the rope: the left hand's grip, as a world point. */
export interface RopeHold {
  readonly hand: Vec3;
}

/** Where the rope leaves the front tips of the sled's two runners, as world points. */
export interface RunnerTips {
  readonly left: Vec3;
  readonly right: Vec3;
}

const between = (from: Vec3, to: Vec3, t: number): Vec3 => ({ x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t), z: lerp(from.z, to.z, t) });

/** Where the V meets: `SLED_KNOT_METRES` from the middle of the runner tips, straight toward the hand. */
export function sledRopeKnot(hold: RopeHold, tips: RunnerTips): Vec3 {
  const middle = between(tips.left, tips.right, 0.5);
  const toHand = new THREE.Vector3(hold.hand.x - middle.x, hold.hand.y - middle.y, hold.hand.z - middle.z);
  const reach = Math.min(SLED_KNOT_METRES, toHand.length() / 2);
  toHand.setLength(reach);
  return { x: middle.x + toHand.x, y: middle.y + toHand.y, z: middle.z + toHand.z };
}

/** `count` points along the rope from the knot to the hand. All are world points. It sags a little between them. */
export function sledRopePoints(hold: RopeHold, knot: Vec3, count: number): Vec3[] {
  const last = count - 1;
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return { ...knot };
    if (index === last) return { ...hold.hand };
    const t = index / last;
    const point = between(knot, hold.hand, t);
    return { ...point, y: point.y - SLED_ROPE_SAG_METRES * 4 * t * (1 - t) };
  });
}

/** `count` points along the V, pulled taut: from the left runner tip to the knot, and on to the right runner tip. */
export function sledBridlePoints(tips: RunnerTips, knot: Vec3, count: number): Vec3[] {
  const middle = (count - 1) / 2;
  return Array.from({ length: count }, (_, index) =>
    index <= middle ? between(tips.left, knot, index / middle) : between(knot, tips.right, (index - middle) / (count - 1 - middle)),
  );
}

export interface SledRope {
  readonly group: THREE.Group;
  /** Draws the rope from the runner tips `tips` to `hold`, or hides it when either is undefined. */
  show(hold: RopeHold | undefined, tips: RunnerTips | undefined): void;
  dispose(): void;
}

export function createSledRope(): SledRope {
  const material = new THREE.MeshStandardMaterial({ color: SLED_ROPE_COLOUR, roughness: 1 });
  const lead = createFishingLine(SLED_ROPE_RADIUS_METRES, material);
  const bridle = createFishingLine(SLED_ROPE_RADIUS_METRES, material);
  const group = new THREE.Group();
  group.visible = false;
  for (const line of [lead, bridle]) {
    line.mesh.castShadow = true;
    group.add(line.mesh);
  }
  const setPoints = (line: typeof lead, from: Vec3[]): void => {
    line.setPoints(from.map((point) => new THREE.Vector3(point.x, point.y, point.z)));
  };
  return {
    group,
    show(hold, tips) {
      group.visible = hold !== undefined && tips !== undefined;
      if (hold === undefined || tips === undefined) return;
      const knot = sledRopeKnot(hold, tips);
      setPoints(lead, sledRopePoints(hold, knot, lead.pointCount));
      setPoints(bridle, sledBridlePoints(tips, knot, bridle.pointCount));
    },
    dispose() {
      lead.dispose();
      bridle.dispose();
      material.dispose();
    },
  };
}
