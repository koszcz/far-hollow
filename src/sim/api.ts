import type { BackpackContent, BackpackContents, Food } from "./backpack";
import type { Recipe, RecipeKind, RecipeLack } from "./crafting";

export type { GroundAmount, Recipe, RecipeAmount, RecipeKind, RecipeLack } from "./crafting";

export type { BackpackContent, CraftingContent, Food } from "./backpack";
import type { TimeOfDay } from "./clock";
import type { CarriedLog, Vec3, WoodpileWood } from "./entities";

export type { CarriedLog, WoodpileWood } from "./entities";
import type { PotWater } from "./pot-state";
import type { DeliveredMaterial, MaterialCost, Placement, QuarterTurns, StructureKind, WorkStationKind } from "./structures";
import type { GroundPoint } from "./valley";

export type { BuildMaterial, DeliveredMaterial, FurnitureKind, MaterialCost, Placement, QuarterTurns, StructureKind, WorkStationKind } from "./structures";

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
  /** Walk the player to a piece of bark on the ground and put it in the backpack, if it fits. The bark is given by its entity id. */
  | { type: "pickUpBark"; barkId: number }
  /** Walk the player to a berry bush or mushroom patch, given by its entity id, and put its food in the backpack, if it all fits. */
  | { type: "forage"; spotId: number }
  /** Eat one of this food from the backpack. It fills hunger. */
  | { type: "eat"; food: Food }
  /** Split the log the player carries into firewood with the axe. The firewood goes in the backpack, if it all fits. */
  | { type: "splitLog" }
  /** Lay the log or debarked log the player carries on the ground at their feet. */
  | { type: "dropLog" }
  /**
   * Drop all of one kind from the backpack at the player's feet, as one pile.
   * If a pile of the same kind lies within 1 m, they join that pile instead.
   */
  | { type: "dropFromBackpack"; content: BackpackContent }
  /** Walk the player to a pile, given by its entity id, and put as many of its things in the backpack as fit. The rest stay in the pile. */
  | { type: "pickUpPile"; pileId: number }
  /**
   * Place a blueprint of a structure from the build menu at the building-grid spot nearest the given spot, in metres,
   * facing `turns` quarter turns. Furniture, such as a chest, goes at the given spot itself. Placing costs nothing. Nothing happens if the structure's placement rule refuses the spot.
   * With `thenBuild`, the player starts building it at once if they have what the first stage needs, as if they had sent build.
   */
  | ({ type: "placeBlueprint"; structure: StructureKind; turns: QuarterTurns; thenBuild?: boolean } & GroundPoint)
  /**
   * Start building a blueprint, given by its entity id. The player walks to it first if needed.
   * Construction goes on until the player sends stopBuilding, walks away, finishes, or runs out of materials.
   */
  | { type: "build"; blueprintId: number }
  /**
   * Walk the player to a blueprint, given by its entity id, and add the debarked log on their shoulder to it.
   * Nothing is added if the blueprint already has all the debarked logs it needs.
   */
  | { type: "deliverToBlueprint"; blueprintId: number }
  /**
   * Walk the player to a blueprint or finished structure, such as a lean-to or a log wall, given by its entity id, and take it down.
   * A blueprint comes down at once. A finished structure takes timed work. The player gets back every material spent on it or carried to it.
   * Debarked logs, and any sticks or bark that do not fit in the backpack, are laid on the ground near the player, on their side of any wall.
   * Nothing happens if another structure stands on it.
   */
  | { type: "takeDown"; pieceId: number }
  /** Stop building. The blueprint keeps its progress. */
  | { type: "stopBuilding" }
  /** Walk the player beside a finished campfire, given by its entity id, so they can tend it. */
  | { type: "tendCampfire"; campfireId: number }
  /** Put one stick, piece of firewood, or piece of bark from the backpack on a campfire. The player walks beside it first if needed. */
  | { type: "addFuel"; campfireId: number; fuel: CampfireFuel }
  /** Walk the player beside a finished woodpile, given by its entity id, so they can stack wood on it or take wood off. */
  | { type: "tendWoodpile"; woodpileId: number }
  /**
   * Stack wood on a woodpile. The player walks beside it first if needed. A log or debarked log comes off the player's shoulder, one at a time.
   * Firewood comes out of the backpack: one piece, or with `all` as many as the woodpile has room for.
   */
  | { type: "stackOnWoodpile"; woodpileId: number; wood: WoodpileWood; all: boolean }
  /**
   * Take wood off a woodpile. The player walks beside it first if needed. A log or debarked log goes on the player's shoulder, if it is free.
   * Firewood goes in the backpack, as much as fits.
   */
  | { type: "takeFromWoodpile"; woodpileId: number; wood: WoodpileWood }
  /** Walk the player beside a finished chest, given by its entity id, and open it. It stays open until the player walks away or does something else. */
  | { type: "openChest"; chestId: number }
  /** Move one of a kind from the backpack into the open chest, or with `all` as many of that kind as fit. Logs never go in a chest. */
  | { type: "putInChest"; chestId: number; content: BackpackContent; all: boolean }
  /** Move one of a kind from the open chest into the backpack, or with `all` as many of that kind as fit. */
  | { type: "takeFromChest"; chestId: number; content: BackpackContent; all: boolean }
  /** Light a campfire with the fire striker. The campfire needs fuel. The player walks beside it first if needed. */
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
  /** Put the full pot from the backpack on a lit campfire, to boil its water. The player walks beside it first if needed. */
  | { type: "putPotOnFire"; campfireId: number }
  /** Take the pot off a campfire and put it back in the backpack. The player walks beside it first if needed. */
  | { type: "takePotOffFire"; campfireId: number }
  /**
   * Start crafting a recipe, given by its name. A hand recipe is crafted where the player stands, as timed work.
   * For a station recipe, the player walks to the finished work station given by `stationId`, or without one to the nearest
   * finished station of the right kind, and works there. A blueprint is not a station.
   * It is refused, with a notice saying why, if the player lacks its tool, work station, or materials, while they carry a log,
   * if the result would not fit in the backpack once the materials it uses are taken out,
   * or if the logs a station recipe uses do not lie within STATION_GROUND_METRES of the station.
   */
  | { type: "craft"; recipe: RecipeKind; stationId?: number }
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
  /** Every recipe, in the order the craft menu lists them, with what the player lacks to follow each one now. */
  readonly craftMenu: readonly CraftMenuEntry[];
  /** The timed work the player is doing right now, or null if none. Walking to the work does not count. */
  readonly action: PlayerAction | null;
  /** What the player carries on their shoulder, or null if nothing. */
  readonly carrying: CarriedLog | null;
  /**
   * The things within the player's reach that the HUD shows a panel for, at most one of each kind, in the order the HUD shows them.
   * `nearbyOf` finds one kind.
   */
  readonly nearby: readonly NearbyThing[];
  /** How full each of the player's needs is, from 0 (empty) to 1 (full). */
  readonly needs: Readonly<Record<"hunger" | "thirst" | "warmth" | "fatigue", number>>;
  /** How warm the player is, from 0 (frozen) to 1 (fully warm). The same as `needs.warmth`. The HUD shows it. */
  readonly warmth: number;
  /** Whether the player is sick, so their needs drain faster. */
  readonly sick: boolean;
  /** Whether rain is falling in the valley. */
  readonly raining: boolean;
  /** A short message to show the player about something that just happened, or null if there is none. */
  readonly notice: Notice | null;
}

