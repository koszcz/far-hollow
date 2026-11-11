import type { BedrollView, CampfireView, Command, GameClient, GameNotice, GameView, PileView, PlayerAction } from "./api";
import { createBedrolls, type BedrollEntity } from "./bedrolls";
import { BACKPACK_WEIGHT_LIMIT_KG, backpackWeight, createStartingBackpack } from "./backpack";
import { playerActivity, type Activity } from "./activity";
import { createBuilding } from "./building";
import { createTakingDown } from "./taking-down";
import { STRUCTURES } from "./structures";
import { createCarrying } from "./carrying";
import { CAMPFIRE_FUEL_LIMIT_MINUTES, createCampfires, isWarmedByCampfire } from "./campfires";
import { createChopping } from "./chopping";
import { createDebarking } from "./debarking";
import { createCrafting, RECIPES } from "./crafting";
import { clockStartMinutes, createClock, isNight, MINUTES_PER_HOUR, nextMorning, readClock, REAL_MS_PER_GAME_MINUTE, type ClockStart } from "./clock";
import { createForaging, valleyForageSpots } from "./foraging";
import { createGathering } from "./gathering";
import { createEntityStore, movingEntities, rainEntities, restoreEntities, saveEntities, type Entity, type EntityStore, type SavedEntity } from "./entities";
import { standingHeightAt } from "./foundations";
import { generateValley, terrainHeightAt, type Valley } from "./valley";
import type { WalkMap } from "./walk-map";
import { createWalking, playerStartSpot, type Walking } from "./walking";
import { createNeeds, hasCollapsed, minutesToRestFully, needsSpeed, passNeedsTime, wakeFromCollapse } from "./needs";
import { createDrinking } from "./drinking";
import { createRain, passRainTime } from "./rain";
import { isUnderRoof } from "./roofs";
import { findRooms, isRoomHeated } from "./rooms";
import { passSicknessTime } from "./sickness";
import { createPot } from "./pot";
import { createPiles } from "./piles";
import { boilProgress } from "./pot-state";
import { createWoodpiles } from "./woodpiles";
import { createChests } from "./chests";

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
/** How many game minutes each notice shows for. One game minute is one real second. */
const NOTICE_MINUTES: Readonly<Record<GameNotice, number>> = {
  collapsed: 30,
  survivedFirstNight: 30,
  backpackFull: 4,
  holdsUpPiece: 4,
  stillHoldsSomething: 4,
  chestFull: 4,
  saveBroken: 10,
  putLogDownFirst: 4,
  noLogBesideStation: 4,
};
/** A new game starts on the morning of day 1. */
export const GAME_START: ClockStart = { day: 1, hour: 8 };

