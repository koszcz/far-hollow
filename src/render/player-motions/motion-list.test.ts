import { describe, expect, it } from "bun:test";
import * as THREE from "three";
import type { LogShape } from "../log-shape";
import type { BuildBones, Limb } from "../player-build-pose";
import { createPlayerMotions, PLAYER_MOTIONS, type MotionId, type MotionMoment } from "./motion-list";
import type { PlayerMotion, PlayerRig } from "./player-motion";

/** A rig with a plain skeleton standing at the origin, enough to pose a motion and place its props. */
function testRig(): PlayerRig {
  const group = new THREE.Group();
  const bone = (parent: THREE.Object3D, x: number, y: number, z = 0) => {
    const made = new THREE.Object3D();
    made.position.set(x, y, z);
    parent.add(made);
    return made;
  };
  const hips = bone(group, 0, 0.9);
  const chest = bone(hips, 0, 0.3);
  const head = bone(chest, 0, 0.3);
  const limb = (parent: THREE.Object3D, side: 1 | -1, x: number, down: number): Limb => {
    const upper = bone(parent, x * side, 0);
    const lower = bone(upper, 0, -down);
    const end = bone(lower, 0, -down);
    return { upper, lower, end, side };
  };
  const leftArm = limb(chest, 1, 0.25, 0.25);
  const rightArm = limb(chest, -1, 0.25, 0.25);
  const bones: BuildBones = { hips, chest, head, legs: [limb(hips, 1, 0.1, 0.45), limb(hips, -1, 0.1, 0.45)], arms: [leftArm, rightArm] };
  const logGeometry = new THREE.BoxGeometry(0.3, 0.3, 2);
  logGeometry.computeBoundingBox();
  return {
    group,
    bones,
    leftArm,
    rightArm,
    logShape: { geometry: logGeometry } as unknown as LogShape,
    material: (color, extra = {}) => new THREE.MeshStandardMaterial({ color, ...extra }),
    applyPose: () => {},
    carrying: false,
    walkedMetres: undefined,
    bodyMoves: false,
  };
}

/** A moment for each motion, a little way into it. */
const MOMENTS: { readonly [Id in MotionId]: MotionMoment<Id> } = {
  "gather-stone-animation": 1,
};

describe("the player motions", () => {
  it("names every motion posed in code, in the order body motions win", () => {
    expect(Object.keys(PLAYER_MOTIONS)).toEqual(["gather-stone-animation"]);
  });

  it("puts the axe on the back for every motion", () => {
    const motions = createPlayerMotions(testRig());
    const onBack = Object.fromEntries(Object.entries(motions).map(([id, motion]) => [id, motion.axeOnBack]));
    expect(onBack).toEqual({ "gather-stone-animation": true });
  });

  it("plays from its first moment until it is given none, and has a pose unless it is an overlay", () => {
    const motions = createPlayerMotions(testRig());
    for (const id of Object.keys(PLAYER_MOTIONS) as MotionId[]) {
      const motion: PlayerMotion<unknown> = motions[id];
      expect(motion.playing).toBe(false);
      motion.update(MOMENTS[id], 0);
      expect(motion.playing).toBe(true);
      expect(motion.pose === undefined).toBe(motion.layer === "overlay");
      motion.pose?.();
      motion.placeProps();
      motion.update(undefined, 0);
      expect(motion.playing).toBe(false);
      motion.dispose();
    }
  });
});
