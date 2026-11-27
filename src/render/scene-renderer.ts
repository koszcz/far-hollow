import * as THREE from "three";
import type { EatOrDrinkView, SleepView } from "../sim/api-game-view";
import type { GroundOrThingPick, ScenePick } from "../sim/api-scene-pick";
import type { PlacingBlueprint } from "../sim/api-client";
import type { Plantable, SeasonDay } from "../sim/api";
import { playerActivity } from "../sim/activity";
import { diggingClayNow } from "../sim/clay";
import { gatheringStoneNow } from "../sim/stone";
import { REACH_SECONDS } from "../sim/hand-reach";
import { MINUTES_PER_HOUR, REAL_MS_PER_GAME_MINUTE } from "../sim/clock";
import { isRaining, movingEntities, snowCoverDepth, playerEntities, type Entity, type EntityStore } from "../sim/entities";
import { structureKindOf } from "../sim/structures";
import { distanceToRiver, terrainHeightAt, type Valley } from "../sim/valley";
import { isRiverBank } from "../sim/river-bank-work";
import { isCarriedLog } from "../sim/wood-and-fuel";
import { createGroundMap } from "../sim/ground-types";
import { copyToward, groundDistance, headingToward, type GroundPoint } from "../sim/ground-point";
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
import type { Fishing } from "./player-motions/fishing-animation";
import { craftMotionOf } from "./player-hand-craft-pose";
import { createRainEffect } from "./rain-effect";
import { createSnowfallEffect } from "./snowfall-effect";
import { createSnowCoverLook } from "./snow-cover-look";
import { createFireflyEffect } from "./firefly-effect";
import { fireflyOpenGround } from "./fireflies";
import { createRiverMeshes } from "./river-meshes";
import { createSawingStep } from "./sawing-stance";
import { EAT_DRINK_SECONDS, eatDrinkCutShort, reachMotionOf, type DoingNow, type EatDrinkKind, type EatDrinkMotion } from "./player-eat-drink-pose";
import { createSkyLighting } from "./sky-lighting";
import { BED_SLEEP_SECONDS, bedSleepSpotFrom } from "./bed-sleep";
import { seatedSpot, sitBodyAt, sitSinkAt, sitSpotFrom, standBodyAt, standSecondsAfter, standSinkAt, standSpotFrom } from "./sit-animation";
import { darkenView, SLEEP_MORNING_AT, SLEEP_SECONDS, sleepDarknessAt, sleepSpotFrom, type SleepSpot } from "./sleep-animation";
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
import { quarterTurnsToRadians } from "../sim/quarter-turns";
import { isDrawnWork, type DrawnWork } from "./drawn-work";

export const CAMERA_FIELD_OF_VIEW_DEGREES = 45;
const CAMERA_NEAR_METRES = 0.1;
const CAMERA_FAR_METRES = 4000;
/** How far the fishing line lands beyond the water's edge, in metres. */
const FLOAT_PAST_EDGE_METRES = 1;
/** The line lands at least this far, and at most this far, in front of the player's feet, in metres. */
const FLOAT_MIN_METRES = 2;
const FLOAT_MAX_METRES = 6;
/** Drawing keeps its own clock for each cast. It starts the cast again if game logic is this many seconds away from it. */
const FISHING_DRIFT_SECONDS = 0.5;

