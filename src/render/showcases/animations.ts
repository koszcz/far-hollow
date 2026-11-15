// Showcases for player and world animations. Each one plays live with &play. The registry is src/render/showcases/index.ts.
import * as THREE from "three";
import { chopSecondsForTreeSize, treeSizeAt } from "../../sim/tree-size";
import { PLANKS_CRAFT_SECONDS } from "../../sim/crafting";
import { DEBARK_SECONDS } from "../../sim/debarking";
import { WALK_SPEED_METRES_PER_SECOND } from "../../sim/walking";
import { HAND_AT_SECONDS, REACH_SECONDS } from "../../sim/hand-reach";
import { BUILD_STONES_SHARE, buildProgressAtStickStage } from "../campfire-meshes";
import { BUILD_FADE_SHARE, BUILD_HOLD_SHARE, BUILD_SET_DOWN_SHARE } from "../structure-look";
import { CAMPFIRE_BUILD_SECONDS } from "../../sim/structures";
import { FOUNDATION_DECK_LIFT_METRES } from "../../sim/foundations";
import { DEBARK_BITE_SHARE, DEBARK_ENTER_SECONDS, DEBARK_PULLED_SHARE, DEBARK_REACHED_SHARE, DEBARK_STROKE_SECONDS } from "../player-debark-pose";
import { CROUCH_CYCLE_SECONDS, CROUCH_HOLD_SHARE, CROUCH_PRESSED_SHARE, CROUCH_REACHED_SHARE, CROUCH_SETTLED_SHARE } from "../player-build-pose";
import { CHOP_RAISED_SHARE, CHOP_STRIKE_SHARE, CHOP_SWING_SHARE, CHOP_SWINGS_PER_SECOND, SPLIT_STRIKES_PER_SECOND, STRIDE_METRES } from "../player-mesh";
import { FALL_LANDS_SECONDS, FALL_SECONDS } from "../tree-fall";
import { SAW_STANCE_METRES, SAW_STROKE_SECONDS } from "../player-saw-pose";
import { FISH_MIN_WAIT_MINUTES } from "../../sim/fishing";
import { REAL_MS_PER_GAME_MINUTE } from "../../sim/clock";
import {
  FISH_CAST_SECONDS,
  FISH_HOLD_SHARE,
  FISH_LIFTED_SHARE,
  FISH_REEL_SECONDS,
  FISH_STRUCK_SHARE,
  FISH_SWUNG_BACK_SHARE,
  FISH_WHIPPED_SHARE,
} from "../player-fish-pose";
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
} from "../sit-animation";
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

/** How long the player stands between reaches in the "pick-up-animation" live loop, in seconds. */
const REACH_PLAY_REST_SECONDS = 0.8;
/** How far in front of the player's feet the stick lies in the pick-up-animation showcase, in metres. */
const REACH_SHOWCASE_METRES = 0.45;

/** How long the player stands after sawing before the "sawing-animation" plays again, in seconds. */
const SAW_PLAY_REST_SECONDS = 1.2;

/**
 * How long each wait for a fish lasts in the "fishing-animation" showcase, in seconds: the shortest wait in the game.
 * The player casts this many times, then lowers the rod and rests before it plays again.
 */
const FISH_PLAY_WAIT_SECONDS = (FISH_MIN_WAIT_MINUTES * REAL_MS_PER_GAME_MINUTE) / 1000;
const FISH_PLAY_CASTS = 2;
const FISH_PLAY_REST_SECONDS = 1.5;
/** Where the line lands in the "fishing-animation" showcase, in front of the player's feet, in metres. */
const FISH_SHOWCASE_FLOAT_METRES = 3.5;
/** A flat stand-in for the water in the "fishing-animation" showcase, which stands on flat ground away from the river. */
const FISH_SHOWCASE_POOL = { from: 2.2, to: 6.5, width: 5, lift: 0.01, colour: 0x3f8f9c };

/** Fishing as the "fishing-animation" showcase shows it, `sinceCast` seconds into a cast that waits FISH_PLAY_WAIT_SECONDS. */
function fishingAt(nowSeconds: number, sinceCast: number) {
  return {
    nowSeconds,
    sinceCast,
    toBite: Math.max(0, FISH_PLAY_WAIT_SECONDS - sinceCast),
    floatForward: FISH_SHOWCASE_FLOAT_METRES,
    floatHeight: FISH_SHOWCASE_POOL.lift,
  };
}

