import type { Command, GameClient, GameView, PlayerAction } from "./api";
import { createStartingBackpack } from "./backpack";
import { createCarrying } from "./carrying";
import { CHOP_SECONDS, createChopping } from "./chopping";
import { createClock, readClock, type ClockStart } from "./clock";
import { createEntityStore, movingEntities, type EntityStore } from "./entities";
import { generateValley, terrainHeightAt, type Valley } from "./valley";
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
      action: currentAction(),
      carrying: player.carrying ?? null,
    });
  }

  function currentAction(): PlayerAction | null {
    if (player.chopTask === undefined || player.walkPath !== undefined) return null;
    return Object.freeze({ kind: "chop", progress: Math.min(1, player.chopTask.secondsDone / CHOP_SECONDS) });
  }

  const commandHandlers: { [Type in Command["type"]]: (command: Extract<Command, { type: Type }>) => void } = {
    setPaused: (command) => {
      paused = command.paused;
    },
    walkTo: (command) => {
      chopping.cancel();
      carrying.cancel();
      walking.walkTo({ x: command.x, z: command.z });
    },
    chopTree: (command) => {
      carrying.cancel();
      chopping.start(command.treeId);
    },
    pickUpLog: (command) => {
      chopping.cancel();
      carrying.pickUp(command.logId);
    },
    dropLog: () => {
      carrying.drop();
    },
    skipTime: (command) => {
      clock.skip(command.hours);
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
      clock.advance(STEP_MS);
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

  return { entities, valley, step, client };
}
