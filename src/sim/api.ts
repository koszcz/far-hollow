import type { BackpackContent, BackpackContents, Food, WildFood } from "./backpack";
import type { Recipe, RecipeKind, RecipeLack } from "./crafting";

export type { GroundAmount, Recipe, RecipeAmount, RecipeKind, RecipeLack } from "./crafting";

export type { BackpackContent, CraftingContent, Fish, FishingContent, Food, WildFood } from "./backpack";

/** The hotbar uses it to show how much each kind of thing in the backpack weighs. */
export { CONTENT_WEIGHT_KG } from "./backpack";
import type { TimeOfDay } from "./clock";

/** The HUD clock uses these to name the time of day. */
export { HOURS_PER_DAY, MORNING_HOUR, NIGHT_START_HOUR, type TimeOfDay } from "./clock";
import type { Vec3 } from "./entities";
import type { BurnTime } from "./burn-time";

/** The hotbar and drawing use these to show how long a lit torch still burns. */
export { burnShare, type BurnTime } from "./burn-time";
import type { CampfireFuel, CarriedLog, WoodpileWood } from "./wood-and-fuel";

export { CAMPFIRE_FUELS, CARRIED_LOGS, WOODPILE_WOODS, type CampfireFuel, type CarriedLog, type WoodpileWood } from "./wood-and-fuel";
import type { PotWater } from "./pot-state";
import type { BuildMaterial, FurnitureKind, KeptMaterial, MaterialCost, Placement, StructureKind, WorkStationKind } from "./structures";
import type { QuarterTurns } from "./quarter-turns";
import type { GroundPoint } from "./ground-point";

export type { BuildMaterial, DeliveredMaterial, FurnitureKind, KeptMaterial, MaterialCost, Placement, StructureKind, WorkStationKind } from "./structures";

import { FURNITURE, type FurnitureUse } from "./furniture";
export type { FurnitureUse } from "./furniture";
import { FURNITURE_KINDS } from "./structure-kind";
export { isPlacedInRows } from "./structure-kind";

