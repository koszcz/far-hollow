import * as THREE from "three";
import type { QuarterTurns, StructureKind } from "../sim/api";
import { movingEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { distanceToRiver, terrainHeightAt, type GroundPoint, type Valley } from "../sim/valley";
import { createBarkMeshes } from "./bark-meshes";
import { createBedrollMeshes } from "./bedroll-meshes";
import { createPileMeshes } from "./pile-meshes";
import { blendPosition } from "./blend";
import { createCameraRig, type CameraRig } from "./camera-rig";
import { createCampfireMeshes } from "./campfire-meshes";
import { createChestMeshes } from "./chest-meshes";
import { createForageMeshes } from "./forage-meshes";
import { createEdgePieceMeshes } from "./edge-piece-meshes";
import { createFoundationMeshes } from "./foundation-meshes";
import { createRoofMeshes } from "./roof-meshes";
import { createForestMeshes } from "./forest-meshes";
import { daylightAt } from "./daylight";
import { createHoverOutline, type OutlinePart } from "./hover-outline";
import { createLeanToMeshes } from "./lean-to-meshes";
import { createPlayerMesh } from "./player-mesh";
import { createRainEffect } from "./rain-effect";
import { createRiverMeshes } from "./river-meshes";
import { createSkyLighting } from "./sky-lighting";
import type { ModelShapes } from "./model-shapes";
import { createUndergrowthMeshes } from "./undergrowth-meshes";
import { createValleyMeshes } from "./valley-meshes";
import { createWoodpileMeshes } from "./woodpile-meshes";

export const CAMERA_FIELD_OF_VIEW_DEGREES = 45;
const CAMERA_NEAR_METRES = 0.1;
const CAMERA_FAR_METRES = 4000;
/** The player turns to face where they walk only when they move further than this in one frame, in metres. */
const TURN_MIN_TRAVEL_METRES = 0.001;

/**
 * What is under a point on the screen. Everything but the ground and the river is given by its entity id.
 * A finished lean-to, foundation, log wall, door frame, or roof section is a `structure`.
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
  | { kind: "bedroll"; id: number }
  | { kind: "pile"; id: number };

/** A blueprint under the mouse that the player has not placed yet, as the build menu's placement check gives it. */
export interface PlacingBlueprint {
  readonly structure: StructureKind;
  /** The building-grid spot it snaps to, on the ground, in metres. */
  readonly spot: Readonly<Vec3>;
  readonly turns: QuarterTurns;
  /** False where its placement rule refuses the spot, so it shows as not allowed. */
  readonly allowed: boolean;
}

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
  const leanToMeshes = createLeanToMeshes(entities);
  scene.add(leanToMeshes.group);
  const foundationMeshes = createFoundationMeshes(entities, (x, z) => terrainHeightAt(valley.terrain, x, z));
  scene.add(foundationMeshes.group);
  const edgePieceMeshes = createEdgePieceMeshes(entities);
  scene.add(edgePieceMeshes.group);
  const roofMeshes = createRoofMeshes(entities);
  scene.add(roofMeshes.group);
  const forageMeshes = createForageMeshes(entities, shapes.berryBush, shapes.mushrooms);
  scene.add(forageMeshes.group);
  const woodpileMeshes = createWoodpileMeshes(entities, shapes.log);
  scene.add(woodpileMeshes.group);
  const bedrollMeshes = createBedrollMeshes(entities);
  scene.add(bedrollMeshes.group);
  const chestMeshes = createChestMeshes(entities);
  scene.add(chestMeshes.group);
  const pileMeshes = createPileMeshes(entities);
  scene.add(pileMeshes.group);
  const barkMeshes = createBarkMeshes(entities);
  scene.add(barkMeshes.group);
  const rainEffect = createRainEffect(entities, (x, z) => terrainHeightAt(valley.terrain, x, z));
  scene.add(rainEffect.group);
  skyLighting.addShadowReceivers(valleyMeshes.group);
  skyLighting.addShadowCasters(
    forestMeshes.group, campfireMeshes.group, leanToMeshes.group, foundationMeshes.group, edgePieceMeshes.group, roofMeshes.group,
    forageMeshes.group, bedrollMeshes.group, woodpileMeshes.group, chestMeshes.group, pileMeshes.group, barkMeshes.group,
  );
  const hoverOutline = createHoverOutline(scene);
  /** The thing under the pointer that the player can click, if any. */
  let hovered: { kind: EntityPick["kind"]; entity: Entity } | undefined;

  /** The shapes to outline for a blueprint of each structure. */
  const blueprintOutlines: { readonly [Kind in StructureKind]: (entity: Entity) => OutlinePart[] } = {
    campfire: (entity) => campfireMeshes.outlineOf({ kind: "blueprint", entity }),
    leanTo: (entity) => leanToMeshes.outlineOf(entity),
    foundation: (entity) => foundationMeshes.outlineOf({ kind: "blueprint", entity }),
    logWall: (entity) => edgePieceMeshes.outlineOf({ kind: "blueprint", entity }),
    doorFrame: (entity) => edgePieceMeshes.outlineOf({ kind: "blueprint", entity }),
    roof: (entity) => roofMeshes.outlineOf({ kind: "blueprint", entity }),
    woodpile: (entity) => woodpileMeshes.outlineOf({ kind: "blueprint", entity }),
    chest: (entity) => chestMeshes.outlineOf({ kind: "blueprint", entity }),
  };
  /** The shapes to outline for each kind of thing the player can click. */
  const outlines: { readonly [Kind in EntityPick["kind"]]: (entity: Entity) => OutlinePart[] } = {
    tree: (entity) => forestMeshes.outlineOf({ kind: "tree", entity }),
    log: (entity) => forestMeshes.outlineOf({ kind: "log", entity }),
    debarkedLog: (entity) => forestMeshes.outlineOf({ kind: "debarkedLog", entity }),
    stick: (entity) => forestMeshes.outlineOf({ kind: "stick", entity }),
    bark: (entity) => barkMeshes.outlineOf(entity),
    forage: (entity) => forageMeshes.outlineOf({ kind: "forage", entity }),
    blueprint: (entity) => (entity.blueprint === undefined ? [] : blueprintOutlines[entity.blueprint.structure](entity)),
    campfire: (entity) => campfireMeshes.outlineOf({ kind: "campfire", entity }),
    woodpile: (entity) => woodpileMeshes.outlineOf({ kind: "woodpile", entity }),
    chest: (entity) => chestMeshes.outlineOf({ kind: "chest", entity }),
    bedroll: (entity) => bedrollMeshes.outlineOf(entity),
    pile: (entity) => pileMeshes.outlineOf(entity),
  };

  /** Outlines the hovered thing where it is drawn now. It may have moved, or be gone. */
  function outlineHovered(): void {
    hoverOutline.show(hovered === undefined ? [] : outlines[hovered.kind](hovered.entity));
  }

  /** Shows or hides the blueprint each structure draws under the mouse while the player places one. */
  const placingBlueprints: { readonly [Kind in StructureKind]: (placing: PlacingBlueprint | undefined) => void } = {
    campfire: (placing) => {
      campfireMeshes.showPlacingBlueprint(placing);
    },
    leanTo: (placing) => {
      leanToMeshes.showPlacingBlueprint(placing);
    },
    foundation: (placing) => {
      foundationMeshes.showPlacingBlueprint(placing);
    },
    logWall: (placing) => {
      edgePieceMeshes.showPlacingBlueprint(placing && { ...placing, structure: "logWall" });
    },
    doorFrame: (placing) => {
      edgePieceMeshes.showPlacingBlueprint(placing && { ...placing, structure: "doorFrame" });
    },
    roof: (placing) => {
      roofMeshes.showPlacingBlueprint(placing);
    },
    woodpile: (placing) => {
      woodpileMeshes.showPlacingBlueprint(placing);
    },
    chest: (placing) => {
      chestMeshes.showPlacingBlueprint(placing);
    },
  };

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
   * Shows what the player is doing: which way they face, what they carry, and whether they build, chop, split, or debark.
   * Debarking reuses the chopping swing, aimed at the log.
   */
  function posePlayer(nowSeconds: number): void {
    const player = entities.with("player", "position").first;
    if (player === undefined) return;
    playerMesh.setCarryingLog(player.carrying);
    // Building crouches the player over the blueprint, facing its middle.
    const blueprint = player.buildTask !== undefined && player.walkPath === undefined ? entities.entity(player.buildTask.blueprintId) : undefined;
    if (blueprint?.blueprint !== undefined && blueprint.position !== undefined && player.splitTask === undefined) {
      playerMesh.setSplitting(undefined);
      playerMesh.setChopping(undefined);
      playerMesh.setHeading(Math.atan2(blueprint.position.x - playerDrawn.x, blueprint.position.z - playerDrawn.z));
      playerMesh.setBuilding(nowSeconds);
      return;
    }
    playerMesh.setBuilding(undefined);
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

  /**
   * What the ray from the camera through the pointer meets first, with how far away it is, looking through finished structures.
   * Set the ray before calling it.
   */
  function pickThroughFinishedStructures(): { pick: GroundOrThingPick; distance: number } | undefined {
    const ground = raycaster.intersectObject(valleyMeshes.ground, false)[0];
    const candidates = [
      forestMeshes.pick(raycaster), campfireMeshes.pick(raycaster), leanToMeshes.pick(raycaster), foundationMeshes.pick(raycaster),
      edgePieceMeshes.pick(raycaster), roofMeshes.pick(raycaster),
      forageMeshes.pick(raycaster),
      bedrollMeshes.pick(raycaster),
      pileMeshes.pick(raycaster),
      woodpileMeshes.pick(raycaster),
      chestMeshes.pick(raycaster),
      barkMeshes.pick(raycaster),
    ];
    let nearest: (typeof candidates)[number];
    for (const candidate of candidates) {
      if (candidate !== undefined && (nearest === undefined || candidate.distance < nearest.distance)) nearest = candidate;
    }
    if (nearest !== undefined && (ground === undefined || nearest.distance <= ground.distance)) {
      const id = entities.id(nearest.hit.entity);
      if (id !== undefined) return { pick: { kind: nearest.hit.kind, id }, distance: nearest.distance };
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
      forestMeshes.update(nowSeconds);
      campfireMeshes.update(nowSeconds);
      leanToMeshes.update();
      foundationMeshes.update();
      forageMeshes.update();
      bedrollMeshes.update();
      pileMeshes.update();
      woodpileMeshes.update();
      chestMeshes.update();
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
      outlineHovered();
      placeCamera();
      // Walls between the camera and the player fade out, so the player stays in view.
      edgePieceMeshes.update({ camera: cameraRig.view().eye, player: playerDrawn });
      // The roof above the player hides, so the player stays in view inside a cabin.
      roofMeshes.update({ player: playerDrawn });
      undergrowthMeshes.update(cameraRig.view().focus);
      rainEffect.update(nowSeconds, cameraRig.view().focus, daylightAt(hourOfDay));
      skyLighting.update(hourOfDay, { focus: cameraRig.view().focus, distance: cameraRig.distance });
      renderer.render(scene, camera);
    },
    pickAt(clientX, clientY) {
      const bounds = canvas.getBoundingClientRect();
      pointer.set(((clientX - bounds.left) / bounds.width) * 2 - 1, -((clientY - bounds.top) / bounds.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const under = pickThroughFinishedStructures();
      let nearest: { entity: Entity; distance: number } | undefined;
      for (const meshes of [leanToMeshes, foundationMeshes, edgePieceMeshes, roofMeshes]) {
        const candidate = meshes.pickFinished(raycaster);
        if (candidate !== undefined && (nearest === undefined || candidate.distance < nearest.distance)) nearest = candidate;
      }
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
      // Each structure draws its own blueprint. Hide them all, then show the one being placed.
      for (const show of Object.values(placingBlueprints)) show(undefined);
      if (placing !== undefined) placingBlueprints[placing.structure](placing);
    },
    dispose() {
      hoverOutline.dispose();
      valleyMeshes.dispose();
      undergrowthMeshes.dispose();
      riverMeshes.dispose();
      forestMeshes.dispose();
      campfireMeshes.dispose();
      leanToMeshes.dispose();
      foundationMeshes.dispose();
      edgePieceMeshes.dispose();
      roofMeshes.dispose();
      forageMeshes.dispose();
      bedrollMeshes.dispose();
      pileMeshes.dispose();
      woodpileMeshes.dispose();
      chestMeshes.dispose();
      barkMeshes.dispose();
      rainEffect.dispose();
      playerMesh.dispose();
      renderer.dispose();
    },
  };
}
