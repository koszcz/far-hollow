// The showcase of the "pick-up-animation".
import { HAND_AT_SECONDS, REACH_SECONDS } from "../../../sim/hand-reach";
import type { Showcase } from "../types";

/** How long the player stands between reaches in the "pick-up-animation" live loop, in seconds. */
const REACH_PLAY_REST_SECONDS = 0.8;
/** How far in front of the player's feet the stick lies in the pick-up-animation showcase, in metres. */
const REACH_SHOWCASE_METRES = 0.45;

export const PICK_UP_ANIMATION_SHOWCASE: Showcase = {
  radius: 1.3,
  focus: { x: 0, y: 0.7, z: 0.3 },
  // The reach to the ground, from the side: bending, the hand at the stick, and straightening. Then the reach at waist height.
  shots: [
    { label: "bending to the stick", seconds: HAND_AT_SECONDS / 2 },
    { label: "hand at the stick", seconds: HAND_AT_SECONDS },
    { label: "straightening", seconds: (HAND_AT_SECONDS + REACH_SECONDS) / 2 },
    { label: "hand out at waist height", seconds: HAND_AT_SECONDS },
  ].map(({ label, seconds }) => ({ label, yaw: -90, pitch: 10, seconds })),
  build({ place, movePlayer }) {
    // A stick on the ground in front of the player, where the hand reaches.
    place(0, REACH_SHOWCASE_METRES, { stick: true });
    movePlayer(0, 0, 0);
  },
  pose({ player }, shot) {
    player.setReaching({ height: shot.label.includes("waist") ? "waist" : "low", seconds: shot.seconds ?? 0, distance: REACH_SHOWCASE_METRES });
  },
  // The player reaches to the ground, stands a moment, reaches out at waist height, stands a moment, and again.
  play: {
    shot: { label: "to the ground, then at waist height", yaw: 70, pitch: 12 },
    pose({ player }, seconds) {
      const one = REACH_SECONDS + REACH_PLAY_REST_SECONDS;
      const cycle = seconds % (2 * one);
      const height = cycle < one ? "low" : "waist";
      const into = cycle % one;
      player.setReaching(into < REACH_SECONDS ? { height, seconds: into, distance: REACH_SHOWCASE_METRES } : undefined);
      return undefined;
    },
  },
};
