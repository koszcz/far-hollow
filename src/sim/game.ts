import {
  needsFreeHands,
  type BedrollView,
  type CampfireView,
  type Command,
  type GameClient,
  type GameView,
  type NearbyThing,
  type NearbyViews,
  type Notice,
  type PileView,
  type PlainNotice,
  type PlayerAction,
  type SleepView,
} from "./api";
import { createBedrolls, type BedrollEntity } from "./bedrolls";
import { createBeds, type BedEntity } from "./beds";
import { createStools } from "./stools";
import { BACKPACK_WEIGHT_LIMIT_KG, backpackWeight, createStartingBackpack } from "./backpack";
import { playerActivity, type Activity } from "./activity";
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
import { isWalkable, nearestWalkableSpot, type WalkMap } from "./walk-map";
import { createWalking, playerStartSpot, type Walking } from "./walking";
import { createNeeds, hasCollapsed, minutesToRestFully, needsSpeed, passNeedsTime, wakeFromCollapse } from "./needs";
import { createDrinking } from "./drinking";
import { createFishing } from "./fishing";
import { createRain, passRainTime } from "./rain";
import { isUnderRoof } from "./roofs";
import { findRooms, isRoomHeated } from "./rooms";
import { passSicknessTime } from "./sickness";
import { createPot } from "./pot";
import { createCooking } from "./cooking";
import { NOTICE_MINUTES } from "./notices";
import { createPiles } from "./piles";
import { createSleds, DRAG_SPEED } from "./sleds";
import { createWoodpiles } from "./woodpiles";
import { createChests } from "./chests";
import { furnitureOf } from "./furniture";
import { createTending } from "./tending";
import { nearestInReach } from "./reach";
import { createStickFallSystem } from "./stick-fall";
import { createHandReach } from "./hand-reach";
import type { GroundPoint } from "./valley";
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

/** The commands that leave a sitting player on their stool. Every other command is the player walking or acting, so they stand up. */
const KEEPS_PLAYER_SITTING: ReadonlySet<Command["type"]> = new Set<Command["type"]>(["setPaused", "skipTime", "skipToRainChange"]);

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
 * The player keeps at least this far from a tree's centre.
 * The walk map uses 1 m cells, so this leaves room for the widest trunk (about 0.4 m) plus half a cell's diagonal.
 */
