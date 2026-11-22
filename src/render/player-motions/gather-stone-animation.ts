// Runs the approved "gather-stone-animation" asset in asset-manifest.json. Posed in code by player-gather-stone-pose.ts, the
// player squats, lifts a stone, drawn by stone-shape.ts, in both hands, and heaves it over the shoulder into the
// backpack. The axe goes on the back.
// Its moment is the steady real-time clock, in seconds.
import * as THREE from "three";
import { GATHER_STONE_LEAVE_SECONDS, gatherStonePoseAt, holdsStoneAt, stoneInRightHandAt } from "../player-gather-stone-pose";
import { createStoneGeometry } from "../stone-shape";
import { createBodyWorkMotion, type PlayerMotion, type PlayerRig } from "./player-motion";

/** How much bigger the stone is in the hands than in a pile. The player's head and beard are big for the body, so a true-size stone hides under them. */
const STONE_IN_HANDS_SCALE = 2;
/**
 * How far below and ahead of the middle of the wrists the stone sits while the player lifts it, in metres, so the hands
 * hold it rather than hide it. Going over the shoulder it sits behind the right wrist instead, by the same distance.
 */
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
    /** Shows the stone between the hands from the grip until it drops into the backpack. */
    placeProps() {
      const since = motion.since;
      const now = motion.at;
      const seconds = since === undefined || now === undefined ? undefined : now - since;
      stoneInHands.visible = seconds !== undefined && holdsStoneAt(seconds);
      if (seconds === undefined || !stoneInHands.visible) return;
      group.updateWorldMatrix(true, true);
      group.worldToLocal(leftArm.end.getWorldPosition(leftWrist));
      group.worldToLocal(rightArm.end.getWorldPosition(rightWrist));
      // The stone sits just below the middle of the wrists, held from either side. As the right hand pushes it back over
      // the shoulder, it moves to sit just behind the right wrist.
      const rightHandOnly = stoneInRightHandAt(seconds);
      stoneInHands.position.addVectors(leftWrist, rightWrist).multiplyScalar(0.5).lerp(rightWrist, rightHandOnly);
      stoneInHands.position.y -= STONE_BELOW_WRISTS_METRES;
      stoneInHands.position.z += STONE_AHEAD_OF_WRISTS_METRES * (1 - 2 * rightHandOnly);
    },
    dispose() {
      stoneGeometry.dispose();
    },
  };
}
