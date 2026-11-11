import type { BackpackContents, Food } from "./backpack";

export type { BackpackContent, Food } from "./backpack";
import type { TimeOfDay } from "./clock";
import type { CarriedLog, Vec3 } from "./entities";

export type { CarriedLog } from "./entities";
import type { PotWater } from "./pot-state";
import type { MaterialCost, QuarterTurns, StructureKind } from "./structures";
import type { GroundPoint } from "./valley";

export type { BuildMaterial, MaterialCost, QuarterTurns, StructureKind } from "./structures";

/** The new-game screen uses it to turn typed text into a seed. */
export { seedFromText } from "./seed";

// The only part of game logic the UI may import (ADR 0005).
// The UI reads a GameView and changes the game only by sending a Command.

export type Command =
  | { type: "setPaused"; paused: boolean }
  /** Walk the player to a spot on the ground, given in metres from the valley's centre. */
  | ({ type: "walkTo" } & GroundPoint)
  /** Walk the player to a standing tree and chop it down. The tree is given by its entity id. */
  | { type: "chopTree"; treeId: number }
  /** Walk the player to a log or debarked log on the ground and shoulder it. The player carries one at a time. */
  | { type: "pickUpLog"; logId: number }
  /**
   * Walk the player to a log on the ground and strip its bark with the drawknife.
   * The log becomes a debarked log, and its bark goes in the backpack, if it all fits.
   */
  | { type: "debarkLog"; logId: number }
  /** Walk the player to a stick on the ground and put it in the backpack, if it fits. The stick is given by its entity id. */
  | { type: "pickUpStick"; stickId: number }
  /** Walk the player to a berry bush or mushroom patch, given by its entity id, and put its food in the backpack, if it all fits. */
  | { type: "forage"; spotId: number }
  /** Eat one of this food from the backpack. It fills hunger. */
  | { type: "eat"; food: Food }
  /** Split the log the player carries into firewood with the axe. The firewood goes in the backpack, if it all fits. */
  | { type: "splitLog" }
  /** Lay the log or debarked log the player carries on the ground at their feet. */
  | { type: "dropLog" }
  /**
   * Place a blueprint of a structure from the build menu at the building-grid spot nearest the given spot, in metres,
   * facing `turns` quarter turns. Placing costs nothing. Nothing happens if the structure's placement rule refuses the spot.
   */
  | ({ type: "placeBlueprint"; structure: StructureKind; turns: QuarterTurns } & GroundPoint)
  /**
   * Start holding the build action on a blueprint, given by its entity id. The player walks to it first if needed.
   * Construction goes on until the player sends stopBuilding, walks away, finishes, or runs out of sticks.
   */
  | { type: "build"; blueprintId: number }
  /** Let go of the build action. The blueprint keeps its progress. */
  | { type: "stopBuilding" }
  /** Walk the player beside a finished campfire, given by its entity id, so they can tend it. */
  | { type: "tendCampfire"; campfireId: number }
  /** Put one stick, piece of firewood, or piece of bark from the backpack on a campfire within the player's reach. */
  | { type: "addFuel"; campfireId: number; fuel: CampfireFuel }
  /** Light a campfire within the player's reach with the fire striker. The campfire needs fuel. */
  | { type: "lightCampfire"; campfireId: number }
  /** Take the bedroll out of the backpack and lay it on the ground at the player's feet. */
  | { type: "layBedroll" }
  /** Walk the player to a laid bedroll, given by its entity id, and put it back in the backpack. */
  | { type: "pickUpBedroll"; bedrollId: number }
  /**
   * Walk the player to a laid bedroll, given by its entity id, and sleep on it. It becomes the player's respawn point.
   * At night the player sleeps until morning. By day they sleep until fatigue is restored.
   * Other needs change for the time slept, and a collapse cuts sleep short.
   */
  | { type: "sleep"; bedrollId: number }
  /**
   * Walk the player to the riverbank nearest a spot on the river, given in metres, and drink there.
   * River water is not boiled, so drinking it fills thirst but makes the player sick.
   */
  | ({ type: "drinkFromRiver" } & GroundPoint)
  /** Walk the player to the riverbank nearest them and fill the empty pot with river water. */
  | { type: "fillPot" }
  /** Drink the water in the full pot. Boiled water fills thirst safely. Unboiled river water makes the player sick. */
  | { type: "drinkFromPot" }
  /** Put the full pot from the backpack on a lit campfire within the player's reach, to boil its water. */
  | { type: "putPotOnFire"; campfireId: number }
  /** Take the pot off a campfire within the player's reach and put it back in the backpack. */
  | { type: "takePotOffFire"; campfireId: number }
  /** Jumps the valley's clock forward. Lit campfires burn their fuel and the player's needs change for the time skipped. A collapse cuts the skip short. The debug overlay sends it. */
  | { type: "skipTime"; hours: number }
  /** Jumps the valley's clock forward to when rain next starts or stops, the same way skipTime does. The debug overlay sends it. */
  | { type: "skipToRainChange" };

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
  /** Every structure the player can build, with its cost, in the order the build menu lists them. */
  readonly buildMenu: readonly BuildMenuEntry[];
  /** The timed work the player is doing right now, or null if none. Walking to the work does not count. */
  readonly action: PlayerAction | null;
  /** What the player carries on their shoulder, or null if nothing. */
  readonly carrying: CarriedLog | null;
  /** The campfire within the player's reach, or null if none is. */
  readonly nearbyCampfire: CampfireView | null;
  /** The laid bedroll within the player's reach, or null if none is. */
  readonly nearbyBedroll: BedrollView | null;
  /** How full each of the player's needs is, from 0 (empty) to 1 (full). */
  readonly needs: Readonly<Record<"hunger" | "thirst" | "warmth" | "fatigue", number>>;
  /** How warm the player is, from 0 (frozen) to 1 (fully warm). The same as `needs.warmth`. The HUD shows it. */
  readonly warmth: number;
  /** Whether the player is sick, so their needs drain faster. */
  readonly sick: boolean;
  /** Whether rain is falling in the valley. */
  readonly raining: boolean;
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

