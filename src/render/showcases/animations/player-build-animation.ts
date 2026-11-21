// The showcase of the "player-build-animation".
import { FOUNDATION_DECK_LIFT_METRES } from "../../../sim/foundations";
import { CROUCH_CYCLE_SECONDS, CROUCH_HOLD_SHARE, CROUCH_PRESSED_SHARE, CROUCH_REACHED_SHARE, CROUCH_SETTLED_SHARE } from "../../player-build-pose";
import { BUILD_PLAY_REST_SECONDS, type Showcase } from "../types";

/** How many build cycles the "player-build-animation" plays before it stops, mid-press, to show the player standing up. */
const BUILD_PLAY_CYCLES = 2.5;

export const PLAYER_BUILD_ANIMATION_SHOWCASE: Showcase = {
  radius: 1.3,
  focus: { x: 0, y: 0.55, z: 0.35 },
  shots: [
    { label: "crouching", share: CROUCH_REACHED_SHARE / 2 },
    { label: "piece held above its place", share: CROUCH_HOLD_SHARE },
    { label: "pressed home", share: CROUCH_PRESSED_SHARE },
    { label: "standing up", share: (CROUCH_SETTLED_SHARE + 1) / 2 },
  ].map(({ label, share }) => ({ label, yaw: 90, pitch: 10, seconds: share * CROUCH_CYCLE_SECONDS })),
  build({ place, movePlayer }) {
    // A half-built foundation blueprint in front of the player, for size and context.
    const blueprint = place(0, 0.9, { blueprint: { structure: "foundation", progress: 0.5, materialsSpent: 2, delivered: { debarkedLog: 4 } } });
    if (blueprint.position !== undefined) blueprint.position.y += FOUNDATION_DECK_LIFT_METRES;
    movePlayer(0, 0, 0);
  },
  pose({ player }, shot) {
    // Start a fresh build at time 0 for each view, so the view shows the cycle `shot.seconds` in.
    player.setMotion("player-build-animation", undefined);
    player.setMotion("player-build-animation", 0);
    player.setMotion("player-build-animation", shot.seconds);
  },
  // The player builds for two and a half cycles, stops mid-press and stands up, rests, then builds again.
  play: {
    shot: { label: "building, stopping mid-press, then a rest", yaw: 70, pitch: 12 },
    pose({ player }, seconds) {
      const cycle = seconds % (BUILD_PLAY_CYCLES * CROUCH_CYCLE_SECONDS + BUILD_PLAY_REST_SECONDS);
      player.setMotion("player-build-animation", cycle < BUILD_PLAY_CYCLES * CROUCH_CYCLE_SECONDS ? cycle : undefined);
      return undefined;
    },
  },
};
