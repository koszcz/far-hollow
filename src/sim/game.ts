import { createRegrowth } from "./regrowth";
import { ACTION_QUEUE_LIMIT } from "./api";
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
import { createBedrolls, type BedrollEntity } from "./bedrolls";
import { createBeds, type BedEntity } from "./beds";
import { createStools } from "./stools";
import { createApproach, type ApproachReach } from "./approach";
import { addToBackpack, BACKPACK_WEIGHT_LIMIT_KG, backpackWeight, countInBackpack, createStartingBackpack } from "./backpack";
import { playerActivity, playerIsBusy, type Activity } from "./activity";
import { createBuilding } from "./building";
import { createTakingDown } from "./taking-down";
import { STRUCTURES } from "./structures";
import { createCarrying } from "./carrying";
import { createCampfires, isWarmedByCampfire } from "./campfires";
import { createChopping } from "./chopping";
import { createDebarking } from "./debarking";
import { createCrafting, RECIPES } from "./crafting";
import { clockStartMinutes, createClock, isNight, MINUTES_PER_HOUR, nextMorning, readClock, REAL_MS_PER_GAME_MINUTE, type ClockStart } from "./clock";
import { createForaging, valleyForageSpots } from "./foraging";
import { createGathering } from "./gathering";
import {
  createEntityStore,
  movingEntities,
  rainEntities,
  restoreEntities,
  saveEntities,
  type Entity,
  type TendTask,
  type EntityStore,
  type SavedEntity,
} from "./entities";
import { standingHeightAt } from "./foundations";
import { generateValley, terrainHeightAt, type Valley } from "./valley";
import { copyToward } from "./ground-point";
import { isWalkable, nearestWalkableSpot, type WalkMap } from "./walk-map";
import { createWalking, playerStartSpot, type Walking } from "./walking";
import { createNeeds, hasCollapsed, minutesToRestFully, needsSpeed, passNeedsTime, wakeFromCollapse } from "./needs";
import { createDrinking } from "./drinking";
import { createFishing, fishingNow } from "./fishing";
import { createStoneGathering } from "./stone";
import { createTorches } from "./torches";
import { createRain, passRainTime } from "./rain";
import { isUnderRoof } from "./roofs";
import { findRooms, isRoomHeated } from "./rooms";
import { passSicknessTime } from "./sickness";
import { createPot } from "./pot";
import { createCooking } from "./cooking";
import { NOTICE_MINUTES, refusedNotice } from "./notices";
import { goneRefusal } from "./refusals";
import { createPiles } from "./piles";
import { createSleds, DRAG_SPEED } from "./sleds";
import { createWoodpiles } from "./woodpiles";
import { createChests } from "./chests";
import { furnitureOf } from "./furniture";
import { nearestInReach } from "./reach";
import { describeThing } from "./thing-view";
import { createStickFallSystem } from "./stick-fall";
import { createHandReach } from "./hand-reach";
import type { GroundPoint } from "./ground-point";
import type { ReachHeight } from "./entities";

/**
 * How the player reaches to carry out each campfire, woodpile, or sled command: to the ground at a campfire, at waist
 * height at a woodpile or sled. Lighting a fire and taking a sled's ropes need motions of their own, so they have none.
 */
const TEND_REACH: Readonly<Record<TendTask["type"], ReachHeight | undefined>> = {
  addFuel: "low",
  lightCampfire: undefined,
  putPotOnFire: "low",
  takePotOffFire: "low",
  cookFish: "low",
  takeFishOff: "low",
  stackOnWoodpile: "waist",
  takeFromWoodpile: "waist",
  loadSled: "waist",
  takeFromSled: "waist",
  loadPlanksOnSled: "waist",
  takePlanksFromSled: "waist",
  tipOutSled: "waist",
  dragSled: undefined,
};

