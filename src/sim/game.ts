import type { CampfireView, Command, GameClient, GameView, PlayerAction } from "./api";
import { BACKPACK_WEIGHT_LIMIT_KG, backpackWeight, createStartingBackpack } from "./backpack";
import { CAMPFIRE_STICK_COST, createBuilding } from "./building";
import { createCarrying } from "./carrying";
import { CAMPFIRE_FUEL_LIMIT_MINUTES, createCampfires } from "./campfires";
import { CHOP_SECONDS, createChopping } from "./chopping";
import { createClock, readClock, type ClockStart } from "./clock";
import { createGathering, SPLIT_SECONDS } from "./gathering";
import { createEntityStore, movingEntities, type EntityStore } from "./entities";
import { generateValley, terrainHeightAt, type Valley } from "./valley";
import type { WalkMap } from "./walk-map";
import { createWalking, playerStartSpot } from "./walking";

/** Logic steps per second. Rendering blends between steps, so this can stay low. */
export const STEPS_PER_SECOND = 30;
export const STEP_MS = 1000 / STEPS_PER_SECOND;

/**
 * The player keeps at least this far from a tree's centre.
 * The walk map uses 1 m cells, so this leaves room for the widest trunk (about 0.4 m) plus half a cell's diagonal.
 */
const TREE_WALK_BLOCK_RADIUS_METRES = 1.2;
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
    });
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
      gathering.pickUpStick(command.stickId);
    },
    splitLog: () => {
      cancelTasks();
      gathering.splitLog();
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
      const before = clock.minutes;
      clock.skip(command.hours);
      campfires.burn(clock.minutes - before);
    },
  };

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
      walking.step(STEP_MS / 1000);
      chopping.step(STEP_MS / 1000);
      carrying.step();
      gathering.step(STEP_MS / 1000);
      building.step(STEP_MS / 1000);
      const before = clock.minutes;
      clock.advance(STEP_MS);
      campfires.burn(clock.minutes - before);
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
