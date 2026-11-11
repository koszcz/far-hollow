import type { BackpackContents } from "./backpack";

export type { BackpackItem } from "./backpack";
import type { TimeOfDay } from "./clock";

// The only part of game logic the UI may import (ADR 0005).
// The UI reads a GameView and changes the game only by sending a Command.

export type Command =
  | { type: "setPaused"; paused: boolean }
  /** Walk the player to a spot on the ground, given in metres from the valley's centre. */
  | { type: "walkTo"; x: number; z: number }
  /** Walk the player to a standing tree and chop it down. The tree is given by its entity id. */
  | { type: "chopTree"; treeId: number }
  /** Walk the player to a log on the ground and shoulder it. The player carries one log at a time. */
  | { type: "pickUpLog"; logId: number }
  /** Lay the log the player carries on the ground at their feet. */
  | { type: "dropLog" }
  /** Jumps the valley's clock forward. The debug overlay sends it. */
  | { type: "skipTime"; hours: number };

export interface GameView {
  /** The seed the valley was laid out from. */
  readonly seed: number;
  readonly paused: boolean;
  /** Logic steps run since the game started. */
  readonly stepCount: number;
  readonly entityCount: number;
  /** Where the player stands after the latest logic step, in metres. */
  readonly playerPosition: Readonly<{ x: number; y: number; z: number }>;
  /** The valley's clock: which day it is and the time of day. */
  readonly time: TimeOfDay;
  /** How many of each tool and material the player's backpack holds. */
  readonly backpack: Readonly<BackpackContents>;
  /** The timed work the player is doing right now, or null if none. Walking to the work does not count. */
  readonly action: PlayerAction | null;
  /** What the player carries on their shoulder, or null if nothing. */
  readonly carrying: "log" | null;
}

export interface PlayerAction {
  readonly kind: "chop";
  /** How far along the work is, from 0 to 1. */
  readonly progress: number;
}

export interface GameClient {
  getView(): GameView;
  send(command: Command): void;
  /** Calls the listener after each logic step. Returns a function that stops listening. */
  subscribe(listener: () => void): () => void;
}
