// The parts of game logic the UI may import (ADR 0005): this file, which passes on helpers from other sim modules,
// and the api-*.ts files. The UI reads a GameView and changes the game only by sending a Command.

export type { GroundAmount, Recipe, RecipeAmount, RecipeKind, RecipeLack } from "./crafting";

export type { BackpackContent, CraftingContent, Fish, FishingContent, Food, JugContent, Plantable, PreservedFood, WildFood } from "./backpack";
export type { Freshness, FreshFood } from "./fresh-food";
export { FRESH_FOODS, isFreshFood } from "./fresh-food";

/** The action menu offers to hang each of these on a drying rack. It offers cooked fish too, which the rack refuses. */
export { RACK_FOODS, type FoodToHang, type RackFood } from "./rack-food";

/** The hotbar uses it to show how much each kind of thing in the backpack weighs. */
export { CONTENT_WEIGHT_KG } from "./backpack";

/** The action menu and the action queue use these to offer drinking from a jug and pouring water into one, and to pick their icons. */
export { hasRoom, holdsWater, isJug, JUG_CONTENTS, jugToDrinkFrom, jugToPourInto, withOneMoreDrink } from "./jug";

/** The HUD clock uses these to name the time of day. */
export { HOURS_PER_DAY, type TimeOfDay } from "./clock";

/** The HUD names the season and tints the clock by it. */
export { isNightHour, type NightHours, nightHoursOf, SEASONS, type Season, type SeasonDay } from "./season";

/** The hotbar and drawing use these to show how long a lit torch still burns. */
export { burnShare, type BurnTime } from "./burn-time";

export {
  CAMPFIRE_FUELS,
  CARRIED_LOGS,
  CARRIED_THINGS,
  HELD_MATERIALS,
  isCarriedLog,
  WOODPILE_WOODS,
  type CampfireFuel,
  type CarriedLog,
  type CarriedThing,
  type HeldMaterial,
  type WoodpileWood,
} from "./wood-and-fuel";

export type { BuildMaterial, DeliveredMaterial, FurnitureKind, KeptMaterial, MaterialCost, Placement, StructureKind, WorkStationKind } from "./structures";

export type { FurnitureUse } from "./furniture";
export { ADD_ON_OF_HOST, isAddOn, isHost, isPlacedInRows, type AddOnKind, type BuildMenuKind, type HostKind } from "./structure-kind";

/** The HUD uses these to tell the player when a low need slows them, and which needs there are. */
export { LOW_NEED, NEED_KINDS, type NeedKind } from "./needs";

/** The HUD uses these to list the journal's goals in order and find the next one. */
export { GOALS, nextGoal, type Goal } from "./journal";

/** The new-game screen uses it to turn typed text into a seed. */
export { seedFromText } from "./seed";
