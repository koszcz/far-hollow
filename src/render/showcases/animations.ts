// Showcases for player and world animations. Each one plays live with &play. The registry is src/render/showcases/index.ts.
import { CHOP_SECONDS } from "../../sim/chopping";
import { DEBARK_SECONDS } from "../../sim/debarking";
import { WALK_SPEED_METRES_PER_SECOND } from "../../sim/walking";
import { BUILD_STONES_SHARE, buildProgressAtStickStage } from "../campfire-meshes";
import { BUILD_FADE_SHARE, BUILD_HOLD_SHARE, BUILD_SET_DOWN_SHARE } from "../structure-look";
import { CAMPFIRE_BUILD_SECONDS } from "../../sim/structures";
import { FOUNDATION_DECK_LIFT_METRES } from "../../sim/foundations";
import { DEBARK_BITE_SHARE, DEBARK_ENTER_SECONDS, DEBARK_PULLED_SHARE, DEBARK_REACHED_SHARE, DEBARK_STROKE_SECONDS } from "../player-debark-pose";
import { CROUCH_CYCLE_SECONDS, CROUCH_HOLD_SHARE, CROUCH_PRESSED_SHARE, CROUCH_REACHED_SHARE, CROUCH_SETTLED_SHARE } from "../player-build-pose";
import { CHOP_RAISED_SHARE, CHOP_STRIKE_SHARE, CHOP_SWING_SHARE, CHOP_SWINGS_PER_SECOND, SPLIT_STRIKES_PER_SECOND, STRIDE_METRES } from "../player-mesh";
import { FALL_LANDS_SECONDS, FALL_SECONDS } from "../tree-fall";
import {
  SLEEP_DARK_AT,
  SLEEP_LAID_DOWN_AT,
  SLEEP_LIGHT_AT,
  SLEEP_MORNING_AT,
  SLEEP_SECONDS,
  SLEEP_STEP_ON_SECONDS,
  sleepDarknessAt,
  sleepSpotFrom,
} from "../sleep-animation";
import { BUILD_PLAY_REST_SECONDS, type Showcase, type Stage } from "./types";

/** How long the player stands after debarking before the "debarking-animation" plays again, in seconds. */
const DEBARK_PLAY_REST_SECONDS = 1.2;

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

/** How many build cycles the "player-build-animation" plays before it stops, mid-press, to show the player standing up. */
const BUILD_PLAY_CYCLES = 2.5;

/** How long the felled tree lies still in the chop animation's live loop before it stands again, in seconds. */
const CHOP_PLAY_REST_SECONDS = 1.2;

