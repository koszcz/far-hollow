import * as THREE from "three";
import type { WorkStationKind } from "../sim/api";
import { playerActivity } from "../sim/activity";
import { movingEntities, type Entity, type EntityStore } from "../sim/entities";
import { distanceToRiver, terrainHeightAt, type GroundPoint, type Valley } from "../sim/valley";
import { createBarkMeshes } from "./bark-meshes";
import { createBedrollMeshes } from "./bedroll-meshes";
import { createPileMeshes } from "./pile-meshes";
import { blendPosition } from "./blend";
import { createCameraRig, type CameraRig } from "./camera-rig";
import { createForageMeshes } from "./forage-meshes";
import { createForestMeshes } from "./forest-meshes";
import { daylightAt } from "./daylight";
import { createHoverOutline, type OutlinePart } from "./hover-outline";
import { createPlayerMesh } from "./player-mesh";
import { createRainEffect } from "./rain-effect";
import { createRiverMeshes } from "./river-meshes";
import { createSkyLighting } from "./sky-lighting";
import { createStructureMeshes, type PlacingBlueprint } from "./structure-meshes";
import type { ModelShapes } from "./model-shapes";
import { drawnPixelRatio as pixelRatioWithinBudget } from "./pixel-budget";
import { frustumOf } from "./culled-batch";
import { createUndergrowthMeshes } from "./undergrowth-meshes";
import { createValleyBackdrop } from "./valley-backdrop-shape";
import { createValleyBackdropMeshes } from "./valley-backdrop-meshes";
import { createValleyMeshes } from "./valley-meshes";

export const CAMERA_FIELD_OF_VIEW_DEGREES = 45;
const CAMERA_NEAR_METRES = 0.1;
const CAMERA_FAR_METRES = 4000;
/** The player turns to face where they walk only when they move further than this in one frame, in metres. */
const TURN_MIN_TRAVEL_METRES = 0.001;

/**
 * What is under a point on the screen. Everything but the ground and the river is given by its entity id.
 * A finished lean-to, foundation, log wall, door frame, roof frame, or roof section is a `structure`.
 * Most clicks act on what is `under` it, as if it were not there, so the player can still walk onto a foundation or place a wall on it.
 */
export type ScenePick =
  | { kind: "structure"; id: number; under: GroundOrThingPick | undefined }
  | { kind: "ground"; spot: GroundPoint }
  | { kind: "river"; spot: GroundPoint }
  | { kind: "tree"; id: number }
  | { kind: "log"; id: number }
  | { kind: "debarkedLog"; id: number }
  | { kind: "stick"; id: number }
  | { kind: "bark"; id: number }
  | { kind: "forage"; id: number }
  | { kind: "blueprint"; id: number }
  | { kind: "campfire"; id: number }
  | { kind: "woodpile"; id: number }
  | { kind: "chest"; id: number }
  | { kind: "workStation"; id: number; station: WorkStationKind }
  | { kind: "bedroll"; id: number }
  | { kind: "pile"; id: number };

export type { PlacingBlueprint } from "./structure-meshes";

/** A pick that landed on anything but a finished structure. */
export type GroundOrThingPick = Exclude<ScenePick, { kind: "structure" }>;

/** A pick that landed on an entity, other than a finished structure. Those are never outlined. */
type EntityPick = Extract<GroundOrThingPick, { id: number }>;

export interface SceneRenderer {
  /** Draws one frame. alpha says how far the frame is between the last two logic steps. */
  render(alpha: number): void;
  /** Where the camera looks. Camera input and camera follow change it. It never changes game state. */
  readonly cameraRig: CameraRig;
  /** What is under a point on the screen, in page pixels, or undefined if nothing is. */
  pickAt(clientX: number, clientY: number): ScenePick | undefined;
  /** Outlines the thing this pick landed on, from the next frame on. Undefined, the ground, or the river outlines nothing. */
  setHovered(pick: ScenePick | undefined): void;
  /** Shows the blueprint under the mouse while the player places one. Undefined hides it. */
  showPlacingBlueprint(placing: PlacingBlueprint | undefined): void;
  dispose(): void;
}

/**
 * readHourOfDay returns the clock's hour of the day, with its fraction, from game logic.
 * Rendering only reads the clock. It never changes it.
 * shapes are the loaded models, from loadModelShapes.
 */
