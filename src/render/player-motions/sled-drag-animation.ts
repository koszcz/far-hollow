// Runs the approved "sled-drag-animation" asset in asset-manifest.json. Posed in code by player-sled-drag-pose.ts, the
// player leans forward over the walk or idle clip, with the left hand holding the rope low behind the hip. ropeHold()
// says where the approved "sled-rope" starts. It is the last body motion in the list, so it poses the body only when no
// other body motion plays. The axe stays in the hand. Its moment is `true` while the player drags a sled.
import * as THREE from "three";
import { sledDragPoseAt } from "../player-sled-drag-pose";
import type { RopeHold } from "../sled-rope";
import type { PlayerMotion, PlayerRig } from "./player-motion";

export interface SledDragMotion extends PlayerMotion<true> {
  /** Where the player holds the sled's rope, as world points, while dragging. Undefined while not dragging. */
  ropeHold(): RopeHold | undefined;
}

export function createSledDragMotion(rig: PlayerRig): SledDragMotion {
  const { group, leftArm } = rig;
  let dragging = false;
  return {
    layer: "body",
    axeOnBack: false,
    get playing() {
      return dragging;
    },
    update(moment) {
      const draggingNow = moment !== undefined;
      if (draggingNow === dragging) return undefined;
      dragging = draggingNow;
      // Letting go stands the player upright at once.
      return { kind: dragging ? "shown" : "hidden" };
    },
    pose() {
      if (!dragging) return;
      // Only the left hand takes the rope. The right arm keeps the clip's swing, or steadies a log on the shoulder.
      // The walk clip takes two steps to each stride, and each step heaves into the pull.
      const walked = rig.walkedMetres;
      const steps = walked === undefined ? undefined : (walked / rig.strideMetres) * 2;
      rig.applyPose(sledDragPoseAt(steps), [leftArm]);
    },
    placeProps() {},
    ropeHold() {
      if (!dragging) return undefined;
      group.updateWorldMatrix(true, true);
      const hand = leftArm.end.getWorldPosition(new THREE.Vector3());
      return { hand: { x: hand.x, y: hand.y, z: hand.z }, walking: rig.walkedMetres !== undefined };
    },
    dispose() {},
  };
}
