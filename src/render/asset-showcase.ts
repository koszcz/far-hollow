// Shows one asset from asset-manifest.json on its own, from four fixed views, so one screenshot reviews it.
// The dev server opens it at /?asset=<id>. It draws with the game's own mesh code on the real valley ground.
// Animations show four key moments instead of four angles.
import * as THREE from "three";
import { CAMPFIRE_FUEL_LIMIT_MINUTES } from "../sim/campfires";
import { createEntityStore, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { generateValley, terrainHeightAt, type Valley } from "../sim/valley";
import { createCampfireMeshes, type CampfireMeshes } from "./campfire-meshes";
import { daylightAt } from "./daylight";
import { createForestMeshes, type ForestMeshes } from "./forest-meshes";
import { CHOP_SWINGS_PER_SECOND, createPlayerMesh, SPLIT_STRIKES_PER_SECOND, type PlayerMesh } from "./player-mesh";
import { createGroundTexture, GROUND_TEXTURE_TILE_METRES } from "./ground-texture";
import { createSkyLighting } from "./sky-lighting";
import type { StumpShape } from "./stump-model";
import { FALL_SECONDS } from "./tree-fall";
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
}

const FOUR_ANGLES: readonly Shot[] = [
  { label: "front", yaw: 0, pitch: 12 },
  { label: "side", yaw: 90, pitch: 12 },
  { label: "back three-quarter", yaw: 215, pitch: 25 },
  { label: "from above", yaw: 40, pitch: 60 },
];

const SHOWCASES: Readonly<Record<string, Showcase>> = {
  terrain: { radius: 14, focus: { x: 0, y: 0, z: 0 }, shots: FOUR_ANGLES, build() {} },
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
  player: { radius: 1.1, focus: { x: 0, y: 0.9, z: 0 }, shots: FOUR_ANGLES, build() {} },
  campfire: {
    radius: 1.1,
    focus: { x: 0, y: 0.3, z: 0 },
    shots: FOUR_ANGLES,
    build({ place }) {
      place(0, 0, { campfire: { lit: false, fuelMinutes: 0 } });
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
  "campfire-build-animation": {
    radius: 1.1,
    focus: { x: 0, y: 0.3, z: 0 },
    shots: [0.25, 0.5, 0.75, 1].map((progress) => ({ label: `built ${progress * 100}%`, yaw: 30, pitch: 25, seconds: progress })),
    build({ place }) {
      place(0, 0, { blueprint: { piece: "campfire", progress: 0, sticksSpent: 0 } });
    },
    pose({ store }, shot) {
      for (const entity of store.with("blueprint")) entity.blueprint.progress = shot.seconds ?? 0;
    },
  },
  "chop-animation": {
    radius: 1.4,
    focus: { x: 0, y: 1, z: 1.2 },
    shots: [
      { label: "axe raised", yaw: 125, pitch: 10, seconds: 0.25 / CHOP_SWINGS_PER_SECOND },
      { label: "strike", yaw: 125, pitch: 10, seconds: 0.75 / CHOP_SWINGS_PER_SECOND },
      { label: "tree falling", yaw: 90, pitch: 15, radius: 6, focus: { y: 3, z: -2 }, seconds: FALL_SECONDS * 0.6 },
      { label: "tree landing", yaw: 90, pitch: 15, radius: 6, focus: { y: 1.5, z: -3 }, seconds: FALL_SECONDS * 0.95 },
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

/** Draws the asset once into a 2 by 2 grid on the canvas. Returns undefined for an id with no showcase. */
export function showAsset(canvas: HTMLCanvasElement, id: string, treeShapes: readonly TreeShape[], stumpShape: StumpShape): AssetShowcase | undefined {
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
  const player = createPlayerMesh();
  const at = (x: number, z: number): Vec3 => ({ x: middle.x + x, y: groundAt(middle.x + x, middle.z + z), z: middle.z + z });
  const showsPlayer = ["player", "logs", "chop-animation", "split-animation", "sky-lighting"].includes(id);
  // The forest's falling trees tip away from the player entity, so it is always there, even when not drawn.
  const playerEntity = store.add({ player: true, position: at(0, 0), previousPosition: at(0, 0) });
  player.group.visible = showsPlayer;
  scene.add(player.group);
  const stage: Stage = {
    store,
    player,
    place(x, z, entity) {
      return store.add({ ...entity, position: at(x, z) });
    },
    movePlayer(x, z, heading) {
      const spot = at(x, z);
      playerEntity.position = spot;
      playerEntity.previousPosition = { ...spot };
      player.group.position.set(spot.x, spot.y, spot.z);
      player.setHeading(heading);
    },
  };
  stage.movePlayer(0, 0, 0);
  showcase.build(stage);

  const forest: ForestMeshes = createForestMeshes(store, treeShapes, stumpShape);
  const campfires: CampfireMeshes = createCampfireMeshes(store);
  scene.add(forest.group, campfires.group);
  sky.addShadowReceivers(ground.group);
  sky.addShadowCasters(forest.group, campfires.group, player.group);

  const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW_DEGREES, width / height, 0.05, 4000);
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);
  showcase.shots.slice(0, 4).forEach((shot, index) => {
    showcase.pose?.(stage, shot);
    const seconds = shot.seconds ?? 0;
    // A tree felled by this pose starts falling at 0 seconds, so the view shows it `seconds` into the fall.
    forest.update(0);
    forest.update(seconds);
    campfires.update(seconds);
    river?.update(seconds, daylightAt(shot.hour ?? NOON));
    const focusOffset = { ...showcase.focus, ...shot.focus };
    const focus = new THREE.Vector3(middle.x + focusOffset.x, groundAt(middle.x + focusOffset.x, middle.z + focusOffset.z) + focusOffset.y, middle.z + focusOffset.z);
    const distance = (shot.radius ?? showcase.radius) / Math.sin(THREE.MathUtils.degToRad(FIELD_OF_VIEW_DEGREES / 2));
    sky.update(shot.hour ?? NOON, { focus, distance });
    const yaw = THREE.MathUtils.degToRad(shot.yaw);
    const pitch = THREE.MathUtils.degToRad(shot.pitch);
    camera.position.set(
      focus.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      focus.y + Math.sin(pitch) * distance,
      focus.z + Math.cos(yaw) * Math.cos(pitch) * distance,
    );
    camera.aspect = halfWidth / halfHeight;
    camera.updateProjectionMatrix();
    camera.lookAt(focus);
    // three.js counts viewport rows from the bottom, so the first view takes the top left.
    const left = (index % 2) * halfWidth;
    const bottom = index < 2 ? height - halfHeight : 0;
    renderer.setViewport(left, bottom, halfWidth, halfHeight);
    renderer.setScissor(left, bottom, halfWidth, halfHeight);
    renderer.render(scene, camera);
  });

  return {
    labels: showcase.shots.slice(0, 4).map((shot) => shot.label),
    dispose() {
      forest.dispose();
      campfires.dispose();
      player.dispose();
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
