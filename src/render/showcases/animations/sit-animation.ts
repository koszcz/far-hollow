// The showcase of the "sit-animation". The player sits on the approved "stool".
import {
  SIT_SEATED_AT,
  SIT_STEP_ON_SECONDS,
  seatedSpot,
  sitBodyAt,
  sitSinkAt,
  sitSpotFrom,
  STAND_SECONDS,
  standBodyAt,
  standSinkAt,
  standSpotFrom,
} from "../../sit-animation";
import type { Showcase, Stage } from "../types";

/** Where the player stands beside the stool before sitting on it, in metres from its middle, and which way they face. */
const SIT_PLAY_FROM = { x: 0.9, z: 0.5, heading: -Math.PI / 2 };
/** How long the player rests on the stool in the "sit-animation" showcase before standing up, in seconds. */
const SIT_PLAY_REST_SECONDS = 2.5;
/** When the player begins to stand in the "sit-animation" showcase, and how long one round lasts, in seconds. */
const SIT_PLAY_STAND_AT = SIT_SEATED_AT + SIT_PLAY_REST_SECONDS;
const SIT_PLAY_CYCLE_SECONDS = SIT_PLAY_STAND_AT + STAND_SECONDS + 1;

/** Poses the player sitting on the stool at the stage's middle, facing the default way, `seconds` after they reached it, then standing up. */
function poseSitter({ player, movePlayer }: Stage, seconds: number): void {
  const seat = seatedSpot({ x: 0, z: 0 }, 0);
  if (seconds < SIT_PLAY_STAND_AT) {
    const spot = sitSpotFrom(SIT_PLAY_FROM, seat, seconds);
    movePlayer(spot.x, spot.z, spot.heading);
    player.group.position.y -= sitSinkAt(seconds);
    player.setSitting(sitBodyAt(seconds));
    return;
  }
  const rising = seconds - SIT_PLAY_STAND_AT;
  if (rising >= STAND_SECONDS) {
    player.setSitting(undefined);
    movePlayer(SIT_PLAY_FROM.x, SIT_PLAY_FROM.z, SIT_PLAY_FROM.heading);
    return;
  }
  const spot = standSpotFrom(seat, SIT_PLAY_FROM, rising, SIT_PLAY_STAND_AT);
  movePlayer(spot.x, spot.z, spot.heading);
  player.group.position.y -= standSinkAt(rising, SIT_PLAY_STAND_AT);
  player.setSitting(standBodyAt(rising, SIT_PLAY_STAND_AT));
}

export const SIT_ANIMATION_SHOWCASE: Showcase = {
  radius: 1.6,
  focus: { x: 0, y: 0.6, z: 0.1 },
  shots: [
    { label: "stepping up to the stool", seconds: SIT_STEP_ON_SECONDS * 0.6, yaw: 60, pitch: 20 },
    { label: "sitting down", seconds: (SIT_STEP_ON_SECONDS + SIT_SEATED_AT) / 2, yaw: 60, pitch: 20 },
    { label: "resting, front", seconds: SIT_SEATED_AT + 1, yaw: 30, pitch: 15 },
    { label: "resting, side", seconds: SIT_SEATED_AT + 1, yaw: 90, pitch: 15 },
  ],
  build({ place }) {
    place(0, 0, { furniture: "stool", facing: { turns: 0 } });
  },
  pose(stage, shot) {
    poseSitter(stage, shot.seconds ?? 0);
  },
  // The player steps up to the stool, sits down, rests, stands up, and steps back. Then again.
  play: {
    shot: { label: "sitting down, resting, standing up", yaw: 50, pitch: 20, radius: 1.9 },
    pose(stage, seconds) {
      poseSitter(stage, seconds % SIT_PLAY_CYCLE_SECONDS);
      return undefined;
    },
  },
};
