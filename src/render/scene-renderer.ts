import * as THREE from "three";
import type { EatOrDrinkView, SleepView } from "../sim/api-game-view";
import type { GroundOrThingPick, ScenePick } from "../sim/api-scene-pick";
import type { PlacingBlueprint } from "../sim/api-client";
import type { Plantable, SeasonDay } from "../sim/api";
import { MINUTES_PER_HOUR } from "../sim/clock";
import { type Entity, type EntityStore } from "../sim/entities";
import { isRaining, movingEntities, snowCoverDepth, playerEntities } from "../sim/entity-queries";
import { structureKindOf } from "../sim/structure-queries";
import { distanceToRiver, terrainHeightAt, type Valley } from "../sim/valley";
import { isRiverBank } from "../sim/river-bank-work";
import { createGroundMap } from "../sim/ground-types";
import type { GroundPoint } from "../sim/ground-point";
import { createBarkMeshes } from "./bark-meshes";
import { createBedrollMeshes } from "./bedroll-meshes";
import { createBirdMeshes } from "./bird-meshes";
import { createPileMeshes } from "./pile-meshes";
import { blendPosition } from "./blend";
import { createCameraRig, type CameraRig } from "./camera-rig";
import { createForageMeshes } from "./forage-meshes";
import { createMushroomLogMeshes } from "./mushroom-log-meshes";
import { leafTurnShare } from "./autumn-leaves";
import { createForestMeshes } from "./forest-meshes";
import { daylightAt } from "./daylight";
import type { NightHours } from "../sim/season";
import { createHoverOutline, type OutlinePart } from "./hover-outline";
import { createPlayerMesh } from "./player-mesh";
import { createPlayerPosing } from "./player-posing";
import { createRainEffect } from "./rain-effect";
import { createSnowfallEffect } from "./snowfall-effect";
import { createSnowCoverLook } from "./snow-cover-look";
import { createFireflyEffect } from "./firefly-effect";
import { fireflyOpenGround } from "./fireflies";
import { createRiverMeshes } from "./river-meshes";
import { createSkyLighting } from "./sky-lighting";
import { darkenView, SLEEP_MORNING_AT, sleepDarknessAt } from "./sleep-animation";
import { createStructureMeshes } from "./structure-meshes";
import { cabinCutaway, NO_CUTAWAY } from "./cabin-cutaway";
import { STARTING_WALL_MODE, type WallMode } from "../wall-mode";
import type { ModelShapes } from "./model-shapes";
import { drawnPixelRatio as pixelRatioWithinBudget } from "./pixel-budget";
import { frustumOf } from "./culled-batch";
import { createUndergrowthMeshes } from "./undergrowth-meshes";
import { easeRain, type EasedRain } from "./eased-rain";
import { windAt } from "./wind";
import { createWindSway } from "./wind-sway";
import { createValleyMeshes } from "./valley-meshes";
import { createDrawnGround } from "./drawn-ground";
import { createTorchLights, type TorchFlame } from "./torch-lights";
import { createPlantedTorchMeshes } from "./planted-torch-meshes";
import { createFishTrapMeshes } from "./fish-trap-meshes";
import { createWindowGlowMeshes } from "./window-glow-meshes";
import type { DrawnWork } from "./drawn-work";

export const CAMERA_FIELD_OF_VIEW_DEGREES = 45;
const CAMERA_NEAR_METRES = 0.1;
const CAMERA_FAR_METRES = 4000;

