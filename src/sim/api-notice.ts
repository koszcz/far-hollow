import type { Refusal } from "./api-refusal";
import type { BackpackContent } from "./backpack";
import type { RecipeLack } from "./crafting";
import type { FreshFood } from "./fresh-food";
import type { WorkStationKind } from "./structures";

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
 * `foodSpoiled`: fresh food kept its full time and is gone, wherever it was. `spoiled` says how many of each kind.
 * `cantGetThere`: the player sent an action on a thing behind a wall, and no walk leads to the thing's side of it.
 */
export type Notice =
  | { readonly kind: PlainNotice }
  | { readonly kind: "noLogBesideStation"; readonly station: WorkStationKind }
  | { readonly kind: "cannotCraftYet"; readonly lacks: readonly RecipeLack[] }
  | { readonly kind: "cannotQueue" | "actionSkipped" | "refused"; readonly refusal: Refusal }
  | { readonly kind: "droppedBesideStation"; readonly content: BackpackContent; readonly count: number; readonly station: WorkStationKind }
  | { readonly kind: "foodSpoiled"; readonly spoiled: Readonly<Partial<Record<FreshFood, number>>> };

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
  | "queueFull"
  | "cantGetThere";