/**
 * Something that just happened that the player should be told about.
 * `collapsed`: the player had a collapse from a neglected need and woke at their respawn point.
 * `survivedFirstNight`: the player reached the first morning without a collapse.
 * `backpackFull`: the backpack had no room for what the player tried to put in it.
 * `chestFull`: the open chest had no room for what the player tried to put in it.
 * `holdsUpPiece`: the player tried to take down a piece that another piece stands on.
 * `stillHoldsSomething`: the player tried to take down a chest or woodpile that still holds something.
 * `saveBroken`: the saved game could not be loaded, so a new game started.
 * `putLogDownFirst`: the player tried to craft while carrying a log.
 * `noLogBesideStation`: the player tried a station recipe, such as cutting planks, with no debarked log lying beside the `station`.
 * `cannotCraftYet`: the player tried a recipe while lacking the tool, work station, or materials it needs, listed in `lacks`.
 */
export type Notice =
  | { readonly kind: PlainNotice }
  | { readonly kind: "noLogBesideStation"; readonly station: WorkStationKind }
  | { readonly kind: "cannotCraftYet"; readonly lacks: readonly RecipeLack[] };

/** The kind of each notice. */
export type GameNotice = Notice["kind"];

/** A notice that needs nothing more than its kind to say what happened. */
export type PlainNotice =
  "collapsed" | "survivedFirstNight" | "backpackFull" | "chestFull" | "holdsUpPiece" | "stillHoldsSomething" | "saveBroken" | "putLogDownFirst";

