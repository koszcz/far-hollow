import type { BackpackContent } from "./backpack";
import type { RecipeLack } from "./crafting";
import type { BuildMaterial } from "./structures";
import type { CampfireFuel } from "./wood-and-fuel";

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
 * - `noUnfiredJug`: the backpack holds no unfired jug.
 * - `noPotOfCleanWater`: the backpack holds no pot of clean water to pour into a jug.
 * - `noJug`: the backpack holds no jug, empty or not.
 * - `noJugWithRoom`: the backpack holds jugs, but every one is full.
 * - `noWaterInJug`: the backpack holds no jug with water in it.
 * - `fireHoldsJug`: the campfire already holds a jug, and fires one at a time.
 * - `woodpileFull`, `sledFull`: it has no room left.
 * - `noLogsNearSled`: no log or debarked log lies within reach of the sled to fill it with.
 * - `letGoFirst`: the player drags a sled, so their hands are busy.
 * - `shoulderFull`: the player already carries a log.
 * - `handsFull`: the player carries something the next building stage does not need, so they cannot build it.
 * - `putLogDownFirst`: the player carries a log, and fishing needs both hands.
 * - `noLogCarried`: the player carries no log to put there.
 * - `nothingToTake`: it holds none of what the command takes.
 * - `emptyFirst`, `potOnFire`, `fishOnFire`, `jugOnFire`: it still holds something, so it cannot come down.
 * - `fireNotOut`: the fireplace burns or still holds fuel, so it cannot come down.
 * - `holdsUpPiece`: another structure stands on it, so it cannot come down.
 * - `tooYoungToChop`: the tree is a young tree, still growing back.
 * - `noSaplingYet`: the stump has no sapling growing from it yet, so there is nothing to dig up.
 * - `tooBigToDigUp`: the tree is a young or full tree, too big to dig up.
 * - `noSapling`: the backpack holds no sapling to plant.
 * - `noBerryBush`: the backpack holds no berry bush to plant.
 * - `notPlantableGround`: a sapling or berry bush grows only on forest floor or in a clearing, not on the river bank or in the river.
 * - `tooCloseToTree`: a tree, stump, or sapling stands too close to plant one here.
 * - `tooCloseToBerryBush`: another berry bush stands too close to plant one here.
 * - `tooCloseToMushroomLog`: a mushroom log lies too close to plant a berry bush here.
 * - `berryBushInTheWay`: a blueprint would cover a berry bush.
 * - `tooCloseToStructure`: a structure, blueprint, or foundation square is too close to plant one here.
 * - `backpackFull`: one more of what the command gathers does not fit in the backpack.
 * - `torchAlreadyLit`: the player already holds a lit torch, and holds only one at a time.
 * - `gone`: the thing the command acts on is no longer there, such as a stick already picked up.
 * - `openFirst`: the chest or shelf is not the one the player has open.
 * - `torchTooClose`: another planted torch stands too close to plant one here.
 * - `noLitTorch`: the player holds no lit torch to plant.
 * - `noMushroom`: the backpack holds no mushroom to plant on a log.
 * - `needsPlainLog`: a mushroom grows only on a plain log, not a debarked one.
 * - `mushroomLogInTheWay`: a blueprint would cover a mushroom log.
 * - `barrelEmpty`: the rain barrel holds no drink.
 * - `noEmptyPot`: the backpack holds no empty pot to fill.
 * - `noFishTrap`: the backpack holds no fish trap to set.
 * - `fishTrapTooClose`: another set fish trap is too close to set one here.
 * - `takeFishFirst`: the fish trap holds a fish, so it cannot be picked up.
 * - `atCorner`: a door frame or window would meet another edge piece at a right angle at a corner, where a log cabin needs crossed logs.
 * - `takeShuttersDownFirst`: shutters hang in the window, finished or as a blueprint, so it cannot come down.
 * - `nothingGrowsInWinter`: it is winter, so a bush, mushroom patch, or mushroom log has no food.
 * - `riverFrozen`: it is winter, so the river is frozen and nobody can fish in it or set a trap.
 * - `chimneyNeedsFireplace`: a chimney goes only on a finished fireplace.
 * - `fireplaceHasChimney`: the fireplace already has a chimney, finished or as a blueprint.
 * - `takeChimneyDownFirst`: a chimney stands on the fireplace, finished or as a blueprint, so it cannot come down.
 * - `finishHostFirst`: an add-on goes only on a finished host, such as a door in a finished door frame.
 * - `holdsAddOn`: the host already holds its add-on, finished or as a blueprint.
 * - `addOnInTheWay`: something is in the way of the add-on's blueprint.
 * - `noBerries`: the backpack holds no berries to hang on a drying rack.
 * - `rackFull`: the drying rack holds as many foods as it can.
 * - `onlyRawFishSmokes`: the player tried to hang cooked fish on a drying rack. Only raw fish can be smoked.
 * - `needsRoom`: the piece goes only inside a room, as a wood box does.
 * - `woodBoxFull`: the wood box holds as much firewood as it can.
 * - `woodBoxEmpty`: the wood box holds no firewood.
 */
export type PlainRefusal =
  | "fireEmpty"
  | "fireFull"
  | "lightFirst"
  | "noPotOfWater"
  | "noRawFish"
  | "fireFullOfFish"
  | "noUnfiredJug"
  | "noPotOfCleanWater"
  | "noJug"
  | "noJugWithRoom"
  | "noWaterInJug"
  | "fireHoldsJug"
  | "woodpileFull"
  | "sledFull"
  | "noLogsNearSled"
  | "letGoFirst"
  | "shoulderFull"
  | "handsFull"
  | "putLogDownFirst"
  | "noLogCarried"
  | "nothingToTake"
  | "emptyFirst"
  | "potOnFire"
  | "fishOnFire"
  | "jugOnFire"
  | "fireNotOut"
  | "holdsUpPiece"
  | "tooYoungToChop"
  | "noSaplingYet"
  | "tooBigToDigUp"
  | "noSapling"
  | "noBerryBush"
  | "notPlantableGround"
  | "tooCloseToTree"
  | "tooCloseToBerryBush"
  | "tooCloseToMushroomLog"
  | "berryBushInTheWay"
  | "tooCloseToStructure"
  | "backpackFull"
  | "torchAlreadyLit"
  | "gone"
  | "openFirst"
  | "torchTooClose"
  | "noLitTorch"
  | "noMushroom"
  | "needsPlainLog"
  | "mushroomLogInTheWay"
  | "barrelEmpty"
  | "noEmptyPot"
  | "noFishTrap"
  | "fishTrapTooClose"
  | "takeFishFirst"
  | "atCorner"
  | "takeShuttersDownFirst"
  | "nothingGrowsInWinter"
  | "riverFrozen"
  | "chimneyNeedsFireplace"
  | "fireplaceHasChimney"
  | "takeChimneyDownFirst"
  | "finishHostFirst"
  | "holdsAddOn"
  | "addOnInTheWay"
  | "noBerries"
  | "rackFull"
  | "onlyRawFishSmokes"
  | "needsRoom"
  | "woodBoxFull"
  | "woodBoxEmpty";
