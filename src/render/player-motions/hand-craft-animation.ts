// Runs the approved "hand-craft-animation" asset in asset-manifest.json. Posed in code by player-hand-craft-pose.ts, the
// player lashes a small bundle of sticks at waist height for a hand recipe, drawn by hand-craft-work.ts. The axe goes on
// the back. Its moment is the steady real-time clock, in seconds. When crafting stops, the player stands straight back
// up, with no easing.
import * as THREE from "three";
import { createHandCraftWork } from "../hand-craft-work";
import { handCraftPoseAt, handCraftWorkTurnAt } from "../player-hand-craft-pose";
import { createBodyWorkMotion, type PlayerMotion, type PlayerRig } from "./player-motion";

export function createHandCraftMotion(rig: PlayerRig): PlayerMotion<number> {
  const { group, leftArm, rightArm } = rig;
  const motion = createBodyWorkMotion<number>(rig, { startOf: (now) => now, poseAt: (now, since) => handCraftPoseAt(now - since) });
  // The bundle of sticks rides in the left hand while crafting by hand, with the cord running to the right hand.
  const handCraftWork = createHandCraftWork();
  handCraftWork.setVisible(false);
  group.add(handCraftWork.group);
  const leftWrist = new THREE.Vector3();
  const rightWrist = new THREE.Vector3();

  return {
    layer: "body",
    axeOnBack: true,
    get playing() {
      return motion.playing;
    },
    update: motion.update,
    pose: motion.pose,
    /** Shows the bundle of sticks in the left hand while crafting by hand, turned as the motion says, with the cord to the right hand. */
    placeProps() {
      const since = motion.since;
      const now = motion.at;
      handCraftWork.setVisible(since !== undefined);
      if (since === undefined || now === undefined) return;
      group.updateWorldMatrix(true, true);
      group.worldToLocal(leftArm.end.getWorldPosition(leftWrist));
      group.worldToLocal(rightArm.end.getWorldPosition(rightWrist));
      handCraftWork.place(leftWrist, rightWrist, handCraftWorkTurnAt(now - since));
    },
    dispose() {
      handCraftWork.dispose();
    },
  };
}