/** The HUD uses these to tell the player when a low need slows them, and which needs there are. */
export { LOW_NEED, NEED_KINDS, type NeedKind } from "./needs";

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
  /**
   * Walk the player to a sapling and dig it up into the backpack. It takes a few seconds and needs no tool.
   * Digging up the sapling on a stump removes the stump for good. It is refused for a bare stump, a young or full tree,
   * and when the sapling does not fit in the backpack.
   */
  | { type: "digUpSapling"; saplingId: number }
  /**
   * Walk the player to a spot and plant a sapling from the backpack there. It takes a few seconds. It is refused when the backpack
   * holds no sapling, off forest floor and clearing, near a tree, stump, or sapling, and near a structure or blueprint.
   */
  | ({ type: "plantSapling" } & GroundPoint)
  /** Walk the player to a log or debarked log on the ground and shoulder it. The player carries one at a time. */
  | { type: "pickUpLog"; logId: number }
  /**
   * Walk the player to a log on the ground and strip its bark with the drawknife.
   * The log becomes a debarked log, and its bark goes in the backpack, if it all fits.
   */
  | { type: "debarkLog"; logId: number }
  /**
   * Walk the player to a plain log on the ground and plant a mushroom from the backpack on it. It takes a few seconds and needs no tool.
   * The log becomes a mushroom log where it lies. It is refused for a debarked log and when the backpack holds no mushroom.
   */
  | { type: "plantMushroom"; logId: number }
  /** Walk the player to a mushroom log, given by its entity id, and take it down. It vanishes and gives nothing back. */
  | { type: "takeDownMushroomLog"; mushroomLogId: number }
  /** Walk the player to a stick on the ground and put it in the backpack, if it fits. The stick is given by its entity id. */
  | { type: "pickUpStick"; stickId: number }
  /** Walk the player to a piece of bark on the ground and put it in the backpack, if it fits. The bark is given by its entity id. */
  | { type: "pickUpBark"; barkId: number }
  /** Walk the player to a berry bush or mushroom patch, given by its entity id, and put its food in the backpack, if it all fits. */
  | { type: "forage"; spotId: number }
  /** Eat one of this food from the backpack. It fills hunger. */
  | { type: "eat"; food: Food }
  /**
   * Split a log into firewood with the axe. The firewood goes in the backpack, if it all fits.
   * Without `logId`, the player splits the log they carry. With `logId`, they walk to that log on the ground, shoulder it, then split it.
   */
  | { type: "splitLog"; logId?: number }
  /** Lay the log or debarked log the player carries on the ground at their feet. */
  | { type: "dropLog" }
  /** Walk the player to a spot on the ground, given in metres from the valley's centre, and lay the log or debarked log they carry there. */
  | ({ type: "dropLogAt" } & GroundPoint)
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
  /** Put the log or debarked log on the player's shoulder on a parked sled, if it has room. The player walks beside it first if needed. */
  | { type: "loadSled"; sledId: number }
  /** Take one log or debarked log off a parked sled onto the player's free shoulder. The player walks beside it first if needed. */
  | { type: "takeFromSled"; sledId: number; log: CarriedLog }
  /** Move every plank in the backpack onto a parked sled, as far as it has room. The player walks beside it first if needed. */
  | { type: "loadPlanksOnSled"; sledId: number }
  /** Move as many planks from a parked sled into the backpack as fit. The player walks beside it first if needed. */
  | { type: "takePlanksFromSled"; sledId: number }
  /**
   * Lay every log on a parked sled on the ground beside it, each on its own, and drop its planks in one pile behind it.
   * The player walks beside it first if needed.
   */
  | { type: "tipOutSled"; sledId: number }
  /** Start dragging a parked sled behind the player. The player walks beside it first if needed. They drag one sled at a time. */
  | { type: "dragSled"; sledId: number }
  /** Let go of the sled the player drags. It stays where it is, with its load. */
  | { type: "letGoOfSled" }
  /** Walk the player beside a finished chest, given by its entity id, and open it. It stays open until the player walks away or does something else. */
  | { type: "openChest"; chestId: number }
  /** Move one of a kind from the backpack into the open chest, or with `all` as many of that kind as fit. Logs never go in a chest. */
  | { type: "putInChest"; chestId: number; content: BackpackContent; all: boolean }
  /** Move one of a kind from the open chest into the backpack, or with `all` as many of that kind as fit. */
  | { type: "takeFromChest"; chestId: number; content: BackpackContent; all: boolean }
  /** Light a campfire with the steel and flint. The campfire needs fuel. The player walks beside it first if needed. */
  | { type: "lightCampfire"; campfireId: number }
  /** Take the bedroll out of the backpack and lay it on the ground at the player's feet. */
  | { type: "layBedroll" }
  /** Walk the player into a finished lean-to, given by its entity id, and lay the bedroll from the backpack across its open front, under the roof. */
  | { type: "layBedrollInLeanTo"; leanToId: number }
  /** Walk the player to a laid bedroll, given by its entity id, and put it back in the backpack. */
  | { type: "pickUpBedroll"; bedrollId: number }
  /**
   * Walk the player to a laid bedroll, given by its entity id, and sleep on it. It becomes the player's respawn point.
   * At night the player sleeps until morning. By day they sleep until fatigue is restored,
   * but a sleep that would end in the night lasts until morning.
   * Other needs change for the time slept, and a collapse cuts sleep short.
   */
  | { type: "sleep"; bedrollId: number }
  /**
   * Walk the player beside a finished bed, given by its entity id, and sleep in it, by the same rules as sleeping on a bedroll.
   * A bed restores fatigue twice as fast as a bedroll. The spot where it stands becomes the player's respawn point.
   */
  | { type: "sleepInBed"; bedId: number }
  /**
   * Walk the player beside a finished stool, given by its entity id, and sit on it. While they sit, fatigue comes back slowly
   * and time runs at normal speed. The player stands up as soon as they walk or act. Sitting does not change the respawn point.
   */
  | { type: "sitOnStool"; stoolId: number }
  /**
   * Walk the player to the riverbank nearest a spot on the river, given in metres, and drink there.
   * River water is not boiled, so drinking it fills thirst but makes the player sick.
   */
  | ({ type: "drinkFromRiver" } & GroundPoint)
  /**
   * Walk the player to the river bank nearest a spot on the river, given in metres, and fish there with the fishing rod.
   * Each cast waits a random 15 to 45 game minutes for a fish, which goes in the backpack. The player casts again until
   * they do something else or a fish gets away because the backpack is full. It is refused while they carry a log,
   * and does nothing without a fishing rod.
   */
  | ({ type: "fish" } & GroundPoint)
  /**
   * Walk the player into reach of a spot on the river bank or in the river, given in metres, and gather one stone there.
   * It takes 4 seconds of work and needs no tool. Stone never runs out. Nothing happens for a spot off the river bank.
   * It is refused when one more stone does not fit in the backpack.
   */
  | ({ type: "gatherStone" } & GroundPoint)
  /** Walk the player to the riverbank nearest them and fill the empty pot with river water. */
  | { type: "fillPot" }
  /** Drink the water in the full pot. Boiled water fills thirst safely. Unboiled river water makes the player sick. */
  | { type: "drinkFromPot" }
  /** Put the full pot from the backpack on a lit campfire, to boil its water. The player walks beside it first if needed. */
  | { type: "putPotOnFire"; campfireId: number }
  /** Take the pot off a campfire and put it back in the backpack. The player walks beside it first if needed. */
  | { type: "takePotOffFire"; campfireId: number }
  /**
   * Put one raw fish from the backpack on a lit campfire. It becomes cooked fish after 8 game minutes on the lit fire.
   * Nothing happens if the fire is out or already holds 3 fish. The player walks beside it first if needed.
   */
  | { type: "cookFish"; campfireId: number }
  /**
   * Take every fish off a campfire, raw or cooked, and put them in the backpack as far as they fit. The rest stay on the fire.
   * The player walks beside it first if needed.
   */
  | { type: "takeFishOff"; campfireId: number }
  /**
   * Start crafting a recipe, given by its name. A hand recipe is crafted where the player stands, as timed work.
   * For a station recipe, the player walks to the finished work station given by `stationId`, or without one to the nearest
   * finished station of the right kind, and works there. A blueprint is not a station.
   * It is refused, with a notice saying why, if the player lacks its tool, work station, or materials, while they carry a log,
   * if the result would not fit in the backpack once the materials it uses are taken out,
   * or if the logs a station recipe uses do not lie within STATION_GROUND_METRES of the station.
   */
  | { type: "craft"; recipe: RecipeKind; stationId?: number }
  /**
   * Light a torch from the backpack with the steel and flint. It leaves the backpack and goes in the player's hand, lit for
   * TORCH_BURN_MINUTES. It is refused without the steel and flint, or while the player already holds a lit torch.
   * Nothing happens if the backpack holds no torch.
   */
  | { type: "lightTorch" }
  /** Put out the lit torch in the player's hand. It is thrown away, since a torch is never lit twice. */
  | { type: "putOutTorch" }
  /**
   * Plant the lit torch in the player's hand in the ground at their feet, or on the foundation they stand on. It keeps the time
   * it had left, and the hand is then empty. It is refused within PLANTED_TORCH_SPACING_METRES of another planted torch.
   * Nothing happens if the player holds no lit torch.
   */
  | { type: "plantTorch" }
  /**
   * Walk the player to a planted torch, given by its entity id, and take it in their hand with the time it has left.
   * It is refused while the player already holds a lit torch.
   */
  | { type: "pickUpTorch"; torchId: number }
  /** Jumps the valley's clock forward. Lit campfires burn their fuel and the player's needs change for the time skipped. A collapse cuts the skip short. The debug overlay sends it. */
  | { type: "skipTime"; hours: number }
  /** Jumps the valley's clock forward to when rain next starts or stops, the same way skipTime does. The debug overlay sends it. */
  | { type: "skipToRainChange" }
  /**
   * Add an action to the end of the action queue. With an empty queue, it starts at once, as if sent on its own.
   * The queue holds at most ACTION_QUEUE_LIMIT actions, counting the one under way. When it is full, or when the game
   * would refuse the action now, nothing is added and a notice says why. A command that is never queued, such as pausing,
   * placing a blueprint, or opening a chest, runs as if sent on its own.
   */
  | { type: "queueAction"; action: ActionCommand }
  /**
   * Take the action at `index` out of the action queue, as a click on its icon does. Index 0 is the action under way:
   * cancelling it stops what the player is doing for it, and the next action starts. Nothing happens if no action is there.
   */
  | { type: "cancelQueuedAction"; index: number };

