import { createRegrowth } from "./regrowth";
import { createGroundChanges } from "./ground-changes";
import type { GroundMap } from "./ground-types";
import { createActionQueue } from "./action-queue";
import type { ActionCommand, Command } from "./api-commands";
import type { GameClient } from "./api-client";
import type { GameView, PlayerAction } from "./api-game-view";
import type { Refusal } from "./api-refusal";
import { createBedrolls, bedrollRules } from "./bedrolls";
import { createBeds, bedRules } from "./beds";
import { createStools, stoolRules } from "./stools";
import { createApproach } from "./approach";
import { playerActivity, playerIsBusy, type Activity } from "./activity";
import { createBuilding } from "./building";
import { buildingRules } from "./building-rules";
import { addOnRules } from "./add-ons";
import { createTakingDown, takingDownRules } from "./taking-down";
import { createCarrying, carryingRules } from "./carrying";
import { createCampfires, campfireRules } from "./campfires";
import { createChopping, choppingRules } from "./chopping";
import { createDiggingUp, diggingUpRules } from "./digging-up";
import { createPlanting, plantingRules } from "./planting";
import { createMushroomLogs, mushroomLogRules } from "./mushroom-logs";
import { createDebarking, debarkingRules } from "./debarking";
import { createCrafting, craftingRules } from "./crafting";
import { clockStartMinutes, createClock, nextMorning, readClock, REAL_MS_PER_GAME_MINUTE, timeRules } from "./clock";
import { NEW_GAME_YEAR_START_DAY, type SeasonDay, seasonDayOf } from "./season";
import { createForaging, foragingRules } from "./foraging";
import { createGathering, gatheringRules } from "./gathering";
import { createEntityStore, movingEntities, restoreEntities, saveEntities, type EntityStore } from "./entities";
import { generateValley, type Valley } from "./valley";
import type { WalkMap } from "./walk-map";
import { createWalking, walkingRules } from "./walking";
import { needsSpeed } from "./needs";
import { createDrinking, drinkingRules } from "./drinking";
import { createFishing, fishingRules } from "./fishing";
import type { CommandRule, CommandRules, RuleGame } from "./command-rule";
import { createStoneGathering, stoneRules } from "./stone";
import { clayRules, createClayDigging } from "./clay";
import { createTorches, torchRules } from "./torches";
import { createShutters, shuttersRules } from "./shutters";
import { createFishTraps, fishTrapRules } from "./fish-traps";
import { createPot, potRules } from "./pot";
import { createRainBarrels, rainBarrelRules } from "./rain-barrels";
import { createDryingRacks, dryingRackRules } from "./drying-racks";
import { createCooking, cookingRules } from "./cooking";
import { createFiring, firingRules } from "./firing";
import { createJugs, jugRules } from "./jugs";
import { refusedNotice } from "./notices";
import { createPiles, pileRules } from "./piles";
import { createSleds, DRAG_SPEED, sledRules } from "./sleds";
import { createSledFilling, sledFillingRules } from "./sled-filling";
import { createWoodpiles, woodpileRules } from "./woodpiles";
import { createWoodBoxes, woodBoxRules } from "./wood-boxes";
import { createChests, chestRules } from "./chests";
import { createSpoiling } from "./spoiling";
import { createStickFallSystem } from "./stick-fall";
import { createHandReach } from "./hand-reach";
import { journalRules } from "./journal";
import { createGameNotices } from "./game-notices";
import { addNewPlayer, addValleyEntities, savedPlayer } from "./game-player";
import { newGameStart, type GameOptions, type GameProgress } from "./game-start";
import { snowSpeedWhereStanding } from "./snow-walking";
import { createEatOrDrinkReport } from "./eat-or-drink-report";
import { createGameClient } from "./game-client";
import { snapshotOf } from "./game-view";
import { createSleeping } from "./sleeping";
import { createTimePassing } from "./time-passing";

/** Logic steps per second. Rendering blends between steps, so this can stay low. */
export const STEPS_PER_SECOND = 30;
export const STEP_MS = 1000 / STEPS_PER_SECOND;

