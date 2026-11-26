// The showcase of the approved "bed" asset, with the player going to sleep in it.
import { setComponent } from "../../../sim/entities";
import { BUILD_FADE_SHARE } from "../../structure-look";
import { BED_MODEL_STAGES } from "../../bed-meshes";
import { BED_SLEEP_SECONDS, bedSleepSpotFrom } from "../../bed-sleep";
import { SLEEP_MORNING_AT, SLEEP_SECONDS, sleepDarknessAt } from "../../sleep-animation";
import type { Showcase, Stage } from "../types";

/** How long the player stands beside the bed after waking before the bed's sleep plays again, in seconds. */
const BED_PLAY_REST_SECONDS = 1.5;
/** The hour the player goes to sleep in the bed showcase, and the morning hour they wake at. */
const BED_PLAY_BEDTIME = 19;
const BED_PLAY_MORNING = 9;
/** Where the player stands beside the bed before stepping onto it, in metres from its middle, and which way they face. */
const BED_PLAY_FROM = { x: 0.3, z: 1, heading: Math.PI };
/** The bed in the showcase is turned a quarter, so it lies across the view. */
const BED_PLAY_TURNS = 1;

/** Poses the player going to sleep in the bed at the stage's middle, turned a quarter, `seconds` after they reached it. */
function poseBedSleeper({ player, movePlayer }: Stage, seconds: number): void {
  if (seconds >= BED_SLEEP_SECONDS) {
    player.setSleeping(undefined);
    movePlayer(BED_PLAY_FROM.x, BED_PLAY_FROM.z, BED_PLAY_FROM.heading);
    return;
  }
  const spot = bedSleepSpotFrom(BED_PLAY_FROM, { x: 0, z: 0 }, BED_PLAY_TURNS, seconds);
  movePlayer(spot.x, spot.z, spot.heading);
  player.group.position.y += spot.lift;
  player.setSleeping(Math.min(seconds, SLEEP_SECONDS));
}

// A blueprint holding 5 of its 8 planks, the head and foot boards being set down, the mattress going on, then the finished bed.
export const BED_SHOWCASE: Showcase = {
  radius: 2.6,
  focus: { x: 0, y: 0.35, z: 0 },
  shots: [
    { label: "blueprint, 5 of 8 planks", yaw: 35, pitch: 30, seconds: 0 },
    { label: "boards above their place", yaw: 35, pitch: 30, seconds: (2 + BUILD_FADE_SHARE) / BED_MODEL_STAGES },
    { label: "mattress above its place", yaw: 35, pitch: 30, seconds: (3 + BUILD_FADE_SHARE) / BED_MODEL_STAGES },
    { label: "built, from the foot", yaw: 0, pitch: 25, seconds: 1 },
    { label: "built, from above", yaw: 140, pitch: 55, seconds: 1 },
  ],
  build({ place, movePlayer }) {
    place(0, 0, { blueprint: { structure: "bed", progress: 0, materialsSpent: 0, delivered: { plank: 5 } }, facing: { turns: 0 } });
    movePlayer(BED_PLAY_FROM.x, BED_PLAY_FROM.z, BED_PLAY_FROM.heading);
  },
  pose({ store }, shot) {
    for (const entity of store.with("blueprint")) entity.blueprint.progress = shot.seconds ?? 0;
  },
  // The finished bed, turned a quarter. The player steps up onto it at night, lies down, morning comes, they get up and step back down.
  play: {
    shot: { label: "sleeping in the bed, then waking", yaw: 30, pitch: 30, radius: 3.2 },
    pose(stage, seconds) {
      for (const entity of [...stage.store.with("blueprint")]) {
        stage.store.removeComponent(entity, "blueprint");
        stage.store.addComponent(entity, "furniture", "bed");
        // The blueprint already faces the default way. addComponent never overwrites, so this turns it.
        setComponent(stage.store, entity, "facing", { turns: BED_PLAY_TURNS });
      }
      poseBedSleeper(stage, seconds % (BED_SLEEP_SECONDS + BED_PLAY_REST_SECONDS));
      return undefined;
    },
    look(seconds) {
      const cycle = seconds % (BED_SLEEP_SECONDS + BED_PLAY_REST_SECONDS);
      return { hour: cycle < SLEEP_MORNING_AT ? BED_PLAY_BEDTIME : BED_PLAY_MORNING, darkness: sleepDarknessAt(cycle) };
    },
  },
};
