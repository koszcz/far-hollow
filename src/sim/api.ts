import type { BackpackContents, Food } from "./backpack";

export type { BackpackContent, Food } from "./backpack";
import type { TimeOfDay } from "./clock";
import type { Vec3 } from "./entities";
import type { GroundPoint } from "./valley";

// The only part of game logic the UI may import (ADR 0005).
// The UI reads a GameView and changes the game only by sending a Command.

export type Command =
  | { type: "setPaused"; paused: boolean }
  /** Walk the player to a spot on the ground, given in metres from the valley's centre. */
  | ({ type: "walkTo" } & GroundPoint)
  /** Walk the player to a standing tree and chop it down. The tree is given by its entity id. */
  | { type: "chopTree"; treeId: number }
  /** Walk the player to a log on the ground and shoulder it. The player carries one log at a time. */
  | { type: "pickUpLog"; logId: number }
  /** Walk the player to a stick on the ground and put it in the backpack, if it fits. The stick is given by its entity id. */
  | { type: "pickUpStick"; stickId: number }
  /** Walk the player to a berry bush or mushroom patch, given by its entity id, and put its food in the backpack, if it all fits. */
  | { type: "forage"; spotId: number }
  /** Eat one of this food from the backpack. It fills hunger. */
  | { type: "eat"; food: Food }
  /** Split the log the player carries into firewood with the axe. The firewood goes in the backpack, if it all fits. */
  | { type: "splitLog" }
  /** Lay the log the player carries on the ground at their feet. */
  | { type: "dropLog" }
  /** Place a campfire blueprint at the building-grid spot nearest the given spot, in metres. Placing costs nothing. */
  | ({ type: "placeCampfire" } & GroundPoint)
  /**
   * Start holding the build action on a blueprint, given by its entity id. The player walks to it first if needed.
   * Construction goes on until the player sends stopBuilding, walks away, finishes, or runs out of sticks.
   */
  | { type: "build"; blueprintId: number }
  /** Let go of the build action. The blueprint keeps its progress. */
  | { type: "stopBuilding" }
  /** Walk the player beside a finished campfire, given by its entity id, so they can tend it. */
  | { type: "tendCampfire"; campfireId: number }
  /** Put one stick or piece of firewood from the backpack on a campfire within the player's reach. */
  | { type: "addFuel"; campfireId: number; fuel: CampfireFuel }
  /** Light a campfire within the player's reach with the fire striker. The campfire needs fuel. */
  | { type: "lightCampfire"; campfireId: number }
  /** Jumps the valley's clock forward. Lit campfires burn their fuel and the player's needs change for the time skipped. A collapse cuts the skip short. The debug overlay sends it. */
  | { type: "skipTime"; hours: number };

export interface GameView {
  /** The seed the valley was laid out from. */
  readonly seed: number;
  readonly paused: boolean;
  /** Logic steps run since the game started. */
  readonly stepCount: number;
  readonly entityCount: number;
  /** Where the player stands after the latest logic step, in metres. */
  readonly playerPosition: Readonly<Vec3>;
  /** The valley's clock: which day it is and the time of day. */
  readonly time: TimeOfDay;
  /** How many of each tool and material the player's backpack holds. */
  readonly backpack: Readonly<BackpackContents>;
  /** How much the backpack's contents weigh, in kilograms. */
  readonly backpackWeight: number;
  /** The most the backpack can hold, in kilograms. */
  readonly backpackWeightLimit: number;
  /** How many sticks it takes to build a campfire. */
  readonly campfireStickCost: number;
  /** The timed work the player is doing right now, or null if none. Walking to the work does not count. */
  readonly action: PlayerAction | null;
  /** What the player carries on their shoulder, or null if nothing. */
  readonly carrying: "log" | null;
  /** The campfire within the player's reach, or null if none is. */
  readonly nearbyCampfire: CampfireView | null;
  /** How full each of the player's needs is, from 0 (empty) to 1 (full). */
  readonly needs: Readonly<Record<"hunger" | "thirst" | "warmth" | "fatigue", number>>;
  /** How warm the player is, from 0 (frozen) to 1 (fully warm). The same as `needs.warmth`. The HUD shows it. */
  readonly warmth: number;
  /** A short message to show the player about something that just happened, or null if there is none. */
  readonly notice: GameNotice | null;
}

/**
 * Something that just happened that the player should be told about.
 * `collapsed`: the player had a collapse from a neglected need and woke at their respawn point.
 * `survivedFirstNight`: the player reached the first morning without a collapse.
 * `backpackFull`: the backpack had no room for what the player tried to put in it.
 * `saveBroken`: the saved game could not be loaded, so a new game started.
 */
export type GameNotice = "collapsed" | "survivedFirstNight" | "backpackFull" | "saveBroken";

/** The kinds of fuel the player can put on a campfire. */
export type CampfireFuel = "stick" | "firewood";

export interface CampfireView {
  /** The campfire's entity id. */
  readonly id: number;
  readonly lit: boolean;
  /** How full of fuel the campfire is, from 0 (empty) to 1 (it holds no more). */
  readonly fuelLeft: number;
  /** How many more game minutes the campfire's fuel can burn. */
  readonly fuelMinutes: number;
  /** True if sending lightCampfire would light it now: it is out, it has fuel, and the player has a fire striker. */
  readonly canLight: boolean;
}

export interface PlayerAction {
  /** Chopping a tree, splitting a log into firewood, or building a blueprint. */
  readonly kind: "chop" | "split" | "build";
  /** How far along the work is, from 0 to 1. */
  readonly progress: number;
}

export interface GameClient {
  getView(): GameView;
  send(command: Command): void;
  /** Calls the listener after each logic step. Returns a function that stops listening. */
  subscribe(listener: () => void): () => void;
}