/** What the drawn player did in the last frame. */
export interface DrawnPlayer {
  /** The work drawn, with when its motion began, on the performance clock in seconds. Undefined while no such work shows. */
  readonly work: { readonly kind: DrawnWork; readonly since: number } | undefined;
  /** The total metres walked so far, while the legs walk, or undefined while they stand still. */
  readonly walkedMetres: number | undefined;
}

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
  /** Shows the see-through sapling or berry bush under the mouse while the player plants one, red where it is not allowed. Undefined hides it. */
  showPlanting(planting: { readonly plant: Plantable; readonly spot: GroundPoint; readonly allowed: boolean } | undefined): void;
  /** Sets the wall mode, which says which cabin roofs hide and which cabin sides fade. It starts in cutaway. */
  setWallMode(mode: WallMode): void;
  /** Whether the sleep animation is playing. Game logic waits while it plays, so the player cannot act mid-sleep. */
  isPlayingSleep(): boolean;
  /** How dark the sleep animation has made the view in the last frame, from 0 (not at all) to 1 (black). Sound fades with it. */
  sleepDarkness(): number;
  /** What the drawn player did in the last frame, for the action sounds. */
  drawnPlayer(): DrawnPlayer;
  /** The hour of the day the sky showed in the last frame, with its fraction. It holds bedtime while the sleep animation darkens the view. Sound follows it. */
  drawnHourOfDay(): number;
  /** The night hours the sky followed in the last frame. They hold bedtime's while the sleep animation darkens the view. Sound follows them. */
  drawnNightHours(): NightHours;
  dispose(): void;
}

/**
 * readHourOfDay returns the clock's hour of the day, with its fraction, from game logic.
 * readNightHours returns today's night hours, which follow the season, from game logic.
 * readClockMinutes returns the game minutes since midnight at the start of day 1, from game logic.
 * readSeasonDay returns the season today and which day of it today is, from game logic.
 * readAfterFirstWinter returns whether a winter has come before today, from game logic. A spring with none keeps green leaves.
 * Rendering only reads the clock and the season. It never changes them.
 * readLastSleep returns the player's last sleep on a bedroll, from game logic. A new one plays the sleep animation.
 * readLastEatOrDrink returns the player's last bite or drink, from game logic. A new one plays its motion once.
 * shapes are the loaded models, from loadModelShapes.
 */
