import { createRegrowth } from "./regrowth";
import { createGroundChanges } from "./ground-changes";
import type { GroundMap } from "./ground-types";
import { TREE_WALK_BLOCK_RADIUS_METRES } from "./tree-size";
import { createActionQueue } from "./action-queue";
import type {
  ActionCommand,
  BedrollView,
  CampfireView,
  Command,
  GameClient,
  GameView,
  NearbyThing,
  NearbyViews,
  Notice,
  PileView,
  PlainNotice,
  PlayerAction,
  Refusal,
  SleepView,
  EatOrDrinkView,
} from "./api";
import { createBedrolls, type BedrollEntity, bedrollRules } from "./bedrolls";
import { createBeds, type BedEntity, bedRules } from "./beds";
import { createStools, stoolRules } from "./stools";
import { createApproach } from "./approach";
import { addToBackpack, BACKPACK_WEIGHT_LIMIT_KG, backpackWeight, createStartingBackpack } from "./backpack";
import { playerActivity, playerIsBusy, type Activity } from "./activity";
import { createBuilding, buildingRules } from "./building";
import { createTakingDown, takingDownRules } from "./taking-down";
import { STRUCTURES } from "./structures";
import { createCarrying, carryingRules } from "./carrying";
import { createCampfires, isWarmedByCampfire, campfireRules } from "./campfires";
import { createChopping, choppingRules } from "./chopping";
import { createDiggingUp, diggingUpRules } from "./digging-up";
import { createPlanting, plantingRules } from "./planting";
import { createMushroomLogs, mushroomLogRules } from "./mushroom-logs";
import { createDebarking, debarkingRules } from "./debarking";
import { createCrafting, RECIPES, craftingRules } from "./crafting";
import {
  clockStartMinutes,
  createClock,
  isNightAt,
  MINUTES_PER_DAY,
  nightHoursAt,
  MINUTES_PER_HOUR,
  nextMorning,
  readClock,
  REAL_MS_PER_GAME_MINUTE,
  type ClockStart,
  timeRules,
} from "./clock";
import {
  firstDayOfSeason,
  isAfterFirstWinter,
  NEW_GAME_YEAR_START_DAY,
  nextSeasonStartDay,
  nightHoursOf,
  type Season,
  type SeasonDay,
  seasonDayOf,
} from "./season";
import { createForaging, valleyForageSpots, foragingRules } from "./foraging";
import { createGathering, gatheringRules } from "./gathering";
import {
  createEntityStore,
  isRaining,
  isSnowing,
  movingEntities,
  rainEntities,
  restoreEntities,
  saveEntities,
  snowCoverDepth,
  type Entity,
  type EntityStore,
  type SavedEntity,
} from "./entities";
import { NO_SNOW_COVER, snowOn, snowWalkingSpeed } from "./snow-cover";
import { finishedFloorOn } from "./floors";
import { snapToGridSquare } from "./build-grid";
import { standingHeightAt } from "./foundations";
import { generateValley, terrainHeightAt, type Valley } from "./valley";
import { copyToward } from "./ground-point";
import { isWalkable, nearestWalkableSpot, type WalkMap } from "./walk-map";
import { createWalking, playerStartSpot, type Walking, walkingRules } from "./walking";
import { createNeeds, hasCollapsed, minutesToRestFully, needsSpeed, passNeedsTime, wakeFromCollapse } from "./needs";
import { createDrinking, drinkingRules } from "./drinking";
import { createFishing, fishingRules } from "./fishing";
import type { CommandRule, CommandRules, RuleGame } from "./command-rule";
import { createStoneGathering, stoneRules } from "./stone";
import { clayRules, createClayDigging } from "./clay";
import { createTorches, torchRules } from "./torches";
import { createShutters, shuttersRules } from "./shutters";
import { createFishTraps, fishTrapRules } from "./fish-traps";
import { createRain, passRainTime } from "./rain";
import { isUnderRoof } from "./roofs";
import { findRooms, isInSnugRoom, isRoomHeated, isRoomSnug, roomAround } from "./rooms";
import { passSicknessTime } from "./sickness";
import { createPot, potRules } from "./pot";
import { createRainBarrels, rainBarrelRules } from "./rain-barrels";
import { createCooking, cookingRules } from "./cooking";
import { createFiring, firingRules } from "./firing";
import { createJugs, jugRules } from "./jugs";
import { NOTICE_MINUTES, refusedNotice } from "./notices";
import { createPiles, pileRules } from "./piles";
import { createSleds, DRAG_SPEED, sledRules } from "./sleds";
import { createWoodpiles, woodpileRules } from "./woodpiles";
import { createChests, chestRules } from "./chests";
import { nearestInReach } from "./reach";
import { describeThing } from "./thing-view";
import { createStickFallSystem } from "./stick-fall";
import { createHandReach } from "./hand-reach";
import { GOAL_NOTICE_MINUTES, goalsProvenByCamp, journalRules, markGoalDone, newJournal, newlyShownGoals, type Goal, type Journal } from "./journal";
import type { GroundPoint } from "./ground-point";