/**
 * What one save slot holds, as the start screen shows it.
 * `empty`: nothing is saved there. `broken`: the save cannot be loaded.
 * `filled`: a game the player can continue, with its seed and the day it reached.
 */
export type SaveSlotSummary =
  { readonly state: "empty" } | { readonly state: "broken" } | { readonly state: "filled"; readonly seed: number; readonly day: number };

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
  /** True if sending lightCampfire would light it: it is out, it has fuel, and the player has a fire striker. The player walks there first if needed. */
  readonly canLight: boolean;
  /** For each kind of fuel, true if one more piece fits on the fire. A full fire takes no more. */
  readonly fits: Readonly<Record<CampfireFuel, boolean>>;
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
  /** The tool the player needs in the backpack to build it. Missing if it needs none. Building does not use the tool up. */
  readonly tool?: BackpackContent;
  /** How its blueprint follows the mouse while the player places it. Furniture goes "anywhere", off the building grid. */
  readonly placement: Placement;
}

/** One recipe in the craft menu: the recipe, with everything the player lacks to follow it now. */
export type CraftMenuEntry = Recipe & {
  /** Everything the player lacks to follow it now, such as its tool or work station. Empty when they can follow it. */
  readonly lacks: readonly RecipeLack[];
};

/** A blueprint, with how far it has been built and the materials carried to it. */
export interface BlueprintView {
  /** The blueprint's entity id. */
  readonly id: number;
  readonly structure: StructureKind;
  /** How far construction has gone, from 0 to 1. */
  readonly progress: number;
  /** For each material the player carries to it, such as debarked logs: how many it has had and how many it needs. */
  readonly deliveries: readonly { readonly material: DeliveredMaterial; readonly has: number; readonly needs: number }[];
}

/** A room: foundation squares closed in by log walls or door frames, with a roof over every square. */
export interface RoomView {
  /** The middles of the room's foundation squares, in metres. */
  readonly squares: readonly GroundPoint[];
  /** Whether a lit campfire in the room warms all of it. */
  readonly heated: boolean;
}

/** A woodpile, with how much of each kind of wood is stacked on it. */
export interface WoodpileView {
  /** The woodpile's entity id. */
  readonly id: number;
  /** How many of each kind of wood are stacked on it. */
  readonly contents: Readonly<Record<WoodpileWood, number>>;
  /** How many pieces of wood it holds in all. */
  readonly total: number;
  /** The most pieces of wood it holds in all, in any mix. */
  readonly capacity: number;
}

/** An open chest, with what it holds. It holds small materials, tools, and food, grouped by kind like the backpack. */
export interface ChestView {
  /** The chest's entity id. */
  readonly id: number;
  /** How many of each kind of thing it holds. Kinds it does not hold are missing. */
  readonly contents: Readonly<BackpackContents>;
  /** How much its contents weigh, in kilograms. */
  readonly weight: number;
  /** The most it can hold, in kilograms. */
  readonly weightLimit: number;
}

