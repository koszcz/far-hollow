// A stand-in for the rig the player mesh lends each motion, for tests. It has a plain skeleton and no clips.
import * as THREE from "three";
import type { LogShape } from "../log-shape";
import type { BuildBones, Limb } from "../player-build-pose";
import type { PlayerRig } from "./player-motion";

/** A rig with a plain skeleton standing at the origin, enough to pose a motion and place its props. */
export function createTestRig(overrides: Partial<PlayerRig> = {}): PlayerRig {
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
    strideMetres: 0.94,
    bodyMoves: false,
    ...overrides,
  };
}
