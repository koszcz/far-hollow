// The showcase of the "sleep-animation".
import {
  SLEEP_DARK_AT,
  SLEEP_LAID_DOWN_AT,
  SLEEP_LIGHT_AT,
  SLEEP_MORNING_AT,
  SLEEP_SECONDS,
  SLEEP_STEP_ON_SECONDS,
  sleepDarknessAt,
  sleepSpotFrom,
} from "../../sleep-animation";
import type { Showcase, Stage } from "../types";

/** How long the player stands after waking before the "sleep-animation" plays again, in seconds. */
const SLEEP_PLAY_REST_SECONDS = 1.5;
/** The hour the player goes to sleep in the "sleep-animation" showcase, and the morning hour they wake at. */
const SLEEP_PLAY_BEDTIME = 19;
const SLEEP_PLAY_MORNING = 9;
/** Where the player stands beside the bedroll before stepping onto it, in metres from its middle, and which way they face. */
const SLEEP_PLAY_FROM = { x: 0.7, z: 0.5, heading: -Math.PI / 2 };

/** Poses the player going to sleep on the bedroll at the stage's middle, `seconds` after they reached it. */
function poseSleeper({ player, movePlayer }: Stage, seconds: number): void {
  if (seconds >= SLEEP_SECONDS) {
    player.setSleeping(undefined);
    movePlayer(SLEEP_PLAY_FROM.x, SLEEP_PLAY_FROM.z, SLEEP_PLAY_FROM.heading);
    return;
  }
  const spot = sleepSpotFrom(SLEEP_PLAY_FROM, { x: 0, z: 0 }, seconds);
  movePlayer(spot.x, spot.z, spot.heading);
  player.setSleeping(seconds);
}

export const SLEEP_ANIMATION_SHOWCASE: Showcase = {
  radius: 1.5,
  focus: { x: 0, y: 0.4, z: 0 },
  shots: [
    { label: "stepping onto the bedroll", seconds: SLEEP_STEP_ON_SECONDS * 0.6, hour: SLEEP_PLAY_BEDTIME },
    { label: "lying down", seconds: (SLEEP_STEP_ON_SECONDS + SLEEP_LAID_DOWN_AT) / 2, hour: SLEEP_PLAY_BEDTIME },
    { label: "asleep, morning comes", seconds: SLEEP_DARK_AT + 1.5, hour: SLEEP_PLAY_MORNING },
    { label: "standing up", seconds: (SLEEP_LIGHT_AT + SLEEP_SECONDS) / 2, hour: SLEEP_PLAY_MORNING },
  ].map((shot) => ({ ...shot, yaw: 60, pitch: 25 })),
  build({ place }) {
    place(0, 0, { bedroll: true });
  },
  pose(stage, shot) {
    poseSleeper(stage, shot.seconds ?? 0);
  },
  // The player steps onto the bedroll at night, lies down, the view dims, morning comes, and they get up. Then again.
  play: {
    shot: { label: "going to sleep, then waking", yaw: 60, pitch: 25, radius: 1.8 },
    pose(stage, seconds) {
      poseSleeper(stage, seconds % (SLEEP_SECONDS + SLEEP_PLAY_REST_SECONDS));
      return undefined;
    },
    look(seconds) {
      const cycle = seconds % (SLEEP_SECONDS + SLEEP_PLAY_REST_SECONDS);
      return { hour: cycle < SLEEP_MORNING_AT ? SLEEP_PLAY_BEDTIME : SLEEP_PLAY_MORNING, darkness: sleepDarknessAt(cycle) };
    },
  },
};