const TREE_WALK_BLOCK_RADIUS_METRES = 1.2;
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
  const player = progress === undefined ? addNewPlayer(entities, walking, valley) : savedPlayer(entities);
  const handReach = createHandReach(entities);
  const chopping = createChopping(entities, walking, valley);
  const carrying = createCarrying(entities, walking, valley, handReach);
  const debarking = createDebarking(entities, walking);
  const crafting = createCrafting(entities, walking, valley.terrain);
  const gathering = createGathering(entities, walking, handReach);
  const foraging = createForaging(entities, walking, handReach);
  const building = createBuilding(entities, walking, valley, handReach, freeBuilding);
  const takingDown = createTakingDown(entities, walking, valley);
  const campfires = createCampfires(entities, walking);
  const bedrolls = createBedrolls(entities, walking, valley, handReach);
  const beds = createBeds(entities, walking);
  const woodpiles = createWoodpiles(entities, walking);
  const sleds = createSleds(entities, walking, valley);
  const chests = createChests(entities, walking);
  // The player puts down what they hold to sit, as they do to sleep.
  const stools = createStools(entities, walking, () => {
    carrying.drop();
    sleds.letGo();
  });
  const drinking = createDrinking(entities, walking, valley);
  const fishing = createFishing(entities, walking, valley, seed);
  const pot = createPot(entities, walking, valley, campfires, handReach);
  const cooking = createCooking(entities, campfires);
  const piles = createPiles(entities, walking, valley, handReach);
  const stickFall = createStickFallSystem(entities, valley);
  const tending = createTending(entities, { campfires, woodpiles, sleds }, reachToTend);
  /** Everything the player does over time, in the order each logic step runs them. Reaching a bedroll or bed to sleep on puts the player to sleep. */
  const activities: readonly Activity[] = [
    chopping,
    carrying,
    debarking,
    crafting,
    gathering,
    foraging,
    building,
    takingDown,
    {
      cancel: () => {
        bedrolls.cancel();
        beds.cancel();
      },
      step: () => {
        const bedroll = bedrolls.step();
        if (bedroll !== undefined) sleepOn(bedroll);
        const bed = beds.step();
        if (bed !== undefined) sleepIn(bed);
      },
    },
    {
      cancel: () => {
        stools.cancel();
      },
      step: () => {
        stools.step();
        return undefined;
      },
    },
    drinking,
    // Fish bite after a wait in game time, which a player slowed by a low need does not stretch.
    {
      cancel: () => {
        fishing.cancel();
      },
      step: () => fishing.step(STEP_MS / REAL_MS_PER_GAME_MINUTE),
    },
    pot,
    chests,
    piles,
    tending,
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
  let stepCount = progress?.stepCount ?? 0;
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
      backpack: Object.freeze({ ...player.backpack.contents }),
      backpackWeight: backpackWeight(player.backpack),
      backpackWeightLimit: BACKPACK_WEIGHT_LIMIT_KG,
      buildMenu: BUILD_MENU,
      craftMenu: craftMenu(),
      action: currentAction(),
      carrying: player.carrying ?? null,
      dragging: sleds.dragged() ?? null,
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
      sittingOn: player.sitting?.stoolId ?? null,
      reach: player.handReach === undefined ? null : Object.freeze({ height: player.handReach.height, seconds: player.handReach.seconds }),
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
    const campfire = campfires.nearby();
    const id = campfire === undefined ? undefined : entities.id(campfire);
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
    for (const activity of activities) activity.cancel();
  }

  /** Starts something new in place of whatever the player was doing, and shows the notice if it is refused. */
  function startNew(start: () => Notice | PlainNotice | undefined): void {
    cancelTasks();
    const refusal = start();
    if (refusal !== undefined) showNotice(refusal);
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

  /** Reaches for a thing the player is walking to, once they stop beside it, if the thing exists. */
  function reachOnArrival(height: ReachHeight, thingId: number): void {
    const position = entities.entity(thingId)?.position;
    if (position !== undefined) handReach.startOnArrival(height, position);
  }

  /** How high the player reaches into a piece of furniture that stores things. A piece whose definition gives no height is reached at the waist. */
  function storageReach(chestId: number): ReachHeight {
    return furnitureOf(entities.entity(chestId))?.reachHeight ?? "waist";
  }

  /**
   * Carries out a command on a campfire or woodpile now if the player stands within its reach.
   * Otherwise the player stops what they were doing, walks beside it, and carries the command out there.
   */
  function tend(command: TendTask): void {
    if (tending.inReach(command)) refuseWith(reachToTend(command));
    else {
      cancelTasks();
      tending.walkThen(command);
    }
  }

  /** Whether the player is resting: standing still and doing no work. Resting helps sickness wear off. */
  function isResting(): boolean {
    return player.walkPath === undefined && player.drinkTask === undefined && player.fillPotTask === undefined && currentAction() === null;
  }

  const commandHandlers: { [Type in Command["type"]]: (command: Extract<Command, { type: Type }>) => void } = {
    setPaused: (command) => {
      paused = command.paused;
    },
    walkTo: (command) => {
      cancelTasks();
      walking.walkTo({ x: command.x, z: command.z });
    },
    chopTree: (command) => {
      cancelTasks();
      chopping.start(command.treeId);
    },
    pickUpLog: (command) => {
      cancelTasks();
      carrying.pickUp(command.logId);
    },
    debarkLog: (command) => {
      startNew(() => debarking.start(command.logId));
    },
    craft: (command) => {
      startNew(() => crafting.start(command.recipe, command.stationId));
    },
    pickUpStick: (command) => {
      cancelTasks();
      gathering.pickUpStick(command.stickId);
    },
    pickUpBark: (command) => {
      cancelTasks();
      gathering.pickUpBark(command.barkId);
    },
    forage: (command) => {
      cancelTasks();
      foraging.forage(command.spotId);
    },
    eat: (command) => {
      foraging.eat(command.food);
    },
    splitLog: (command) => {
      const { logId } = command;
      if (logId === undefined) {
        startNew(() => gathering.splitLog());
        return;
      }
      // Only a log on the ground can be split this way. A debarked log cannot be split.
      if (entities.entity(logId)?.log === undefined) return;
      startNew(() => {
        const refusal = gathering.splitRefusal();
        if (refusal === "noAxe") return undefined;
        if (refusal !== undefined) return refusal;
        carrying.pickUp(logId, true);
        return undefined;
      });
    },
    dropLog: () => {
      if (player.carrying !== undefined) {
        putDown(() => {
          carrying.drop();
        });
      }
    },
    dropLogAt: (command) => {
      cancelTasks();
      carrying.dropAt({ x: command.x, z: command.z });
    },
    dropFromBackpack: (command) => {
      if ((player.backpack.contents[command.content] ?? 0) > 0) {
        putDown(() => {
          piles.drop(command.content);
        });
      }
    },
    pickUpPile: (command) => {
      cancelTasks();
      piles.pickUp(command.pileId);
    },
    placeBlueprint: (command) => {
      const id = building.place(command.structure, { x: command.x, z: command.z }, command.turns);
      if (command.thenBuild !== true || id === undefined || !building.canStartBuilding(id)) return;
      cancelTasks();
      building.build(id);
    },
    build: (command) => {
      cancelTasks();
      building.build(command.blueprintId);
    },
    deliverToBlueprint: (command) => {
      cancelTasks();
      building.deliver(command.blueprintId);
    },
    takeDown: (command) => {
      startNew(() => takingDown.start(command.pieceId));
    },
    stopBuilding: () => {
      building.cancel();
    },
    tendCampfire: (command) => {
      cancelTasks();
      campfires.tend(command.campfireId);
      reachOnArrival("low", command.campfireId);
    },
    addFuel: tend,
    tendWoodpile: (command) => {
      cancelTasks();
      woodpiles.tend(command.woodpileId);
      reachOnArrival("waist", command.woodpileId);
    },
    stackOnWoodpile: tend,
    takeFromWoodpile: tend,
    loadSled: tend,
    takeFromSled: tend,
    loadPlanksOnSled: tend,
    takePlanksFromSled: tend,
    tipOutSled: tend,
    dragSled: tend,
    letGoOfSled: () => {
      sleds.letGo();
    },
    openChest: (command) => {
      cancelTasks();
      chests.open(command.chestId);
      reachOnArrival(storageReach(command.chestId), command.chestId);
    },
    putInChest: (command) => {
      if (chests.opened()?.id !== command.chestId) return;
      handReach.start(storageReach(command.chestId), entities.entity(command.chestId)?.position, () =>
        chests.put(command.chestId, command.content, command.all),
      );
    },
    takeFromChest: (command) => {
      if (chests.opened()?.id !== command.chestId) return;
      handReach.start(storageReach(command.chestId), entities.entity(command.chestId)?.position, () =>
        chests.take(command.chestId, command.content, command.all),
      );
    },
    lightCampfire: tend,
    layBedroll: () => {
      if ((player.backpack.contents.bedroll ?? 0) > 0) {
        putDown(() => {
          bedrolls.lay();
        });
      }
    },
    pickUpBedroll: (command) => {
      cancelTasks();
      bedrolls.pickUp(command.bedrollId);
    },
    sleep: (command) => {
      cancelTasks();
      const bedroll = bedrolls.sleep(command.bedrollId);
      if (bedroll !== undefined) sleepOn(bedroll);
    },
    sleepInBed: (command) => {
      cancelTasks();
      const bed = beds.sleep(command.bedId);
      if (bed !== undefined) sleepIn(bed);
    },
    sitOnStool: (command) => {
      cancelTasks();
      stools.sit(command.stoolId);
    },
    drinkFromRiver: (command) => {
      cancelTasks();
      drinking.drinkFromRiver({ x: command.x, z: command.z });
    },
    fish: (command) => {
      startNew(() => fishing.fish({ x: command.x, z: command.z }));
    },
    putPotOnFire: tend,
    takePotOffFire: tend,
    cookFish: tend,
    takeFishOff: tend,
    drinkFromPot: () => {
      pot.drink();
    },
    fillPot: () => {
      cancelTasks();
      pot.fill();
    },
    skipTime: (command) => {
      // Time only moves forward. Ignore a negative or broken amount.
      if (command.hours > 0 && Number.isFinite(command.hours)) passTime(command.hours * MINUTES_PER_HOUR);
    },
    skipToRainChange: () => {
      const wasFalling = rain.falling;
      // Slice by slice, so the skip stops on the minute rain starts or stops, or at a collapse.
      while (rain.falling === wasFalling) {
        if (!passTime(PASS_TIME_SLICE_MINUTES)) return;
      }
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
      campfires.burn(minutes);
      foraging.grow(minutes);
      stickFall.pass(minutes);
      pot.heat(minutes);
      cooking.cook(minutes);
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
   * The player collapses from a neglected need. They drop what is on their shoulder and lose the rest of the day.
   * They wake the next morning at their respawn point with that need low, keeping everything in their backpack.
   */
  function collapse(): void {
    // A collapse before the first morning means the player did not survive the first night.
    firstNightOver = true;
    cancelTasks();
    stools.standUp();
    carrying.drop();
    // The sled stays where the player fell, with its load.
    sleds.letGo();
    entities.removeComponent(player, "walkPath");
    const asleepMinutes = nextMorning(clock.minutes) - clock.minutes;
    clock.skip(asleepMinutes / MINUTES_PER_HOUR);
    campfires.burn(asleepMinutes);
    foraging.grow(asleepMinutes);
    stickFall.pass(asleepMinutes);
    pot.heat(asleepMinutes);
    cooking.cook(asleepMinutes);
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
   * At night they sleep until morning. By day they sleep until fatigue is restored, or until morning if that comes first.
   */
  function sleepOn(bedroll: BedrollEntity): void {
    lieDown(bedroll.position);
    Object.assign(player.position, bedroll.position);
    Object.assign(player.previousPosition, player.position);
    sleep("bedroll");
    reportSleep(bedroll.position);
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

  /** Records a sleep at `spot` for drawing to play. `bed` says which way the bed faces, for a sleep in a bed. */
  function reportSleep(spot: GroundPoint, bed?: SleepView["bed"]): void {
    const at = Object.freeze({ x: spot.x, z: spot.z });
    const count = (lastSleep?.count ?? 0) + 1;
    lastSleep = Object.freeze(bed === undefined ? { count, at } : { count, at, bed: Object.freeze({ ...bed }) });
  }

  /** The player puts down what they hold to lie down at `spot`, which becomes their respawn point. */
  function lieDown(spot: GroundPoint): void {
    carrying.drop();
    sleds.letGo();
    entities.removeComponent(player, "walkPath");
    player.respawnPoint = { x: spot.x, z: spot.z };
  }

  /**
   * The player sleeps where they lie. At night they sleep until morning. By day they sleep until fatigue is restored, or until morning if that comes first.
   * Returns false if a collapse cut sleep short.
   */
  function sleep(asleepIn: SleepPlace): boolean {
    const untilMorning = nextMorning(clock.minutes) - clock.minutes;
    const night = isNight(readClock(clock.minutes).hourOfDay);
    const toRestFully = minutesToRestFully(player.needs, isUnderRoof(entities, player.position), asleepIn === "bed");
    return passTime(night ? untilMorning : Math.min(untilMorning, toRestFully), asleepIn);
  }

  function applyCommand(command: Command): void {
    // While dragging a sled, the player's hands are busy until they let go.
    if (player.dragging !== undefined && needsFreeHands(command)) {
      showNotice("letGoFirst");
      return;
    }
    // The player stands up from a stool as soon as they walk or act. Pausing or skipping time is not acting.
    if (!KEEPS_PLAYER_SITTING.has(command.type)) stools.standUp();
    // Any new command cancels a reach in progress. If the hand has not got to the thing yet, its command is never carried out.
    if (command.type !== "setPaused") handReach.cancel();
    // TypeScript cannot tell that the handler picked by `command.type` takes this same command, so we say so.
    const handle = commandHandlers[command.type] as (command: Command) => void;
    handle(command);
  }

  function step(): void {
    for (const command of pendingCommands.splice(0)) applyCommand(command);

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
    nearestInReach: () => nearestInReach(entities, player.position),
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

/** Adds a new game's player near the river, with a starting backpack. */
function addNewPlayer(entities: EntityStore, walking: Walking, valley: Valley): Player {
  const start = playerStartSpot(walking, valley);
  const startPosition = { x: start.x, y: terrainHeightAt(valley.terrain, start.x, start.z), z: start.z };
  return entities.add<Player>({
    player: true,
    position: startPosition,
    previousPosition: { ...startPosition },
    backpack: createStartingBackpack(),
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