export interface GameOptions {
  /** Decides how the valley is laid out. The same seed always makes the same valley. */
  seed: number;
  /** Carries on a saved game instead of starting a new one. It must have been saved from a game with the same seed. */
  progress?: GameProgress;
  /** A notice to show the player as soon as the game starts. */
  startNotice?: GameNotice;
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
  notice: { kind: GameNotice; untilMinutes: number } | null;
  /** Every entity, with the id that tasks and commands know it by. */
  entities: SavedEntity[];
}

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
  const chopping = createChopping(entities, walking, valley);
  const carrying = createCarrying(entities, walking, valley);
  const debarking = createDebarking(entities, walking);
  const crafting = createCrafting(entities, walking);
  const gathering = createGathering(entities, walking);
  const foraging = createForaging(entities, walking);
  const building = createBuilding(entities, walking, valley, freeBuilding);
  const takingDown = createTakingDown(entities, walking, valley);
  const campfires = createCampfires(entities, walking);
  const bedrolls = createBedrolls(entities, walking, valley);
  const woodpiles = createWoodpiles(entities, walking);
  const chests = createChests(entities, walking);
  const drinking = createDrinking(entities, walking, valley);
  const pot = createPot(entities, walking, valley, campfires);
  const piles = createPiles(entities, walking, valley);
  /** Everything the player does over time, in the order each logic step runs them. Reaching a bedroll to sleep on puts the player to sleep. */
  const activities: readonly Activity[] = [
    chopping, carrying, debarking, crafting, gathering, foraging, building, takingDown,
    {
      cancel: () => {
        bedrolls.cancel();
      },
      step: () => {
        const reached = bedrolls.step();
        if (reached !== undefined) sleepOn(reached);
      },
    },
    drinking, pot, chests, piles,
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
  let notice: { kind: GameNotice; untilMinutes: number } | null = progress?.notice ? { ...progress.notice } : null;
  let paused = false;
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
      nearbyCampfire: nearbyCampfire(),
      nearbyBedroll: nearbyBedroll(),
      nearbyPile: nearbyPile(),
      nearbyWoodpile: woodpiles.nearby() ?? null,
      openChest: chests.opened() ?? null,
      nearbyBlueprint: building.nearby() ?? null,
      needs: Object.freeze({
        hunger: player.needs.hunger.level,
        thirst: player.needs.thirst.level,
        warmth: player.needs.warmth.level,
        fatigue: player.needs.fatigue.level,
      }),
      warmth: player.needs.warmth.level,
      sick: player.sickness !== undefined,
      raining: rain.falling,
      notice: notice !== null && clock.minutes < notice.untilMinutes ? notice.kind : null,
    });
  }

  function showNotice(kind: GameNotice): void {
    notice = { kind, untilMinutes: clock.minutes + NOTICE_MINUTES[kind] };
  }

  function nearbyCampfire(): CampfireView | null {
    const campfire = campfires.nearby();
    const id = campfire === undefined ? undefined : entities.id(campfire);
    if (campfire === undefined || id === undefined) return null;
    return Object.freeze({
      id,
      lit: campfire.campfire.lit,
      fuelLeft: campfire.campfire.fuelMinutes / CAMPFIRE_FUEL_LIMIT_MINUTES,
      fuelMinutes: campfire.campfire.fuelMinutes,
      canLight: campfires.canLight(id),
      pot: campfire.potOnFire === undefined ? null : Object.freeze({ water: campfire.potOnFire.water, boilProgress: boilProgress(campfire.potOnFire) }),
    });
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
    return Object.freeze(
      RECIPES.map(({ kind, materials, besideStation, result, seconds, tool, station }) => {
        const lacks = crafting.lacks(kind);
        return Object.freeze({
          recipe: kind,
          materials: Object.freeze(materials.map((amount) => Object.freeze({ ...amount }))),
          ...(besideStation === undefined ? {} : { besideStation: Object.freeze(besideStation.map((amount) => Object.freeze({ ...amount }))) }),
          result: Object.freeze({ ...result }),
          seconds,
          ...(tool === undefined ? {} : { tool }),
          ...(station === undefined ? {} : { station }),
          ...(lacks.tool === undefined ? {} : { missingTool: lacks.tool }),
          ...(lacks.station === undefined ? {} : { missingStation: lacks.station }),
          hasMaterials: lacks.materials !== true,
        });
      }),
    );
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
  function startNew(start: () => GameNotice | undefined): void {
    cancelTasks();
    const refusal = start();
    if (refusal !== undefined) showNotice(refusal);
  }

  /** Shows the notice if what the player tried was refused. */
  function refuseWith(refusal: GameNotice | undefined): void {
    if (refusal !== undefined) showNotice(refusal);
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
      startNew(() => gathering.pickUpStick(command.stickId));
    },
    pickUpBark: (command) => {
      startNew(() => gathering.pickUpBark(command.barkId));
    },
    forage: (command) => {
      startNew(() => foraging.forage(command.spotId));
    },
    eat: (command) => {
      foraging.eat(command.food);
    },
    splitLog: () => {
      startNew(() => gathering.splitLog());
    },
    dropLog: () => {
      carrying.drop();
    },
    dropFromBackpack: (command) => {
      piles.drop(command.content);
    },
    pickUpPile: (command) => {
      startNew(() => piles.pickUp(command.pileId));
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
    },
    addFuel: (command) => {
      campfires.addFuel(command.campfireId, command.fuel);
    },
    tendWoodpile: (command) => {
      cancelTasks();
      woodpiles.tend(command.woodpileId);
    },
    stackOnWoodpile: (command) => {
      woodpiles.stack(command.woodpileId, command.wood, command.all);
    },
    takeFromWoodpile: (command) => {
      refuseWith(woodpiles.take(command.woodpileId, command.wood));
    },
    openChest: (command) => {
      cancelTasks();
      chests.open(command.chestId);
    },
    putInChest: (command) => {
      refuseWith(chests.put(command.chestId, command.content, command.all));
    },
    takeFromChest: (command) => {
      refuseWith(chests.take(command.chestId, command.content, command.all));
    },
    lightCampfire: (command) => {
      campfires.light(command.campfireId);
    },
    layBedroll: () => {
      bedrolls.lay();
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
    drinkFromRiver: (command) => {
      cancelTasks();
      drinking.drinkFromRiver({ x: command.x, z: command.z });
    },
    putPotOnFire: (command) => {
      pot.putOnFire(command.campfireId);
    },
    takePotOffFire: (command) => {
      refuseWith(pot.takeOffFire(command.campfireId));
    },
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
   * `asleep` says whether the player sleeps through it.
   */
  function passTime(gameMinutes: number, asleep = false): boolean {
    for (let left = gameMinutes; left > 0; left -= PASS_TIME_SLICE_MINUTES) {
      const minutes = Math.min(PASS_TIME_SLICE_MINUTES, left);
      clock.skip(minutes / MINUTES_PER_HOUR);
      passRainTime(rain, seed, clock.minutes);
      // Rain does not put out campfires.
      campfires.burn(minutes);
      foraging.grow(minutes);
      pot.heat(minutes);
      const underRoof = isUnderRoof(entities, player.position);
      passNeedsTime(player.needs, minutes, {
        night: isNight(readClock(clock.minutes).hourOfDay),
        warmedByCampfire: isWarmedByCampfire(entities, player.position),
        working: currentAction() !== null,
        asleep,
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
    carrying.drop();
    entities.removeComponent(player, "walkPath");
    const asleepMinutes = nextMorning(clock.minutes) - clock.minutes;
    clock.skip(asleepMinutes / MINUTES_PER_HOUR);
    campfires.burn(asleepMinutes);
    foraging.grow(asleepMinutes);
    pot.heat(asleepMinutes);
    const { x, z } = player.respawnPoint;
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
    carrying.drop();
    entities.removeComponent(player, "walkPath");
    const { x, z } = bedroll.position;
    player.respawnPoint = { x, z };
    Object.assign(player.position, bedroll.position);
    Object.assign(player.previousPosition, player.position);
    const untilMorning = nextMorning(clock.minutes) - clock.minutes;
    const night = isNight(readClock(clock.minutes).hourOfDay);
    passTime(night ? untilMorning : Math.min(untilMorning, minutesToRestFully(player.needs, isUnderRoof(entities, player.position))), true);
  }

  function applyCommand(command: Command): void {
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
      walking.step(playerSeconds);
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
    describeRooms: () =>
      Object.freeze(
        findRooms(entities).map((room) => Object.freeze({ squares: Object.freeze(room.map((square) => Object.freeze({ ...square }))), heated: isRoomHeated(entities, room) })),
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
