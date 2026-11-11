import type { TimeOfDay } from "./clock";

// The only part of game logic the UI may import (ADR 0005).
// The UI reads a GameView and changes the game only by sending a Command.

export type Command =
  | { type: "setPaused"; paused: boolean }
  /** Walk the player to a spot on the ground, given in metres from the valley's centre. */
  | { type: "walkTo"; x: number; z: number }
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
}

export interface GameClient {
  getView(): GameView;
  send(command: Command): void;
  /** Calls the listener after each logic step. Returns a function that stops listening. */
  subscribe(listener: () => void): () => void;
}
