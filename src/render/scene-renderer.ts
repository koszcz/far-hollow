import * as THREE from "three";
import type { QuarterTurns, StructureKind } from "../sim/api";
import { movingEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { distanceToRiver, terrainHeightAt, type GroundPoint, type Valley } from "../sim/valley";
import { createBedrollMeshes } from "./bedroll-meshes";
import { blendPosition } from "./blend";
import { createCameraRig, type CameraRig } from "./camera-rig";
import { createCampfireMeshes } from "./campfire-meshes";
import { createForageMeshes } from "./forage-meshes";
import { createFoundationMeshes } from "./foundation-meshes";
import { createForestMeshes } from "./forest-meshes";
import { daylightAt } from "./daylight";
import { createHoverOutline } from "./hover-outline";
import { createPlayerMesh } from "./player-mesh";
import { createRainEffect } from "./rain-effect";
import { createRiverMeshes } from "./river-meshes";
import { createSkyLighting } from "./sky-lighting";
import type { ModelShapes } from "./model-shapes";
import { createUndergrowthMeshes } from "./undergrowth-meshes";
import { createValleyMeshes } from "./valley-meshes";

export const CAMERA_FIELD_OF_VIEW_DEGREES = 45;
const CAMERA_NEAR_METRES = 0.1;
const CAMERA_FAR_METRES = 4000;
/** The player turns to face where they walk only when they move further than this in one frame, in metres. */
const TURN_MIN_TRAVEL_METRES = 0.001;

/** What is under a point on the screen. Everything but the ground and the river is given by its entity id. */
export type ScenePick =
  | { kind: "ground"; spot: GroundPoint }
  | { kind: "river"; spot: GroundPoint }
  | { kind: "tree"; id: number }
  | { kind: "log"; id: number }
  | { kind: "debarkedLog"; id: number }
  | { kind: "stick"; id: number }
  | { kind: "forage"; id: number }
  | { kind: "blueprint"; id: number }
  | { kind: "campfire"; id: number }
  | { kind: "bedroll"; id: number };

/** A blueprint under the mouse that the player has not placed yet, as the build menu's placement check gives it. */
export interface PlacementPreview {
  readonly structure: StructureKind;
  /** The building-grid spot it snaps to, on the ground, in metres. */
  readonly spot: Readonly<Vec3>;
  readonly turns: QuarterTurns;
  /** False where its placement rule refuses the spot, so it shows as not allowed. */
  readonly allowed: boolean;
}

/** A pick that landed on an entity. */
type EntityPick = Extract<ScenePick, { id: number }>;

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
  setPlacementPreview(preview: PlacementPreview | undefined): void;
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

  const camera = new THREE.PerspectiveCamera(
    CAMERA_FIELD_OF_VIEW_DEGREES,
    1,
    CAMERA_NEAR_METRES,
    CAMERA_FAR_METRES,
  );
  const cameraRig = createCameraRig({ groundHeightAt: (x, z) => terrainHeightAt(valley.terrain, x, z) });
  function placeCamera(): void {
    const { eye, focus } = cameraRig.view();
    camera.position.set(eye.x, eye.y, eye.z);
    camera.lookAt(focus.x, focus.y, focus.z);
  }

  const valleyMeshes = createValleyMeshes(valley);
  scene.add(valleyMeshes.group);
  const riverMeshes = createRiverMeshes(valley);
  scene.add(riverMeshes.group);
  // Undergrowth is only for looks: it is never picked, and it casts no shadows. It hides under anything the player places.
  const undergrowthMeshes = createUndergrowthMeshes(valley, shapes.undergrowth, entities);
  scene.add(undergrowthMeshes.group);
  const forestMeshes = createForestMeshes(entities, shapes.trees, shapes.stump, shapes.log);
  scene.add(forestMeshes.group);
  const campfireMeshes = createCampfireMeshes(entities);
  scene.add(campfireMeshes.group);
  const foundationMeshes = createFoundationMeshes(entities, (x, z) => terrainHeightAt(valley.terrain, x, z));
  scene.add(foundationMeshes.group);
  const forageMeshes = createForageMeshes(entities, shapes.berryBush, shapes.mushrooms);
  scene.add(forageMeshes.group);
  const bedrollMeshes = createBedrollMeshes(entities);
  scene.add(bedrollMeshes.group);
  const rainEffect = createRainEffect(entities, (x, z) => terrainHeightAt(valley.terrain, x, z));
  scene.add(rainEffect.group);
  skyLighting.addShadowReceivers(valleyMeshes.group);
  skyLighting.addShadowCasters(forestMeshes.group, campfireMeshes.group, foundationMeshes.group, forageMeshes.group, bedrollMeshes.group);
  const hoverOutline = createHoverOutline(scene);
  /** The thing under the pointer that the player can click, if any. */
  let hovered: { kind: EntityPick["kind"]; entity: Entity } | undefined;

  /** Outlines the hovered thing where it is drawn now. It may have moved, or be gone. */
  function outlineHovered(): void {
    if (hovered === undefined) {
      hoverOutline.show([]);
      return;
    }
    const { kind, entity } = hovered;
    if (kind === "bedroll") hoverOutline.show(bedrollMeshes.outlineOf(entity));
    else if (kind === "blueprint" && entity.blueprint?.piece === "foundation") hoverOutline.show(foundationMeshes.outlineOf({ kind, entity }));
    else if (kind === "blueprint" || kind === "campfire") hoverOutline.show(campfireMeshes.outlineOf({ kind, entity }));
    else if (kind === "forage") hoverOutline.show(forageMeshes.outlineOf({ kind, entity }));
    else hoverOutline.show(forestMeshes.outlineOf({ kind, entity }));
  }

  let drawnWidth = 0;
  let drawnHeight = 0;
  let drawnPixelRatio = 0;
  function matchCanvasSize(): void {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const pixelRatio = window.devicePixelRatio;
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
  const pointer = new THREE.Vector2();

  /**
   * Shows what the player is doing: which way they face, what they carry, and whether they chop, split, or debark.
   * Debarking reuses the chopping swing, aimed at the log.
   */
  function posePlayer(nowSeconds: number): void {
    const player = entities.with("player", "position").first;
    if (player === undefined) return;
    playerMesh.setCarryingLog(player.carrying);
    if (player.splitTask !== undefined) {
      // Splitting has its own overhead strike, aimed where the player already faces.
      playerMesh.setSplitting(nowSeconds);
      return;
    }
    playerMesh.setSplitting(undefined);
    const workTargetId = player.walkPath === undefined ? (player.chopTask?.treeId ?? player.debarkTask?.logId) : undefined;
    const target = workTargetId === undefined ? undefined : entities.entity(workTargetId);
    if (target?.position !== undefined) {
      playerMesh.setHeading(Math.atan2(target.position.x - playerDrawn.x, target.position.z - playerDrawn.z));
      playerMesh.setChopping(nowSeconds);
      return;
    }
    playerMesh.setChopping(undefined);
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

  return {
    cameraRig,
    render(alpha) {
      const nowSeconds = performance.now() / 1000;
      matchCanvasSize();
      const hourOfDay = readHourOfDay();
      riverMeshes.update(nowSeconds, daylightAt(hourOfDay));
      forestMeshes.update(nowSeconds);
      campfireMeshes.update(nowSeconds);
      foundationMeshes.update();
      forageMeshes.update();
      bedrollMeshes.update();
      Object.assign(playerDrawnBefore, playerDrawn);
      for (const entity of moving) {
        blendPosition(entity.previousPosition, entity.position, alpha, blended);
        if (entity.player) {
          Object.assign(playerDrawn, blended);
          playerMesh.group.position.set(blended.x, blended.y, blended.z);
        }
      }
      posePlayer(nowSeconds);
      outlineHovered();
      placeCamera();
      undergrowthMeshes.update(cameraRig.view().focus);
      rainEffect.update(nowSeconds, cameraRig.view().focus, daylightAt(hourOfDay));
      skyLighting.update(hourOfDay, { focus: cameraRig.view().focus, distance: cameraRig.distance });
      renderer.render(scene, camera);
    },
    pickAt(clientX, clientY) {
      const bounds = canvas.getBoundingClientRect();
      pointer.set(((clientX - bounds.left) / bounds.width) * 2 - 1, -((clientY - bounds.top) / bounds.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const ground = raycaster.intersectObject(valleyMeshes.ground, false)[0];
      const candidates = [
        forestMeshes.pick(raycaster), campfireMeshes.pick(raycaster), foundationMeshes.pick(raycaster), forageMeshes.pick(raycaster),
        bedrollMeshes.pick(raycaster),
      ];
      let nearest: (typeof candidates)[number];
      for (const candidate of candidates) {
        if (candidate !== undefined && (nearest === undefined || candidate.distance < nearest.distance)) nearest = candidate;
      }
      if (nearest !== undefined && (ground === undefined || nearest.distance <= ground.distance)) {
        const id = entities.id(nearest.hit.entity);
        if (id !== undefined) return { kind: nearest.hit.kind, id };
      }
      if (ground === undefined) return undefined;
      const spot = { x: ground.point.x, z: ground.point.z };
      // The ray passes through the see-through water to the riverbed below it.
      return distanceToRiver(valley.river, spot) <= valley.river.width / 2 ? { kind: "river", spot } : { kind: "ground", spot };
    },
    setHovered(pick) {
      const entityPick = pick !== undefined && "id" in pick ? pick : undefined;
      const entity = entityPick === undefined ? undefined : entities.entity(entityPick.id);
      hovered = entityPick !== undefined && entity !== undefined ? { kind: entityPick.kind, entity } : undefined;
    },
    setPlacementPreview(preview) {
      // Each structure draws its own blueprint. Later structures add a branch here.
      campfireMeshes.showPreview(preview?.structure === "campfire" ? preview : undefined);
      foundationMeshes.showPreview(preview?.structure === "foundation" ? preview : undefined);
    },
    dispose() {
      hoverOutline.dispose();
      valleyMeshes.dispose();
      undergrowthMeshes.dispose();
      riverMeshes.dispose();
      forestMeshes.dispose();
      campfireMeshes.dispose();
      foundationMeshes.dispose();
      forageMeshes.dispose();
      bedrollMeshes.dispose();
      rainEffect.dispose();
      playerMesh.dispose();
      renderer.dispose();
    },
  };
}
