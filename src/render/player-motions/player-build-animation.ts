// Runs the approved "player-build-animation" asset in asset-manifest.json. Posed in code by player-build-pose.ts, the
// player crouches over the clip to set pieces in place. The axe goes on the back. Its moment is the steady real-time
// clock, in seconds.
import { buildPoseAt } from "../player-build-pose";
import { createBodyWorkMotion, type PlayerMotion, type PlayerRig } from "./player-motion";

/** Seconds the player takes to stand up when building stops partway through a crouch. */
const BUILD_LEAVE_SECONDS = 0.3;

export function createBuildingMotion(rig: PlayerRig): PlayerMotion<number> {
  const motion = createBodyWorkMotion<number>(rig, {
    startOf: (now) => now,
    poseAt: (now, since) => buildPoseAt(now - since),
    leaveSeconds: BUILD_LEAVE_SECONDS,
  });
  return {
    layer: "body",
    axeOnBack: true,
    get playing() {
      return motion.playing;
    },
    update: motion.update,
    pose: motion.pose,
    placeProps() {},
    dispose() {},
  };
}
