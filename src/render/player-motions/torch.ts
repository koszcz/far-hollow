// Runs the approved "torch" asset in asset-manifest.json while the player holds it lit: built by torch-shape.ts, it rides
// upright in the left hand through every motion, with a small "fire-effect" flame on its head. scene-renderer.ts lights
// the ground from torchFlame(). It is an overlay, so it poses nothing and places its props after every other motion.
// The axe stays in the hand. Its moment is the steady real-time clock its flame burns at, in seconds.
import * as THREE from "three";
import { createFireMaker } from "../fire-effect";
import { createTorchFlame, createTorchShape, TORCH_FLAME_HEIGHT_METRES } from "../torch-shape";
import type { PlayerMotion, PlayerRig } from "./player-motion";

/**
 * The lit torch rides in the left hand, gripped this far up from its butt, in metres. It leans this far forward and this far
 * out from the body, in radians, so the flame stays clear of the head.
 */
const TORCH_GRIP_METRES = 0.14;
const TORCH_LEAN_FORWARD = 0.25;
const TORCH_LEAN_OUT = 0.2;
const TORCH_TILT = new THREE.Quaternion().setFromEuler(new THREE.Euler(TORCH_LEAN_FORWARD, 0, -TORCH_LEAN_OUT));

export interface TorchMotion extends PlayerMotion<number> {
  /**
   * Copies where the lit torch's flame is, as a world point, into `target.position`, and how high it is above the player's feet
   * into `target.aboveGroundMetres`. Returns false, and copies nothing, while no torch shows.
   */
  torchFlame(target: { readonly position: THREE.Vector3; aboveGroundMetres: number }): boolean;
}

export function createTorchMotion(rig: PlayerRig): TorchMotion {
  const { group, leftArm } = rig;
  // The lit torch rides in the left hand, upright, placed from the wrist each time the player is posed.
  const torchShape = createTorchShape();
  const torchFireMaker = createFireMaker();
  const torchInHand = new THREE.Group();
  for (const part of torchShape.parts) torchInHand.add(new THREE.Mesh(part.geometry, part.material));
  const torchFire = createTorchFlame(torchFireMaker);
  torchInHand.add(torchFire.group);
  torchInHand.visible = false;
  group.add(torchInHand);
  /** When the lit torch shows, the steady clock time its flame burns at. Undefined while the player holds no lit torch. */
  let torchAt: number | undefined;
  /** Where the player's feet are in the world, worked out again each time torchFlame runs. */
  const feet = new THREE.Vector3();
  const torchHand = new THREE.Vector3();
  const torchUp = new THREE.Vector3();

  return {
    layer: "overlay",
    axeOnBack: false,
    get playing() {
      return torchAt !== undefined;
    },
    update(moment) {
      torchAt = moment;
      return undefined;
    },
    /** Shows the lit torch in the left hand, gripped near its butt and leaning a little forward and out, with its flame burning. */
    placeProps() {
      torchInHand.visible = torchAt !== undefined;
      if (torchAt === undefined) return;
      group.updateWorldMatrix(true, true);
      group.worldToLocal(leftArm.end.getWorldPosition(torchHand));
      torchInHand.quaternion.copy(TORCH_TILT);
      torchUp.set(0, 1, 0).applyQuaternion(TORCH_TILT);
      torchInHand.position.copy(torchHand).addScaledVector(torchUp, -TORCH_GRIP_METRES);
      torchFire.animate(torchAt, 1, 0.7);
    },
    torchFlame(target) {
      if (torchAt === undefined) return false;
      torchInHand.updateWorldMatrix(true, false);
      target.position.set(0, TORCH_FLAME_HEIGHT_METRES, 0);
      torchInHand.localToWorld(target.position);
      target.aboveGroundMetres = target.position.y - feet.setFromMatrixPosition(group.matrixWorld).y;
      return true;
    },
    dispose() {
      torchShape.dispose();
      torchFireMaker.dispose();
    },
  };
}
