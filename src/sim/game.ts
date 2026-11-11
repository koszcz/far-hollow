import type { CampfireView, Command, GameClient, GameNotice, GameView, PlayerAction } from "./api";
import { BACKPACK_WEIGHT_LIMIT_KG, backpackWeight, createStartingBackpack } from "./backpack";
import { CAMPFIRE_STICK_COST, createBuilding } from "./building";
import { createCarrying } from "./carrying";
import { CAMPFIRE_FUEL_LIMIT_MINUTES, createCampfires, isWarmedByCampfire } from "./campfires";
import { CHOP_SECONDS, createChopping } from "./chopping";
import { createClock, isNight, MINUTES_PER_HOUR, nextMorning, readClock, REAL_MS_PER_GAME_MINUTE, type ClockStart } from "./clock";
import { createGathering, SPLIT_SECONDS } from "./gathering";
import { createEntityStore, movingEntities, type EntityStore } from "./entities";
import { generateValley, terrainHeightAt, type Valley } from "./valley";
import type { WalkMap } from "./walk-map";
import { createWalking, playerStartSpot } from "./walking";
import { createNeeds, hasCollapsed, needsSpeed, passNeedsTime, wakeFromCollapse } from "./needs";

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
};
/** A new game starts on the morning of day 1. */
export const GAME_START: ClockStart = { day: 1, hour: 8 };

export interface GameOptions {
  /** Decides how the valley is laid out. The same seed always makes the same valley. */
  seed: number;
}

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
}

export function createGame({ seed }: GameOptions): Game {
  const entities = createEntityStore();
  const valley = generateValley(seed);
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
  const walking = createWalking(entities, valley);
  const start = playerStartSpot(walking, valley);
  const startPosition = { x: start.x, y: terrainHeightAt(valley.terrain, start.x, start.z), z: start.z };
  const player = entities.add({
    player: true,
    position: startPosition,
    previousPosition: { ...startPosition },
    backpack: createStartingBackpack(),
    needs: createNeeds(),
    // Until the player has slept in a bed, they wake where they started after a collapse.
    respawnPoint: { x: start.x, z: start.z },
  });
  const chopping = createChopping(entities, walking, valley);
  const carrying = createCarrying(entities, walking, valley);
  const gathering = createGathering(entities, walking);
  const building = createBuilding(entities, walking, valley);
  const campfires = createCampfires(entities, walking);
  const moving = movingEntities(entities);
  const pendingCommands: Command[] = [];
  const listeners = new Set<() => void>();
  const clock = createClock(GAME_START);
  /** When the first night ends. Reaching it without a collapse counts as surviving the night. */
  const firstMorning = nextMorning(clock.minutes);
  /** Whether the first night has ended, by morning coming or by a collapse. */
  let firstNightOver = false;
  let notice: { kind: GameNotice; untilMinutes: number } | null = null;
  let paused = false;
  let stepCount = 0;
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
      campfireStickCost: CAMPFIRE_STICK_COST,
      action: currentAction(),
      carrying: player.carrying ?? null,
      nearbyCampfire: nearbyCampfire(),
      needs: Object.freeze({
        hunger: player.needs.hunger.level,
        thirst: player.needs.thirst.level,
        warmth: player.needs.warmth.level,
        fatigue: player.needs.fatigue.level,
      }),
      warmth: player.needs.warmth.level,
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
    });
  }

  function currentAction(): PlayerAction | null {
    if (player.buildTask !== undefined && player.walkPath === undefined) {
      const blueprint = entities.entity(player.buildTask.blueprintId)?.blueprint;
      if (blueprint !== undefined) return Object.freeze({ kind: "build", progress: blueprint.progress });
    }
    if (player.splitTask !== undefined) {
      return Object.freeze({ kind: "split", progress: Math.min(1, player.splitTask.secondsDone / SPLIT_SECONDS) });
    }
    if (player.chopTask === undefined || player.walkPath !== undefined) return null;
    return Object.freeze({ kind: "chop", progress: Math.min(1, player.chopTask.secondsDone / CHOP_SECONDS) });
  }

  /** Stops whatever the player was walking to do, before they start something else. */
  function cancelTasks(): void {
    chopping.cancel();
    carrying.cancel();
    gathering.cancel();
    building.cancel();
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
    pickUpStick: (command) => {
      cancelTasks();
      const refusal = gathering.pickUpStick(command.stickId);
      if (refusal !== undefined) showNotice(refusal);
    },
    splitLog: () => {
      cancelTasks();
      const refusal = gathering.splitLog();
      if (refusal !== undefined) showNotice(refusal);
    },
    dropLog: () => {
      carrying.drop();
    },
    placeCampfire: (command) => {
      building.placeCampfire({ x: command.x, z: command.z });
    },
    build: (command) => {
      cancelTasks();
      building.build(command.blueprintId);
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
    lightCampfire: (command) => {
      campfires.light(command.campfireId);
    },
    skipTime: (command) => {
      // Time only moves forward. Ignore a negative or broken amount.
      if (command.hours > 0 && Number.isFinite(command.hours)) passTime(command.hours * MINUTES_PER_HOUR);
    },
  };

  /**
   * Moves the clock on by this many game minutes. Campfires burn and the player's needs change as it goes.
   * A long stretch, such as skipped time, runs in short slices, so night falling or a fire going out partway counts.
   * A collapse ends the stretch early.
   */
  function passTime(gameMinutes: number): void {
    for (let left = gameMinutes; left > 0; left -= PASS_TIME_SLICE_MINUTES) {
      const minutes = Math.min(PASS_TIME_SLICE_MINUTES, left);
      clock.skip(minutes / MINUTES_PER_HOUR);
      campfires.burn(minutes);
      passNeedsTime(player.needs, minutes, {
        night: isNight(readClock(clock.minutes).hourOfDay),
        warmedByCampfire: isWarmedByCampfire(entities, player.position),
      });
      if (hasCollapsed(player.needs)) {
        collapse();
        return;
      }
      if (!firstNightOver && clock.minutes >= firstMorning) {
        firstNightOver = true;
        showNotice("survivedFirstNight");
      }
    }
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
    const { x, z } = player.respawnPoint;
    Object.assign(player.position, { x, y: terrainHeightAt(valley.terrain, x, z), z });
    Object.assign(player.previousPosition, player.position);
    wakeFromCollapse(player.needs);
    showNotice("collapsed");
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
      chopping.step(playerSeconds);
      carrying.step();
      gathering.step(playerSeconds);
      building.step(playerSeconds);
      passTime(STEP_MS / REAL_MS_PER_GAME_MINUTE);
      stepCount += 1;
    }

    view = snapshot();
    for (const listener of listeners) listener();
  }

  const client: GameClient = {
    getView: () => view,
    send: (command) => {
      pendingCommands.push(command);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return { entities, valley, walkMap: walking.walkMap, step, client };
}
