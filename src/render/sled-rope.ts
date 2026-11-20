// Builds the "sled-rope" asset in asset-manifest.json: the short rope the player pulls a sled by. It runs from the hand,
// up over the shoulder, and down behind the player to the loop at the front of the sled's tow rope, sagging a little.
// It shows only while the player drags a sled. sled-meshes.ts draws it from where player-mesh.ts says the hand and the
// shoulder are. It is a draft built in code.
import * as THREE from "three";
import type { Vec3 } from "../sim/entities";
import { createFishingLine } from "./fishing-tackle";

/** How far the middle of the rope between the shoulder and the sled hangs below a straight line, in metres. */
export const SLED_ROPE_SAG_METRES = 0.06;
/** The rope's thickness, as a radius in metres: the same as the sled's tow rope. */
const SLED_ROPE_RADIUS_METRES = 0.011;
/** The rope's colour: the same as the sled's tow rope. */
const SLED_ROPE_COLOUR = 0x3d3128;
/** How many of the rope's points run from the hand to the shoulder, and from the shoulder down the back. The rest hang to the sled. */
const POINTS_TO_SHOULDER = 2;
const POINTS_DOWN_BACK = 3;

/**
 * Where the player holds the rope, as world points: the hand grips it, the rope runs back over the top of the shoulder,
 * and down to `back`, clear of the backpack. From there it hangs to the sled.
 */
export interface RopeHold {
  readonly hand: Vec3;
  readonly shoulder: Vec3;
  readonly back: Vec3;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const between = (from: Vec3, to: Vec3, t: number): Vec3 => ({ x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t), z: lerp(from.z, to.z, t) });
/** `count` points from `from` up to, but not including, `to`, evenly spaced. */
const straight = (from: Vec3, to: Vec3, count: number): Vec3[] => Array.from({ length: count }, (_, index) => between(from, to, index / count));

/**
 * `count` points along the rope, from the hand, over the shoulder and down the back, to the tow loop `loop`.
 * All are world points. The rope is taut against the body, and sags a little between the back and the sled.
 */
export function sledRopePoints(hold: RopeHold, loop: Vec3, count: number): Vec3[] {
  const last = count - POINTS_TO_SHOULDER - POINTS_DOWN_BACK - 1;
  const hanging = Array.from({ length: last + 1 }, (_, index) => {
    if (index === last) return { ...loop };
    if (index === 0) return { ...hold.back };
    const t = index / last;
    const point = between(hold.back, loop, t);
    return { ...point, y: point.y - SLED_ROPE_SAG_METRES * 4 * t * (1 - t) };
  });
  return [...straight(hold.hand, hold.shoulder, POINTS_TO_SHOULDER), ...straight(hold.shoulder, hold.back, POINTS_DOWN_BACK), ...hanging];
}

export interface SledRope {
  readonly mesh: THREE.Mesh;
  /** Draws the rope from `hold` to the tow loop at `loop`, or hides it when either is undefined. */
  show(hold: RopeHold | undefined, loop: Vec3 | undefined): void;
  dispose(): void;
}

export function createSledRope(): SledRope {
  const material = new THREE.MeshStandardMaterial({ color: SLED_ROPE_COLOUR, roughness: 1 });
  const line = createFishingLine(SLED_ROPE_RADIUS_METRES, material);
  line.mesh.castShadow = true;
  line.mesh.visible = false;
  const points = Array.from({ length: line.pointCount }, () => new THREE.Vector3());
  return {
    mesh: line.mesh,
    show(hold, loop) {
      line.mesh.visible = hold !== undefined && loop !== undefined;
      if (hold === undefined || loop === undefined) return;
      sledRopePoints(hold, loop, line.pointCount).forEach((point, index) => points[index]?.set(point.x, point.y, point.z));
      line.setPoints(points);
    },
    dispose() {
      line.dispose();
      material.dispose();
    },
  };
}
