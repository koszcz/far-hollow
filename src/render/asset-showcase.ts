// Shows one asset from asset-manifest.json on its own, from four fixed views, so one screenshot reviews it.
// The dev server opens it at /?asset=<id>. It draws with the game's own mesh code on the real valley ground.
// Animations show four key moments instead of four angles. With &play in the address, an animation that supports it
// plays live in one full view instead, so the owner can judge its timing. &speed=0.25 slows it down.
// Each asset's views live in src/render/showcases/, one file per family of assets.
import * as THREE from "three";
import { createEntityStore, type Vec3 } from "../sim/entities";
import { generateValley, terrainHeightAt, type Valley } from "../sim/valley";
import { createBarkMeshes } from "./bark-meshes";
import { createBedrollMeshes } from "./bedroll-meshes";
import { createPileMeshes } from "./pile-meshes";
import { createPotMaker } from "./pot-shape";
import { daylightAt } from "./daylight";
import { createForageMeshes } from "./forage-meshes";
import { createForestMeshes, type ForestMeshes } from "./forest-meshes";
import { createPlayerMesh } from "./player-mesh";
import { createGroundTexture, GROUND_TEXTURE_TILE_METRES } from "./ground-texture";
import { createRainEffect, type RainEffect } from "./rain-effect";
import { createSkyLighting } from "./sky-lighting";
import { darkenView } from "./sleep-animation";
import type { ModelShapes } from "./model-shapes";
import { createRiverMeshes, type RiverMeshes } from "./river-meshes";
import { createValleyMeshes } from "./valley-meshes";
import { createStructureMeshes } from "./structure-meshes";
import { SHOWCASES } from "./showcases";
import { NOON, STAGE_FROM_RIVER_METRES, type Shot, type Stage } from "./showcases/types";

/** Every showcase uses the same valley, so screenshots of one asset compare across sessions. */
const SHOWCASE_SEED = 42;
const FIELD_OF_VIEW_DEGREES = 40;

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
  shapes: ModelShapes,
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
  const player = createPlayerMesh(shapes.player, shapes.log);
  const at = (x: number, z: number): Vec3 => ({ x: middle.x + x, y: groundAt(middle.x + x, middle.z + z), z: middle.z + z });
  const showsPlayer = [
    "player",
    "backpack",
    "logs",
    "debarked-log",
    "walk-animation",
    "chop-animation",
    "split-animation",
    "debarking-animation",
    "sleep-animation",
    "player-build-animation",
    "sky-lighting",
    "hud",
    "log-wall",
    "door-frame",
  ].includes(id);
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
    undergrowthShapes: shapes.undergrowth,
    treeShapes: shapes.trees,
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

  const forest: ForestMeshes = createForestMeshes(store, shapes.trees, shapes.stump, shapes.log);
  const structures = createStructureMeshes(store, groundAt, shapes.log);
  const forage = createForageMeshes(store, shapes.berryBush, shapes.mushrooms);
  forage.update();
  const bedrolls = createBedrollMeshes(store, groundAt);
  const bark = createBarkMeshes(store);
  const piles = createPileMeshes(store, shapes.mushrooms);
  // Rain shows only where the stage has rain falling.
  const rain: RainEffect = createRainEffect(store, groundAt);
  scene.add(forest.group, structures.group, forage.group, bedrolls.group, bark.group, piles.group, rain.group);
  sky.addShadowReceivers(ground.group);
  sky.addShadowCasters(forest.group, structures.group, forage.group, bedrolls.group, bark.group, piles.group, player.group, props);

  const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW_DEGREES, width / height, 0.05, 4000);
  /** Draws one view into a rectangle of the canvas, counted in pixels from the bottom left. */
  const drawView = (shot: Shot, seconds: number, follow: Partial<Vec3>, view: { left: number; bottom: number; width: number; height: number }): void => {
    // A tree felled by this pose starts falling at 0 seconds, so the view shows it `seconds` into the fall.
    // Stills restart every fall at time 0. A live loop lets each fall start when its tree is felled.
    if (!(options.play && showcase.play !== undefined)) forest.update(0);
    forest.update(seconds);
    structures.update({ nowSeconds: seconds });
    bedrolls.update();
    piles.update();
    bark.update();
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
      const look = play.look?.(seconds);
      if (look !== undefined) darkenView(renderer.domElement, look.darkness);
      drawView(look === undefined ? play.shot : { ...play.shot, hour: look.hour }, seconds, follow, { left: 0, bottom: 0, width, height });
      frame = requestAnimationFrame(drawFrame);
    };
    frame = requestAnimationFrame(drawFrame);
  } else {
    const halfWidth = Math.floor(width / 2);
    const halfHeight = Math.floor(height / 2);
    showcase.shots.slice(0, 4).forEach((shot, index) => {
      showcase.pose?.(stage, shot);
      // three.js counts viewport rows from the bottom, so the first view takes the top left.
      drawView(
        shot,
        shot.seconds ?? 0,
        {},
        { left: (index % 2) * halfWidth, bottom: index < 2 ? height - halfHeight : 0, width: halfWidth, height: halfHeight },
      );
    });
  }

  return {
    labels: play !== undefined ? [`${play.shot.label}, ${options.speed}× speed`] : showcase.shots.slice(0, 4).map((shot) => shot.label),
    dispose() {
      if (frame !== undefined) cancelAnimationFrame(frame);
      forest.dispose();
      structures.dispose();
      potMaker.dispose();
      forage.dispose();
      bedrolls.dispose();
      piles.dispose();
      bark.dispose();
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