export interface BedrollView {
  /** The bedroll's entity id. */
  readonly id: number;
}

/** A pile of things the player dropped on the ground. */
export interface PileView {
  /** The pile's entity id. */
  readonly id: number;
  /** What kind of thing the pile holds. */
  readonly content: BackpackContent;
  /** How many things the pile holds. */
  readonly count: number;
}

/**
 * What the HUD shows for each kind of thing within the player's reach:
 * the campfire, the laid bedroll, the nearest pile, the woodpile, the chest the player has open, and the nearest blueprint.
 * A chest closes when the player walks away.
 */
export interface NearbyViews {
  readonly campfire: CampfireView;
  readonly bedroll: BedrollView;
  readonly pile: PileView;
  readonly woodpile: WoodpileView;
  readonly openChest: ChestView;
  readonly blueprint: BlueprintView;
}

/** One thing within the player's reach, with its kind. */
export type NearbyThing = { readonly [Kind in keyof NearbyViews]: { readonly kind: Kind; readonly view: NearbyViews[Kind] } }[keyof NearbyViews];

/** The thing of this kind within the player's reach, or null if none is. */
export function nearbyOf<Kind extends keyof NearbyViews>(view: GameView, kind: Kind): NearbyViews[Kind] | null {
  const found = view.nearby.find((thing) => thing.kind === kind);
  return found === undefined ? null : (found.view as NearbyViews[Kind]);
}

/**
 * A thing in the world the player can act on with E, given by its entity id, with its kind.
 * The kinds match what the scene reports under the cursor, so the UI can treat both the same way.
 */
export type ThingInReach =
  | {
      readonly kind: "tree" | "log" | "debarkedLog" | "stick" | "bark" | "forage" | "blueprint" | "campfire" | "woodpile" | "chest" | "bedroll" | "pile";
      readonly id: number;
    }
  | { readonly kind: "workStation"; readonly id: number; readonly station: WorkStationKind };

export interface PlayerAction {
  /** Chopping a tree, splitting a log into firewood, debarking a log, building a blueprint, taking down a finished piece, or crafting. */
  readonly kind: "chop" | "split" | "debark" | "build" | "takeDown" | "craft";
  /** How far along the work is, from 0 to 1. */
  readonly progress: number;
}

/** Where a blueprint would go, and whether its structure's placement rule allows it there. */
export interface PlacementCheck {
  /** The building-grid spot it snaps to, on the ground, in metres. */
  readonly spot: Readonly<Vec3>;
  /** The turn it takes there. This is the turn asked for, except for a roof, which takes the turn of the frame under it. */
  readonly turns: QuarterTurns;
  readonly allowed: boolean;
}

export interface GameClient {
  getView(): GameView;
  /**
   * Where a blueprint of `structure` facing `turns` would go if placed near `at`, and whether it is allowed there.
   * It only reads game state, so the blueprint under the mouse can follow it before the player clicks.
   */
  checkPlacement(structure: StructureKind, at: GroundPoint, turns: QuarterTurns): PlacementCheck;
  /** What a blueprint, given by its entity id, has and needs, or null if it is not a blueprint. It only reads game state. */
  describeBlueprint(blueprintId: number): BlueprintView | null;
  /** A finished campfire, given by its entity id, near or far, or null if it is not one. It only reads game state. */
  describeCampfire(campfireId: number): CampfireView | null;
  /** A finished woodpile, given by its entity id, near or far, or null if it is not one. It only reads game state. */
  describeWoodpile(woodpileId: number): WoodpileView | null;
  /** The thing nearest the player within the reach of E, or null if nothing is in reach. It only reads game state. */
  nearestInReach(): ThingInReach | null;
  /** Every room in the valley, worked out from the finished pieces. It only reads game state. The debug overlay shows it. */
  describeRooms(): readonly RoomView[];
  send(command: Command): void;
  /** Calls the listener after each logic step. Returns a function that stops listening. */
  subscribe(listener: () => void): () => void;
}
