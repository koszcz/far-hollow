// Runs the approved "debarking-animation" asset in asset-manifest.json. Posed in code by player-debark-pose.ts, the
// player bends over the log pulling a drawknife, and the axe goes on the back. Its moment is the steady real-time clock,
// in seconds.
import * as THREE from "three";
import { createDrawknife, DRAWKNIFE_GRIP } from "../pile-meshes";
import { DEBARK_ENTER_SECONDS, debarkPoseAt, DRAWKNIFE_IN_HAND_SCALE } from "../player-debark-pose";
import { createBodyWorkMotion, type PlayerMotion, type PlayerRig } from "./player-motion";

export function createDebarkingMotion(rig: PlayerRig): PlayerMotion<number> {
  const { group, leftArm, rightArm } = rig;
  const motion = createBodyWorkMotion<number>(rig, {
    startOf: (now) => now,
    poseAt: (now, since) => debarkPoseAt(now - since),
    leaveSeconds: DEBARK_ENTER_SECONDS,
  });
  // The drawknife rides between the hands while debarking, placed from the wrists each frame.
  const drawknife = createDrawknife();
  drawknife.group.visible = false;
  drawknife.group.scale.setScalar(DRAWKNIFE_IN_HAND_SCALE);
  group.add(drawknife.group);
  const leftWrist = new THREE.Vector3();
  const rightWrist = new THREE.Vector3();
  const knifeAcross = new THREE.Vector3();
  const knifeUp = new THREE.Vector3();
  const knifeForward = new THREE.Vector3();
  const knifeTurn = new THREE.Matrix4();

  return {
    layer: "body",
    axeOnBack: true,
    get playing() {
      return motion.playing;
    },
    update: motion.update,
    pose: motion.pose,
    /** Shows the drawknife while debarking, its handles in the two hands. */
    placeProps() {
      drawknife.group.visible = motion.since !== undefined;
      if (!drawknife.group.visible) return;
      group.updateWorldMatrix(true, true);
      group.worldToLocal(leftArm.end.getWorldPosition(leftWrist));
      group.worldToLocal(rightArm.end.getWorldPosition(rightWrist));
      // The blade runs level across the hands, beyond them, with the handles pointing back towards the player.
      knifeAcross.subVectors(rightWrist, leftWrist).normalize();
      knifeUp.set(0, 1, 0);
      knifeForward.crossVectors(knifeAcross, knifeUp).normalize();
      knifeUp.crossVectors(knifeForward, knifeAcross);
      knifeTurn.makeBasis(knifeAcross, knifeUp, knifeForward);
      drawknife.group.quaternion.setFromRotationMatrix(knifeTurn);
      // The grips sit at the wrists, so the middle of the blade lies out beyond them.
      drawknife.group.position
        .addVectors(leftWrist, rightWrist)
        .multiplyScalar(0.5)
        .addScaledVector(knifeForward, -DRAWKNIFE_GRIP.forward * DRAWKNIFE_IN_HAND_SCALE);
    },
    dispose() {
      drawknife.dispose();
    },
  };
}
