import type { Command, GameClient, GameView } from "./api";
import { createEntityStore, movingEntities, type EntityStore } from "./entities";

/** Logic steps per second. Rendering blends between steps, so this can stay low. */
export const STEPS_PER_SECOND = 30;
export const STEP_MS = 1000 / STEPS_PER_SECOND;

export interface Game {
  readonly entities: EntityStore;
  /** Runs one fixed logic step. */
  step(): void;
  /** What the UI uses: it reads a GameView and sends commands. */
  readonly client: GameClient;
}

export function createGame(): Game {
  const entities = createEntityStore();
  const moving = movingEntities(entities);
  const pendingCommands: Command[] = [];
  const listeners = new Set<() => void>();
  let paused = false;
  let stepCount = 0;
  let view = snapshot();

  function snapshot(): GameView {
    return Object.freeze({ paused, stepCount, entityCount: entities.entities.length });
  }

  const commandHandlers: { [Type in Command["type"]]: (command: Extract<Command, { type: Type }>) => void } = {
    setPaused: (command) => {
      paused = command.paused;
    },
  };

  function applyCommand(command: Command): void {
    commandHandlers[command.type](command);
  }

  function step(): void {
    for (const command of pendingCommands.splice(0)) applyCommand(command);

    if (!paused) {
      for (const entity of moving) {
        Object.assign(entity.previousPosition, entity.position);
      }
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

  return { entities, step, client };
}