export function createSceneRenderer(
  canvas: HTMLCanvasElement,
  valley: Valley,
  entities: EntityStore,
  readHourOfDay: () => number,
  shapes: ModelShapes,
): SceneRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

  const scene = new THREE.Scene();
  const skyLighting = createSkyLighting(scene, renderer);

  const camera = new THREE.PerspectiveCamera(CAMERA_FIELD_OF_VIEW_DEGREES, 1, CAMERA_NEAR_METRES, CAMERA_FAR_METRES);
  const backdrop = createValleyBackdrop(valley);
  // The camera's focus stays over the valley. Its eye stays above the ridges when it looks in from outside.
  const cameraRig = createCameraRig({ groundHeightAt: (x, z) => backdrop.groundHeightAt(x, z), focusLimit: valley.size / 2 });
  function placeCamera(): void {
    const { eye, focus } = cameraRig.view();
    camera.position.set(eye.x, eye.y, eye.z);
    camera.lookAt(focus.x, focus.y, focus.z);
  }

  const valleyMeshes = createValleyMeshes(valley);
  scene.add(valleyMeshes.group);
  const riverMeshes = createRiverMeshes(valley);
  scene.add(riverMeshes.group);
  // The ridges and mountains around the valley are only for looks. Clicks on the ridge start nothing.
  const backdropMeshes = createValleyBackdropMeshes(valley, backdrop, valleyMeshes.look, valleyMeshes.ground.geometry.getAttribute("normal"), shapes.trees);
  scene.add(backdropMeshes.group);
  // Undergrowth is only for looks: it is never picked, and it casts no shadows. It hides under anything the player places.
  const undergrowthMeshes = createUndergrowthMeshes(valley, shapes.undergrowth, entities);
  scene.add(undergrowthMeshes.group);
  const forestMeshes = createForestMeshes(entities, shapes.trees, shapes.stump, shapes.log);
  scene.add(forestMeshes.group);
  const structureMeshes = createStructureMeshes(entities, (x, z) => terrainHeightAt(valley.terrain, x, z), shapes.log);
  scene.add(structureMeshes.group);
  const forageMeshes = createForageMeshes(entities, shapes.berryBush, shapes.mushrooms);
  scene.add(forageMeshes.group);
  const bedrollMeshes = createBedrollMeshes(entities, (x, z) => terrainHeightAt(valley.terrain, x, z));
  scene.add(bedrollMeshes.group);
  const pileMeshes = createPileMeshes(entities, shapes.mushrooms);
  scene.add(pileMeshes.group);
  const barkMeshes = createBarkMeshes(entities);
  scene.add(barkMeshes.group);
  const rainEffect = createRainEffect(entities, (x, z) => terrainHeightAt(valley.terrain, x, z));
  scene.add(rainEffect.group);
  skyLighting.addShadowReceivers(valleyMeshes.group);
  skyLighting.addShadowCasters(forestMeshes.group, structureMeshes.group, forageMeshes.group, bedrollMeshes.group, pileMeshes.group, barkMeshes.group);
  const hoverOutline = createHoverOutline(scene);
  /** The thing under the pointer that the player can click, if any. */
  let hovered: { kind: EntityPick["kind"]; entity: Entity } | undefined;

  /** The shapes to outline for each kind of thing the player can click. */
  const outlines: { readonly [Kind in EntityPick["kind"]]: (entity: Entity) => OutlinePart[] } = {
    tree: (entity) => forestMeshes.outlineOf({ kind: "tree", entity }),
    log: (entity) => forestMeshes.outlineOf({ kind: "log", entity }),
    debarkedLog: (entity) => forestMeshes.outlineOf({ kind: "debarkedLog", entity }),
    stick: (entity) => forestMeshes.outlineOf({ kind: "stick", entity }),
    bark: (entity) => barkMeshes.outlineOf(entity),
    forage: (entity) => forageMeshes.outlineOf({ kind: "forage", entity }),
    blueprint: (entity) => structureMeshes.outlineOf({ kind: "blueprint", entity }),
    campfire: (entity) => structureMeshes.outlineOf({ kind: "campfire", entity }),
    woodpile: (entity) => structureMeshes.outlineOf({ kind: "woodpile", entity }),
    chest: (entity) => structureMeshes.outlineOf({ kind: "chest", entity }),
    workStation: (entity) => structureMeshes.outlineOf({ kind: "workStation", entity }),
    bedroll: (entity) => bedrollMeshes.outlineOf(entity),
    pile: (entity) => pileMeshes.outlineOf(entity),
  };

  /** Outlines the hovered thing where it is drawn now. It may have moved, or be gone. */
  function outlineHovered(): void {
    hoverOutline.show(hovered === undefined ? [] : outlines[hovered.kind](hovered.entity));
  }

  let drawnWidth = 0;
  let drawnHeight = 0;
  let drawnPixelRatio = 0;
  function matchCanvasSize(): void {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const pixelRatio = pixelRatioWithinBudget(width, height, window.devicePixelRatio);
    if (width === drawnWidth && height === drawnHeight && pixelRatio === drawnPixelRatio) return;
    drawnWidth = width;
    drawnHeight = height;
    drawnPixelRatio = pixelRatio;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    hoverOutline.setViewSize(width, height);
  }

  const playerMesh = createPlayerMesh(shapes.player, shapes.log);
  scene.add(playerMesh.group);
  skyLighting.addShadowCasters(playerMesh.group);
  /** Where the player is drawn this frame. The camera follows it. */
  const playerDrawn = { x: 0, y: 0, z: 0 };
  const playerDrawnBefore = { x: 0, y: 0, z: 0 };
  cameraRig.setFollowTarget(playerDrawn);
  /** Total metres the player has walked, which keeps the legs in step with the ground. */
  let playerWalkedMetres = 0;

  const moving = movingEntities(entities);
  const blended = { x: 0, y: 0, z: 0 };
  const raycaster = new THREE.Raycaster();
  const viewFrustum = new THREE.Frustum();
  const pointer = new THREE.Vector2();

  /**
   * Shows what the player is doing: which way they face, what they carry, and whether they build, chop, split, debark, or craft.
   * Debarking bends the player over the log with the drawknife. Crafting reuses the chopping swing where the player faces.
   * Game logic decides which work the player is doing, the same way the HUD shows it.
   */
  function posePlayer(nowSeconds: number): void {
    const player = entities.with("player", "position").first;
    if (player === undefined) return;
    playerMesh.setCarryingLog(player.carrying);
    const activity = playerActivity(entities, player);
    const target = activity?.targetId === undefined ? undefined : entities.entity(activity.targetId);
    const faceTarget = () => {
      if (target?.position !== undefined) playerMesh.setHeading(Math.atan2(target.position.x - playerDrawn.x, target.position.z - playerDrawn.z));
    };
    // Building crouches the player over the blueprint, facing its middle.
    playerMesh.setBuilding(activity?.kind === "build" ? nowSeconds : undefined);
    // Splitting has its own overhead strike, aimed where the player already faces.
    playerMesh.setSplitting(activity?.kind === "split" ? nowSeconds : undefined);
    // Debarking pulls a drawknife along the log. The player stands off its end, so facing its middle faces along it.
    playerMesh.setDebarking(activity?.kind === "debark" ? nowSeconds : undefined);
    // Chopping swings at the tree. Crafting swings where the player already faces.
    const swinging = activity?.kind === "chop" || activity?.kind === "craft";
    playerMesh.setChopping(swinging ? nowSeconds : undefined);
    if (activity?.kind === "build" || activity?.kind === "chop" || activity?.kind === "debark") faceTarget();
    if (activity !== undefined && activity.kind !== "takeDown") return;
    const dx = playerDrawn.x - playerDrawnBefore.x;
    const dz = playerDrawn.z - playerDrawnBefore.z;
    const travelled = Math.hypot(dx, dz);
    if (travelled > TURN_MIN_TRAVEL_METRES) playerMesh.setHeading(Math.atan2(dx, dz));
    if (player.walkPath === undefined) {
      playerMesh.setWalking(undefined);
      return;
    }
    playerWalkedMetres += travelled;
    playerMesh.setWalking(playerWalkedMetres);
  }

  /**
   * What the ray from the camera through the pointer meets first, with how far away it is, looking through finished structures.
   * Set the ray before calling it.
   */
  function pickThroughFinishedStructures(): { pick: GroundOrThingPick; distance: number } | undefined {
    const ground = raycaster.intersectObject(valleyMeshes.ground, false)[0];
    // The ridge hides whatever lies behind it, so a click on it lands on nothing.
    const ridge = raycaster.intersectObject(backdropMeshes.ridge, false)[0];
    const result = pickInsideValley(ground);
    if (ridge !== undefined && (result === undefined || ridge.distance < result.distance)) return undefined;
    return result;
  }

  /** Like pickThroughFinishedStructures, given what the ray meets on the valley's ground. */
  function pickInsideValley(ground: THREE.Intersection | undefined): { pick: GroundOrThingPick; distance: number } | undefined {
    const candidates = [
      forestMeshes.pick(raycaster),
      structureMeshes.pick(raycaster),
      forageMeshes.pick(raycaster),
      bedrollMeshes.pick(raycaster),
      pileMeshes.pick(raycaster),
      barkMeshes.pick(raycaster),
    ];
    let nearest: (typeof candidates)[number];
    for (const candidate of candidates) {
      if (candidate !== undefined && (nearest === undefined || candidate.distance < nearest.distance)) nearest = candidate;
    }
    if (nearest !== undefined && (ground === undefined || nearest.distance <= ground.distance)) {
      const { kind, entity } = nearest.hit;
      const id = entities.id(entity);
      if (id !== undefined) {
        if (kind !== "workStation") return { pick: { kind, id }, distance: nearest.distance };
        if (entity.workStation !== undefined) return { pick: { kind, id, station: entity.workStation }, distance: nearest.distance };
      }
    }
    if (ground === undefined) return undefined;
    const spot = { x: ground.point.x, z: ground.point.z };
    // The ray passes through the see-through water to the riverbed below it.
    const onRiver = distanceToRiver(valley.river, spot) <= valley.river.width / 2;
    return { pick: onRiver ? { kind: "river", spot } : { kind: "ground", spot }, distance: ground.distance };
  }

  return {
    cameraRig,
    render(alpha) {
      const nowSeconds = performance.now() / 1000;
      matchCanvasSize();
      const hourOfDay = readHourOfDay();
      riverMeshes.update(nowSeconds, daylightAt(hourOfDay));
      backdropMeshes.update(nowSeconds, daylightAt(hourOfDay));
      forestMeshes.update(nowSeconds);
      forageMeshes.update();
      bedrollMeshes.update();
      pileMeshes.update();
      barkMeshes.update();
      Object.assign(playerDrawnBefore, playerDrawn);
      for (const entity of moving) {
        blendPosition(entity.previousPosition, entity.position, alpha, blended);
        if (entity.player) {
          Object.assign(playerDrawn, blended);
          playerMesh.group.position.set(blended.x, blended.y, blended.z);
        }
      }
      posePlayer(nowSeconds);
      placeCamera();
      // Walls between the camera and the player fade out, and the roof above the player hides, so the player stays in view.
      structureMeshes.update({ nowSeconds, camera: cameraRig.view().eye, player: playerDrawn });
      outlineHovered();
      undergrowthMeshes.update(cameraRig.view().focus);
      rainEffect.update(nowSeconds, cameraRig.view().focus, daylightAt(hourOfDay));
      skyLighting.update(hourOfDay, { focus: cameraRig.view().focus, distance: cameraRig.distance });
      // Trees, plants, and undergrowth draw only what the camera and the sun's shadow box can see.
      const views = { view: frustumOf(camera, viewFrustum), eye: camera.position, shadow: skyLighting.shadowFrustum() };
      forestMeshes.cull(views);
      forageMeshes.cull(views);
      backdropMeshes.cull(views);
      undergrowthMeshes.cull(views.view, views.eye);
      renderer.render(scene, camera);
    },
    pickAt(clientX, clientY) {
      const bounds = canvas.getBoundingClientRect();
      pointer.set(((clientX - bounds.left) / bounds.width) * 2 - 1, -((clientY - bounds.top) / bounds.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const under = pickThroughFinishedStructures();
      const nearest = structureMeshes.pickFinished(raycaster);
      const id = nearest === undefined ? undefined : entities.id(nearest.entity);
      if (nearest === undefined || id === undefined || (under !== undefined && under.distance < nearest.distance)) return under?.pick;
      return { kind: "structure", id, under: under?.pick };
    },
    setHovered(pick) {
      const entityPick = pick !== undefined && "id" in pick && pick.kind !== "structure" ? pick : undefined;
      const entity = entityPick === undefined ? undefined : entities.entity(entityPick.id);
      hovered = entityPick !== undefined && entity !== undefined ? { kind: entityPick.kind, entity } : undefined;
    },
    showPlacingBlueprint(placing) {
      structureMeshes.showPlacingBlueprint(placing);
    },
    dispose() {
      hoverOutline.dispose();
      valleyMeshes.dispose();
      undergrowthMeshes.dispose();
      riverMeshes.dispose();
      backdropMeshes.dispose();
      forestMeshes.dispose();
      structureMeshes.dispose();
      forageMeshes.dispose();
      bedrollMeshes.dispose();
      pileMeshes.dispose();
      barkMeshes.dispose();
      rainEffect.dispose();
      playerMesh.dispose();
      renderer.dispose();
    },
  };
}
