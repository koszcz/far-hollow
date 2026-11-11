import type { Command, GameClient, GameView } from "./api";
import { createClock, readClock, type ClockStart } from "./clock";
import { createEntityStore, movingEntities, type EntityStore } from "./entities";
import { generateValley, terrainHeightAt, type Valley } from "./valley";

/** Logic steps per second. Rendering blends between steps, so this can stay low. */
export const STEPS_PER_SECOND = 30;
export const STEP_MS = 1000 / STEPS_PER_SECOND;

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
    entities.add({ tree: true, position: { x: tree.x, y: terrainHeightAt(valley.terrain, tree.x, tree.z), z: tree.z } });
  }
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
      time: readClock(clock.minutes),
    });
  }

  const commandHandlers: { [Type in Command["type"]]: (command: Extract<Command, { type: Type }>) => void } = {
    setPaused: (command) => {
      paused = command.paused;
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
