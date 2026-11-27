import type { EatOrDrinkView, SleepView } from "../sim/api";
import { playerActivity } from "../sim/activity";
import { diggingClayNow } from "../sim/clay";
import { gatheringStoneNow } from "../sim/stone";
import { REACH_SECONDS } from "../sim/hand-reach";
import { REAL_MS_PER_GAME_MINUTE } from "../sim/clock";
import type { Entity, EntityStore } from "../sim/entities";
import { distanceToRiver, terrainHeightAt, type Valley } from "../sim/valley";
import { isCarriedLog } from "../sim/wood-and-fuel";
import { copyToward, groundDistance, headingToward, type GroundPoint } from "../sim/ground-point";
import type { NightHours } from "../sim/season";
import { quarterTurnsToRadians } from "../sim/quarter-turns";
import type { createPlayerMesh } from "./player-mesh";
import type { Fishing } from "./player-motions/fishing-animation";
import { craftMotionOf } from "./player-hand-craft-pose";
import { createSawingStep } from "./sawing-stance";
import { EAT_DRINK_SECONDS, eatDrinkCutShort, reachMotionOf, type DoingNow, type EatDrinkKind, type EatDrinkMotion } from "./player-eat-drink-pose";
import { BED_SLEEP_SECONDS, bedSleepSpotFrom } from "./bed-sleep";
import { seatedSpot, sitBodyAt, sitSinkAt, sitSpotFrom, standBodyAt, standSecondsAfter, standSinkAt, standSpotFrom } from "./sit-animation";
import { SLEEP_SECONDS, sleepSpotFrom, type SleepSpot } from "./sleep-animation";
import { isDrawnWork, type DrawnWork } from "./drawn-work";

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

/** Poses the drawn player from game logic: walking, work, reaching, sitting, sleeping, eating, and drinking. */
export interface PlayerPosing {
  /** Where the player is drawn this frame. Space moves the camera to it, and the camera follows it when follow is on. */
  readonly playerDrawn: { x: number; y: number; z: number };
  /** Where the player was drawn the frame before. */
  readonly playerDrawnBefore: { x: number; y: number; z: number };
  /** Starts the sleep animation when game logic reports a sleep it has not played yet. Run it before the player is placed. */
  startSleepIfNew(nowSeconds: number, hour: number, nightHours: NightHours): void;
  /** Ends the sleep animation once it has played out. */
  endSleepIfDone(nowSeconds: number): void;
  /** The sleep animation, while it plays. */
  sleeping(): { since: number; hour: number; nightHours: NightHours } | undefined;
  /** Starts an eat or drink motion when game logic reports a bite or drink it has not played yet. Run it before posing the player. */
  startEatOrDrinkIfNew(nowSeconds: number): void;
  /** Poses the player for this frame. */
  pose(nowSeconds: number): void;
  /** The kind of work drawn this frame. */
  workKind(): DrawnWork | undefined;
  /** The total metres walked if the legs walk this frame. */
  walkedMetres(): number | undefined;
  /** The forage, eat, or drink motion posing the player this frame, if any. */
  eatOrDrinkShown(): EatDrinkMotion | undefined;
}

/** playerMesh is the mesh the renderer draws the player with. */
export function createPlayerPosing(
  entities: EntityStore,
  valley: Valley,
  playerMesh: ReturnType<typeof createPlayerMesh>,
  readLastSleep: () => SleepView | null,
  readLastEatOrDrink: () => EatOrDrinkView | null,
): PlayerPosing {
  const playerDrawn = { x: 0, y: 0, z: 0 };
  const playerDrawnBefore = { x: 0, y: 0, z: 0 };
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

  /** Starts the sleep animation when game logic reports a sleep it has not played yet. Run it before the player is placed. */
  function startSleepIfNew(nowSeconds: number, drawnHour: number, drawnNightHours: NightHours): void {
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

  return {
    playerDrawn,
    playerDrawnBefore,
    startSleepIfNew,
    endSleepIfDone(nowSeconds) {
      if (sleeping !== undefined && nowSeconds - sleeping.since >= (sleeping.bed === undefined ? SLEEP_SECONDS : BED_SLEEP_SECONDS)) sleeping = undefined;
    },
    sleeping: () => sleeping,
    startEatOrDrinkIfNew,
    pose: posePlayer,
    workKind: () => workKindThisFrame,
    walkedMetres: () => walkedMetresThisFrame,
    eatOrDrinkShown: () => eatOrDrinkShown,
  };
}