/** Every command except those that change the action queue itself: what the action queue holds. */
export type ActionCommand = Exclude<Command, { type: "queueAction" | "cancelQueuedAction" }>;

/** The most actions the action queue holds, counting the one under way. */
export const ACTION_QUEUE_LIMIT = 4;

/** Wraps a command so it goes to the end of the action queue instead of replacing it. A command that changes the queue itself stays as it is. */
export function queued(command: Command): Command {
  return command.type === "queueAction" || command.type === "cancelQueuedAction" ? command : { type: "queueAction", action: command };
}

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
  /** Whether it is night now, by the game's own hours. The HUD shows the moon instead of the sun. */
  readonly night: boolean;
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
  /** The sled the player drags behind them, or null if none. */
  readonly dragging: SledView | null;
  /**
   * The lit torch in the player's hand, or null if they hold none: how long it still burns. `burnShare` gives that as a share
   * of its whole burning time. It lights the ground within TORCH_LIGHT_METRES of the player.
   */
  readonly litTorch: BurnTime | null;
  /** Every torch planted in the ground, in no set order. Each burns down as the one in the hand does, sleep included. */
  readonly plantedTorches: readonly PlantedTorchView[];
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
  /**
   * The player's last sleep on a bedroll or in a bed since the game was loaded, or null if none. `count` goes up by one with each
   * sleep, so drawing can tell a new one. `at` is the middle of the bedroll or bed. Drawing plays the sleep animation from it.
   */
  readonly lastSleep: SleepView | null;
  /**
   * The player's last bite of food or drink of water since the game was loaded, or null if none. `count` goes up by one
   * with each, so drawing can tell a new one and play its motion once. It is not saved.
   */
  readonly lastEatOrDrink: EatOrDrinkView | null;
  /** The entity id of the stool the player sits on, or null if they are not sitting. */
  readonly sittingOn: number | null;
  /**
   * The player's reach to pick something up or put something down, or null if they are not reaching.
   * `height` is "low" for the ground and "waist" for a woodpile, chest, or sled. The hand gets to the thing, and the
   * command is carried out, `seconds` = HAND_AT_SECONDS into the reach. See hand-reach.ts.
   */
  readonly reach: ReachView | null;
  /**
   * The action queue: the action under way first, then the actions waiting their turn, in order. Empty when the player
   * is doing nothing they were asked to do. It holds at most ACTION_QUEUE_LIMIT actions. It is not saved.
   */
  readonly actionQueue: readonly ActionCommand[];
}

