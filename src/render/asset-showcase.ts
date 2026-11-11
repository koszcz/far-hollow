// Shows one asset from asset-manifest.json on its own, from four fixed views, so one screenshot reviews it.
// The dev server opens it at /?asset=<id>. It draws with the game's own mesh code on the real valley ground.
// Animations show four key moments instead of four angles. With &play in the address, an animation that supports it
// plays live in one full view instead, so the owner can judge its timing. &speed=0.25 slows it down.
import * as THREE from "three";
import { CAMPFIRE_FUEL_LIMIT_MINUTES } from "../sim/campfires";
import { CHOP_SECONDS } from "../sim/chopping";
import { createEntityStore, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { generateValley, terrainHeightAt, type Valley } from "../sim/valley";
import { WALK_SPEED_METRES_PER_SECOND } from "../sim/walking";
import { createBedrollMeshes } from "./bedroll-meshes";
import {
  BUILD_FADE_SHARE, BUILD_HOLD_SHARE, BUILD_SET_DOWN_SHARE, BUILD_STONES_SHARE, buildProgressAtStickStage, createCampfireMeshes,
  type CampfireMeshes,
} from "./campfire-meshes";
import { CAMPFIRE_BUILD_SECONDS } from "../sim/building";
import { createPotMaker, type PotLook, type PotMesh } from "./pot-shape";
import { daylightAt } from "./daylight";
import { createFirewoodGeometry, FIREWOOD_COLOUR } from "./firewood-shape";
import { createForageMeshes } from "./forage-meshes";
import { createForestMeshes, type ForestMeshes } from "./forest-meshes";
import { CHOP_RAISED_SHARE, CHOP_STRIKE_SHARE, CHOP_SWING_SHARE, CHOP_SWINGS_PER_SECOND, createPlayerMesh, SPLIT_STRIKES_PER_SECOND, STRIDE_METRES, type PlayerMesh } from "./player-mesh";
import { createGroundTexture, GROUND_TEXTURE_TILE_METRES } from "./ground-texture";
import { createRainEffect, type RainEffect } from "./rain-effect";
import { createSkyLighting } from "./sky-lighting";
import type { LogShape } from "./log-shape";
import type { StumpShape } from "./stump-model";
import type { BerryBushShape } from "./berry-bush-model";
import type { MushroomsShape } from "./mushrooms-model";
import { FALL_LANDS_SECONDS, FALL_SECONDS } from "./tree-fall";
import type { TreeShape } from "./tree-model";
import { createRiverMeshes, type RiverMeshes } from "./river-meshes";
import { createValleyMeshes } from "./valley-meshes";

/** Every showcase uses the same valley, so screenshots of one asset compare across sessions. */
const SHOWCASE_SEED = 42;
/** Props stand this far east of the river's middle, on the flat valley floor. */
const STAGE_FROM_RIVER_METRES = 25;
const FIELD_OF_VIEW_DEGREES = 40;
/** Midday, so colours show as they do in daylight. */
const NOON = 12;
const NIGHT = 22;
/** How long the felled tree lies still in the chop animation's live loop before it stands again, in seconds. */
const CHOP_PLAY_REST_SECONDS = 1.2;

/** One of the four views. Angles are in degrees. Yaw 0 looks at the front of the player, from +z. */
interface Shot {
  readonly label: string;
  readonly yaw: number;
  readonly pitch: number;
  /** Overrides the showcase's framing for this view. */
  readonly radius?: number;
  readonly focus?: Partial<Vec3>;
  readonly hour?: number;
  /** For animations: the moment shown, in seconds since the motion began. */
  readonly seconds?: number;
}

interface Stage {
  readonly store: EntityStore;
  readonly player: PlayerMesh;
  /** Adds an entity standing on the ground at this offset from the stage's middle, in metres. */
  readonly place: (x: number, z: number, entity: Entity) => Entity;
  /** Moves the player to this offset from the stage's middle and turns them to face `heading`, in radians. */
  readonly movePlayer: (x: number, z: number, heading: number) => void;
  /** Stands a pot on the ground at this offset from the stage's middle, in metres. It is not an entity. */
  readonly placePot: (x: number, z: number) => PotMesh;
  /**
   * Adds a shape that no entity draws yet, standing on the ground at this offset from the stage's middle.
   * `lift` raises it, in metres, and `heading` turns it about the vertical, in radians. The showcase disposes it.
   */
  readonly addProp: (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, z: number, lift?: number, heading?: number) => void;
}

interface Showcase {
  /** How far from the focus the camera keeps everything in view, in metres. */
  readonly radius: number;
  /** What the camera looks at, as an offset from the stage's middle, in metres. */
  readonly focus: Vec3;
  readonly shots: readonly Shot[];
  build(stage: Stage): void;
  /** Poses an animation for one view, before it draws. */
  pose?(stage: Stage, shot: Shot): void;
  /** Plays the animation live in one view. */
  readonly play?: {
    readonly shot: Shot;
    /** Poses the animation `seconds` after it began. Returns how far the camera moves to follow it, in metres. */
    pose(stage: Stage, seconds: number): Partial<Vec3> | undefined;
  };
}

/** How long the built campfire rests before the "campfire-build-animation" plays again, in seconds. */
const BUILD_PLAY_REST_SECONDS = 1.5;

const FOUR_ANGLES: readonly Shot[] = [
  { label: "front", yaw: 0, pitch: 12 },
  { label: "side", yaw: 90, pitch: 12 },
  { label: "back three-quarter", yaw: 215, pitch: 25 },
  { label: "from above", yaw: 40, pitch: 60 },
];

/** The pots standing on the ground in the "pot" showcase, with how each one looks. */
const showcasePots: { pot: PotMesh; look: PotLook }[] = [];

/** Shows each standing pot in the "pot" showcase as it should look `seconds` into its steam loop. */
function showPots(seconds: number): void {
  for (const { pot, look } of showcasePots) pot.show(look, seconds);
}

const SHOWCASES: Readonly<Record<string, Showcase>> = {
  // Framed so all three ground types show: river bank to the west, forest floor around a tree, and clearing between.
  terrain: { radius: 22, focus: { x: -5, y: 0, z: 4 }, shots: FOUR_ANGLES, build() {} },
  river: {
    radius: 16,
    focus: { x: -STAGE_FROM_RIVER_METRES, y: 0, z: 0 },
    shots: FOUR_ANGLES.map((shot) => ({ ...shot, pitch: shot.pitch + 15 })),
    build() {},
  },
  trees: {
    radius: 7,
    focus: { x: 0, y: 3, z: 0 },
    shots: FOUR_ANGLES,
    build({ place }) {
      for (const [x, z] of [[-4, 0], [0, -1], [4, 0.5]] as const) place(x, z, { tree: true });
    },
  },
  stumps: {
    radius: 1.6,
    focus: { x: 0, y: 0.25, z: 0 },
    shots: FOUR_ANGLES,
    build({ place }) {
      for (const [x, z] of [[-0.9, 0], [0.9, 0.2]] as const) place(x, z, { stump: true });
    },
  },
  sticks: {
    radius: 1.3,
    focus: { x: 0, y: 0.05, z: 0 },
    shots: FOUR_ANGLES,
    build({ place }) {
      for (const [x, z] of [[-0.6, 0], [0.5, -0.4], [0.3, 0.6]] as const) place(x, z, { stick: true });
    },
  },
  "berry-bush": {
    radius: 1.5,
    focus: { x: 0, y: 0.4, z: 0 },
    shots: FOUR_ANGLES,
    build({ place }) {
      // With berries on the left, foraged and growing back on the right.
      place(-0.8, 0, { forageSpot: { food: "berries" } });
      place(0.8, 0, { forageSpot: { food: "berries" }, regrowing: { minutesLeft: 60 } });
    },
  },
  mushrooms: {
    radius: 0.5,
    focus: { x: 0, y: 0.15, z: 0 },
    shots: FOUR_ANGLES,
    build({ place }) {
      place(0, 0, { forageSpot: { food: "mushroom" } });
    },
  },
  logs: {
    radius: 2.2,
    focus: { x: 0, y: 0.7, z: 0 },
    shots: FOUR_ANGLES,
    build({ place, player }) {
      place(-0.8, 0.8, { log: { heading: 0.3 } });
      place(0.9, 0.6, { log: { heading: 1.8 } });
      player.setCarryingLog(true);
    },
  },
  firewood: {
    radius: 0.9,
    focus: { x: 0, y: 0.12, z: 0 },
    shots: FOUR_ANGLES,
    // One piece alone, a small pile, and the log it is split from, for size and colour.
    build({ place, addProp }) {
      const geometry = createFirewoodGeometry();
      const material = new THREE.MeshStandardMaterial({ color: FIREWOOD_COLOUR, flatShading: true, vertexColors: true });
      addProp(geometry, material, -0.45, 0.25, 0, 0.5);
      // Two pieces side by side, bark to bark, with a third resting in the groove between them.
      addProp(geometry, material, 0.31, 0.1, 0, 0);
      addProp(geometry, material, 0.47, 0.1, 0, Math.PI);
      addProp(geometry, material, 0.39, 0.12, 0.07, 0.04);
      place(0, -0.75, { log: { heading: Math.PI / 2 } });
    },
  },
  player: { radius: 1.1, focus: { x: 0, y: 0.9, z: 0 }, shots: FOUR_ANGLES, build() {} },
  campfire: {
    radius: 1.1,
    focus: { x: 0, y: 0.3, z: 0 },
    shots: FOUR_ANGLES,
    build({ place }) {
      place(0, 0, { campfire: { lit: false, fuelMinutes: 0 } });
    },
  },
  bedroll: {
    radius: 1.3,
    focus: { x: 0, y: 0.1, z: 0 },
    shots: FOUR_ANGLES,
    build({ place }) {
      place(0, 0, { bedroll: true });
    },
  },
  "fire-effect": {
    radius: 2,
    focus: { x: 0, y: 0.5, z: 0 },
    shots: [
      { label: "day", yaw: 0, pitch: 15 },
      { label: "day, from above", yaw: 40, pitch: 55 },
      { label: "night", yaw: 0, pitch: 15, hour: NIGHT },
      { label: "night, warmth pool", yaw: 40, pitch: 55, radius: 7, hour: NIGHT },
    ],
    build({ place }) {
      place(0, 0, { campfire: { lit: true, fuelMinutes: CAMPFIRE_FUEL_LIMIT_MINUTES } });
    },
    // The flames, sparks, and smoke move all the time, so the fire burns live at dusk, when both light and glow show.
    play: {
      shot: { label: "burning at dusk", yaw: 20, pitch: 14, radius: 2.4, focus: { y: 0.8 }, hour: 20 },
      pose: () => undefined,
    },
  },
  pot: {
    radius: 0.5,
    focus: { x: 0, y: 0.15, z: 0 },
    shots: [
      { label: "empty", yaw: 20, pitch: 35, focus: { x: -0.5 } },
      { label: "full of water", yaw: 20, pitch: 35, focus: { x: 0 } },
      { label: "steaming", yaw: 20, pitch: 20, focus: { x: 0.5, y: 0.3 }, seconds: 1 },
      { label: "on a lit campfire", yaw: 20, pitch: 15, radius: 1, focus: { x: 0, y: 0.8, z: -2 }, seconds: 1 },
    ],
    build({ place, placePot }) {
      showcasePots.length = 0;
      showcasePots.push(
        { pot: placePot(-0.5, 0), look: "empty" },
        { pot: placePot(0, 0), look: "full" },
        { pot: placePot(0.5, 0), look: "steaming" },
      );
      place(0, -2, { campfire: { lit: true, fuelMinutes: CAMPFIRE_FUEL_LIMIT_MINUTES }, potOnFire: { water: "river", minutesBoiling: 0 } });
    },
    pose(_stage, shot) {
      showPots(shot.seconds ?? 0);
    },
    // The steam rises in a loop, so it plays live on the campfire at dusk.
    play: {
      shot: { label: "steaming on a lit campfire", yaw: 20, pitch: 12, radius: 1, focus: { x: 0, y: 0.85, z: -2 }, hour: 19 },
      pose(_stage, seconds) {
        showPots(seconds);
        return undefined;
      },
    },
  },
  // The HUD is drawn over these views by src/ui/hud-showcase.tsx, one game state per view, in this order.
  hud: {
    radius: 6,
    focus: { x: 0, y: 1, z: 0 },
    shots: [
      { label: "HUD: walking, day", yaw: 20, pitch: 35 },
      { label: "HUD: chopping, backpack full", yaw: -20, pitch: 35 },
      { label: "HUD: carrying a log at a campfire", yaw: 40, pitch: 35, hour: 18 },
      { label: "HUD: cold at night, paused, placing", yaw: 20, pitch: 35, hour: NIGHT },
    ],
    build({ place, movePlayer }) {
      for (const [x, z] of [[-6, -4], [0, -7], [6, -3], [-3, -9]] as const) place(x, z, { tree: true });
      place(1.5, -1, { campfire: { lit: true, fuelMinutes: CAMPFIRE_FUEL_LIMIT_MINUTES } });
      movePlayer(0, 0, 0);
    },
  },
  "sky-lighting": {
    radius: 9,
    focus: { x: 0, y: 2, z: 0 },
    shots: [
      { label: "dawn, 07:00", yaw: 250, pitch: 8, hour: 7 },
      { label: "midday, 12:00", yaw: 200, pitch: 20, hour: NOON },
      { label: "dusk, 19:00", yaw: 70, pitch: 8, hour: 19 },
      { label: "night, 23:00", yaw: 200, pitch: 8, hour: 23 },
    ],
    build({ place }) {
      for (const [x, z] of [[-5, -3], [0, -6], [5, -2], [-3, 4]] as const) place(x, z, { tree: true });
      place(2, 1, { log: { heading: 0.6 } });
      place(-2, 1.5, { campfire: { lit: true, fuelMinutes: CAMPFIRE_FUEL_LIMIT_MINUTES } });
    },
  },
  rain: {
    radius: 6,
    focus: { x: 0, y: 1.5, z: 0 },
    shots: [
      { label: "midday", yaw: 200, pitch: 10, hour: NOON, seconds: 0 },
      { label: "midday, from above", yaw: 40, pitch: 45, hour: NOON, seconds: 0.4 },
      { label: "dusk, by a campfire", yaw: 70, pitch: 10, hour: 19, seconds: 0.8 },
      { label: "night, by a campfire", yaw: 200, pitch: 10, hour: NIGHT, seconds: 1.2 },
    ],
    build({ place }) {
      place(0, 0, { rain: { falling: true, changeAtMinutes: Infinity, changes: 1 } });
      for (const [x, z] of [[-4, -3], [3, -5], [5, 1]] as const) place(x, z, { tree: true });
      place(-1.5, 1, { campfire: { lit: true, fuelMinutes: CAMPFIRE_FUEL_LIMIT_MINUTES } });
    },
    // Rain falls all the time, so it plays live in the afternoon.
    play: {
      shot: { label: "rain falling", yaw: 200, pitch: 10, hour: 15 },
      pose: () => undefined,
    },
  },
  "campfire-build-animation": {
    radius: 1.1,
    focus: { x: 0, y: 0.3, z: 0 },
    // Stones half placed, key moments while the third stick is laid, then the finished campfire.
    shots: [
      { label: "stones going down", progress: BUILD_STONES_SHARE / 2 },
      { label: "3rd stick above its place", progress: buildProgressAtStickStage(2 + BUILD_FADE_SHARE) },
      { label: "3rd stick set down", progress: buildProgressAtStickStage(2 + (BUILD_HOLD_SHARE + BUILD_SET_DOWN_SHARE) / 2) },
      { label: "built", progress: 1 },
    ].map(({ label, progress }) => ({ label, yaw: 30, pitch: 25, seconds: progress })),
    build({ place }) {
      place(0, 0, { blueprint: { piece: "campfire", progress: 0, sticksSpent: 0 } });
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
  "split-animation": {
    radius: 1.3,
    focus: { x: 0, y: 1, z: 0 },
    shots: [
      { label: "after the strike", phase: 0 },
      { label: "lifting", phase: 0.35 },
      { label: "axe overhead", phase: 0.7 },
      { label: "dropping", phase: 0.9 },
    ].map(({ label, phase }) => ({ label, yaw: 90, pitch: 10, seconds: phase / SPLIT_STRIKES_PER_SECOND })),
    build({ player }) {
      player.setCarryingLog(true);
    },
    pose({ player }, shot) {
      player.setSplitting(shot.seconds);
    },
  },
};

/** Every asset id the showcase can draw. */
export const SHOWCASE_ASSET_IDS: readonly string[] = Object.keys(SHOWCASES);

export interface AssetShowcase {
  /** The label of each view, in the order they fill the screen: top left, top right, bottom left, bottom right. */
  readonly labels: readonly string[];
  dispose(): void;
}

/** How to show an asset: four still views, or the animation playing live at `speed` times game speed. */
export interface ShowOptions {
  readonly play: boolean;
  readonly speed: number;
}

/**
 * Draws the asset once into a 2 by 2 grid on the canvas, or plays its animation live when `options.play` is set and the
 * asset can play. Returns undefined for an id with no showcase.
 */
export function showAsset(
  canvas: HTMLCanvasElement,
  id: string,
  treeShapes: readonly TreeShape[],
  stumpShape: StumpShape,
  logShape: LogShape,
  bushShape: BerryBushShape,
  mushroomsShape: MushroomsShape,
  options: ShowOptions = { play: false, speed: 1 },
): AssetShowcase | undefined {
  const showcase = SHOWCASES[id];
  if (showcase === undefined) return undefined;
  // The valley's ground and river are the subject only for "terrain" and "river". Everything else stands on flat ground
  // with the same painted texture, because the valley floor slopes and would tilt every view.
  const onValley = id === "terrain" || id === "river";
  const valley = generateValley(SHOWCASE_SEED);
  const middle = onValley ? stageMiddle(valley) : { x: 0, y: 0, z: 0 };
  const groundAt = (x: number, z: number): number => (onValley ? terrainHeightAt(valley.terrain, x, z) : 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  // A page still loading can report a zero-size canvas. The window's size is the canvas's size then.
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height, false);
  renderer.setScissorTest(true);
  const scene = new THREE.Scene();
  const sky = createSkyLighting(scene, renderer);
  const ground = onValley ? createValleyMeshes(valley) : createFlatGround();
  scene.add(ground.group);
  const river: RiverMeshes | undefined = onValley ? createRiverMeshes(valley) : undefined;
  if (river !== undefined) scene.add(river.group);

  const store = createEntityStore();
  const player = createPlayerMesh(logShape);
  const at = (x: number, z: number): Vec3 => ({ x: middle.x + x, y: groundAt(middle.x + x, middle.z + z), z: middle.z + z });
  const showsPlayer = ["player", "logs", "walk-animation", "chop-animation", "split-animation", "sky-lighting", "hud"].includes(id);
  // The forest's falling trees tip away from the player entity, so it is always there, even when not drawn.
  const playerEntity = store.add({ player: true, position: at(0, 0), previousPosition: at(0, 0) });
  player.group.visible = showsPlayer;
  scene.add(player.group);
  const potMaker = createPotMaker();
  const props = new THREE.Group();
  const propResources = new Set<{ dispose(): void }>();
  scene.add(props);
  const stage: Stage = {
    store,
    player,
    place(x, z, entity) {
      return store.add({ ...entity, position: at(x, z) });
    },
    addProp(geometry, material, x, z, lift = 0, heading = 0) {
      const mesh = new THREE.Mesh(geometry, material);
      const spot = at(x, z);
      mesh.position.set(spot.x, spot.y + lift, spot.z);
      mesh.rotation.y = heading;
      props.add(mesh);
      propResources.add(geometry).add(material);
    },
    movePlayer(x, z, heading) {
      const spot = at(x, z);
      playerEntity.position = spot;
      playerEntity.previousPosition = { ...spot };
      player.group.position.set(spot.x, spot.y, spot.z);
      player.setHeading(heading);
    },
    placePot(x, z) {
      const pot = potMaker.make();
      const spot = at(x, z);
      pot.group.position.set(spot.x, spot.y, spot.z);
      scene.add(pot.group);
      return pot;
    },
  };
  stage.movePlayer(0, 0, 0);
  showcase.build(stage);

  const forest: ForestMeshes = createForestMeshes(store, treeShapes, stumpShape, logShape);
  const campfires: CampfireMeshes = createCampfireMeshes(store);
  const forage = createForageMeshes(store, bushShape, mushroomsShape);
  forage.update();
  const bedrolls = createBedrollMeshes(store);
  // Rain shows only where the stage has rain falling.
  const rain: RainEffect = createRainEffect(store, groundAt);
  scene.add(forest.group, campfires.group, forage.group, bedrolls.group, rain.group);
  sky.addShadowReceivers(ground.group);
  sky.addShadowCasters(forest.group, campfires.group, forage.group, bedrolls.group, player.group, props);

  const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW_DEGREES, width / height, 0.05, 4000);
  /** Draws one view into a rectangle of the canvas, counted in pixels from the bottom left. */
  const drawView = (shot: Shot, seconds: number, follow: Partial<Vec3>, view: { left: number; bottom: number; width: number; height: number }): void => {
    // A tree felled by this pose starts falling at 0 seconds, so the view shows it `seconds` into the fall.
    // Stills restart every fall at time 0. A live loop lets each fall start when its tree is felled.
    if (!(options.play && showcase.play !== undefined)) forest.update(0);
    forest.update(seconds);
    campfires.update(seconds);
    bedrolls.update();
    river?.update(seconds, daylightAt(shot.hour ?? NOON));
    const focusOffset = { ...showcase.focus, ...shot.focus };
    const x = middle.x + focusOffset.x + (follow.x ?? 0);
    const z = middle.z + focusOffset.z + (follow.z ?? 0);
    const focus = new THREE.Vector3(x, groundAt(x, z) + focusOffset.y + (follow.y ?? 0), z);
    rain.update(seconds, focus, daylightAt(shot.hour ?? NOON));
    const distance = (shot.radius ?? showcase.radius) / Math.sin(THREE.MathUtils.degToRad(FIELD_OF_VIEW_DEGREES / 2));
    sky.update(shot.hour ?? NOON, { focus, distance });
    const yaw = THREE.MathUtils.degToRad(shot.yaw);
    const pitch = THREE.MathUtils.degToRad(shot.pitch);
    camera.position.set(
      focus.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      focus.y + Math.sin(pitch) * distance,
      focus.z + Math.cos(yaw) * Math.cos(pitch) * distance,
    );
    camera.aspect = view.width / view.height;
    camera.updateProjectionMatrix();
    camera.lookAt(focus);
    renderer.setViewport(view.left, view.bottom, view.width, view.height);
    renderer.setScissor(view.left, view.bottom, view.width, view.height);
    renderer.render(scene, camera);
  };

  let frame: number | undefined;
  const play = options.play ? showcase.play : undefined;
  if (play !== undefined) {
    const startMs = performance.now();
    const drawFrame = (nowMs: number): void => {
      const seconds = ((nowMs - startMs) / 1000) * options.speed;
      const follow = play.pose(stage, seconds) ?? {};
      drawView(play.shot, seconds, follow, { left: 0, bottom: 0, width, height });
      frame = requestAnimationFrame(drawFrame);
    };
    frame = requestAnimationFrame(drawFrame);
  } else {
    const halfWidth = Math.floor(width / 2);
    const halfHeight = Math.floor(height / 2);
    showcase.shots.slice(0, 4).forEach((shot, index) => {
      showcase.pose?.(stage, shot);
      // three.js counts viewport rows from the bottom, so the first view takes the top left.
      drawView(shot, shot.seconds ?? 0, {}, { left: (index % 2) * halfWidth, bottom: index < 2 ? height - halfHeight : 0, width: halfWidth, height: halfHeight });
    });
  }

  return {
    labels: play !== undefined ? [`${play.shot.label}, ${options.speed}× speed`] : showcase.shots.slice(0, 4).map((shot) => shot.label),
    dispose() {
      if (frame !== undefined) cancelAnimationFrame(frame);
      forest.dispose();
      campfires.dispose();
      potMaker.dispose();
      forage.dispose();
      bedrolls.dispose();
      rain.dispose();
      player.dispose();
      for (const resource of propResources) resource.dispose();
      ground.dispose();
      river?.dispose();
      sky.dispose();
      renderer.dispose();
    },
  };
}

/** A spot on the flat valley floor beside the middle of the river, with its ground height. */
function stageMiddle(valley: Valley): Vec3 {
  const river = valley.river.path[Math.floor(valley.river.path.length / 2)] ?? { x: 0, z: 0 };
  const x = river.x + STAGE_FROM_RIVER_METRES;
  return { x, y: terrainHeightAt(valley.terrain, x, river.z), z: river.z };
}

/** How wide the flat ground under a prop is, in metres. Wide enough to reach the horizon in every view. */
const FLAT_GROUND_METRES = 400;

/** Flat ground with the valley's painted texture, at y = 0. */
function createFlatGround(): { group: THREE.Group; dispose(): void } {
  const geometry = new THREE.PlaneGeometry(FLAT_GROUND_METRES, FLAT_GROUND_METRES).rotateX(-Math.PI / 2);
  const texture = createGroundTexture();
  texture.repeat.set(FLAT_GROUND_METRES / GROUND_TEXTURE_TILE_METRES, FLAT_GROUND_METRES / GROUND_TEXTURE_TILE_METRES);
  const material = new THREE.MeshStandardMaterial({ map: texture, flatShading: true });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, material));
  return {
    group,
    dispose() {
      geometry.dispose();
      texture.dispose();
      material.dispose();
    },
  };
}
