// Runs the approved "sawing-animation" asset in asset-manifest.json. Posed in code by player-saw-pose.ts, the player
// holds the log on the sawhorse with the left hand and saws it with the right. The saw is the approved "saw-model",
// built by saw-model.ts. The axe goes on the back.
import * as THREE from "three";
import { SAW_ENTER_SECONDS, SAW_IN_HAND_SCALE, sawPoseAt } from "../player-saw-pose";
import { createSaw } from "../saw-model";
import { createBodyWorkMotion, type PlayerMotion, type PlayerRig } from "./player-motion";

/** The moment sawing moves on to: the steady real-time clock, in seconds, and how far through the log the saw is, from 0 to 1. */
export interface Sawing {
  readonly nowSeconds: number;
  readonly progress: number;
}

export function createSawingMotion(rig: PlayerRig): PlayerMotion<Sawing> {
  const { group, rightArm, logShape } = rig;
  // Measure the log shape once, for how tall the log on the sawhorse is.
  const logShapeBox =
    logShape.geometry.boundingBox ?? new THREE.Box3().setFromBufferAttribute(logShape.geometry.getAttribute("position") as THREE.BufferAttribute);
  /** How tall a log lying on its side is, in metres. */
  const logThickness = logShapeBox.max.y - logShapeBox.min.y;
  const motion = createBodyWorkMotion<Sawing>(rig, {
    startOf: (at) => at.nowSeconds,
    poseAt: (at, since) => sawPoseAt(at.nowSeconds - since, at.progress, logThickness),
    leaveSeconds: SAW_ENTER_SECONDS,
  });
  // The saw rides in the right hand while sawing, placed from the wrist each frame.
  const saw = createSaw();
  saw.group.visible = false;
  saw.group.scale.setScalar(SAW_IN_HAND_SCALE);
  group.add(saw.group);

  return {
    layer: "body",
    axeOnBack: true,
    get playing() {
      return motion.playing;
    },
    update: motion.update,
    pose: motion.pose,
    /** Shows the saw while sawing, its grip in the right hand and its blade pointing the way the player faces. */
    placeProps() {
      saw.group.visible = motion.since !== undefined;
      if (!saw.group.visible) return;
      group.updateWorldMatrix(true, true);
      group.worldToLocal(rightArm.end.getWorldPosition(saw.group.position));
    },
    dispose() {
      saw.dispose();
    },
  };
}