/** A torch planted in the ground, given by its entity id: where it stands and how long it still burns. See `GameView.plantedTorches`. */
export interface PlantedTorchView extends BurnTime {
  readonly id: number;
  readonly position: Readonly<Vec3>;
}

/** How far a lit torch lights the ground around it, in metres. Drawing uses it for the torch's light. */
export const TORCH_LIGHT_METRES = 6;

/** A reach in progress. See `GameView.reach`. */
export interface ReachView {
  readonly height: "low" | "waist";
  readonly seconds: number;
}

/**
 * One bite of food or drink of water. See `GameView.lastEatOrDrink`. `kind` says which: eating from the backpack,
 * drinking from the river, or drinking from the pot. `toward` is the spot on the river, for a drink from the river.
 */
export interface EatOrDrinkView {
  readonly count: number;
  readonly kind: "eat" | "drinkFromRiver" | "drinkFromPot";
  readonly toward?: Readonly<GroundPoint>;
}

/** One sleep on a bedroll or in a bed. See `GameView.lastSleep`. */
export interface SleepView {
  readonly count: number;
  readonly at: Readonly<GroundPoint>;
  /** Present for a sleep in a bed, with which way the bed faces. Missing for a sleep on a bedroll. */
  readonly bed?: { readonly turns: QuarterTurns };
  /** Present for a sleep on a bedroll laid turned, such as in a lean-to, with which way it faces. Missing for a bed or a bedroll laid along z. */
  readonly bedroll?: { readonly turns: QuarterTurns };
}