/**
 * How the game handles one kind of command. Each kind has one rule, in commandRules.
 * - `start`: "fresh" stops whatever the player was doing before the command runs. "alongside" leaves it going,
 *   so a command that sometimes starts afresh, such as placing a blueprint to build at once, stops it itself.
 * - `refusal`: why the game would turn the command away, wherever the player stands. The UI shows it before the player sends the command.
 *   The game checks it before it runs the command, and a refused command shows the refusal as a notice and does nothing.
 * - `run`: carries the command out. It only receives commands whose refusal passed. It returns a notice to show,
 *   if the work turns out not to be possible, such as a full backpack.
 * - `approach`: for a command the player walks within reach to carry out. `reach` says where the approach takes them, and
 *   `act` carries the command out once they stand there. The game checks the refusal again just before `act`. A rule with an
 *   approach and no `run` starts the approach when it runs. See approach.ts.
 * - `needsFreeHands`: the player cannot do it while they drag a sled, such as shouldering a log, gathering, chopping, building, crafting, or fishing.
 * - `keepsPlayerSitting`: a player sitting on a stool stays sitting, as for pausing or skipping time. Every other command is the player walking or acting, so they stand up.
 * - `queue`: how the command meets the action queue. Without it, the command can be queued, and sent on its own it empties the queue.
 *   "plainOnly": it is never queued. Sent to the queue, it runs as if sent on its own. "apart": as "plainOnly", and sent on its own
 *   it leaves the queue as it is, unless it stops what the player was doing.
 */
type CommandRule<C extends ActionCommand> = CommandRuleParts<C> &
  (
    | { readonly run: (command: C) => Notice | PlainNotice | undefined; readonly approach?: ApproachRule<C> }
    | { readonly run?: undefined; readonly approach: ApproachRule<C> }
  );

/** How a command the player walks within reach to carry out meets the approach. */
interface ApproachRule<C extends ActionCommand> {
  readonly reach: (command: C) => ApproachReach | undefined;
  readonly act: (command: C) => Notice | PlainNotice | undefined;
}

interface CommandRuleParts<C extends ActionCommand> {
  readonly start: "fresh" | "alongside";
  readonly refusal?: (command: C) => Refusal | undefined;
  readonly needsFreeHands?: true | ((command: C) => boolean);
  readonly keepsPlayerSitting?: true;
  readonly queue?: "plainOnly" | "apart";
}

/** The rule for each kind of command. Queueing an action is handled before any rule. */
type CommandRules = { readonly [Type in ActionCommand["type"]]: CommandRule<Extract<ActionCommand, { type: Type }>> };

/** The build menu never changes, so every view shares one frozen copy. */
const BUILD_MENU: GameView["buildMenu"] = Object.freeze(
  STRUCTURES.map(({ kind, cost, tool, placement }) =>
    Object.freeze({
      structure: kind,
      cost: Object.freeze(cost.map((item) => Object.freeze({ ...item }))),
      ...(tool === undefined ? {} : { tool }),
      placement,
    }),
  ),
);

/** Logic steps per second. Rendering blends between steps, so this can stay low. */
export const STEPS_PER_SECOND = 30;
export const STEP_MS = 1000 / STEPS_PER_SECOND;

/**
 * The walk map blocks every 1 m cell whose centre lies within this distance of a tree's centre. A larger radius closes diagonal gaps between trees about 3 m apart, which look wide enough on screen.
 * The cost is that a path can, in rare cases, graze the edge of the widest trunk (about 0.4 m across).
 */
export const TREE_WALK_BLOCK_RADIUS_METRES = 0.9;
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
}

/**
 * Everything about a game in progress that its seed does not decide. It is plain data, so it can be stored.
 * State kept in entity components is included without any change here.
 */
export interface GameProgress {
  /** Game minutes since midnight at the start of day 1. */
  clockMinutes: number;
  stepCount: number;
  firstNightOver: boolean;
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
}