/** The build menu never changes, so every view shares one frozen copy. */
const BUILD_MENU: GameView["buildMenu"] = Object.freeze(
  STRUCTURES.map(({ kind, cost, tool, placement, fixedFacing }) =>
    Object.freeze({
      structure: kind,
      cost: Object.freeze(cost.map((item) => Object.freeze({ ...item }))),
      ...(tool === undefined ? {} : { tool }),
      placement,
      ...(fixedFacing === true ? { fixedFacing } : {}),
    }),
  ),
);

/** Logic steps per second. Rendering blends between steps, so this can stay low. */
export const STEPS_PER_SECOND = 30;
export const STEP_MS = 1000 / STEPS_PER_SECOND;

/** Skipped time runs in slices this many game minutes long. */
const PASS_TIME_SLICE_MINUTES = 1;
/** A new game starts on the morning of day 1. */
export const GAME_START: ClockStart = { day: 1, hour: 8 };

export interface GameOptions {
  /** Decides how the valley is laid out. The same seed always makes the same valley. */
  seed: number;
  /** Carries on a saved game instead of starting a new one. It must have been saved from a game with the same seed. */
  progress?: GameProgress;
  /** A notice to show the player as soon as the game starts. */
  startNotice?: PlainNotice;
  /** Lets the player build anything without spending materials or needing tools. The playground turns it on. It is never saved. */
  freeBuilding?: boolean;
  /**
   * Marks done, with no notice, every journal goal the saved camp proves the player once did.
   * Loading a save made before the journal existed turns it on. It is never saved, so it runs only once for each save.
   */
  journalFromCamp?: boolean;
  /**
   * Starts a new game at the morning hour on day 1 of this season, instead of at GAME_START.
   * The playground's `&season=` sets it. It is ignored when carrying on a saved game.
   */
  startSeason?: Season;
}

/** How many game minutes the banner shows for when a season starts. One game minute is one real second. */
export const SEASON_BANNER_MINUTES = 30;

/** The morning of this day, which falls in this season: the season's morning hour, so winter mornings start at daylight. */
function seasonMorning(season: Season, day: number): ClockStart {
  return { day, hour: nightHoursOf(season).morningHour };
}

/** Where a new game's clock starts: at GAME_START, or on the morning of day 1 of `startSeason` if given. */
export function newGameStart(startSeason: Season | undefined): ClockStart {
  if (startSeason === undefined) return GAME_START;
  return seasonMorning(startSeason, firstDayOfSeason(startSeason, NEW_GAME_YEAR_START_DAY));
}

/**
 * Everything about a game in progress that its seed does not decide. It is plain data, so it can be stored.
 * State kept in entity components is included without any change here.
 */
export interface GameProgress {
  /** Game minutes since midnight at the start of day 1. */
  clockMinutes: number;
  /** The day the year started on, which day 1 of spring falls on. The season follows from it and the day (see season.ts). */
  yearStartDay: number;
  stepCount: number;
  firstNightOver: boolean;
  /** Whether the banner saying a snug room keeps out the cold has shown. It shows once in each game. */
  snugRoomNoticeShown: boolean;
  /** The journal's goals done and whether the player hid it. A playground game keeps it as a new game has it. */
  journal: Journal;
  /** The notice showing now, with the game minute it stops showing at, or null if none shows. */
  notice: (Notice & { untilMinutes: number }) | null;
  /** Every entity, with the id that tasks and commands know it by. */
  entities: SavedEntity[];
}

/** What the player sleeps on. */
type SleepPlace = "bedroll" | "bed";