/**
 * Something that just happened that the player should be told about.
 * `collapsed`: the player had a collapse from a neglected need and woke at their respawn point.
 * `survivedFirstNight`: the player reached the first morning without a collapse.
 * `snugRoomKeepsOutCold`: the player stood in a snug room for the first time in this game.
 * `backpackFull`: the backpack had no room for what the player tried to put in it.
 * `chestFull`: the open chest had no room for what the player tried to put in it.
 * `shelfFull`: the open shelf had no room for what the player tried to put in it.
 * `holdsUpPiece`: the player tried to take down a piece that another piece stands on.
 * `stillHoldsSomething`: the player tried to take down a piece of furniture or a woodpile that still holds something, or a campfire with a pot or fish on it.
 * `saveBroken`: the saved game could not be loaded, so a new game started.
 * `putLogDownFirst`: the player tried to craft while carrying a log.
 * `letGoFirst`: the player tried to shoulder a log, gather, chop, build, or craft while dragging a sled.
 * `noLogBesideStation`: the player tried a station recipe, such as cutting planks, with no debarked log lying beside the `station`.
 * `cannotCraftYet`: the player tried a recipe while lacking the tool, work station, or materials it needs, listed in `lacks`.
 * `fishGotAway`: a fish bit while the backpack was full, so it got away and the player stopped fishing.
 * `queueFull`: the player tried to add an action to the action queue, but it already held ACTION_QUEUE_LIMIT.
 * `cannotQueue`: the player tried to add an action to the action queue that the game refuses now, for the `refusal`.
 * `actionSkipped`: a queued action's turn came, but the game refused it, for the `refusal`, so it was dropped.
 * `refused`: the player sent a command that the game refuses now, for the `refusal`, so nothing happened.
 * `droppedBesideStation`: crafting at the `station` finished, and `count` of the result, `content`, did not fit in the backpack,
 * so they dropped in a pile beside the station.
 */
export type Notice =
  | { readonly kind: PlainNotice }
  | { readonly kind: "noLogBesideStation"; readonly station: WorkStationKind }
  | { readonly kind: "cannotCraftYet"; readonly lacks: readonly RecipeLack[] }
  | { readonly kind: "cannotQueue" | "actionSkipped" | "refused"; readonly refusal: Refusal }
  | { readonly kind: "droppedBesideStation"; readonly content: BackpackContent; readonly count: number; readonly station: WorkStationKind };

/** The kind of each notice. */
export type GameNotice = Notice["kind"];

/** A notice that needs nothing more than its kind to say what happened. */
export type PlainNotice =
  | "collapsed"
  | "survivedFirstNight"
  | "snugRoomKeepsOutCold"
  | "backpackFull"
  | "chestFull"
  | "shelfFull"
  | "holdsUpPiece"
  | "stillHoldsSomething"
  | "saveBroken"
  | "putLogDownFirst"
  | "letGoFirst"
  | "fishGotAway"
  | "queueFull";

/**
 * Why the game refuses to load a save (ADR 0008):
 * - `notASave`: the data is not a Far Hollow saved game, or it is damaged.
 * - `largeValley`: the save was made in the 1 km valley, before the valley shrank.
 * - `newerVersion`: the save was made by a newer version of the game.
 */
export type SaveRefusal = "notASave" | "largeValley" | "newerVersion";

/**
 * Why the game could not import a file into a save slot: any reason it refuses a save, or `notStored`.
 * `notStored` means the file was fine, but the browser could not store it.
 */
export type ImportRefusal = SaveRefusal | "notStored";

/**
 * What one save slot holds, as the start screen shows it.
 * `empty`: nothing is saved there. `broken`: the save cannot be loaded.
 * `filled`: a game the player can continue, with its seed and the day it reached.
 */
export type SaveSlotSummary =
  { readonly state: "empty" } | { readonly state: "broken" } | { readonly state: "filled"; readonly seed: number; readonly day: number };

export interface CampfireView {
  /** The entity id of the campfire or fireplace. */
  readonly id: number;
  /** Whether the fire is a campfire or in a fireplace. */
  readonly kind: "campfire" | "fireplace";
  readonly lit: boolean;
  /** How full of fuel the campfire is, from 0 (empty) to 1 (it holds no more). */
  readonly fuelLeft: number;
  /** How many more game minutes the campfire's fuel can burn. */
  readonly fuelMinutes: number;
  /**
   * The pot on the campfire, or null if there is none. `water` says whether its water has boiled yet.
   * `boilProgress` runs from 0 to 1 while the water boils on the lit fire.
   */
  readonly pot: { readonly water: PotWater; readonly boilProgress: number } | null;
  /**
   * The fish on the campfire, in the order they went on. `cookProgress` runs from 0 to 1 while a fish cooks on the lit fire.
   * At 1 it is `cooked`, and it never burns.
   */
  readonly fish: readonly { readonly cooked: boolean; readonly cookProgress: number }[];
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
  /** Present when R does not turn its blueprint, as for a roof section, a door, or a floor. Missing if R turns it. */
  readonly fixedFacing?: true;
}

