// The showcase of the "debarking-animation".
import { DEBARK_SECONDS } from "../../../sim/debarking";
import { DEBARK_BITE_SHARE, DEBARK_ENTER_SECONDS, DEBARK_PULLED_SHARE, DEBARK_REACHED_SHARE, DEBARK_STROKE_SECONDS } from "../../player-debark-pose";
import type { Showcase } from "../types";

/** How long the player stands after debarking before the "debarking-animation" plays again, in seconds. */
const DEBARK_PLAY_REST_SECONDS = 1.2;

export const DEBARKING_ANIMATION_SHOWCASE: Showcase = {
  radius: 1.3,
  focus: { x: 0, y: 0.6, z: 0.3 },
  shots: [
    { label: "reaching out", share: DEBARK_REACHED_SHARE / 2 },
    { label: "blade bites the bark", share: DEBARK_BITE_SHARE },
    { label: "pulling", share: (DEBARK_BITE_SHARE + DEBARK_PULLED_SHARE) / 2 },
    { label: "lifting the blade", share: (DEBARK_PULLED_SHARE + 1) / 2 },
  ].map(({ label, share }) => ({ label, yaw: 50, pitch: 25, seconds: DEBARK_ENTER_SECONDS + share * DEBARK_STROKE_SECONDS })),
  build({ place, movePlayer }) {
    // The log lies along the way the player faces, so each stroke runs along its length, as a real one does.
    place(0, 0.55, { log: { heading: 0 } });
    movePlayer(0, 0, 0);
  },
  pose({ player }, shot) {
    // Start debarking afresh at time 0 for each view, so the view shows the stroke `shot.seconds` in.
    player.setDebarking(undefined);
    player.setDebarking(0);
    player.setDebarking(shot.seconds);
  },
  // The player debarks for as long as the game takes, stands up, rests, then starts again.
  play: {
    shot: { label: "debarking, then standing up", yaw: 30, pitch: 20, radius: 1.6 },
    pose({ player }, seconds) {
      const cycle = seconds % (DEBARK_SECONDS + DEBARK_PLAY_REST_SECONDS);
      player.setDebarking(cycle < DEBARK_SECONDS ? cycle : undefined);
      return undefined;
    },
  },
};
