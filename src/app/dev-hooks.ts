import type { GameClient } from "../sim/api";
import { STEPS_PER_SECOND } from "../sim/game";
import type { SoundState } from "../sound/sound-engine";

/**
 * What the dev build puts on `window.farHollow`, so browser tests and agents can read and drive the game without screenshots.
 * See `docs/agents/game-testing.md`.
 */
export interface DevHooks {
  readonly client: GameClient;
  /**
   * Runs the game's logic steps for `seconds` of real play time at once, instead of waiting for them.
   * Everything that would happen while playing happens: the player walks, work progresses, and the clock moves on.
   * The next drawn frame shows the result. Returns how many seconds of play time ran.
   * It runs fewer when the game holds its logic, such as while the sleep animation plays.
   */
  advance(seconds: number): number;
  /** Which sounds play now and how loud each one is, so tests check sound by reading state instead of listening. */
  sound(): SoundState;
}

/** Runs one logic step. Returns false if the game held its logic this step, so no time passed. */
export type DevStep = () => boolean;

export function createDevHooks(client: GameClient, step: DevStep, readSound: () => SoundState): DevHooks {
  return {
    client,
    advance(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError(`advance needs a number of seconds of 0 or more, not ${seconds}`);
      const steps = Math.round(seconds * STEPS_PER_SECOND);
      let ran = 0;
      for (let count = 0; count < steps; count += 1) if (step()) ran += 1;
      return ran / STEPS_PER_SECOND;
    },
    sound: readSound,
  };
}