/** The build menu's furniture rows, in order, from each piece's definition. The HUD showcase shows the full build menu with them. */
export const FURNITURE_BUILD_MENU: readonly BuildMenuEntry[] = FURNITURE_KINDS.map((kind) => {
  const { cost, tool } = FURNITURE[kind];
  return { structure: kind, cost, ...(tool === undefined ? {} : { tool }), placement: "anywhere" };
});

/** How the player uses a finished piece of furniture, from its definition, or undefined if it has no use, as for a table. */
export function furnitureUse(kind: FurnitureKind): FurnitureUse | undefined {
  return FURNITURE[kind].use;
}

/** One recipe in the craft menu. What the player lacks to follow it now comes from `GameClient.refusal`. */
export type CraftMenuEntry = Recipe;

/** A blueprint, with how far it has been built and the materials carried to it. */
export interface BlueprintView {
  /** The blueprint's entity id. */
  readonly id: number;
  readonly structure: StructureKind;
  /** How far construction has gone, from 0 to 1. */
  readonly progress: number;
  /** For each material it keeps, such as debarked logs carried to it or planks: how many it has had and how many it needs. */
  readonly deliveries: readonly { readonly material: KeptMaterial; readonly has: number; readonly needs: number }[];
  /** What the player lacks to build the next stage, or null if they can build it now. */
  readonly lacks: BuildLack | null;
}

/** Why the player cannot build a blueprint's next stage: a tool not in the backpack, or a material not in the backpack or not yet brought. */
export type BuildLack = { readonly kind: "tool"; readonly tool: BackpackContent } | { readonly kind: "material"; readonly material: BuildMaterial };

/**
 * Why the game turns a command away. The UI names each one, such as when it greys out an action and says why.
 * `needsTool`: the backpack lacks the tool. `noContent`: the backpack holds none of the fuel or planks the command uses.
 * `cannotBuildYet` and `cannotCraftYet`: what the next building stage or the recipe lacks.
 * Every other kind needs nothing more than its name (see PlainRefusal).
 */
export type Refusal =
  | { readonly kind: PlainRefusal }
  | { readonly kind: "needsTool"; readonly tool: BackpackContent }
  | { readonly kind: "noContent"; readonly content: CampfireFuel | "plank" }
  | { readonly kind: "cannotBuildYet"; readonly lacks: BuildLack }
  | { readonly kind: "cannotCraftYet"; readonly lacks: readonly RecipeLack[] };

/**
 * A refusal that needs nothing more than its kind to say why.
 * - `fireEmpty`: the campfire has no fuel to light.
 * - `fireFull`: the fuel would not fit on the campfire.
 * - `lightFirst`: the campfire is out.
 * - `noPotOfWater`, `noRawFish`: the backpack holds none.
 * - `fireFullOfFish`: the campfire holds as many fish as it can.
 * - `woodpileFull`, `sledFull`: it has no room left.
 * - `letGoFirst`: the player drags a sled, so their hands are busy.
 * - `shoulderFull`: the player already carries a log.
 * - `putLogDownFirst`: the player carries a log, and fishing needs both hands.
 * - `noLogCarried`: the player carries no log to put there.
 * - `nothingToTake`: it holds none of what the command takes.
 * - `emptyFirst`, `potOnFire`, `fishOnFire`: it still holds something, so it cannot come down.
 * - `fireNotOut`: the fireplace burns or still holds fuel, so it cannot come down.
 * - `holdsUpPiece`: another structure stands on it, so it cannot come down.
 * - `tooYoungToChop`: the tree is a young tree, still growing back.
 * - `noSaplingYet`: the stump has no sapling growing from it yet, so there is nothing to dig up.
 * - `tooBigToDigUp`: the tree is a young or full tree, too big to dig up.
 * - `noSapling`: the backpack holds no sapling to plant.
 * - `notPlantableGround`: a sapling grows only on forest floor or in a clearing, not on the river bank or in the river.
 * - `tooCloseToTree`: a tree, stump, or sapling stands too close to plant one here.
 * - `tooCloseToStructure`: a structure, blueprint, or foundation square is too close to plant one here.
 * - `backpackFull`: one more of what the command gathers does not fit in the backpack.
 * - `torchAlreadyLit`: the player already holds a lit torch, and holds only one at a time.
 * - `gone`: the thing the command acts on is no longer there, such as a stick already picked up.
 * - `openFirst`: the chest or shelf is not the one the player has open.
 * - `torchTooClose`: another planted torch stands too close to plant one here.
 * - `noLitTorch`: the player holds no lit torch to plant.
 * - `noMushroom`: the backpack holds no mushroom to plant on a log.
 * - `needsPlainLog`: a mushroom grows only on a plain log, not a debarked one.
 * - `coversMushroomLog`: a blueprint there would cover a mushroom log.
 */