export const ANIMATIONS_SHOWCASES: Readonly<Record<string, Showcase>> = {
  "campfire-build-animation": {
    radius: 1.3,
    focus: { x: 0, y: 0.3, z: 0 },
    // Stones half placed, key moments while the third stick is laid, then the finished campfire.
    shots: [
      { label: "stones going down", progress: BUILD_STONES_SHARE / 2 },
      { label: "3rd stick above its place", progress: buildProgressAtStickStage(2 + BUILD_FADE_SHARE) },
      { label: "3rd stick set down", progress: buildProgressAtStickStage(2 + (BUILD_HOLD_SHARE + BUILD_SET_DOWN_SHARE) / 2) },
      { label: "built", progress: 1 },
    ].map(({ label, progress }) => ({ label, yaw: 30, pitch: 25, seconds: progress })),
    build({ place }) {
      place(0, 0, { blueprint: { structure: "campfire", progress: 0, materialsSpent: 0, delivered: {} } });
    },
    pose({ store }, shot) {
      for (const entity of store.with("blueprint")) entity.blueprint.progress = shot.seconds ?? 0;
    },
    // The whole build plays at game speed, rests built, then starts again from an empty blueprint.
    play: {
      shot: { label: "building, then a rest", yaw: 30, pitch: 25 },
      pose({ store }, seconds) {
        const cycle = seconds % (CAMPFIRE_BUILD_SECONDS + BUILD_PLAY_REST_SECONDS);
        for (const entity of store.with("blueprint")) entity.blueprint.progress = Math.min(1, cycle / CAMPFIRE_BUILD_SECONDS);
        return undefined;
      },
    },
  },
  "chop-animation": {
    radius: 1.4,
    focus: { x: 0, y: 1, z: 1.2 },
    shots: [
      { label: "axe raised", yaw: 90, pitch: 12, seconds: (CHOP_RAISED_SHARE + CHOP_SWING_SHARE) / 2 / CHOP_SWINGS_PER_SECOND },
      { label: "strike", yaw: 110, pitch: 45, seconds: (CHOP_STRIKE_SHARE + 0.01) / CHOP_SWINGS_PER_SECOND },
      { label: "tree falling", yaw: 90, pitch: 15, radius: 6, focus: { y: 3, z: -2 }, seconds: FALL_LANDS_SECONDS * 0.75 },
      { label: "tree bounces", yaw: 90, pitch: 15, radius: 6, focus: { y: 1.5, z: -3 }, seconds: FALL_LANDS_SECONDS + 0.08 },
    ],
    build({ place, movePlayer }) {
      place(0, 0, { tree: true });
      // The player stands south of the tree, facing it.
      movePlayer(0, 1.2, Math.PI);
    },
    pose({ store, player }, shot) {
      const falling = shot.label.startsWith("tree");
      player.setChopping(falling ? undefined : shot.seconds);
      const tree = store.with("tree").first;
      if (falling && tree !== undefined) store.removeComponent(tree, "tree");
    },
    // The player chops for as long as the game takes, the tree falls, and after a pause the tree stands again.
    play: {
      shot: { label: "chopping, then the fall", yaw: 80, pitch: 12, radius: 4.6, focus: { y: 1.8, z: -2.8 } },
      pose({ store, player }, seconds) {
        const cycle = seconds % (CHOP_SECONDS + FALL_SECONDS + CHOP_PLAY_REST_SECONDS);
        const tree = store.with("position").where((entity) => entity.player === undefined).first;
        if (tree === undefined) return undefined;
        const chopping = cycle < CHOP_SECONDS;
        player.setChopping(chopping ? cycle : undefined);
        if (chopping && tree.tree === undefined) store.addComponent(tree, "tree", true);
        if (!chopping && tree.tree !== undefined) store.removeComponent(tree, "tree");
        return undefined;
      },
    },
  },
  "player-build-animation": {
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
      player.setBuilding(undefined);
      player.setBuilding(0);
      player.setBuilding(shot.seconds);
    },
    // The player builds for two and a half cycles, stops mid-press and stands up, rests, then builds again.
    play: {
      shot: { label: "building, stopping mid-press, then a rest", yaw: 70, pitch: 12 },
      pose({ player }, seconds) {
        const cycle = seconds % (BUILD_PLAY_CYCLES * CROUCH_CYCLE_SECONDS + BUILD_PLAY_REST_SECONDS);
        player.setBuilding(cycle < BUILD_PLAY_CYCLES * CROUCH_CYCLE_SECONDS ? cycle : undefined);
        return undefined;
      },
    },
  },
  "walk-animation": {
    radius: 1.2,
    focus: { x: 0, y: 0.9, z: 0 },
    // A quarter turn of the stride apart: each foot lands, then each leg passes the other.
    shots: [
      { label: "right leg passes", share: 0.25 },
      { label: "right foot lands", share: 0.5 },
      { label: "left leg passes", share: 0.75 },
      { label: "left foot lands", share: 1 },
    ].map(({ label, share }) => ({ label, yaw: 70, pitch: 8, seconds: (share * STRIDE_METRES) / WALK_SPEED_METRES_PER_SECOND })),
    build() {},
    pose({ player }, shot) {
      player.setWalking((shot.seconds ?? 0) * WALK_SPEED_METRES_PER_SECOND);
    },
    // The player walks forward at game speed over the textured ground, so foot slide shows. The camera keeps pace.
    play: {
      shot: { label: "walking", yaw: 70, pitch: 10, radius: 1.6 },
      pose({ player, movePlayer }, seconds) {
        const walked = (seconds * WALK_SPEED_METRES_PER_SECOND) % 60;
        movePlayer(0, walked, 0);
        player.setWalking(walked);
        return { z: walked };
      },
    },
  },
  "sleep-animation": {
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
  },
  "debarking-animation": {
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
  },
  "split-animation": {
    radius: 1.3,
    focus: { x: 0, y: 1, z: 0 },
    shots: [
      { label: "lifting", phase: 0.15 },
      { label: "axe overhead", phase: 0.35 },
      { label: "dropping", phase: 0.45 },
      { label: "strike", phase: 0.52 },
    ].map(({ label, phase }) => ({ label, yaw: 90, pitch: 10, seconds: phase / SPLIT_STRIKES_PER_SECOND })),
    build() {},
    pose({ player }, shot) {
      player.setSplitting(shot.seconds);
    },
  },
};