export function createGame({ seed, progress, startNotice, freeBuilding = false }: GameOptions): Game {
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
  const foraging = createForaging(entities, handReach);
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
  const fishing = createFishing(entities, walking, valley, seed, STEP_MS / REAL_MS_PER_GAME_MINUTE);
  const stoneGathering = createStoneGathering(entities, walking, valley);
  const pot = createPot(entities, walking.walkMap, valley, campfires, handReach);
  const cooking = createCooking(entities, campfires);
  const torches = createTorches(entities, valley, handReach);
  const piles = createPiles(entities, valley, handReach);
  const stickFall = createStickFallSystem(entities, valley);
  const regrowth = createRegrowth(entities);
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
    chests,
    // Last, so a reach started by a step above moves on in that same step.
    handReach,
  ];
  const moving = movingEntities(entities);
  const pendingCommands: Command[] = [];
  const listeners = new Set<() => void>();
  const gameStartMinutes = clockStartMinutes(GAME_START);
  const clock = createClock(progress?.clockMinutes ?? gameStartMinutes);
  // A save made before rain existed has no weather, so it starts dry from here.
  const rain = (rainEntities(entities).first ?? entities.add({ rain: createRain(seed, clock.minutes) })).rain;
  /** When the first night ends. Reaching it without a collapse counts as surviving the night. */
  const firstMorning = nextMorning(gameStartMinutes);
  /** Whether the first night has ended, by morning coming or by a collapse. */
  let firstNightOver = progress?.firstNightOver ?? false;
  let notice: (Notice & { untilMinutes: number }) | null = progress?.notice ? structuredClone(progress.notice) : null;
  let paused = false;
  /** The player's last sleep since the game was loaded. It is not saved. */
  let lastSleep: SleepView | null = null;
  /** The player's last bite or drink since the game was loaded. It is not saved. */
  let lastEatOrDrink: EatOrDrinkView | null = null;
  let stepCount = progress?.stepCount ?? 0;
  /** The action queue: the action under way first, then those waiting their turn. It is not saved. */
  const actionQueue: ActionCommand[] = [];
  /** How many times cancelTasks has run, so sending a command can tell whether it stopped what the player was doing. */
  let cancelCount = 0;
  /** How many casts the player had made when they were first seen fishing since the latest command, or undefined if not yet seen. */
  let castsWhenFishingBegan: number | undefined;
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
      night: isNight(readClock(clock.minutes).hourOfDay),
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
      raining: rain.falling,
      notice: notice !== null && clock.minutes < notice.untilMinutes ? noticeView(notice) : null,
      lastSleep,
      lastEatOrDrink,
      sittingOn: player.sitting?.stoolId ?? null,
      reach: player.handReach === undefined ? null : Object.freeze({ height: player.handReach.height, seconds: player.handReach.seconds }),
      actionQueue: deepFreeze(structuredClone(actionQueue)),
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

  /** Every recipe, with what the player lacks to follow each one now. */
  function craftMenu(): GameView["craftMenu"] {
    return deepFreeze(RECIPES.map((recipe) => ({ ...structuredClone(recipe), lacks: structuredClone(crafting.lacks(recipe.kind)) })));
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
    cancelCount += 1;
    for (const activity of activities) activity.cancel();
  }

  /** Shows the notice if what the player tried was refused. */
  function refuseWith(refusal: Notice | PlainNotice | undefined): void {
    if (refusal !== undefined) showNotice(refusal);
  }

  /** Carries out a command on a campfire or woodpile within the player's reach. Returns a notice if it is refused. */
  function tendNow(command: TendTask): PlainNotice | undefined {
    switch (command.type) {
      case "addFuel":
        campfires.addFuel(command.campfireId, command.fuel);
        return undefined;
      case "lightCampfire":
        campfires.light(command.campfireId);
        return undefined;
      case "putPotOnFire":
        pot.putOnFire(command.campfireId);
        return undefined;
      case "takePotOffFire":
        return pot.takeOffFire(command.campfireId);
      case "cookFish":
        cooking.cookFish(command.campfireId);
        return undefined;
      case "takeFishOff":
        return cooking.takeFishOff(command.campfireId);
      case "stackOnWoodpile":
        woodpiles.stack(command.woodpileId, command.wood, command.all);
        return undefined;
      case "takeFromWoodpile":
        return woodpiles.take(command.woodpileId, command.wood);
      case "loadSled":
        sleds.load(command.sledId);
        return undefined;
      case "takeFromSled":
        sleds.take(command.sledId, command.log);
        return undefined;
      case "loadPlanksOnSled":
        sleds.loadPlanks(command.sledId);
        return undefined;
      case "takePlanksFromSled":
        return sleds.takePlanks(command.sledId);
      case "tipOutSled":
        sleds.tipOut(command.sledId);
        return undefined;
      case "dragSled":
        sleds.drag(command.sledId);
        return undefined;
    }
  }

  /**
   * Starts the player reaching to carry out a command on a campfire, woodpile, or sled within reach. The command is
   * carried out when the hand gets there. A command with no reach of its own, such as lighting a fire, is carried out now.
   */
  function reachToTend(command: TendTask): PlainNotice | undefined {
    const height = TEND_REACH[command.type];
    if (height === undefined) return tendNow(command);
    handReach.start(height, placeOf(command), () => tendNow(command));
    return undefined;
  }

  /** Where the campfire, woodpile, or sled a command works on stands, if it still exists. */
  function placeOf(command: TendTask): GroundPoint | undefined {
    const id = "campfireId" in command ? command.campfireId : "woodpileId" in command ? command.woodpileId : command.sledId;
    return entities.entity(id)?.position;
  }

  /** Starts the player reaching down to put something at their feet. `put` runs when the hand gets to the ground. */
  function putDown(put: () => void): void {
    handReach.start("low", undefined, () => {
      put();
      return undefined;
    });
  }

  /** Reaches toward a thing the player stands beside, such as a campfire they came to tend or a chest they open. The reach carries nothing out. */
  function reachToward(height: ReachHeight, thingId: number): void {
    handReach.start(height, entities.entity(thingId)?.position);
  }

  /** How high the player reaches into a piece of furniture that stores things. A piece whose definition gives no height is reached at the waist. */
  function storageReach(chestId: number): ReachHeight {
    return furnitureOf(entities.entity(chestId))?.reachHeight ?? "waist";
  }

  /**
   * The approach for a command on a campfire, woodpile, or sled. A player within reach carries it out at once, without
   * stopping other work. Otherwise they stop what they were doing, walk beside it, and carry the command out there.
   */
  const tendApproach: ApproachRule<TendTask> = {
    reach: (command) => {
      if ("campfireId" in command) return campfires.reach(command.campfireId);
      if ("woodpileId" in command) return woodpiles.reach(command.woodpileId);
      return sleds.reach(command.sledId);
    },
    act: reachToTend,
  };

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

  const commandRules: CommandRules = {
    setPaused: {
      start: "alongside",
      keepsPlayerSitting: true,
      queue: "apart",
      run: (command) => {
        paused = command.paused;
      },
    },
    walkTo: {
      start: "fresh",
      run: (command) => {
        walking.walkTo({ x: command.x, z: command.z });
      },
    },
    chopTree: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => chopping.refusal(command.treeId),
      approach: {
        reach: (command) => chopping.reach(command.treeId),
        act: (command) => {
          chopping.start(command.treeId);
        },
      },
    },
    pickUpLog: {
      start: "fresh",
      needsFreeHands: true,
      refusal: () => carrying.pickUpRefusal(),
      approach: {
        reach: (command) => carrying.pickUpReach(command.logId),
        act: (command) => {
          carrying.pickUp(command.logId);
        },
      },
    },
    debarkLog: {
      start: "fresh",
      needsFreeHands: true,
      refusal: () => debarking.refusal(),
      // A full backpack turns the player away before they set off.
      run: (command) => debarking.roomRefusal() ?? approach.start(command),
      approach: {
        reach: (command) => debarking.reach(command.logId),
        act: (command) => debarking.start(command.logId),
      },
    },
    craft: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => crafting.refusal(command.recipe),
      // A hand recipe is crafted where the player stands. A station recipe is followed beside the station, so the player
      // walks there first, unless they could not start it anyway. The approach holds the station the player walks to.
      run: (command) => {
        const stationId = crafting.stationFor(command.recipe, command.stationId);
        if (stationId === undefined) return crafting.start(command.recipe, command.stationId);
        return crafting.startRefusal(command.recipe, stationId) ?? approach.start({ type: "craft", recipe: command.recipe, stationId });
      },
      approach: {
        reach: (command) => crafting.reach(command.recipe, command.stationId),
        act: (command) => crafting.start(command.recipe, command.stationId),
      },
    },
    // Lighting a torch and putting it out take no time, and the player keeps doing what they were doing.
    lightTorch: {
      start: "alongside",
      refusal: () => torches.lightRefusal(),
      run: () => {
        torches.light();
      },
    },
    putOutTorch: {
      start: "alongside",
      run: () => {
        torches.putOut();
      },
    },
    // Planting the torch reaches down to stand it at the player's feet, as laying the bedroll does.
    plantTorch: {
      start: "alongside",
      refusal: () => torches.plantRefusal(),
      run: () => {
        if (player.litTorch !== undefined && torches.plantRefusal() === undefined)
          putDown(() => {
            torches.plant();
          });
      },
    },
    pickUpTorch: {
      start: "fresh",
      refusal: () => torches.pickUpRefusal(),
      approach: {
        reach: (command) => torches.pickUpReach(command.torchId),
        act: (command) => {
          torches.pickUp(command.torchId);
        },
      },
    },
    pickUpStick: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => goneRefusal(entities, command.stickId),
      approach: {
        reach: (command) => gathering.reach(command.stickId, "stick"),
        act: (command) => {
          gathering.pickUp(command.stickId, "stick");
        },
      },
    },
    pickUpBark: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => goneRefusal(entities, command.barkId),
      approach: {
        reach: (command) => gathering.reach(command.barkId, "bark"),
        act: (command) => {
          gathering.pickUp(command.barkId, "bark");
        },
      },
    },
    forage: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => foraging.refusal(command.spotId),
      approach: {
        reach: (command) => foraging.reach(command.spotId),
        act: (command) => {
          foraging.forage(command.spotId);
        },
      },
    },
    eat: {
      start: "alongside",
      run: (command) => {
        if (foraging.eat(command.food)) reportEatOrDrink("eat");
      },
    },
    splitLog: {
      // A log given by id must lie on the ground, and only then does the player stop what they were doing. A debarked log cannot be split.
      start: "alongside",
      needsFreeHands: true,
      refusal: (command) => gathering.splitRefusal(command.logId),
      run: (command) => {
        if (command.logId !== undefined) return approach.start(command);
        cancelTasks();
        gathering.splitLog();
        return undefined;
      },
      // A log given by id is picked up first, then split on the player's shoulder.
      approach: {
        reach: ({ logId }) => (logId === undefined || entities.entity(logId)?.log === undefined ? undefined : carrying.pickUpReach(logId)),
        act: ({ logId }) => {
          if (logId !== undefined) carrying.pickUp(logId, true);
        },
      },
    },
    dropLog: {
      start: "alongside",
      run: () => {
        if (player.carrying !== undefined)
          putDown(() => {
            carrying.drop();
          });
      },
    },
    dropLogAt: {
      start: "fresh",
      approach: {
        reach: (command) => carrying.dropReach(command),
        act: (command) => {
          carrying.dropAt(command);
        },
      },
    },
    dropFromBackpack: {
      start: "alongside",
      run: (command) => {
        if (countInBackpack(player.backpack, command.content) > 0)
          putDown(() => {
            piles.drop(command.content);
          });
      },
    },
    pickUpPile: {
      start: "fresh",
      needsFreeHands: true,
      approach: {
        reach: (command) => piles.reach(command.pileId),
        act: (command) => {
          piles.pickUp(command.pileId);
        },
      },
    },
    placeBlueprint: {
      // Placing alone leaves the player doing what they were doing. Building it at once starts afresh.
      start: "alongside",
      queue: "apart",
      needsFreeHands: (command) => command.thenBuild === true,
      run: (command) => {
        const id = building.place(command.structure, { x: command.x, z: command.z }, command.turns);
        if (command.thenBuild !== true || id === undefined || !building.canStartBuilding(id)) return undefined;
        cancelTasks();
        return approach.start({ type: "build", blueprintId: id });
      },
    },
    build: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => building.refusal(command.blueprintId),
      approach: {
        reach: (command) => building.reach(command.blueprintId),
        act: (command) => {
          building.build(command.blueprintId);
        },
      },
    },
    deliverToBlueprint: {
      start: "fresh",
      needsFreeHands: true,
      approach: {
        reach: (command) => building.reach(command.blueprintId),
        act: (command) => {
          building.deliver(command.blueprintId);
        },
      },
    },
    takeDown: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => takingDown.refusal(command.pieceId),
      approach: {
        reach: (command) => takingDown.reach(command.pieceId),
        act: (command) => {
          takingDown.start(command.pieceId);
        },
      },
    },
    stopBuilding: {
      start: "alongside",
      queue: "apart",
      run: () => {
        building.cancel();
      },
    },
    tendCampfire: {
      start: "fresh",
      approach: {
        reach: (command) => campfires.reach(command.campfireId),
        act: (command) => {
          reachToward("low", command.campfireId);
        },
      },
    },
    addFuel: { start: "alongside", refusal: (command) => campfires.refusal(command), approach: tendApproach },
    lightCampfire: { start: "alongside", refusal: (command) => campfires.refusal(command), approach: tendApproach },
    putPotOnFire: { start: "alongside", refusal: (command) => pot.putOnRefusal(command.campfireId), approach: tendApproach },
    takePotOffFire: { start: "alongside", approach: tendApproach },
    cookFish: { start: "alongside", refusal: (command) => cooking.refusal(command.campfireId), approach: tendApproach },
    takeFishOff: { start: "alongside", approach: tendApproach },
    tendWoodpile: {
      start: "fresh",
      approach: {
        reach: (command) => woodpiles.reach(command.woodpileId),
        act: (command) => {
          reachToward("waist", command.woodpileId);
        },
      },
    },
    stackOnWoodpile: { start: "alongside", refusal: (command) => woodpiles.refusal(command), approach: tendApproach },
    takeFromWoodpile: {
      start: "alongside",
      // Firewood goes in the backpack, so taking it does not need free hands. A log goes on the shoulder.
      needsFreeHands: (command) => command.wood !== "firewood",
      refusal: (command) => woodpiles.refusal(command),
      approach: tendApproach,
    },
    loadSled: { start: "alongside", refusal: (command) => sleds.refusal(command), approach: tendApproach },
    takeFromSled: { start: "alongside", needsFreeHands: true, refusal: (command) => sleds.refusal(command), approach: tendApproach },
    loadPlanksOnSled: { start: "alongside", refusal: (command) => sleds.refusal(command), approach: tendApproach },
    takePlanksFromSled: { start: "alongside", refusal: (command) => sleds.refusal(command), approach: tendApproach },
    tipOutSled: { start: "alongside", refusal: (command) => sleds.refusal(command), approach: tendApproach },
    dragSled: { start: "alongside", refusal: (command) => sleds.refusal(command), approach: tendApproach },
    letGoOfSled: {
      start: "alongside",
      run: () => {
        sleds.letGo();
      },
    },
    openChest: {
      start: "fresh",
      // Opening a chest opens its panel, a menu, so it is never queued.
      queue: "plainOnly",
      approach: {
        reach: (command) => chests.reach(command.chestId),
        act: (command) => {
          chests.open(command.chestId);
          reachToward(storageReach(command.chestId), command.chestId);
        },
      },
    },
    putInChest: {
      start: "alongside",
      queue: "apart",
      refusal: (command) => chests.refusal(command.chestId),
      run: (command) => {
        handReach.start(storageReach(command.chestId), entities.entity(command.chestId)?.position, () =>
          chests.put(command.chestId, command.content, command.all),
        );
      },
    },
    takeFromChest: {
      start: "alongside",
      queue: "apart",
      refusal: (command) => {
        const kind = chests.takeRefusal(command.chestId, command.content);
        return chests.refusal(command.chestId) ?? (kind === undefined ? undefined : { kind });
      },
      run: (command) => {
        handReach.start(storageReach(command.chestId), entities.entity(command.chestId)?.position, () =>
          chests.take(command.chestId, command.content, command.all),
        );
      },
    },
    layBedroll: {
      start: "alongside",
      run: () => {
        if (countInBackpack(player.backpack, "bedroll") > 0)
          putDown(() => {
            bedrolls.lay();
          });
      },
    },
    layBedrollInLeanTo: {
      start: "fresh",
      approach: {
        reach: (command) => bedrolls.layInLeanToReach(command.leanToId),
        act: (command) => {
          bedrolls.layInLeanTo(command.leanToId);
        },
      },
    },
    pickUpBedroll: {
      start: "fresh",
      approach: {
        reach: (command) => bedrolls.reach(command.bedrollId),
        act: (command) => {
          bedrolls.pickUp(command.bedrollId);
        },
      },
    },
    sleep: {
      start: "fresh",
      refusal: (command) => goneRefusal(entities, command.bedrollId),
      approach: {
        reach: (command) => bedrolls.reach(command.bedrollId),
        act: (command) => {
          bedrolls.sleep(command.bedrollId);
        },
      },
    },
    sleepInBed: {
      start: "fresh",
      refusal: (command) => goneRefusal(entities, command.bedId),
      approach: {
        reach: (command) => beds.reach(command.bedId),
        act: (command) => {
          beds.sleep(command.bedId);
        },
      },
    },
    sitOnStool: {
      start: "fresh",
      refusal: (command) => goneRefusal(entities, command.stoolId),
      approach: {
        reach: (command) => stools.reach(command.stoolId),
        act: (command) => {
          stools.sit(command.stoolId);
        },
      },
    },
    drinkFromRiver: {
      start: "fresh",
      approach: {
        reach: (command) => drinking.reach(command),
        act: (command) => {
          drinking.drinkFromRiver(command);
        },
      },
    },
    fish: {
      start: "fresh",
      needsFreeHands: true,
      refusal: () => fishing.refusal(),
      run: (command) => {
        fishing.fish({ x: command.x, z: command.z });
      },
    },
    gatherStone: {
      start: "fresh",
      needsFreeHands: true,
      refusal: () => stoneGathering.refusal(),
      run: (command) => {
        stoneGathering.gather({ x: command.x, z: command.z });
      },
    },
    drinkFromPot: {
      start: "alongside",
      run: () => {
        if (pot.drink()) reportEatOrDrink("drinkFromPot");
      },
    },
    fillPot: {
      start: "fresh",
      approach: {
        reach: () => pot.fillReach(),
        act: () => {
          pot.fill();
        },
      },
    },
    skipTime: {
      start: "alongside",
      keepsPlayerSitting: true,
      queue: "apart",
      run: (command) => {
        // Time only moves forward. Ignore a negative or broken amount.
        if (command.hours > 0 && Number.isFinite(command.hours)) passTime(command.hours * MINUTES_PER_HOUR);
      },
    },
    skipToRainChange: {
      start: "alongside",
      keepsPlayerSitting: true,
      queue: "apart",
      run: () => {
        const wasFalling = rain.falling;
        // Slice by slice, so the skip stops on the minute rain starts or stops, or at a collapse.
        while (rain.falling === wasFalling) {
          if (!passTime(PASS_TIME_SLICE_MINUTES)) return;
        }
      },
    },
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
      clock.skip(minutes / MINUTES_PER_HOUR);
      passRainTime(rain, seed, clock.minutes);
      // Rain does not put out campfires.
      passWorldTime(minutes);
      const underRoof = isUnderRoof(entities, player.position);
      passNeedsTime(player.needs, minutes, {
        night: isNight(readClock(clock.minutes).hourOfDay),
        warmedByCampfire: isWarmedByCampfire(entities, player.position),
        working: currentAction() !== null,
        asleep: asleepIn !== undefined,
        inBed: asleepIn === "bed",
        sitting: asleepIn === undefined && player.sitting !== undefined,
        sick: player.sickness !== undefined,
        inRain: rain.falling && !underRoof,
        underRoof,
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

  /**
   * Moves the valley on by this many game minutes: fires and torches burn, in the hand and planted, food and trees grow back,
   * sticks fall, and pots and fish heat.
   */
  function passWorldTime(minutes: number): void {
    campfires.burn(minutes);
    torches.burn(minutes);
    foraging.grow(minutes);
    regrowth.grow(minutes);
    stickFall.pass(minutes);
    pot.heat(minutes);
    cooking.cook(minutes);
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
    actionQueue.length = 0;
    stools.standUp();
    torches.putOut();
    carrying.drop();
    // The sled stays where the player fell, with its load.
    sleds.letGo();
    entities.removeComponent(player, "walkPath");
    const asleepMinutes = nextMorning(clock.minutes) - clock.minutes;
    clock.skip(asleepMinutes / MINUTES_PER_HOUR);
    passWorldTime(asleepMinutes);
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
    const untilMorning = nextMorning(clock.minutes) - clock.minutes;
    const toRestFully = minutesToRestFully(player.needs, isUnderRoof(entities, player.position), asleepIn === "bed");
    const wakesAtNight = isNight(readClock(clock.minutes + toRestFully).hourOfDay);
    return passTime(wakesAtNight ? untilMorning : Math.min(untilMorning, toRestFully), asleepIn);
  }

  /** Carries out a command, once its refusal passes. A refused command does nothing, and a notice says why. */
  function applyCommand(command: ActionCommand): void {
    const refusal = refusalOf(command);
    if (refusal !== null) {
      showNotice(refusedNotice(refusal));
      return;
    }
    const rule = ruleOf(command);
    // The player stands up from a stool as soon as they walk or act. Pausing or skipping time is not acting.
    if (rule.keepsPlayerSitting !== true) stools.standUp();
    // Any new command cancels a reach in progress. If the hand has not got to the thing yet, its command is never carried out.
    if (command.type !== "setPaused") handReach.cancel();
    if (rule.start === "fresh") cancelTasks();
    castsWhenFishingBegan = undefined;
    refuseWith(rule.run === undefined ? approach.start(command) : rule.run(command));
  }

  /** Carries out a command the UI sent: it adds an action to the action queue, or it runs on its own. */
  function receive(command: Command): void {
    if (command.type === "queueAction") queueAction(command.action);
    else if (command.type === "cancelQueuedAction") cancelQueuedAction(command.index);
    else sendOnItsOwn(command);
  }

  /**
   * Carries out a command sent on its own, as a plain click does. An action empties the actions waiting in the queue.
   * If it stops what the player was doing, or starts something while the queue is empty, it becomes the action under way.
   * A command apart from the queue, such as pausing, leaves the queue as it is, unless it stops what the player was doing.
   */
  function sendOnItsOwn(command: ActionCommand): void {
    const apart = ruleOf(command).queue === "apart";
    if (!apart) actionQueue.splice(1);
    const cancelsBefore = cancelCount;
    applyCommand(command);
    if (cancelCount !== cancelsBefore || (!apart && actionQueue.length === 0 && playerIsBusy(player))) actionQueue.splice(0, actionQueue.length, command);
  }

  /**
   * Adds an action to the end of the action queue, as a Shift-click does. With an empty queue, it starts at once.
   * It is turned away, with a notice saying why, when the queue is full or the game refuses the action now.
   */
  function queueAction(command: ActionCommand): void {
    if (ruleOf(command).queue !== undefined) {
      sendOnItsOwn(command);
      return;
    }
    if (actionQueue.length >= ACTION_QUEUE_LIMIT) {
      showNotice("queueFull");
      return;
    }
    const refusal = refusalOf(command);
    if (refusal !== null) {
      showNotice({ kind: "cannotQueue", refusal });
      return;
    }
    actionQueue.push(command);
    if (actionQueue.length === 1) applyCommand(command);
  }

  /**
   * Takes the action at `index` out of the action queue, as a click on its icon does. Cancelling the action under way
   * stops what the player is doing for it, as if they had stopped of their own accord, and the next action starts.
   */
  function cancelQueuedAction(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= actionQueue.length) return;
    if (index > 0) {
      actionQueue.splice(index, 1);
      return;
    }
    cancelTasks();
    stools.standUp();
    handReach.cancel();
    entities.removeComponent(player, "walkPath");
    actionQueue.shift();
    startNextQueued();
  }

  /**
   * Moves the action queue on, once a logic step has run. When the player has nothing left to do for the action under way,
   * it leaves the queue and the next one starts. An action with no end goes on while nothing waits behind it. With another
   * action waiting, sitting ends at once, and fishing ends once a fish has bitten. An action the game refuses when its turn
   * comes is dropped, with a notice saying why.
   */
  function moveQueueOn(): void {
    const underWay = actionQueue[0];
    if (underWay === undefined) return;
    if (playerIsBusy(player)) {
      const done = endlessActionDone();
      if (!done || actionQueue.length === 1) return;
      cancelTasks();
      stools.standUp();
    }
    actionQueue.shift();
    startNextQueued();
  }

  /** Starts the first action in the queue. An action the game refuses now is dropped, with a notice saying why, and the one after is tried. */
  function startNextQueued(): void {
    for (let next = actionQueue[0]; next !== undefined; next = actionQueue[0]) {
      const refusal = refusalOf(next);
      if (refusal === null) {
        applyCommand(next);
        return;
      }
      showNotice({ kind: "actionSkipped", refusal });
      actionQueue.shift();
    }
  }

  /**
   * Whether the player has done enough of an action with no end to move on when another action waits: they sit,
   * or they fish and a fish has bitten since they began. A queued fishing trip catches one fish.
   */
  function endlessActionDone(): boolean {
    if (player.sitting !== undefined) return true;
    if (fishingNow(player) === undefined) return false;
    const casts = player.fishCasts ?? 0;
    // The player casts when they start fishing, and again each time a fish bites.
    castsWhenFishingBegan ??= casts;
    return casts > castsWhenFishingBegan;
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
    for (const command of pendingCommands.splice(0)) receive(command);

    if (!paused) {
      for (const entity of moving) {
        Object.assign(entity.previousPosition, entity.position);
      }
      // A player with a low need moves and works more slowly, as if less time passed for them.
      const playerSeconds = (STEP_MS / 1000) * needsSpeed(player.needs);
      // Dragging a sled slows walking further, but not other work.
      walking.step(player.dragging === undefined ? playerSeconds : playerSeconds * DRAG_SPEED);
      sleds.follow();
      for (const activity of activities) refuseWith(activity.step(playerSeconds));
      passTime(STEP_MS / REAL_MS_PER_GAME_MINUTE);
      moveQueueOn();
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
          Object.freeze({ squares: Object.freeze(room.map((square) => Object.freeze({ ...square }))), heated: isRoomHeated(entities, room) }),
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
      stepCount,
      firstNightOver,
      notice,
      entities: saveEntities(entities),
    });
  }

  return { entities, valley, walkMap: walking.walkMap, step, client, progress: readProgress };
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