/** The player entity, with the components every player has. */
type Player = Entity & Required<Pick<Entity, "position" | "previousPosition" | "backpack" | "needs" | "respawnPoint">>;

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

export function createGame({ seed, progress, startNotice, freeBuilding = false, journalFromCamp = false, startSeason }: GameOptions): Game {
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
  const building = createBuilding(entities, walking, valley, handReach, freeBuilding);
  const takingDown = createTakingDown(entities, walking, valley);
  const campfires = createCampfires(entities);
  const bedrolls = createBedrolls(entities, valley, handReach, sleepOn);
  const beds = createBeds(entities, sleepIn);
  const woodpiles = createWoodpiles(entities);
  const sleds = createSleds(entities, valley);
  const chests = createChests(entities);
  // The player puts down what they hold to sit, as they do to sleep.
  const stools = createStools(entities, () => {
    carrying.drop();
    sleds.letGo();
  });
  const drinking = createDrinking(entities, walking.walkMap, valley, (river) => {
    reportEatOrDrink("drinkFromRiver", river);
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
  const cooking = createCooking(entities, campfires);
  const firing = createFiring(entities, campfires);
  const jugs = createJugs(entities);
  const torches = createTorches(entities, valley, handReach);
  const shutters = createShutters(entities);
  const piles = createPiles(entities, valley, handReach);
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
  /** The season the banner last said had started, or the season the game began in. It is not saved. */
  let announcedSeason = seasonNow().season;
  /** The season that has just started, with the game minute its banner stops showing at, or null. It is not saved. */
  let seasonBanner: { season: Season; untilMinutes: number } | null = null;
  // A save made before rain existed has no weather, so it starts dry from here.
  const weather = rainEntities(entities).first ?? entities.add({ rain: createRain(seed, clock.minutes, yearStartDay) });
  const rain = weather.rain;
  entities.addComponent(weather, "snow", snowOn(readClock(clock.minutes), yearStartDay));
  /** When the first night ends. Reaching it without a collapse counts as surviving the night. */
  const firstMorning = nextMorning(gameStartMinutes, yearStartDay);
  /** Whether the first night has ended, by morning coming or by a collapse. */
  let firstNightOver = progress?.firstNightOver ?? false;
  let snugRoomNoticeShown = progress?.snugRoomNoticeShown ?? false;
  const journal: Journal = progress?.journal === undefined ? newJournal() : structuredClone(progress.journal);
  if (journalFromCamp && !freeBuilding) for (const goal of goalsProvenByCamp(entities, player)) markGoalDone(journal, goal);
  /** Goals done that no notice has said so yet, oldest first. Each waits for the one before to go. It is not saved. */
  const goalsToAnnounce: Goal[] = [];
  /** The goal the journal's notice says is done now, with the game minute it stops showing at, or null. It is not saved. */
  let goalNotice: { goal: Goal; untilMinutes: number } | null = null;
  let notice: (Notice & { untilMinutes: number }) | null = progress?.notice ? structuredClone(progress.notice) : null;
  let paused = false;
  /** The player's last sleep since the game was loaded. It is not saved. */
  let lastSleep: SleepView | null = null;
  /** The player's last bite or drink since the game was loaded. It is not saved. */
  let lastEatOrDrink: EatOrDrinkView | null = null;
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
    showNotice,
  });
  if (startNotice !== undefined) showNotice(startNotice);
  let view = snapshot();

  function snapshot(): GameView {
    return Object.freeze({
      seed,
      paused,
      stepCount,
      entityCount: entities.entities.length,
      playerPosition: Object.freeze({ ...player.position }),
      time: readClock(clock.minutes),
      night: isNightAt(clock.minutes, yearStartDay),
      nightHours: nightHoursAt(clock.minutes, yearStartDay),
      season: Object.freeze(seasonNow()),
      afterFirstWinter: isAfterFirstWinter(readClock(clock.minutes).day, yearStartDay),
      seasonBanner: seasonBanner !== null && clock.minutes < seasonBanner.untilMinutes ? seasonBanner.season : null,
      backpack: Object.freeze({ ...player.backpack.contents }),
      backpackWeight: backpackWeight(player.backpack),
      backpackWeightLimit: BACKPACK_WEIGHT_LIMIT_KG,
      buildMenu: BUILD_MENU,
      craftMenu: craftMenu(),
      action: currentAction(),
      carrying: player.carrying ?? null,
      dragging: sleds.dragged() ?? null,
      litTorch: deepFreeze(torches.held() ?? null),
      plantedTorches: deepFreeze(torches.planted()),
      nearby: nearbyThings(),
      needs: Object.freeze({
        hunger: player.needs.hunger.level,
        thirst: player.needs.thirst.level,
        warmth: player.needs.warmth.level,
        fatigue: player.needs.fatigue.level,
      }),
      warmth: player.needs.warmth.level,
      sick: player.sickness !== undefined,
      raining: isRaining(entities),
      snowing: isSnowing(entities),
      snowCover: snowCoverDepth(entities),
      notice: notice !== null && isNoticeOnScreen() ? noticeView(notice) : null,
      lastSleep,
      lastEatOrDrink,
      sittingOn: player.sitting?.stoolId ?? null,
      reach: player.handReach === undefined ? null : Object.freeze({ height: player.handReach.height, seconds: player.handReach.seconds }),
      actionQueue: deepFreeze(structuredClone(actionQueue.actions())),
      // The playground has no journal.
      journal: freeBuilding ? null : deepFreeze({ ...structuredClone(journal), justDone: goalNoticeShown() }),
    });
  }

  /** Shows a notice for as long as its kind shows. A plain notice can be given by its kind alone. */
  function showNotice(shown: Notice | PlainNotice): void {
    const full: Notice = typeof shown === "string" ? { kind: shown } : shown;
    notice = { ...structuredClone(full), untilMinutes: clock.minutes + NOTICE_MINUTES[full.kind] };
  }

  /** Each thing within the player's reach that the HUD shows a panel for, in the order the HUD shows them. */
  function nearbyThings(): readonly NearbyThing[] {
    const things: NearbyThing[] = [];
    const add = <Kind extends NearbyThing["kind"]>(kind: Kind, view: NearbyViews[Kind] | null | undefined): void => {
      if (view !== null && view !== undefined) things.push(Object.freeze({ kind, view }) as NearbyThing);
    };
    add("campfire", nearbyCampfire());
    add("woodpile", woodpiles.nearby());
    add("bedroll", nearbyBedroll());
    add("pile", nearbyPile());
    add("blueprint", building.nearby());
    add("openChest", chests.opened());
    add("rainBarrel", rainBarrels.nearby());
    return Object.freeze(things);
  }

  function nearbyCampfire(): CampfireView | null {
    const id = campfires.nearbyFire();
    return id === undefined ? null : (campfires.describe(id) ?? null);
  }

  function nearbyBedroll(): BedrollView | null {
    const bedroll = bedrolls.nearby();
    const id = bedroll === undefined ? undefined : entities.id(bedroll);
    return id === undefined ? null : Object.freeze({ id });
  }

  function nearbyPile(): PileView | null {
    const pile = piles.nearby();
    const id = pile === undefined ? undefined : entities.id(pile);
    if (pile === undefined || id === undefined) return null;
    return Object.freeze({ id, content: pile.pile.content, count: pile.pile.count });
  }

  /** Every recipe. The HUD asks `refusal` what the player lacks to follow one now. */
  function craftMenu(): GameView["craftMenu"] {
    return deepFreeze(RECIPES.map((recipe) => structuredClone(recipe)));
  }

  /** The notice as the view shows it: without the minute it stops showing at. */
  function noticeView(shown: Notice & { untilMinutes: number }): Notice {
    const fields = Object.entries(structuredClone(shown)).filter(([key]) => key !== "untilMinutes");
    return deepFreeze(Object.fromEntries(fields) as Notice);
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

  /** Shows the notice if what the player tried was refused. */
  function refuseWith(refusal: Notice | PlainNotice | undefined): void {
    if (refusal !== undefined) showNotice(refusal);
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
   * - the `Command` union in src/sim/api.ts;
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
        passTime(gameMinutes);
      },
      skipToRainChange,
      skipToSeason,
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
      reportEatOrDrink("eat");
    }),
    ...pileRules(piles, ruleGame),
    ...buildingRules(building, ruleGame),
    ...takingDownRules(takingDown),
    ...campfireRules(campfires, ruleGame),
    ...potRules(pot, campfires, ruleGame, () => {
      reportEatOrDrink("drinkFromPot");
    }),
    ...cookingRules(cooking, campfires, ruleGame),
    ...firingRules(firing, campfires, ruleGame),
    ...jugRules(jugs, () => {
      reportEatOrDrink("drinkFromJug");
    }),
    ...woodpileRules(woodpiles, ruleGame),
    ...sledRules(sleds, ruleGame),
    ...chestRules(chests, ruleGame),
    ...bedrollRules(bedrolls, ruleGame),
    ...bedRules(beds, ruleGame),
    ...stoolRules(stools, ruleGame),
    ...rainBarrelRules(rainBarrels, ruleGame),
    ...drinkingRules(drinking),
    ...fishingRules(fishing),
    ...fishTrapRules(fishTraps, ruleGame),
    ...stoneRules(stoneGathering),
    ...clayRules(clayDigging),
    ...journalRules((hidden) => {
      journal.hidden = hidden;
      // Goals done while the journal is hidden are never announced.
      if (!hidden) return;
      goalsToAnnounce.splice(0);
      goalNotice = null;
    }),
  };

  /**
   * Moves the clock on by this many game minutes. Campfires burn and the player's needs change as it goes.
   * A long stretch, such as skipped time, runs in short slices, so night falling or a fire going out partway counts.
   * Rain starts and stops as it goes. A collapse ends the stretch early, and then this returns false.
   * `asleepIn` says what the player sleeps on through it, if they sleep.
   */
  function passTime(gameMinutes: number, asleepIn?: SleepPlace): boolean {
    for (let left = gameMinutes; left > 0; left -= PASS_TIME_SLICE_MINUTES) {
      const minutes = Math.min(PASS_TIME_SLICE_MINUTES, left);
      const winter = isWinter();
      clock.skip(minutes / MINUTES_PER_HOUR);
      passRainTime(rain, seed, clock.minutes);
      weather.snow = snowOn(readClock(clock.minutes), yearStartDay);
      // Rain does not put out campfires.
      passWorldTime(minutes, winter);
      const underRoof = isUnderRoof(entities, player.position);
      passNeedsTime(player.needs, minutes, {
        night: isNightAt(clock.minutes, yearStartDay),
        season: seasonNow().season,
        warmedByCampfire: isWarmedByCampfire(entities, player.position),
        working: currentAction() !== null,
        asleep: asleepIn !== undefined,
        inBed: asleepIn === "bed",
        sitting: asleepIn === undefined && player.sitting !== undefined,
        sick: player.sickness !== undefined,
        // Snow chills the player as rain does.
        inRain: rain.falling && !underRoof,
        underRoof,
        inSnugRoom: isInSnugRoom(entities, player.position),
      });
      if (player.sickness !== undefined && passSicknessTime(player.sickness, minutes, { resting: isResting() })) {
        entities.removeComponent(player, "sickness");
      }
      if (hasCollapsed(player.needs)) {
        collapse();
        return false;
      }
      if (!firstNightOver && clock.minutes >= firstMorning) {
        firstNightOver = true;
        showNotice("survivedFirstNight");
      }
    }
    return true;
  }

  /** Moves the clock on until rain starts or stops, slice by slice, so the skip stops on that minute, or at a collapse. */
  function skipToRainChange(): void {
    const wasFalling = rain.falling;
    while (rain.falling === wasFalling) {
      if (!passTime(PASS_TIME_SLICE_MINUTES)) return;
    }
  }

  /** How fast the player walks where they stand: deep snow slows them outdoors, but not on a floor or inside a room. */
  function snowSpeedWhereStanding(): number {
    const square = snapToGridSquare(player.position);
    if (finishedFloorOn(entities, square) !== undefined || roomAround(entities, square) !== undefined) return 1;
    return snowWalkingSpeed(weather.snow?.cover ?? NO_SNOW_COVER);
  }

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
   * Moves the clock on to the morning hour on day 1 of the next season. A collapse on the way does not stop it:
   * the player wakes the next morning and time passes on, so the skip always gets there.
   */
  function skipToSeason(): void {
    const day = nextSeasonStartDay(readClock(clock.minutes).day, yearStartDay);
    const target = clockStartMinutes(seasonMorning(seasonDayOf(day, yearStartDay).season, day));
    while (clock.minutes < target) passTime(target - clock.minutes);
  }

  /** Shows the banner for a season that has started since the last one shown. The step calls it once time has passed. */
  function noticeSeasonStart(): void {
    const { season } = seasonNow();
    if (season === announcedSeason) return;
    announcedSeason = season;
    seasonBanner = { season, untilMinutes: clock.minutes + SEASON_BANNER_MINUTES };
  }

  /**
   * Marks a journal goal done, the first time the player does it, and queues a notice saying so unless the journal is hidden.
   * The playground has no journal, so nothing is marked there.
   */
  function reachGoal(goal: Goal): void {
    if (freeBuilding || !markGoalDone(journal, goal)) return;
    if (!journal.hidden) goalsToAnnounce.push(goal);
  }

  /** Marks done every journal goal the valley shows the player has done, then says so for the oldest waiting, once the last such notice has gone. */
  function noteGoals(): void {
    if (freeBuilding) return;
    for (const goal of newlyShownGoals(journal, entities, player)) reachGoal(goal);
    if (goalNoticeShown() !== null) return;
    const goal = goalsToAnnounce.shift();
    goalNotice = goal === undefined ? null : { goal, untilMinutes: clock.minutes + GOAL_NOTICE_MINUTES };
  }

  /** The goal the journal's notice says is done now, or null if it shows none. */
  function goalNoticeShown(): Goal | null {
    return goalNotice !== null && clock.minutes < goalNotice.untilMinutes ? goalNotice.goal : null;
  }

  /**
   * Shows the banner that a snug room keeps out the cold, the first time in this game the player stands in one.
   * It waits until no other notice is on screen, so neither notice hides the other. The step calls it last,
   * so nothing later in the step can replace the banner before the player sees it.
   */
  function noticeSnugRoom(): void {
    if (snugRoomNoticeShown || isNoticeOnScreen() || !isInSnugRoom(entities, player.position)) return;
    snugRoomNoticeShown = true;
    showNotice("snugRoomKeepsOutCold");
  }

  /** Whether a notice shows on screen now. */
  function isNoticeOnScreen(): boolean {
    return notice !== null && clock.minutes < notice.untilMinutes;
  }

  /**
   * Moves the valley on by this many game minutes: fires and torches burn, in the hand and planted, food and trees grow back,
   * sticks fall, pots and fish heat, rain barrels catch the rain falling now, and set fish traps catch fish.
   * `winter` says whether these minutes fall in winter, when food and trees do not grow and fish traps catch nothing.
   */
  function passWorldTime(minutes: number, winter: boolean): void {
    // Snow does not fill rain barrels.
    rainBarrels.catchRain(minutes, isRaining(entities));
    campfires.burn(minutes);
    torches.burn(minutes);
    foraging.grow(minutes, winter);
    if (!winter) regrowth.grow(minutes);
    stickFall.pass(minutes);
    pot.heat(minutes);
    cooking.cook(minutes);
    firing.fire(minutes);
    fishTraps.pass(minutes, winter);
  }

  /**
   * The player collapses from a neglected need. They drop what is on their shoulder and lose the rest of the day.
   * The lit torch in their hand goes out and is gone, as when they lie down to sleep.
   * They wake the next morning at their respawn point with that need low, keeping everything in their backpack.
   */
  function collapse(): void {
    // A collapse before the first morning means the player did not survive the first night.
    firstNightOver = true;
    cancelTasks();
    actionQueue.empty();
    stools.standUp();
    torches.putOut();
    carrying.drop();
    // The sled stays where the player fell, with its load.
    sleds.letGo();
    entities.removeComponent(player, "walkPath");
    // The valley moves on in two parts when midnight falls before morning, so a season that starts at midnight counts from then.
    const morning = nextMorning(clock.minutes, yearStartDay);
    const midnight = (Math.floor(clock.minutes / MINUTES_PER_DAY) + 1) * MINUTES_PER_DAY;
    let from = clock.minutes;
    for (const until of midnight < morning ? [midnight, morning] : [morning]) {
      clock.skip((until - from) / MINUTES_PER_HOUR);
      passWorldTime(until - from, isWinterAt(from));
      from = until;
    }
    // A bed blocks walking, so a player whose respawn point is a bed wakes on the open ground nearest it.
    const { x, z } = isWalkable(walking.walkMap, player.respawnPoint)
      ? player.respawnPoint
      : (nearestWalkableSpot(walking.walkMap, player.respawnPoint) ?? player.respawnPoint);
    Object.assign(player.position, { x, y: standingHeightAt(entities, valley.terrain, { x, z }), z });
    Object.assign(player.previousPosition, player.position);
    wakeFromCollapse(player.needs);
    showNotice("collapsed");
  }

  /**
   * The player lies down on a bedroll and sleeps. The bedroll becomes their respawn point.
   * At night they sleep until morning. By day they sleep until fatigue is restored. If that would wake them in the night, they sleep on until morning.
   */
  function sleepOn(bedroll: BedrollEntity): void {
    lieDown(bedroll.position);
    Object.assign(player.position, bedroll.position);
    Object.assign(player.previousPosition, player.position);
    sleep("bedroll");
    reachGoal("sleepOnBedroll");
    reportSleep(bedroll.position, undefined, bedroll.facing === undefined ? undefined : { turns: bedroll.facing.turns });
  }

  /**
   * The player lies down in a bed and sleeps, by the same rules as on a bedroll, but regains fatigue twice as fast.
   * The spot where the bed stands becomes their respawn point. They lie in the bed while they sleep, so a roof over the bed counts.
   * The bed blocks walking, so they wake standing where they were beside it, unless a collapse cut sleep short.
   */
  function sleepIn(bed: BedEntity): void {
    lieDown(bed.position);
    const standing = { ...player.position };
    Object.assign(player.position, bed.position);
    if (sleep("bed")) Object.assign(player.position, standing);
    Object.assign(player.previousPosition, player.position);
    reportSleep(bed.position, { turns: bed.facing?.turns ?? 0 });
  }

  /**
   * Records a sleep at `spot` for drawing to play. `bed` says which way the bed faces, for a sleep in a bed.
   * `bedroll` says which way a turned bedroll faces, for a sleep on one.
   */
  function reportSleep(spot: GroundPoint, bed?: SleepView["bed"], bedroll?: SleepView["bedroll"]): void {
    const at = Object.freeze({ x: spot.x, z: spot.z });
    const count = (lastSleep?.count ?? 0) + 1;
    lastSleep = Object.freeze({
      count,
      at,
      ...(bed === undefined ? {} : { bed: Object.freeze({ ...bed }) }),
      ...(bedroll === undefined ? {} : { bedroll: Object.freeze({ ...bedroll }) }),
    });
  }

  /** Records a bite or drink for drawing to play. `toward` is the spot on the river, for a drink from the river. */
  function reportEatOrDrink(kind: EatOrDrinkView["kind"], toward?: GroundPoint): void {
    const count = (lastEatOrDrink?.count ?? 0) + 1;
    lastEatOrDrink = deepFreeze({ count, kind, ...copyToward(toward) });
  }

  /**
   * The player puts down what they hold to lie down at `spot`, which becomes their respawn point.
   * The game puts out the lit torch in their hand, which is then gone, as after putting it out.
   */
  function lieDown(spot: GroundPoint): void {
    torches.putOut();
    carrying.drop();
    sleds.letGo();
    entities.removeComponent(player, "walkPath");
    player.respawnPoint = { x: spot.x, z: spot.z };
  }

  /**
   * The player sleeps where they lie. At night they sleep until morning. By day they sleep until fatigue is restored.
   * If that would wake them in the night, such as after lying down in the evening, they sleep on until morning.
   * Returns false if a collapse cut sleep short.
   */
  function sleep(asleepIn: SleepPlace): boolean {
    const untilMorning = nextMorning(clock.minutes, yearStartDay) - clock.minutes;
    const toRestFully = minutesToRestFully(player.needs, isUnderRoof(entities, player.position), asleepIn === "bed");
    const wakesAtNight = isNightAt(clock.minutes + toRestFully, yearStartDay);
    return passTime(wakesAtNight ? untilMorning : Math.min(untilMorning, toRestFully), asleepIn);
  }

  /**
   * Carries out a command, once its refusal passes. A refused command does nothing, and a notice says why.
   * Returns whether it stopped what the player was doing.
   */
  function applyCommand(command: ActionCommand): boolean {
    const refusal = refusalOf(command);
    if (refusal !== null) {
      showNotice(refusedNotice(refusal));
      return false;
    }
    stoppedWork = false;
    const rule = ruleOf(command);
    // The player stands up from a stool as soon as they walk or act. Pausing or skipping time is not acting.
    if (rule.keepsPlayerSitting !== true) stools.standUp();
    // A new command cancels a reach in progress, unless its rule keeps it. If the hand has not got to the thing yet, its command is never carried out.
    if (rule.keepsHandReach !== true) handReach.cancel();
    if (rule.start === "fresh") cancelTasks();
    refuseWith(rule.run === undefined ? approach.start(command) : rule.run(command));
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
      const walkingSeconds = playerSeconds * snowSpeedWhereStanding();
      walking.step(player.dragging === undefined ? walkingSeconds : walkingSeconds * DRAG_SPEED);
      sleds.follow();
      for (const activity of activities) refuseWith(activity.step(playerSeconds));
      passTime(STEP_MS / REAL_MS_PER_GAME_MINUTE);
      actionQueue.moveOn();
      noteGoals();
      noticeSnugRoom();
      noticeSeasonStart();
      stepCount += 1;
    }

    view = snapshot();
    for (const listener of listeners) listener();
  }

  const client: GameClient = {
    getView: () => view,
    checkPlacement: (structure, at, turns) => building.checkPlacement(structure, at, turns),
    describeBlueprint: (blueprintId) => building.describe(blueprintId) ?? null,
    describeCampfire: (campfireId) => campfires.describe(campfireId) ?? null,
    describeWoodpile: (woodpileId) => woodpiles.describe(woodpileId) ?? null,
    describeSled: (sledId) => sleds.describe(sledId) ?? null,
    describeThing: (id) => describeThing(entities, id) ?? null,
    nearestInReach: () => nearestInReach(entities, player.position),
    refusal: refusalOf,
    describeRooms: () =>
      Object.freeze(
        findRooms(entities).map((room) =>
          Object.freeze({
            squares: Object.freeze(room.map((square) => Object.freeze({ ...square }))),
            heated: isRoomHeated(entities, room),
            snug: isRoomSnug(entities, room),
          }),
        ),
      ),
    send: (command) => {
      pendingCommands.push(command);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  function readProgress(): GameProgress {
    return structuredClone({
      clockMinutes: clock.minutes,
      yearStartDay,
      stepCount,
      firstNightOver,
      snugRoomNoticeShown,
      journal,
      notice,
      entities: saveEntities(entities),
    });
  }

  return { entities, valley, walkMap: walking.walkMap, step, client, progress: readProgress, groundMap: () => groundChanges.mapNow() };
}

/** Freezes plain data and everything inside it, so whoever reads the view cannot change it. */
function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

/** Adds the valley's starting trees, sticks, berry bushes, and mushrooms. */
function addValleyEntities(entities: EntityStore, valley: Valley): void {
  for (const tree of valley.trees) {
    entities.add({
      tree: true,
      position: { x: tree.x, y: terrainHeightAt(valley.terrain, tree.x, tree.z), z: tree.z },
      blocksWalking: { radius: TREE_WALK_BLOCK_RADIUS_METRES },
    });
  }
  for (const stick of valley.sticks) {
    entities.add({ stick: true, position: { x: stick.x, y: terrainHeightAt(valley.terrain, stick.x, stick.z), z: stick.z } });
  }
  for (const spot of valleyForageSpots(valley)) entities.add(spot);
}

/** How many stone a new playground game's backpack holds, so the player can try out stone without gathering it first. */
export const PLAYGROUND_STONE = 5;

/** Adds a new game's player near the river, with a starting backpack. In the playground, it also holds PLAYGROUND_STONE stone. */
function addNewPlayer(entities: EntityStore, walking: Walking, valley: Valley, playground: boolean): Player {
  const backpack = createStartingBackpack();
  if (playground) addToBackpack(backpack, "stone", PLAYGROUND_STONE);
  const start = playerStartSpot(walking, valley);
  const startPosition = { x: start.x, y: terrainHeightAt(valley.terrain, start.x, start.z), z: start.z };
  return entities.add<Player>({
    player: true,
    position: startPosition,
    previousPosition: { ...startPosition },
    backpack,
    needs: createNeeds(),
    // Until the player has slept in a bed, they wake where they started after a collapse.
    respawnPoint: { x: start.x, z: start.z },
  });
}

/** Finds the player among restored entities. */
function savedPlayer(entities: EntityStore): Player {
  const player = entities.with("player", "position", "previousPosition", "backpack", "needs", "respawnPoint").first;
  if (player === undefined) throw new Error("The saved game has no player");
  return player;
}
