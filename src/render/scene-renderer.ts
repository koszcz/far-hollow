import * as THREE from "three";
import { movingEntities, type Entity, type EntityStore } from "../sim/entities";
import { terrainHeightAt, type GroundPoint, type Valley } from "../sim/valley";
import { createBedrollMeshes } from "./bedroll-meshes";
import { blendPosition } from "./blend";
import { createCameraRig, type CameraRig } from "./camera-rig";
import { createCampfireMeshes } from "./campfire-meshes";
import { createForestMeshes } from "./forest-meshes";
import { daylightAt } from "./daylight";
import { createHoverOutline } from "./hover-outline";
import { createPlayerMesh } from "./player-mesh";
import { createRiverMeshes } from "./river-meshes";
import { createSkyLighting } from "./sky-lighting";
import type { TreeShape } from "./tree-model";
import type { StumpShape } from "./stump-model";
import { createValleyMeshes } from "./valley-meshes";

export const CAMERA_FIELD_OF_VIEW_DEGREES = 45;
const CAMERA_NEAR_METRES = 0.1;
const CAMERA_FAR_METRES = 4000;
/** The player turns to face where they walk only when they move further than this in one frame, in metres. */
const TURN_MIN_TRAVEL_METRES = 0.001;

/** What is under a point on the screen. Everything but the ground is given by its entity id. */
export type ScenePick =
  | { kind: "ground"; spot: GroundPoint }
  | { kind: "tree"; id: number }
  | { kind: "log"; id: number }
  | { kind: "stick"; id: number }
  | { kind: "blueprint"; id: number }
  | { kind: "campfire"; id: number }
  | { kind: "bedroll"; id: number };

export interface SceneRenderer {
  /** Draws one frame. alpha says how far the frame is between the last two logic steps. */
  render(alpha: number): void;
  /** Where the camera looks. Camera input and camera follow change it. It never changes game state. */
  readonly cameraRig: CameraRig;
  /** What is under a point on the screen, in page pixels, or undefined if nothing is. */
  pickAt(clientX: number, clientY: number): ScenePick | undefined;
  /** Outlines the thing this pick landed on, from the next frame on. Undefined, or the ground, outlines nothing. */
  setHovered(pick: ScenePick | undefined): void;
  dispose(): void;
}

/**
 * readHourOfDay returns the clock's hour of the day, with its fraction, from game logic.
 * Rendering only reads the clock. It never changes it.
 * treeShapes are the loaded tree types, from loadTreeShapes. stumpShape is the loaded stump, from loadStumpShape.
 */
export function createSceneRenderer(
  canvas: HTMLCanvasElement,
  valley: Valley,
  entities: EntityStore,
  readHourOfDay: () => number,
  treeShapes: readonly TreeShape[],
  stumpShape: StumpShape,
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
  const forestMeshes = createForestMeshes(entities, treeShapes, stumpShape);
  scene.add(forestMeshes.group);
  const campfireMeshes = createCampfireMeshes(entities);
  scene.add(campfireMeshes.group);
  const bedrollMeshes = createBedrollMeshes(entities);
  scene.add(bedrollMeshes.group);
  skyLighting.addShadowReceivers(valleyMeshes.group);
  skyLighting.addShadowCasters(forestMeshes.group, campfireMeshes.group, bedrollMeshes.group);
  const hoverOutline = createHoverOutline(scene);
  /** The thing under the pointer that the player can click, if any. */
  let hovered: { kind: Exclude<ScenePick["kind"], "ground">; entity: Entity } | undefined;

  /** Outlines the hovered thing where it is drawn now. It may have moved, or be gone. */
  function outlineHovered(): void {
    if (hovered === undefined) {
      hoverOutline.show([]);
      return;
    }
    const { kind, entity } = hovered;
    if (kind === "bedroll") hoverOutline.show(bedrollMeshes.outlineOf(entity));
    else if (kind === "blueprint" || kind === "campfire") hoverOutline.show(campfireMeshes.outlineOf({ kind, entity }));
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

  const playerMesh = createPlayerMesh();
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

  /** Shows what the player is doing: which way they face, whether they carry a log, and whether they chop or split. */
  function posePlayer(nowSeconds: number): void {
    const player = entities.with("player", "position").first;
    if (player === undefined) return;
    playerMesh.setCarryingLog(player.carrying === "log");
    if (player.splitTask !== undefined) {
      // Splitting has its own overhead strike, aimed where the player already faces.
      playerMesh.setSplitting(nowSeconds);
      return;
    }
    const tree = player.chopTask && player.walkPath === undefined ? entities.entity(player.chopTask.treeId) : undefined;
    if (tree?.position !== undefined) {
      playerMesh.setHeading(Math.atan2(tree.position.x - playerDrawn.x, tree.position.z - playerDrawn.z));
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
      skyLighting.update(hourOfDay, { focus: cameraRig.view().focus, distance: cameraRig.distance });
      renderer.render(scene, camera);
    },
    pickAt(clientX, clientY) {
      const bounds = canvas.getBoundingClientRect();
      pointer.set(((clientX - bounds.left) / bounds.width) * 2 - 1, -((clientY - bounds.top) / bounds.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const ground = raycaster.intersectObject(valleyMeshes.ground, false)[0];
      const forest = forestMeshes.pick(raycaster);
      const campfire = campfireMeshes.pick(raycaster);
      const bedroll = bedrollMeshes.pick(raycaster);
      let nearest: { hit: { kind: Exclude<ScenePick["kind"], "ground">; entity: Entity }; distance: number } | undefined;
      for (const candidate of [forest, campfire, bedroll]) {
        if (candidate !== undefined && (nearest === undefined || candidate.distance < nearest.distance)) nearest = candidate;
      }
      if (nearest !== undefined && (ground === undefined || nearest.distance <= ground.distance)) {
        const id = entities.id(nearest.hit.entity);
        if (id !== undefined) return { kind: nearest.hit.kind, id };
      }
      return ground === undefined ? undefined : { kind: "ground", spot: { x: ground.point.x, z: ground.point.z } };
    },
    setHovered(pick) {
      const entity = pick === undefined || pick.kind === "ground" ? undefined : entities.entity(pick.id);
      hovered = pick !== undefined && pick.kind !== "ground" && entity !== undefined ? { kind: pick.kind, entity } : undefined;
    },
    dispose() {
      hoverOutline.dispose();
      valleyMeshes.dispose();
      riverMeshes.dispose();
      forestMeshes.dispose();
      campfireMeshes.dispose();
      bedrollMeshes.dispose();
      playerMesh.dispose();
      renderer.dispose();
    },
  };
}
