// Helpers that tests share for running a game's logic steps.
import type { Game } from "./game";
import { REACH_SECONDS } from "./hand-reach";
import { STEPS_PER_SECOND } from "./game";

/**
 * Runs logic steps until the player's reach is over, so whatever the reach hands over has changed hands.
 * It gives up after one whole reach's worth of steps, as while the game is paused.
 */
export function finishReach(game: Game): void {
  const maxSteps = Math.ceil(REACH_SECONDS * STEPS_PER_SECOND) + 1;
  for (let steps = 0; steps < maxSteps && game.client.getView().reach !== null; steps += 1) game.step();
}