export interface Game {
  readonly entities: EntityStore;
  /** The valley's ground, river, and starting tree spots. These never change during a game. */
  readonly valley: Valley;
  /** Which parts of the valley floor can be walked on. It updates itself as blockers are added and removed. */
  readonly walkMap: WalkMap;
  /** Runs one fixed logic step. */
  step(): void;
  /** What the UI uses: it reads a GameView and sends commands. */
  readonly client: GameClient;
  /** A copy of the game's progress, for saving. Changing the copy does not change the game. */
  progress(): GameProgress;
  /** The valley's ground types now, as the ground follows the trees that stand for good. */
  groundMap(): GroundMap;
}

export function createGame({
  seed,
  progress,
  startNotice,
  freeBuilding: freeOption = false,
  instantBuilding = false,
  journalFromCamp = false,
  startSeason,
}: GameOptions): Game {
  const freeBuilding = freeOption || instantBuilding;
  const entities = createEntityStore();
  const valley = generateValley(seed);
  if (progress === undefined) addValleyEntities(entities, valley);
  else restoreEntities(entities, structuredClone(progress.entities));
  const walking = createWalking(entities, valley);
  const player = progress === undefined ? addNewPlayer(entities, walking, valley, freeBuilding) : savedPlayer(entities);
  const handReach = createHandReach(entities);
  const chopping = createChopping(entities, walking, valley);
  const carrying = createCarrying(entities, valley, handReach);
  const debarking = createDebarking(entities);
  const crafting = createCrafting(entities, valley.terrain);
  const gathering = createGathering(entities, handReach);
  const foraging = createForaging(entities, handReach, isWinter);
  const building = createBuilding(entities, walking, valley, handReach, freeBuilding, instantBuilding);
  const takingDown = createTakingDown(entities, walking, valley);
  // A fire takes its firewood from a wood box in its room first.
  const woodBoxes = createWoodBoxes(entities);
  const campfires = createCampfires(entities, woodBoxes);
  const bedrolls = createBedrolls(entities, valley, handReach, (bedroll) => {
    sleeping.sleepOn(bedroll);
  });
  const beds = createBeds(entities, walking.walkMap, (bed) => {
    sleeping.sleepIn(bed);
  });
  const woodpiles = createWoodpiles(entities);
  const sleds = createSleds(entities, valley, walking.walkMap);
  const sledFilling = createSledFilling(entities, walking, handReach);
  // The clock is read only once the game runs.
  const chests = createChests(entities, () => clock.minutes);
  // The player puts down what they hold to sit, as they do to sleep.
  const stools = createStools(entities, () => {
    carrying.drop();
    sleds.letGo();
  });
  const drinking = createDrinking(entities, walking.walkMap, valley, (river) => {
    eatOrDrink.report("drinkFromRiver", river);
  });
  const fishing = createFishing(entities, walking.walkMap, valley, seed, STEP_MS / REAL_MS_PER_GAME_MINUTE, isWinter);
  const stoneGathering = createStoneGathering(entities, walking.walkMap, valley);
  const clayDigging = createClayDigging(entities, walking.walkMap, valley);
  const fishTraps = createFishTraps(entities, walking.walkMap, valley, seed, isWinter);
  // The ground follows the trees that stand for good. The clock is read only once the game runs.
  const groundChanges = createGroundChanges(entities, valley, () => clock.minutes);
  const diggingUp = createDiggingUp(entities, (spot) => {
    groundChanges.treeGone(spot);
  });
  const planting = createPlanting(entities, walking.walkMap, valley);
  const mushroomLogs = createMushroomLogs(entities);
  const pot = createPot(entities, walking.walkMap, valley, campfires, handReach);
  const rainBarrels = createRainBarrels(entities);
  const dryingRacks = createDryingRacks(entities);
  const cooking = createCooking(entities, campfires);
  const firing = createFiring(entities, campfires);
  const jugs = createJugs(entities);
  const torches = createTorches(entities, valley, handReach);
  const shutters = createShutters(entities);
  const piles = createPiles(entities, valley, handReach, () => clock.minutes);
  const spoiling = createSpoiling(entities);
  const stickFall = createStickFallSystem(entities, valley);
  const regrowth = createRegrowth(entities, walking.walkMap, (spot) => {
    groundChanges.treeGrown(spot);
  });
  const approach = createApproach(entities, walking, {
    reach: (command) => ruleOf(command).approach?.reach(command),
    refusal: refusalOf,
    act: (command) => ruleOf(command).approach?.act(command),
    stopOtherWork: cancelTasks,
  });
  /** Everything the player does over time, in the order each logic step runs them. Reaching a bedroll or bed to sleep on puts the player to sleep. */
  const activities: readonly Activity[] = [
    // First, so timed work that an approach starts on arrival, such as chopping, moves on in that same step.
    approach,
    chopping,
    debarking,
    crafting,
    gathering,
    building,
    sledFilling,
    takingDown,
    stools,
    fishing,
    stoneGathering,
    clayDigging,
    diggingUp,
    planting,
    mushroomLogs,
    chests,
    // Last, so a reach started by a step above moves on in that same step.
    handReach,
  ];
  const moving = movingEntities(entities);
  const pendingCommands: Command[] = [];
  const listeners = new Set<() => void>();
  const gameStartMinutes = clockStartMinutes(newGameStart(progress === undefined ? startSeason : undefined));
  const clock = createClock(progress?.clockMinutes ?? gameStartMinutes);
  const yearStartDay = progress?.yearStartDay ?? NEW_GAME_YEAR_START_DAY;
  const notices = createGameNotices({ entities, player, clock, freeBuilding, progress, journalFromCamp, seasonNow });
  const timePassing = createTimePassing({
    seed,
    entities,
    player,
    valley,
    walkMap: walking.walkMap,
    clock,
    yearStartDay,
    // When the first night ends. Reaching it without a collapse counts as surviving the night.
    firstMorning: nextMorning(gameStartMinutes, yearStartDay),
    firstNightOver: progress?.firstNightOver ?? false,
    seasonNow,
    isWinter,
    isWinterAt,
    isWorking: () => currentAction() !== null,
    isResting,
    showNotice: notices.show,
    foodSpoiled: (food, count) => {
      notices.foodSpoiled(food, count);
    },
    cancelTasks,
    emptyActionQueue: () => {
      actionQueue.empty();
    },
    stools,
    torches,
    carrying,
    sleds,
    rainBarrels,
    campfires,
    foraging,
    regrowth,
    stickFall,
    pot,
    cooking,
    firing,
    fishTraps,
    dryingRacks,
    spoiling,
  });
  const sleeping = createSleeping({
    entities,
    player,
    clock,
    yearStartDay,
    torches,
    carrying,
    sleds,
    passTime: timePassing.passTime,
    reachGoal: notices.reachGoal,
  });
  let paused = false;
  const eatOrDrink = createEatOrDrinkReport();
  let stepCount = progress?.stepCount ?? 0;
  /** Whether cancelTasks has run since the command being carried out began, so applyCommand can report that it stopped what the player was doing. */
  let stoppedWork = false;
  /** The action queue: the action under way first, then those waiting their turn. It is not saved. */
  const actionQueue = createActionQueue({
    rule: ruleOf,
    refusal: refusalOf,
    carryOut: applyCommand,
    playerIsBusy: () => playerIsBusy(player),
    stopUnderWay: () => {
      cancelTasks();
      stools.standUp();
      handReach.cancel();
      entities.removeComponent(player, "walkPath");
    },
    showNotice: notices.show,
  });
  if (startNotice !== undefined) notices.show(startNotice);
  const nearbySources = { entities, campfires, woodpiles, bedrolls, piles, building, chests, rainBarrels, dryingRacks, woodBoxes };
  let view = snapshot();

  /** The view of the game now. */
  function snapshot(): GameView {
    return snapshotOf({
      ...nearbySources,
      seed,
      player,
      clock,
      yearStartDay,
      instantBuilding,
      season: seasonNow(),
      action: currentAction(),
      paused,
      stepCount,
      lastEatOrDrink: eatOrDrink.last(),
      notices,
      sleeping,
      sleds,
      torches,
      actionQueue,
    });
  }

  function currentAction(): PlayerAction | null {
    const activity = playerActivity(entities, player);
    return activity === undefined ? null : Object.freeze({ kind: activity.kind, progress: activity.progress });
  }

  /** Stops whatever the player was walking to do, before they start something else. */
  function cancelTasks(): void {
    stoppedWork = true;
    for (const activity of activities) activity.cancel();
  }

  /** Whether the player is resting: standing still and doing no work. Resting helps sickness wear off. */
  function isResting(): boolean {
    return player.walkPath === undefined && player.approach === undefined && currentAction() === null;
  }

  /** Whether the player's hands are busy dragging a sled, and the command needs them free. */
  function handsBusy(command: ActionCommand): boolean {
    if (player.dragging === undefined) return false;
    const needs = ruleOf(command).needsFreeHands;
    return typeof needs === "function" ? needs(command) : needs === true;
  }

  /** The rule for a command. */
  function ruleOf(command: ActionCommand): CommandRule<ActionCommand> {
    // TypeScript cannot tell that the rule picked by `command.type` takes this same command, so we say so.
    return commandRules[command.type] as CommandRule<ActionCommand>;
  }

  /** What the command rules use from the game. */
  const ruleGame: RuleGame = {
    entities,
    player,
    hand: handReach,
    startApproach: (command) => approach.start(command),
    stopOtherWork: cancelTasks,
  };

  /**
   * The rule for each kind of command, from the module that carries it out. TypeScript reports a kind with no rule.
   * This file keeps only what every command shares: hands busy with a sled, standing up from a stool, cancelling tasks,
   * and the action queue. A new command touches these files, and no other file in the sim:
   * - its activity module, which exports its rule (see command-rule.ts);
   * - the `Command` union in src/sim/api-commands.ts;
   * - the save check for commands in src/sim/save-schema.ts;
   * - the UI files that offer it, such as src/app/thing-actions.ts;
   * - src/strings.ts, for its label.
   */
  const commandRules: CommandRules = {
    ...timeRules({
      setPaused: (now) => {
        paused = now;
      },
      passTime: (gameMinutes) => {
        timePassing.passTime(gameMinutes);
      },
      skipToRainChange: () => {
        timePassing.skipToRainChange();
      },
      skipToSeason: () => {
        timePassing.skipToSeason();
      },
    }),
    ...walkingRules(walking),
    ...choppingRules(chopping),
    ...diggingUpRules(diggingUp),
    ...plantingRules(planting),
    ...mushroomLogRules(mushroomLogs),
    ...carryingRules(carrying, ruleGame),
    ...debarkingRules(debarking, ruleGame),
    ...craftingRules(crafting, ruleGame),
    ...torchRules(torches, ruleGame),
    ...shuttersRules(shutters),
    ...gatheringRules(gathering, carrying, ruleGame),
    ...foragingRules(foraging, () => {
      eatOrDrink.report("eat");
    }),
    ...pileRules(piles, ruleGame),
    ...buildingRules(building, ruleGame),
    ...addOnRules(building, ruleGame),
    ...takingDownRules(takingDown),
    ...campfireRules(campfires, ruleGame),
    ...potRules(pot, campfires, ruleGame, () => {
      eatOrDrink.report("drinkFromPot");
    }),
    ...cookingRules(cooking, campfires, ruleGame),
    ...firingRules(firing, campfires, ruleGame),
    ...jugRules(jugs, () => {
      eatOrDrink.report("drinkFromJug");
    }),
    ...woodpileRules(woodpiles, ruleGame),
    ...sledRules(sleds, ruleGame),
    ...sledFillingRules(sledFilling),
    ...chestRules(chests, ruleGame),
    ...bedrollRules(bedrolls, ruleGame),
    ...bedRules(beds, ruleGame),
    ...stoolRules(stools, ruleGame),
    ...rainBarrelRules(rainBarrels, ruleGame),
    ...dryingRackRules(dryingRacks, ruleGame, () => clock.minutes),
    ...woodBoxRules(woodBoxes, ruleGame),
    ...drinkingRules(drinking),
    ...fishingRules(fishing),
    ...fishTrapRules(fishTraps, ruleGame),
    ...stoneRules(stoneGathering),
    ...clayRules(clayDigging),
    ...journalRules((hidden) => {
      notices.hideJournal(hidden);
    }),
  };

  /** The season today, from the day on the clock and the day the year started on. */
  function seasonNow(): SeasonDay {
    return seasonDayOf(readClock(clock.minutes).day, yearStartDay);
  }

  /** Whether it is winter now, when nature rests: nothing grows and the river is frozen. */
  function isWinter(): boolean {
    return isWinterAt(clock.minutes);
  }

  /** Whether it is winter at this game minute, counted from midnight at the start of day 1. */
  function isWinterAt(minutes: number): boolean {
    return seasonDayOf(readClock(minutes).day, yearStartDay).season === "winter";
  }

  /**
   * Carries out a command, once its refusal passes. A refused command does nothing, and a notice says why.
   * Returns whether it stopped what the player was doing.
   */
  function applyCommand(command: ActionCommand): boolean {
    const refusal = refusalOf(command);
    if (refusal !== null) {
      notices.show(refusedNotice(refusal));
      return false;
    }
    stoppedWork = false;
    const rule = ruleOf(command);
    // The player stands up from a stool as soon as they walk or act. Pausing or skipping time is not acting.
    if (rule.keepsPlayerSitting !== true) stools.standUp();
    // A new command cancels a reach in progress, unless its rule keeps it. If the hand has not got to the thing yet, its command is never carried out.
    if (rule.keepsHandReach !== true) handReach.cancel();
    if (rule.start === "fresh") cancelTasks();
    notices.refuseWith(rule.run === undefined ? approach.start(command) : rule.run(command));
    return stoppedWork;
  }

  /** Why the game would turn a command away now: the player's hands being busy with a sled first, then the command's own rule. */
  function refusalOf(command: Command): Refusal | null {
    if (command.type === "queueAction") return refusalOf(command.action);
    if (command.type === "cancelQueuedAction") return null;
    if (handsBusy(command)) return Object.freeze({ kind: "letGoFirst" });
    const refusal = ruleOf(command).refusal?.(command);
    return refusal === undefined ? null : Object.freeze(refusal);
  }

  function step(): void {
    for (const command of pendingCommands.splice(0)) actionQueue.receive(command);

    if (!paused) {
      for (const entity of moving) {
        Object.assign(entity.previousPosition, entity.position);
      }
      // A player with a low need moves and works more slowly, as if less time passed for them.
      const playerSeconds = (STEP_MS / 1000) * needsSpeed(player.needs);
      // Dragging a sled and deep snow slow walking further, but not other work.
      const walkingSeconds = playerSeconds * snowSpeedWhereStanding(entities, player.position, timePassing.snow());
      walking.step(player.dragging === undefined ? walkingSeconds : walkingSeconds * DRAG_SPEED);
      sleds.follow();
      for (const activity of activities) notices.refuseWith(activity.step(playerSeconds));
      timePassing.passTime(STEP_MS / REAL_MS_PER_GAME_MINUTE);
      actionQueue.moveOn();
      notices.noteGoals();
      notices.noticeSpoiledFood();
      notices.noticeSnugRoom();
      notices.noticeSeasonStart();
      stepCount += 1;
    }

    view = snapshot();
    for (const listener of listeners) listener();
  }

  const client = createGameClient({
    entities,
    player,
    building,
    campfires,
    woodpiles,
    sleds,
    dryingRacks,
    getView: () => view,
    refusal: refusalOf,
    pendingCommands,
    listeners,
  });

  function readProgress(): GameProgress {
    return structuredClone({
      clockMinutes: clock.minutes,
      yearStartDay,
      stepCount,
      firstNightOver: timePassing.firstNightOver(),
      ...notices.saved(),
      entities: saveEntities(entities),
    });
  }

  return { entities, valley, walkMap: walking.walkMap, step, client, progress: readProgress, groundMap: () => groundChanges.mapNow() };
}