/**
 * What one save slot holds, as the start screen shows it.
 * `empty`: nothing is saved there. `broken`: the save cannot be loaded.
 * `filled`: a game the player can continue, with its seed and the day it reached.
 */
export type SaveSlotSummary =
  | { readonly state: "empty" }
  | { readonly state: "broken" }
  | { readonly state: "filled"; readonly seed: number; readonly day: number };

/** The kinds of fuel the player can put on a campfire. */
export type CampfireFuel = "stick" | "firewood" | "bark";

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
  /**
   * The pot on the campfire, or null if there is none. `water` says whether its water has boiled yet.
   * `boilProgress` runs from 0 to 1 while the water boils on the lit fire.
   */
  readonly pot: { readonly water: PotWater; readonly boilProgress: number } | null;
}

/** One structure in the build menu. */
export interface BuildMenuEntry {
  readonly structure: StructureKind;
  /** Everything building it costs. Placing its blueprint costs nothing. Construction spends it. */
  readonly cost: readonly MaterialCost[];
}

export interface BedrollView {
  /** The bedroll's entity id. */
  readonly id: number;
}

export interface PlayerAction {
  /** Chopping a tree, splitting a log into firewood, debarking a log, or building a blueprint. */
  readonly kind: "chop" | "split" | "debark" | "build";
  /** How far along the work is, from 0 to 1. */
  readonly progress: number;
}

/** Where a blueprint would go, and whether its structure's placement rule allows it there. */
export interface PlacementCheck {
  /** The building-grid spot it snaps to, on the ground, in metres. */
  readonly spot: Readonly<Vec3>;
  readonly allowed: boolean;
}

export interface GameClient {
  getView(): GameView;
  /**
   * Where a blueprint of `structure` facing `turns` would go if placed near `at`, and whether it is allowed there.
   * It only reads game state, so the blueprint under the mouse can follow it before the player clicks.
   */
  checkPlacement(structure: StructureKind, at: GroundPoint, turns: QuarterTurns): PlacementCheck;
  send(command: Command): void;
  /** Calls the listener after each logic step. Returns a function that stops listening. */
  subscribe(listener: () => void): () => void;
}