/** The player turns to face where they walk only when they move further than this in one frame, in metres. */
const TURN_MIN_TRAVEL_METRES = 0.001;
/** A player gathering stone this close to the spot clicked stands on it, so they keep facing the way they walked. In metres. */
const STAND_ON_SPOT_METRES = 0.3;

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
  /** Where the player is drawn this frame. Space moves the camera to it, and the camera follows it when follow is on. */
  const playerDrawn = { x: 0, y: 0, z: 0 };
  const playerDrawnBefore = { x: 0, y: 0, z: 0 };
  cameraRig.setFollowTarget(playerDrawn);
  const players = playerEntities(entities);
  /** Whether the camera has looked at the player yet. */
  let cameraPlaced = false;
  /** The wall mode the player has chosen with the HUD button. */
  let wallMode: WallMode = STARTING_WALL_MODE;
  /**
   * The reach drawn now: when it began on the frame clock, in seconds, and the logic step's seconds it was last seen at.
   * Game logic moves a reach on once per step, so drawing runs its own clock from the start to keep the motion smooth.
   */
  let reachDrawn: { since: number; seenSeconds: number } | undefined;
  /** Total metres the player has walked, which keeps the legs in step with the ground. */
  let playerWalkedMetres = 0;
  /** The kind of work drawn this frame, and the total metres walked if the legs walk this frame. posePlayer sets them. */
  let workKindThisFrame: DrawnWork | undefined;
  let walkedMetresThisFrame: number | undefined;
  /** The work drawn in the last frame, with when its motion began. */
  let drawnWork: DrawnPlayer["work"];
  /** The hour of the day the sky showed last frame. */
  let drawnHour = readHourOfDay();
  /** The night hours the sky followed last frame. */
  let drawnNightHours = readNightHours();
  /** How many sleeps the player had when the last sleep animation began. */
  let sleepsSeen = readLastSleep()?.count ?? 0;
  /**
   * The sleep animation, while it plays: when it began, on the performance clock in seconds, where the player stood and
   * faced then, the middle of the bedroll or bed, the hour the sky keeps showing until the view is dark, and which way a bed or turned bedroll faces.
   */
  let sleeping:
    | { since: number; from: SleepSpot; at: GroundPoint; hour: number; nightHours: NightHours; bed?: SleepView["bed"]; bedroll?: SleepView["bedroll"] }
    | undefined;

  /** Sitting on a stool, while drawn: when the player reached it, on the performance clock in seconds, where they stood and faced then, and where and how high they sit. */
  let seated: { since: number; from: SleepSpot; seat: SleepSpot; y: number } | undefined;
  /** Standing up from a stool, while drawn: when it began, where the player's feet were then, and how long they had sat, in seconds. */
  let rising: { since: number; seat: SleepSpot; seatedFor: number } | undefined;

  /** How many bites and drinks the player had when the last eat or drink motion began. */
  let eatsOrDrinksSeen = readLastEatOrDrink()?.count ?? 0;
  /**
   * The eat or drink motion drawn now: when it began on the frame clock, in seconds, which it is, the spot on the river
   * for a drink from it, and what the player did last frame, once it has been drawn.
   */
  let eatOrDrinkDrawn: { since: number; kind: EatDrinkKind; toward?: GroundPoint; doing?: DoingNow } | undefined;
  /** The forage, eat, or drink motion posing the player this frame, if any. */
  let eatOrDrinkShown: EatDrinkMotion | undefined;

  /** Steps the drawn player up to the sawhorse to saw planks, and back when sawing stops. */
  const sawingStep = createSawingStep();

  /**
   * The cast drawn now: when it began on the frame clock, in seconds, and where its line lands, from the player's feet.
   * Game logic moves fishing on once per step, so drawing runs its own clock from the cast to keep the motion smooth.
   */
  let castDrawn: { since: number; floatForward: number; floatHeight: number } | undefined;

  /** How the player fishes this frame, from the fishing in game logic. The player stands at `from`, facing the water. */
  function fishingDrawn(nowSeconds: number, task: NonNullable<Entity["fishTask"]>, from: { x: number; y: number; z: number }): Fishing {
    const secondsPerMinute = REAL_MS_PER_GAME_MINUTE / 1000;
    const loggedSinceCast = task.minutesWaited * secondsPerMinute;
    if (castDrawn === undefined || Math.abs(nowSeconds - castDrawn.since - loggedSinceCast) > FISHING_DRIFT_SECONDS) {
      castDrawn = { since: nowSeconds - loggedSinceCast, ...floatSpot(task, from) };
    }
    const sinceCast = nowSeconds - castDrawn.since;
    return {
      nowSeconds,
      sinceCast,
      toBite: Math.max(0, task.biteAfterMinutes * secondsPerMinute - sinceCast),
      floatForward: castDrawn.floatForward,
      floatHeight: castDrawn.floatHeight,
    };
  }

  /** Where the line lands: just past the water's edge, towards the spot the player fishes, from their feet. */
  function floatSpot(spot: GroundPoint, from: { x: number; y: number; z: number }): { floatForward: number; floatHeight: number } {
    const away = groundDistance(spot, from) || 1;
    // Keeps raw numbers: stepAlongHeading or blendGroundPoints would round differently and move the float.
    const along = (metres: number): GroundPoint => ({ x: from.x + ((spot.x - from.x) / away) * metres, z: from.z + ((spot.z - from.z) / away) * metres });
    let edge = FLOAT_MIN_METRES;
    for (let metres = 0; metres <= FLOAT_MAX_METRES; metres += 0.25) {
      edge = metres;
      if (distanceToRiver(valley.river, along(metres)) <= valley.river.width / 2) break;
    }
    const forward = Math.min(FLOAT_MAX_METRES, Math.max(FLOAT_MIN_METRES, edge + FLOAT_PAST_EDGE_METRES));
    const edgeSpot = along(edge);
    return { floatForward: forward, floatHeight: terrainHeightAt(valley.terrain, edgeSpot.x, edgeSpot.z) - from.y };
  }

  const moving = movingEntities(entities);
  const blended = { x: 0, y: 0, z: 0 };
  const raycaster = new THREE.Raycaster();
  const viewFrustum = new THREE.Frustum();
  const pointer = new THREE.Vector2();

  /**
   * Shows what the player is doing: which way they face, what they carry, and whether they build, chop, split, debark, or craft.
   * Debarking bends the player over the log with the drawknife. Cutting planks saws the log on the sawhorse, with the
   * player stepped up beside it. A hand recipe works at something small held at waist height, where the player faces.
   * Game logic decides which work the player is doing, the same way the HUD shows it.
   */
  function posePlayer(nowSeconds: number): void {
    workKindThisFrame = undefined;
    walkedMetresThisFrame = undefined;
    // Sleeping or sitting down ends an eat or drink motion: the branches that show those return before it goes on.
    const eatingOrDrinking = eatOrDrinkDrawn;
    eatOrDrinkDrawn = undefined;
    eatOrDrinkShown = undefined;
    const player = entities.with("player", "position").first;
    if (player === undefined) return;
    // A log rides on the shoulder. A plank or stone fetched for a blueprint rides in both hands.
    const carried = player.carrying;
    playerMesh.setCarryingLog(carried !== undefined && isCarriedLog(carried) ? carried : undefined);
    playerMesh.setMotion("carry-in-hands-animation", carried !== undefined && !isCarriedLog(carried) ? carried : undefined);
    // The lit torch stays in the left hand through every motion. Game logic puts it out before the player sleeps.
    playerMesh.setMotion("torch", player.litTorch === undefined || sleeping !== undefined ? undefined : nowSeconds);
    // Dragging a sled leans the player into the rope, walking or standing. Letting go stands them up at once.
    playerMesh.setMotion("sled-drag-animation", player.dragging !== undefined && sleeping === undefined ? true : undefined);
    if (sleeping !== undefined) {
      // The player steps onto the bedroll and lies along it. Nothing else moves them until they are up again.
      // In a bed, they step up onto the mattress, and back down beside the bed once they stand.
      const seconds = nowSeconds - sleeping.since;
      const spot =
        sleeping.bed === undefined
          ? { ...sleepSpotFrom(sleeping.from, sleeping.at, seconds, quarterTurnsToRadians(sleeping.bedroll?.turns ?? 0)), lift: 0 }
          : bedSleepSpotFrom(sleeping.from, sleeping.at, sleeping.bed.turns, seconds);
      Object.assign(playerDrawn, { x: spot.x, z: spot.z });
      playerMesh.group.position.set(spot.x, playerDrawn.y + spot.lift, spot.z);
      playerMesh.setHeading(spot.heading);
      playerMesh.setWalking(undefined);
      playerMesh.setSitting(undefined);
      playerMesh.setSleeping(seconds);
      seated = undefined;
      rising = undefined;
      return;
    }
    playerMesh.setSleeping(undefined);
    if (poseSitting(nowSeconds, player)) return;
    const activity = playerActivity(entities, player);
    // A bite or drink plays on over walking or work already under way, and stops when new walking or work starts.
    const doing: DoingNow = { walking: player.walkPath !== undefined, busyWith: activity?.kind ?? (player.handReach === undefined ? undefined : "reach") };
    if (
      eatingOrDrinking !== undefined &&
      nowSeconds - eatingOrDrinking.since < EAT_DRINK_SECONDS &&
      (eatingOrDrinking.doing === undefined || !eatDrinkCutShort(eatingOrDrinking.doing, doing))
    ) {
      eatOrDrinkDrawn = { ...eatingOrDrinking, doing };
      eatOrDrinkShown = { kind: eatingOrDrinking.kind, seconds: nowSeconds - eatingOrDrinking.since };
    }
    const target = activity?.targetId === undefined ? undefined : entities.entity(activity.targetId);
    const faceTarget = () => {
      if (target?.position !== undefined) playerMesh.setHeading(headingToward(playerDrawn, target.position));
    };
    // Building crouches the player over the blueprint, facing its middle.
    playerMesh.setMotion("player-build-animation", activity?.kind === "build" ? nowSeconds : undefined);
    // Splitting has its own overhead strike, aimed where the player already faces.
    playerMesh.setSplitting(activity?.kind === "split" ? nowSeconds : undefined);
    // Debarking pulls a drawknife along the log. The player stands off its end, so facing its middle faces along it.
    playerMesh.setMotion("debarking-animation", activity?.kind === "debark" ? nowSeconds : undefined);
    // Gathering stone crouches at the water's edge and lifts a stone, facing the spot clicked, unless the player stands on it.
    // Digging clay plays the same motion with a lump of clay.
    // The game says how long one lift takes, and the motion plays to fit it.
    const bankWork = activity?.kind === "gatherStone" ? gatheringStoneNow(player) : activity?.kind === "digClay" ? diggingClayNow(player) : undefined;
    const lifts = activity?.kind === "digClay" ? "clay" : "stone";
    playerMesh.setMotion("gather-stone-animation", bankWork === undefined ? undefined : { seconds: nowSeconds, lifts, liftSeconds: bankWork.secondsEach });
    if (bankWork !== undefined && groundDistance(playerDrawn, bankWork.spot) > STAND_ON_SPOT_METRES)
      playerMesh.setHeading(headingToward(playerDrawn, bankWork.spot));
    // Fishing casts the line out over the water, waits, and reels a fish in, facing the spot on the river.
    const fishTask = activity?.kind === "fish" ? player.fishTask : undefined;
    if (fishTask === undefined) castDrawn = undefined;
    playerMesh.setMotion("fishing-animation", fishTask === undefined ? undefined : fishingDrawn(nowSeconds, fishTask, playerDrawn));
    if (fishTask !== undefined) playerMesh.setHeading(headingToward(playerDrawn, fishTask));
    // A recipe made at the sawhorse saws. The player steps up beside the beam to saw, and back when sawing stops.
    // A hand recipe, such as crafting the saw, works at it with both hands where the player stands.
    const craftMotion = activity?.kind === "craft" && player.craftTask !== undefined ? craftMotionOf(player.craftTask.recipe) : undefined;
    const sawhorse = craftMotion === "saw" && target?.position !== undefined ? target : undefined;
    workKindThisFrame = sawhorse !== undefined ? "saw" : activity !== undefined && isDrawnWork(activity.kind) ? activity.kind : undefined;
    playerMesh.setMotion("hand-craft-animation", craftMotion === "hand" ? nowSeconds : undefined);
    playerMesh.setMotion("sawing-animation", sawhorse !== undefined && activity !== undefined ? { nowSeconds, progress: activity.progress } : undefined);
    const stance = sawingStep.drawnAt(
      nowSeconds,
      sawhorse?.position === undefined ? undefined : { position: sawhorse.position, turns: sawhorse.facing?.turns ?? 0 },
      { x: playerDrawn.x, z: playerDrawn.z, heading: playerMesh.group.rotation.y },
    );
    if (stance !== undefined) {
      Object.assign(playerDrawn, { x: stance.x, z: stance.z });
      playerMesh.group.position.set(stance.x, playerDrawn.y, stance.z);
      playerMesh.setHeading(stance.heading);
      playerMesh.setChopping(undefined);
      playerMesh.setReaching(undefined);
      // The feet stay planted while sawing. A step up or back walks them across.
      const stepped = groundDistance(playerDrawnBefore, playerDrawn);
      if (stepped > 1e-4) {
        playerWalkedMetres += stepped;
        playerMesh.setWalking(playerWalkedMetres);
        walkedMetresThisFrame = playerWalkedMetres;
      } else {
        playerMesh.setWalking(undefined);
      }
      return;
    }
    // Chopping swings at the tree.
    playerMesh.setChopping(activity?.kind === "chop" ? nowSeconds : undefined);
    if (activity?.kind === "build" || activity?.kind === "chop" || activity?.kind === "debark") faceTarget();
    if (activity !== undefined && activity.kind !== "takeDown") {
      playerMesh.setReaching(undefined);
      return;
    }
    // Reaching to pick something up or put it down. The player faces the thing first.
    const reach = player.handReach;
    if (reach !== undefined) {
      // A reach that starts over, as when a second command follows the first, shows as a new reach.
      if (reachDrawn === undefined || reach.seconds < reachDrawn.seenSeconds) reachDrawn = { since: nowSeconds - reach.seconds, seenSeconds: reach.seconds };
      reachDrawn.seenSeconds = reach.seconds;
      const seconds = Math.min(nowSeconds - reachDrawn.since, REACH_SECONDS);
      playerMesh.setWalking(undefined);
      if (reach.toward !== undefined) playerMesh.setHeading(headingToward(playerDrawn, reach.toward));
      // Foraging a berry bush and filling the pot play their own motions, timed by the reach. Other reaches, such as
      // foraging mushrooms, bend down as the reach clip does.
      const motion = reachMotionOf(reach.reachingFor);
      if (motion !== undefined) {
        playerMesh.setReaching(undefined);
        eatOrDrinkShown = { kind: motion, seconds };
        return;
      }
      // The hand reaches toward the thing, as far as a bend allows.
      playerMesh.setReaching(
        reach.toward === undefined ? { height: reach.height, seconds } : { height: reach.height, seconds, distance: groundDistance(playerDrawn, reach.toward) },
      );
      return;
    }
    reachDrawn = undefined;
    playerMesh.setReaching(undefined);
    // Eating or drinking while standing faces the river for a drink from it. Over walking, the legs keep walking.
    if (eatOrDrinkDrawn !== undefined && !doing.walking) {
      const { toward } = eatOrDrinkDrawn;
      if (toward !== undefined) playerMesh.setHeading(headingToward(playerDrawn, toward));
      playerMesh.setWalking(undefined);
      return;
    }
    const travelled = groundDistance(playerDrawnBefore, playerDrawn);
    if (travelled > TURN_MIN_TRAVEL_METRES) playerMesh.setHeading(headingToward(playerDrawnBefore, playerDrawn));
    if (player.walkPath === undefined) {
      playerMesh.setWalking(undefined);
      return;
    }
    playerWalkedMetres += travelled;
    playerMesh.setWalking(playerWalkedMetres);
    walkedMetresThisFrame = playerWalkedMetres;
  }

  /**
   * Poses the player sitting on a stool, or standing up from one, and returns true while either shows.
   * Game logic keeps the player beside the stool, which blocks walking. Drawing steps them onto it, sits them down,
   * and once game logic stands them up, plays the rise and steps them back to where game logic keeps them.
   */
  function poseSitting(nowSeconds: number, player: Entity): boolean {
    const stool = player.sitting === undefined ? undefined : entities.entity(player.sitting.stoolId);
    if (stool?.position !== undefined) {
      if (seated === undefined) {
        const from = { x: playerDrawn.x, z: playerDrawn.z, heading: playerMesh.group.rotation.y };
        seated = { since: nowSeconds, from, seat: seatedSpot(stool.position, stool.facing?.turns ?? 0), y: stool.position.y };
        rising = undefined;
      }
      const seconds = nowSeconds - seated.since;
      const spot = sitSpotFrom(seated.from, seated.seat, seconds);
      showSittingAt(spot, seated.y - sitSinkAt(seconds));
      playerMesh.setSitting(sitBodyAt(seconds));
      return true;
    }
    if (seated !== undefined) {
      const seconds = nowSeconds - seated.since;
      rising = { since: nowSeconds, seat: sitSpotFrom(seated.from, seated.seat, seconds), seatedFor: seconds };
      seated = undefined;
    }
    if (rising !== undefined) {
      const seconds = nowSeconds - rising.since;
      if (seconds < standSecondsAfter(rising.seatedFor)) {
        const spot = standSpotFrom(rising.seat, playerDrawn, seconds, rising.seatedFor);
        showSittingAt(spot, playerDrawn.y - standSinkAt(seconds, rising.seatedFor));
        playerMesh.setSitting(standBodyAt(seconds, rising.seatedFor));
        return true;
      }
      rising = undefined;
    }
    playerMesh.setSitting(undefined);
    return false;
  }

  /** Draws the player at a spot of sitting or standing up, with nothing else moving them. */
  function showSittingAt(spot: SleepSpot, y: number): void {
    Object.assign(playerDrawn, { x: spot.x, z: spot.z });
    playerMesh.group.position.set(spot.x, y, spot.z);
    playerMesh.setHeading(spot.heading);
    playerMesh.setWalking(undefined);
    playerMesh.setReaching(undefined);
    playerMesh.setChopping(undefined);
    playerMesh.setMotion("player-build-animation", undefined);
  }

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

  /** Starts the sleep animation when game logic reports a sleep it has not played yet. Run it before the player is placed. */
  function startSleepIfNew(nowSeconds: number): void {
    const last = readLastSleep();
    if (last === null || last.count === sleepsSeen) return;
    sleepsSeen = last.count;
    // Game logic has moved the player onto the bedroll, or kept them beside the bed, already. They step there from where they were drawn last frame.
    const from = { x: playerDrawn.x, z: playerDrawn.z, heading: playerMesh.group.rotation.y };
    sleeping = {
      since: nowSeconds,
      from,
      at: last.at,
      hour: drawnHour,
      nightHours: drawnNightHours,
      ...(last.bed === undefined ? {} : { bed: { turns: last.bed.turns } }),
      ...(last.bedroll === undefined ? {} : { bedroll: { turns: last.bedroll.turns } }),
    };
  }

  /** Starts an eat or drink motion when game logic reports a bite or drink it has not played yet. Run it before posing the player. */
  function startEatOrDrinkIfNew(nowSeconds: number): void {
    const last = readLastEatOrDrink();
    if (last === null || last.count === eatsOrDrinksSeen) return;
    eatsOrDrinksSeen = last.count;
    // A jug has no motion of its own yet. Drinking from it raises one hand to the mouth, as eating does.
    const kind = last.kind === "drinkFromJug" ? "eat" : last.kind;
    eatOrDrinkDrawn = { since: nowSeconds, kind, ...copyToward(last.toward) };
  }

  /** How dark the sleep animation made the view in the last frame. */
  let darkness = 0;

  return {
    cameraRig,
    isPlayingSleep: () => sleeping !== undefined,
    sleepDarkness: () => darkness,
    drawnPlayer: () => ({ work: drawnWork, walkedMetres: walkedMetresThisFrame }),
    drawnHourOfDay: () => drawnHour,
    drawnNightHours: () => drawnNightHours,
    render(alpha) {
      const nowSeconds = performance.now() / 1000;
      matchCanvasSize();
      startSleepIfNew(nowSeconds);
      if (sleeping !== undefined && nowSeconds - sleeping.since >= (sleeping.bed === undefined ? SLEEP_SECONDS : BED_SLEEP_SECONDS)) sleeping = undefined;
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
      startEatOrDrinkIfNew(nowSeconds);
      posePlayer(nowSeconds);
      if (workKindThisFrame === undefined) drawnWork = undefined;
      else if (drawnWork?.kind !== workKindThisFrame) drawnWork = { kind: workKindThisFrame, since: nowSeconds };
      playerMesh.setMotion("forage-eat-drink-animation", eatOrDrinkShown);
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