export function createSceneRenderer(
  canvas: HTMLCanvasElement,
  valley: Valley,
  entities: EntityStore,
  readHourOfDay: () => number,
  readNightHours: () => NightHours,
  readClockMinutes: () => number,
  readSeasonDay: () => SeasonDay,
  readAfterFirstWinter: () => boolean,
  readLastSleep: () => SleepView | null,
  readLastEatOrDrink: () => EatOrDrinkView | null,
  shapes: ModelShapes,
): SceneRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

  const scene = new THREE.Scene();
  const skyLighting = createSkyLighting(scene, renderer);

  const camera = new THREE.PerspectiveCamera(CAMERA_FIELD_OF_VIEW_DEGREES, 1, CAMERA_NEAR_METRES, CAMERA_FAR_METRES);
  const groundHeightAt = (x: number, z: number): number => terrainHeightAt(valley.terrain, x, z);
  const groundMap = createGroundMap(valley);
  const cameraRig = createCameraRig({ groundHeightAt });
  function placeCamera(): void {
    const { eye, focus } = cameraRig.view();
    camera.position.set(eye.x, eye.y, eye.z);
    camera.lookAt(focus.x, focus.y, focus.z);
  }

  // The ground follows the trees that stand for good. The terrain and the undergrowth both draw it.
  const drawnGround = createDrawnGround(valley, entities, readClockMinutes);
  // Snow cover lies on the ground, the tree crowns, and the roofs, as deep as game logic says. It is only for looks.
  const snowCoverLook = createSnowCoverLook();
  const valleyMeshes = createValleyMeshes(valley, drawnGround, snowCoverLook);
  scene.add(valleyMeshes.group);
  const riverMeshes = createRiverMeshes(valley);
  scene.add(riverMeshes.group);
  // The wind sways the undergrowth and the trees. It is only for looks, like the rain, and is never saved.
  const windSway = createWindSway();
  /** How far the rain has eased in for the wind. Undefined until the first frame. */
  let windRain: EasedRain | undefined;
  function blowWind(nowSeconds: number): void {
    windRain = easeRain(windRain, isRaining(entities), nowSeconds);
    windSway.update(windAt({ seed: valley.seed, nowSeconds, gameHours: readClockMinutes() / MINUTES_PER_HOUR, rainShare: windRain.share }), nowSeconds);
  }
  // Undergrowth is only for looks: it is never picked, and it casts no shadows. It hides under anything the player places.
  const undergrowthMeshes = createUndergrowthMeshes(valley, shapes.undergrowth, entities, drawnGround, windSway);
  scene.add(undergrowthMeshes.group);
  const forestMeshes = createForestMeshes(entities, shapes, windSway, snowCoverLook);
  scene.add(forestMeshes.group);
  const structureMeshes = createStructureMeshes(entities, groundHeightAt, shapes.log, snowCoverLook);
  scene.add(structureMeshes.group);
  const forageMeshes = createForageMeshes(entities, shapes.berryBush, shapes.mushrooms);
  scene.add(forageMeshes.group);
  const mushroomLogMeshes = createMushroomLogMeshes(entities, shapes.log, shapes.mushrooms);
  scene.add(mushroomLogMeshes.group);
  const bedrollMeshes = createBedrollMeshes(entities, groundHeightAt);
  scene.add(bedrollMeshes.group);
  const pileMeshes = createPileMeshes(entities, shapes.mushrooms);
  scene.add(pileMeshes.group);
  const barkMeshes = createBarkMeshes(entities);
  const plantedTorchMeshes = createPlantedTorchMeshes(entities);
  scene.add(plantedTorchMeshes.group);
  const fishTrapMeshes = createFishTrapMeshes(entities, valley.river, groundHeightAt);
  scene.add(fishTrapMeshes.group);
  scene.add(barkMeshes.group);
  const rainEffect = createRainEffect(entities, groundHeightAt);
  scene.add(rainEffect.group);
  const snowfallEffect = createSnowfallEffect(entities);
  scene.add(snowfallEffect.group);
  // Birds are only for looks: they are never picked, and they cast no shadows.
  const birdMeshes = createBirdMeshes(entities, { map: groundMap, heightAt: groundHeightAt });
  scene.add(birdMeshes.group);
  // Fireflies are only for looks, like the rain. Game logic never sees them, and they are never saved.
  const fireflyEffect = createFireflyEffect(entities, { isOpen: fireflyOpenGround(groundMap), heightAt: groundHeightAt });
  scene.add(fireflyEffect.group);
  // The glow in firelit windows at night is only for looks: it casts no shadow, lights nothing, and is never picked.
  const windowGlowMeshes = createWindowGlowMeshes(entities);
  scene.add(windowGlowMeshes.group);
  skyLighting.addShadowReceivers(valleyMeshes.group);
  skyLighting.addShadowCasters(
    forestMeshes.group,
    structureMeshes.group,
    forageMeshes.group,
    mushroomLogMeshes.group,
    bedrollMeshes.group,
    pileMeshes.group,
    barkMeshes.group,
  );
  const hoverOutline = createHoverOutline(scene);
  /** The thing under the pointer that the player can click, if any. */
  let hovered: { kind: EntityPick["kind"]; entity: Entity } | undefined;

  /** The shapes to outline for each kind of thing the player can click. */
  const outlines: { readonly [Kind in EntityPick["kind"]]: (entity: Entity) => OutlinePart[] } = {
    tree: (entity) => forestMeshes.outlineOf({ kind: "tree", entity }),
    youngTree: (entity) => forestMeshes.outlineOf({ kind: "youngTree", entity }),
    sapling: (entity) => forestMeshes.outlineOf({ kind: "sapling", entity }),
    stump: (entity) => forestMeshes.outlineOf({ kind: "stump", entity }),
    log: (entity) => forestMeshes.outlineOf({ kind: "log", entity }),
    debarkedLog: (entity) => forestMeshes.outlineOf({ kind: "debarkedLog", entity }),
    stick: (entity) => forestMeshes.outlineOf({ kind: "stick", entity }),
    bark: (entity) => barkMeshes.outlineOf(entity),
    forage: (entity) => forageMeshes.outlineOf({ kind: "forage", entity }),
    mushroomLog: (entity) => mushroomLogMeshes.outlineOf(entity),
    blueprint: (entity) => structureMeshes.outlineOf({ kind: "blueprint", entity }),
    campfire: (entity) => structureMeshes.outlineOf({ kind: "campfire", entity }),
    fireplace: (entity) => structureMeshes.outlineOf({ kind: "fireplace", entity }),
    woodpile: (entity) => structureMeshes.outlineOf({ kind: "woodpile", entity }),
    furniture: (entity) => structureMeshes.outlineOf({ kind: "furniture", entity }),
    sled: (entity) => structureMeshes.outlineOf({ kind: "sled", entity }),
    workStation: (entity) => structureMeshes.outlineOf({ kind: "workStation", entity }),
    bedroll: (entity) => bedrollMeshes.outlineOf(entity),
    pile: (entity) => pileMeshes.outlineOf(entity),
    plantedTorch: (entity) => plantedTorchMeshes.outlineOf(entity),
    fishTrap: (entity) => fishTrapMeshes.outlineOf(entity),
    shutters: (entity) => structureMeshes.outlineOf({ kind: "shutters", entity }),
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
  // The torch lights stay in the scene whether a torch is lit or not, so lighting one does not rebuild every material.
  const torchLights = createTorchLights();
  scene.add(torchLights.group);
  const handTorchFlame = { position: new THREE.Vector3(), seed: 0, aboveGroundMetres: 0 };
  /**
   * Lights the ground from the lit torch in the player's hand, if they hold one, then from the planted torches nearest the camera.
   * Run it once the camera is placed.
   */
  function lightTorches(nowSeconds: number): void {
    const hand: TorchFlame | undefined = playerMesh.torchFlame(handTorchFlame) ? handTorchFlame : undefined;
    torchLights.update(hand, plantedTorchMeshes.flames(), camera.position, nowSeconds);
  }
  const posing = createPlayerPosing(entities, valley, playerMesh, readLastSleep, readLastEatOrDrink);
  const { playerDrawn, playerDrawnBefore } = posing;
  cameraRig.setFollowTarget(playerDrawn);
  const players = playerEntities(entities);
  /** Whether the camera has looked at the player yet. */
  let cameraPlaced = false;
  /** The wall mode the player has chosen with the HUD button. */
  let wallMode: WallMode = STARTING_WALL_MODE;
  /** The work drawn in the last frame, with when its motion began. */
  let drawnWork: DrawnPlayer["work"];
  /** The hour of the day the sky showed last frame. */
  let drawnHour = readHourOfDay();
  /** The night hours the sky followed last frame. */
  let drawnNightHours = readNightHours();
  const moving = movingEntities(entities);
  const blended = { x: 0, y: 0, z: 0 };
  const raycaster = new THREE.Raycaster();
  const viewFrustum = new THREE.Frustum();
  const pointer = new THREE.Vector2();

  /**
   * What the ray from the camera through the pointer meets first, with how far away it is, looking through finished structures.
   * Set the ray before calling it.
   */
  function pickThroughFinishedStructures(): { pick: GroundOrThingPick; distance: number } | undefined {
    const ground = raycaster.intersectObject(valleyMeshes.ground, false)[0];
    const candidates = [
      forestMeshes.pick(raycaster),
      structureMeshes.pick(raycaster),
      forageMeshes.pick(raycaster),
      mushroomLogMeshes.pick(raycaster),
      bedrollMeshes.pick(raycaster),
      pileMeshes.pick(raycaster),
      barkMeshes.pick(raycaster),
      plantedTorchMeshes.pick(raycaster),
      fishTrapMeshes.pick(raycaster),
    ];
    let nearest: (typeof candidates)[number];
    for (const candidate of candidates) {
      if (candidate !== undefined && (nearest === undefined || candidate.distance < nearest.distance)) nearest = candidate;
    }
    if (nearest !== undefined && (ground === undefined || nearest.distance <= ground.distance)) {
      const { kind, entity } = nearest.hit;
      const id = entities.id(entity);
      if (id !== undefined) {
        if (kind === "workStation") {
          if (entity.workStation !== undefined) return { pick: { kind, id, station: entity.workStation }, distance: nearest.distance };
        } else if (kind === "furniture") {
          if (entity.furniture !== undefined) return { pick: { kind, id, furniture: entity.furniture }, distance: nearest.distance };
        } else return { pick: { kind, id }, distance: nearest.distance };
      }
    }
    if (ground === undefined) return undefined;
    const spot = { x: ground.point.x, z: ground.point.z };
    // The ray passes through the see-through water to the riverbed below it.
    const onRiver = distanceToRiver(valley.river, spot) <= valley.river.width / 2;
    if (onRiver) return { pick: { kind: "river", spot }, distance: ground.distance };
    return { pick: isRiverBank(valley, spot) ? { kind: "ground", spot, riverBank: true } : { kind: "ground", spot }, distance: ground.distance };
  }

  /** How dark the sleep animation made the view in the last frame. */
  let darkness = 0;

  return {
    cameraRig,
    isPlayingSleep: () => posing.sleeping() !== undefined,
    sleepDarkness: () => darkness,
    drawnPlayer: () => ({ work: drawnWork, walkedMetres: posing.walkedMetres() }),
    drawnHourOfDay: () => drawnHour,
    drawnNightHours: () => drawnNightHours,
    render(alpha) {
      const nowSeconds = performance.now() / 1000;
      matchCanvasSize();
      posing.startSleepIfNew(nowSeconds, drawnHour, drawnNightHours);
      posing.endSleepIfDone(nowSeconds);
      const sleeping = posing.sleeping();
      const sleepSeconds = sleeping === undefined ? undefined : nowSeconds - sleeping.since;
      // The sky keeps the bedtime hour until the view is dark, then shows the morning game logic has already reached.
      const atBedtime = sleeping !== undefined && sleepSeconds !== undefined && sleepSeconds < SLEEP_MORNING_AT ? sleeping : undefined;
      const hourOfDay = atBedtime?.hour ?? readHourOfDay();
      const nightHours = atBedtime?.nightHours ?? readNightHours();
      drawnHour = hourOfDay;
      drawnNightHours = nightHours;
      darkness = sleepSeconds === undefined ? 0 : sleepDarknessAt(sleepSeconds);
      darkenView(canvas, darkness);
      const daylight = daylightAt(hourOfDay, nightHours);
      const seasonDay = readSeasonDay();
      riverMeshes.setFrozen(seasonDay.season === "winter");
      riverMeshes.update(nowSeconds, daylight);
      forestMeshes.setLeafTurn(leafTurnShare(seasonDay, readHourOfDay(), { afterWinter: readAfterFirstWinter() }));
      blowWind(nowSeconds);
      forestMeshes.update(nowSeconds);
      forageMeshes.update();
      mushroomLogMeshes.update();
      bedrollMeshes.update();
      pileMeshes.update();
      barkMeshes.update();
      plantedTorchMeshes.update(nowSeconds);
      fishTrapMeshes.update();
      Object.assign(playerDrawnBefore, playerDrawn);
      for (const entity of moving) {
        blendPosition(entity.previousPosition, entity.position, alpha, blended);
        if (entity.player) {
          Object.assign(playerDrawn, blended);
          playerMesh.group.position.set(blended.x, blended.y, blended.z);
        }
      }
      posing.startEatOrDrinkIfNew(nowSeconds);
      posing.pose(nowSeconds);
      const workKindThisFrame = posing.workKind();
      if (workKindThisFrame === undefined) drawnWork = undefined;
      else if (drawnWork?.kind !== workKindThisFrame) drawnWork = { kind: workKindThisFrame, since: nowSeconds };
      playerMesh.setMotion("forage-eat-drink-animation", posing.eatOrDrinkShown());
      // With follow off, the camera first looks at the player once the player is placed. After that it stays put.
      if (!cameraPlaced && players.first !== undefined) {
        cameraRig.snapToFollowTarget();
        cameraPlaced = true;
      }
      placeCamera();
      lightTorches(nowSeconds);
      // Trees between the camera and the player fade, so the player stays in view in a dense forest.
      forestMeshes.seeThroughTo(players.first === undefined ? null : playerDrawn);
      // The wall mode says which cabin roofs hide and which cabin sides fade. Walls between the camera and the player always fade.
      const eye = cameraRig.view().eye;
      const cutaway = players.first === undefined ? NO_CUTAWAY : cabinCutaway(entities, wallMode, eye, playerDrawn);
      structureMeshes.update({ nowSeconds, cutaway, player: playerDrawn, ropeHold: playerMesh.ropeHold() });
      outlineHovered();
      const changedGround = drawnGround.refresh();
      valleyMeshes.redrawGround(changedGround);
      undergrowthMeshes.regrow(changedGround);
      undergrowthMeshes.update(cameraRig.view().focus);
      rainEffect.update(nowSeconds, cameraRig.view().focus, daylight);
      snowfallEffect.update(nowSeconds, cameraRig.view().focus, daylight);
      snowCoverLook.update(snowCoverDepth(entities));
      birdMeshes.update(nowSeconds, players.first === undefined ? undefined : playerDrawn, daylight);
      fireflyEffect.update(nowSeconds, players.first === undefined ? cameraRig.view().focus : playerDrawn, daylight, seasonDay.season === "summer");
      windowGlowMeshes.update({ daylight, nowSeconds, cutaway });
      skyLighting.update(hourOfDay, nightHours, { focus: cameraRig.view().focus, distance: cameraRig.distance });
      // Trees, plants, and undergrowth draw only what the camera and the sun's shadow box can see.
      const views = { view: frustumOf(camera, viewFrustum), eye: camera.position, shadow: skyLighting.shadowFrustum() };
      forestMeshes.cull(views);
      forageMeshes.cull(views);
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
      const structure = nearest === undefined ? undefined : structureKindOf(nearest.entity);
      if (nearest === undefined || id === undefined || structure === undefined || (under !== undefined && under.distance < nearest.distance))
        return under?.pick;
      return { kind: "structure", id, structure, under: under?.pick };
    },
    setHovered(pick) {
      const entityPick = pick !== undefined && "id" in pick && pick.kind !== "structure" ? pick : undefined;
      const entity = entityPick === undefined ? undefined : entities.entity(entityPick.id);
      hovered = entityPick !== undefined && entity !== undefined ? { kind: entityPick.kind, entity } : undefined;
    },
    showPlanting(planting) {
      const shown = planting && {
        spot: { x: planting.spot.x, y: terrainHeightAt(valley.terrain, planting.spot.x, planting.spot.z), z: planting.spot.z },
        allowed: planting.allowed,
      };
      forestMeshes.showPlantingSapling(planting?.plant === "sapling" ? shown : undefined);
      forageMeshes.showPlantingBush(planting?.plant === "berryBush" ? shown : undefined);
    },
    showPlacingBlueprint(placing) {
      structureMeshes.showPlacingBlueprint(placing);
    },
    setWallMode(mode) {
      wallMode = mode;
    },
    dispose() {
      hoverOutline.dispose();
      windowGlowMeshes.dispose();
      valleyMeshes.dispose();
      undergrowthMeshes.dispose();
      riverMeshes.dispose();
      forestMeshes.dispose();
      structureMeshes.dispose();
      forageMeshes.dispose();
      mushroomLogMeshes.dispose();
      bedrollMeshes.dispose();
      pileMeshes.dispose();
      barkMeshes.dispose();
      plantedTorchMeshes.dispose();
      fishTrapMeshes.dispose();
      rainEffect.dispose();
      snowfallEffect.dispose();
      birdMeshes.dispose();
      fireflyEffect.dispose();
      playerMesh.dispose();
      renderer.dispose();
    },
  };
}