export type PlainRefusal =
  | "fireEmpty"
  | "fireFull"
  | "lightFirst"
  | "noPotOfWater"
  | "noRawFish"
  | "fireFullOfFish"
  | "woodpileFull"
  | "sledFull"
  | "letGoFirst"
  | "shoulderFull"
  | "putLogDownFirst"
  | "noLogCarried"
  | "nothingToTake"
  | "emptyFirst"
  | "potOnFire"
  | "fishOnFire"
  | "fireNotOut"
  | "holdsUpPiece"
  | "tooYoungToChop"
  | "noSaplingYet"
  | "tooBigToDigUp"
  | "noSapling"
  | "notPlantableGround"
  | "tooCloseToTree"
  | "tooCloseToStructure"
  | "backpackFull"
  | "torchAlreadyLit"
  | "gone"
  | "openFirst"
  | "torchTooClose"
  | "noLitTorch"
  | "noMushroom"
  | "needsPlainLog"
  | "coversMushroomLog";

/** A room: foundation squares closed in by log walls or door frames, with a roof over every square. */
export interface RoomView {
  /** The middles of the room's foundation squares, in metres. */
  readonly squares: readonly GroundPoint[];
  /** Whether a lit campfire in the room warms all of it. */
  readonly heated: boolean;
  /** Whether the room is snug: a finished floor on every square and a finished door in every door frame. */
  readonly snug: boolean;
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

/** A chest or a shelf: the furniture that holds small materials, tools, and food, and opens in the chest panel. */
export type ChestOrShelf = "chest" | "shelf";

/**
 * An open chest or shelf, with what it holds. It holds small materials, tools, and food, grouped by kind like the backpack.
 * A shelf opens in the same panel as a chest.
 */
export interface ChestView {
  /** The chest's or shelf's entity id. */
  readonly id: number;
  /** Whether it is a chest or a shelf. */
  readonly furniture: ChestOrShelf;
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

/** A parked sled, with how many logs, debarked logs, and planks lie on it. */
export interface SledView {
  /** The sled's entity id. */
  readonly id: number;
  /** How many logs, debarked logs, and planks lie on it. */
  readonly contents: Readonly<Record<CarriedLog | "plank", number>>;
  /** How many of its log spaces are full. Each plank fills a quarter of a log space, so it can be a fraction, such as 1.5. */
  readonly total: number;
  /** How many log spaces it has. Each holds one log, one debarked log, or four planks. */
  readonly capacity: number;
  /** How many more logs or debarked logs fit on it. */
  readonly logsThatFit: number;
  /** How many more planks fit on it. */
  readonly planksThatFit: number;
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
 * What the scene reports under the cursor is built from this type, so the app can treat both the same way.
 * A `mushroomLog` is a log the player planted a mushroom on, with mushrooms or growing them back.
 * A `youngTree` is a tree growing back, too young to chop. A `sapling` grows on a stump, or where the player planted it. A `stump` is a bare stump:
 * the player can click it, but E never reaches it, so it does not hide the logs lying beside it.
 */
export type ThingInReach =
  | {
      readonly kind:
        | "tree"
        | "youngTree"
        | "sapling"
        | "stump"
        | "log"
        | "debarkedLog"
        | "stick"
        | "bark"
        | "forage"
        | "mushroomLog"
        | "blueprint"
        | "campfire"
        | "fireplace"
        | "woodpile"
        | "bedroll"
        | "pile"
        | "sled"
        | "plantedTorch";
      readonly id: number;
    }
  | { readonly kind: "workStation"; readonly id: number; readonly station: WorkStationKind }
  /** A finished piece of furniture. `furniture` names the piece. */
  | { readonly kind: "furniture"; readonly id: number; readonly furniture: FurnitureKind };

/**
 * What is under a point on the screen, as the scene reports it. Everything but the ground and the river is given by its entity id.
 * A finished lean-to, foundation, log wall, door frame, roof frame, or roof section is a `structure`.
 * Most clicks act on what is `under` it, as if it were not there, so the player can still walk onto a foundation or place a wall on it.
 * Every other thing is a ThingInReach, so the app treats a click and the E key the same way.
 */
export type ScenePick =
  | { kind: "structure"; id: number; structure: StructureKind; under: GroundOrThingPick | undefined }
  /** Open ground. `riverBank` is true on river bank ground, where the player can gather stone. */
  | { kind: "ground"; spot: GroundPoint; riverBank?: true }
  | { kind: "river"; spot: GroundPoint }
  | ThingInReach;

/** A pick that landed on anything but a finished structure. */
export type GroundOrThingPick = Exclude<ScenePick, { kind: "structure" }>;

/**
 * What a thing in the world is, given by its entity id. The action queue shows it as the icon of an action on it.
 * A blueprint or finished structure gives its structure, a forage spot its food, and a pile what it holds.
 */
export type ThingView =
  | { readonly kind: "structure"; readonly structure: StructureKind }
  | { readonly kind: "forage"; readonly food: WildFood }
  | { readonly kind: "pile"; readonly content: BackpackContent }
  | { readonly kind: "tree" | "sapling" | "stump" | "log" | "debarkedLog" | "stick" | "bark" | "bedroll" };

export interface PlayerAction {
  /**
   * Chopping a tree, splitting a log into firewood, debarking a log, building a blueprint, taking down a finished piece, crafting,
   * fishing, gathering stone, digging up a sapling, planting one, or planting a mushroom on a log.
   */
  readonly kind: "chop" | "split" | "debark" | "build" | "takeDown" | "craft" | "fish" | "gatherStone" | "digUp" | "plant" | "plantMushroom";
  /** How far along the work is, from 0 to 1. While fishing, how far through the wait for the next fish. */
  readonly progress: number;
}

/** Where a blueprint would go, and whether its structure's placement rule allows it there. */
export interface PlacementCheck {
  /** The building-grid spot it snaps to, on the ground, in metres. */
  readonly spot: Readonly<Vec3>;
  /** The turn it takes there. This is the turn asked for, except for a roof, which takes the turn of the frame under it. */
  readonly turns: QuarterTurns;
  readonly allowed: boolean;
  /** Why it is not allowed there, when the game can say, such as a mushroom log lying there. Missing when allowed, or when no reason is given. */
  readonly refusal?: Refusal;
}

/** A blueprint under the mouse that the player has not placed yet, as the placement check gives it. The scene shows it. */
export interface PlacingBlueprint extends PlacementCheck {
  readonly structure: StructureKind;
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
  /** A finished sled, given by its entity id, near or far, or null if it is not one. It only reads game state. */
  describeSled(sledId: number): SledView | null;
  /** What a thing in the world is, given by its entity id, or null if it is gone or is none of the kinds ThingView names. It only reads game state. */
  describeThing(id: number): ThingView | null;
  /** The thing nearest the player within the reach of E, or null if nothing is in reach. It only reads game state. */
  nearestInReach(): ThingInReach | null;
  /** Every room in the valley, worked out from the finished pieces. It only reads game state. The debug overlay shows it. */
  describeRooms(): readonly RoomView[];
  /**
   * Why the game would turn this command away if it were sent now, or null if it has no reason to give.
   * It ignores how far away the thing is, since the player walks there first. It only reads game state.
   * The game checks the same rules again when it carries the command out, since things can change while the player walks.
   */
  refusal(command: Command): Refusal | null;
  send(command: Command): void;
  /** Calls the listener after each logic step. Returns a function that stops listening. */
  subscribe(listener: () => void): () => void;
}
