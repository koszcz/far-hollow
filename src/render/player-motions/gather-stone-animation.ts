// Runs the draft "gather-stone-animation" asset in asset-manifest.json. Posed in code by player-gather-stone-pose.ts, the
// player crouches at the water's edge and lifts a stone, drawn by stone-shape.ts, in both hands. The axe goes on the back.
// Its moment is the steady real-time clock, in seconds.
import * as THREE from "three";
import { GATHER_STONE_LEAVE_SECONDS, gatherStonePoseAt, holdsStoneAt } from "../player-gather-stone-pose";
import { createStoneGeometry } from "../stone-shape";
import { createBodyWorkMotion, type PlayerMotion, type PlayerRig } from "./player-motion";

/** How much bigger the stone is in the hands than in a pile. The player's head and beard are big for the body, so a true-size stone hides under them. */
const STONE_IN_HANDS_SCALE = 2;
/** How far below and ahead of the middle of the wrists the stone sits while the player lifts it, in metres, so the hands hold it rather than hide it. */
const STONE_BELOW_WRISTS_METRES = 0.06;
const STONE_AHEAD_OF_WRISTS_METRES = 0.08;

export function createGatherStoneMotion(rig: PlayerRig): PlayerMotion<number> {
  const { group, leftArm, rightArm } = rig;
  const motion = createBodyWorkMotion<number>(rig, {
    startOf: (now) => now,
    poseAt: (now, since) => gatherStonePoseAt(now - since),
    leaveSeconds: GATHER_STONE_LEAVE_SECONDS,
  });
  // The stone rides between the hands while the player lifts it, placed from the wrists each frame.
  const stoneGeometry = createStoneGeometry();
  // The stone's faces carry their own colours and normals, the same as stone in a pile.
  const stoneInHands = new THREE.Mesh(stoneGeometry, rig.material(0xffffff, { vertexColors: true, flatShading: false }));
  stoneInHands.castShadow = true;
  stoneInHands.scale.setScalar(STONE_IN_HANDS_SCALE);
  stoneInHands.visible = false;
  group.add(stoneInHands);
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
    /** Shows the stone between the hands while the player lifts it. */
    placeProps() {
      const since = motion.since;
      const now = motion.at;
      stoneInHands.visible = since !== undefined && now !== undefined && holdsStoneAt(now - since);
      if (!stoneInHands.visible) return;
      group.updateWorldMatrix(true, true);
      group.worldToLocal(leftArm.end.getWorldPosition(leftWrist));
      group.worldToLocal(rightArm.end.getWorldPosition(rightWrist));
      // The stone sits just below the middle of the wrists, held from either side.
      stoneInHands.position.addVectors(leftWrist, rightWrist).multiplyScalar(0.5);
      stoneInHands.position.y -= STONE_BELOW_WRISTS_METRES;
      stoneInHands.position.z += STONE_AHEAD_OF_WRISTS_METRES;
    },
    dispose() {
      stoneGeometry.dispose();
    },
  };
}
