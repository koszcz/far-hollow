// The showcase of the approved "hand-craft-animation": the player crafts the saw, a hand recipe, lashing a bundle of sticks at waist height.
import { SAW_CRAFT_SECONDS } from "../../../sim/crafting-recipes";
import {
  HAND_CRAFT_CYCLE_SECONDS,
  HAND_CRAFT_ENTER_SECONDS,
  HAND_CRAFT_HOLD_SHARE,
  HAND_CRAFT_TUGGED_SHARE,
  HAND_CRAFT_WOUND_SHARE,
} from "../../player-hand-craft-pose";
import type { Showcase } from "../types";

/** How long the player stands after crafting by hand before the "hand-craft-animation" plays again, in seconds. */
const HAND_CRAFT_PLAY_REST_SECONDS = 1.2;

export const HAND_CRAFT_ANIMATION_SHOWCASE: Showcase = {
  radius: 1.3,
  focus: { x: 0, y: 0.85, z: 0.2 },
  shots: [
    { label: "winding over the front", share: 0.2, yaw: 20, pitch: 10 },
    { label: "winding under, from the right", share: 0.275, yaw: 300, pitch: 10 },
    { label: "holding the cord on top, from the left", share: (HAND_CRAFT_WOUND_SHARE + HAND_CRAFT_HOLD_SHARE) / 2, yaw: 50, pitch: 20 },
    { label: "tugged tight", share: HAND_CRAFT_TUGGED_SHARE, yaw: 0, pitch: 10 },
  ].map(({ label, share, yaw, pitch }) => ({ label, yaw, pitch, seconds: HAND_CRAFT_ENTER_SECONDS + share * HAND_CRAFT_CYCLE_SECONDS })),
  build({ movePlayer }) {
    movePlayer(0, 0, 0);
  },
  pose({ player }, shot) {
    // Start crafting afresh at time 0 for each view, so the view shows the work `shot.seconds` in.
    player.setMotion("hand-craft-animation", undefined);
    player.setMotion("hand-craft-animation", 0);
    player.setMotion("hand-craft-animation", shot.seconds);
  },
  // The player crafts the saw for as long as the game takes, stands, rests, then starts again.
  play: {
    shot: { label: "crafting the saw, then standing", yaw: 30, pitch: 15, radius: 1.6 },
    pose({ player }, seconds) {
      const cycle = seconds % (SAW_CRAFT_SECONDS + HAND_CRAFT_PLAY_REST_SECONDS);
      player.setMotion("hand-craft-animation", cycle < SAW_CRAFT_SECONDS ? cycle : undefined);
      return undefined;
    },
  },
};