/** How long the felled tree lies still in the chop animation's live loop before it stands again, in seconds. */
const CHOP_PLAY_REST_SECONDS = 1.2;
/** How long the game takes to chop the showcase's tree, which stands at the middle of the scene. */
const SHOWCASE_CHOP_SECONDS = chopSecondsForTreeSize(treeSizeAt(0, 0));

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
        const cycle = seconds % (SHOWCASE_CHOP_SECONDS + FALL_SECONDS + CHOP_PLAY_REST_SECONDS);
        const tree = store.with("position").where((entity) => entity.player === undefined).first;
        if (tree === undefined) return undefined;
        const chopping = cycle < SHOWCASE_CHOP_SECONDS;
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
  "pick-up-animation": {
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
  "sit-animation": {
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
  "sawing-animation": {
    radius: 1.4,
    focus: { x: 0, y: 0.85, z: -0.25 },
    // Each view is a moment of one cut through the log, which takes as long as the game takes to cut planks.
    // Whole strokes are pulled back and half strokes pushed away. The blade sinks lower in each later view.
    shots: [
      { label: "pulled back, cut starting, side on", seconds: 1, yaw: 270, pitch: 0 },
      { label: "pushed away, cut starting", seconds: 1.5 },
      { label: "pushed away, from above", seconds: 4.5, yaw: 270, pitch: 85 },
      { label: "pulled back, cut nearly through", seconds: 7, yaw: 240 },
    ].map(({ label, seconds, yaw = 290, pitch = 10 }) => ({ label, yaw, pitch, seconds: seconds * SAW_STROKE_SECONDS })),
    build({ store, place, movePlayer }) {
      // A sawhorse with its beam along x, a debarked log beside it, and the player cutting planks there.
      const sawhorse = place(0, 0, { workStation: "sawhorse", facing: { turns: 0 } });
      place(0, 1.2, { debarkedLog: { heading: Math.PI / 2 } });
      const player = store.with("player").first;
      const stationId = store.id(sawhorse);
      if (player !== undefined && stationId !== undefined) store.addComponent(player, "craftTask", { recipe: "planks", secondsDone: 1, stationId });
      movePlayer(0, -SAW_STANCE_METRES, 0);
    },
    pose({ player }, shot) {
      // Start sawing afresh at time 0 for each view, so the view shows the cut `shot.seconds` in.
      const seconds = shot.seconds ?? 0;
      player.setSawing(undefined);
      player.setSawing({ nowSeconds: 0, progress: 0 });
      player.setSawing({ nowSeconds: seconds, progress: seconds / PLANKS_CRAFT_SECONDS });
    },
    // The player saws through the log for as long as the game takes, stands up, rests, then starts again.
    play: {
      shot: { label: "sawing through the log, then standing up", yaw: 250, pitch: 18, radius: 1.8 },
      pose({ player }, seconds) {
        const cycle = seconds % (PLANKS_CRAFT_SECONDS + SAW_PLAY_REST_SECONDS);
        player.setSawing(cycle < PLANKS_CRAFT_SECONDS ? { nowSeconds: cycle, progress: cycle / PLANKS_CRAFT_SECONDS } : undefined);
        return undefined;
      },
    },
  },
  // The approved "fishing-animation": the player casts the approved "fishing-rod" out over a stand-in pool, waits, and lands a raw fish.
  "fishing-animation": {
    radius: 2.6,
    focus: { x: 0, y: 1, z: 1.4 },
    shots: [
      { label: "rod swung back", seconds: ((FISH_SWUNG_BACK_SHARE + FISH_HOLD_SHARE) / 2) * FISH_CAST_SECONDS },
      { label: "line rolling out", seconds: ((FISH_WHIPPED_SHARE + 1) / 2) * FISH_CAST_SECONDS },
      { label: "hook set, rod bent", seconds: FISH_PLAY_WAIT_SECONDS - FISH_REEL_SECONDS * (1 - FISH_STRUCK_SHARE) },
      { label: "fish swinging in", seconds: FISH_PLAY_WAIT_SECONDS - FISH_REEL_SECONDS * (1 - (FISH_LIFTED_SHARE + 0.1)) },
    ].map(({ label, seconds }) => ({ label, yaw: -55, pitch: 12, seconds })),
    build({ addProp, movePlayer }) {
      const pool = FISH_SHOWCASE_POOL;
      const water = new THREE.PlaneGeometry(pool.width, pool.to - pool.from).rotateX(-Math.PI / 2);
      addProp(water, new THREE.MeshStandardMaterial({ color: pool.colour, roughness: 0.3 }), 0, (pool.from + pool.to) / 2, pool.lift);
      movePlayer(0, 0, 0);
    },
    pose({ player }, shot) {
      // Start fishing afresh for each view, with the rod already lifted, so the view shows the cast `shot.seconds` in.
      const seconds = shot.seconds ?? 0;
      player.setFishing(undefined);
      player.setFishing(fishingAt(0, seconds));
      player.setFishing(fishingAt(10, seconds));
    },
    // The player casts and catches a fish twice, at the shortest wait the game has, lowers the rod, rests, then starts again.
    play: {
      shot: { label: "casting, waiting, and reeling in", yaw: -55, pitch: 12 },
      pose({ player }, seconds) {
        const fishing = FISH_PLAY_WAIT_SECONDS * FISH_PLAY_CASTS;
        const cycle = seconds % (fishing + FISH_PLAY_REST_SECONDS);
        player.setFishing(cycle < fishing ? fishingAt(cycle, cycle % FISH_PLAY_WAIT_SECONDS) : undefined);
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
