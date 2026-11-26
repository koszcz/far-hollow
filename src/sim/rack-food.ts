/**
 * Food on a drying rack, and how it dries or smokes (see GLOSSARY.md). It imports only types, so entities and the UI's API can use it.
 * Berries or a mushroom on the rack dry in DRY_MINUTES with no fire, and become dried berries or a dried mushroom.
 * Raw fish on the rack smokes in SMOKE_MINUTES, but only while a lit fire is close by, and becomes smoked fish.
 * Fresh food on the rack keeps its spoil time until it is preserved. Preserved food has none, since it never spoils.
 * Each function returns a new value. The caller assigns it back to the rack. See ADR 0009.
 */
import type { BackpackContent, PreservedFood } from "./backpack";

/** The fresh food the player can hang on a drying rack. */
export type RackFood = "berries" | "mushroom" | "rawFish";

/** Every food the player can hang on a drying rack, in the order the action menu offers them. */
export const RACK_FOODS: readonly RackFood[] = ["berries", "mushroom", "rawFish"];

/** A food the player may try to hang on a drying rack: a rack food, or cooked fish, which the rack refuses. */
export type FoodToHang = RackFood | "cookedFish";

/** Every food the player may try to hang on a drying rack. */
export const FOODS_TO_HANG: readonly FoodToHang[] = [...RACK_FOODS, "cookedFish"];

/** True if the rack takes this food. Only raw fish can be smoked, so it refuses cooked fish. */
export function isRackFood(food: FoodToHang): food is RackFood {
  return food !== "cookedFish";
}

/** The most foods one drying rack holds at once, in any mix. */
export const DRYING_RACK_FOOD_LIMIT = 6;

/** Berries or a mushroom on a drying rack dry after this many game minutes. Six game hours. */
export const DRY_MINUTES = 6 * 60;

/** Raw fish on a drying rack is smoked after this many game minutes beside a lit fire. Four game hours. */
export const SMOKE_MINUTES = 4 * 60;

/** Raw fish on a rack smokes only while a lit campfire or fireplace stands this close to the rack, in metres. */
export const SMOKING_FIRE_METRES = 2;

/** How many game minutes each food takes to be preserved on the rack. */
const PRESERVE_MINUTES: Readonly<Record<RackFood, number>> = { berries: DRY_MINUTES, mushroom: DRY_MINUTES, rawFish: SMOKE_MINUTES };

/** What each food on the rack becomes once preserved. */
export const PRESERVED_FORM: Readonly<Record<RackFood, PreservedFood>> = { berries: "driedBerries", mushroom: "driedMushroom", rawFish: "smokedFish" };

/** True if this food is smoked, so it needs a lit fire close by. Other food dries with no fire. */
export function needsFire(food: RackFood): boolean {
  return food === "rawFish";
}

/**
 * One food on a drying rack: what was hung, and how many game minutes it has dried or smoked, up to its whole preserving time.
 * `spoilsAt` is the game minute fresh food spoils at. Preserved food has none.
 */
export interface FoodOnRack {
  readonly food: RackFood;
  readonly minutesPreserved: number;
  readonly spoilsAt?: number;
}

/** A food just hung on the rack, which spoils at game minute `spoilsAt` unless it is preserved first. */
export function hungOnRack(food: RackFood, spoilsAt: number): FoodOnRack {
  return { food, minutesPreserved: 0, spoilsAt };
}

/** A food this close to preserved counts as preserved, so rounding errors in the clock cannot leave it a sliver short. */
const PRESERVED_ALLOWANCE_MINUTES = 1e-6;

/** True once a food on the rack has dried or smoked, so it is preserved and never spoils. */
export function isPreserved(item: FoodOnRack): boolean {
  return item.minutesPreserved >= PRESERVE_MINUTES[item.food];
}

/** How far a food on the rack is through drying or smoking, from 0 (just hung) to 1 (preserved). */
export function preserveProgress(item: FoodOnRack): number {
  return Math.min(1, item.minutesPreserved / PRESERVE_MINUTES[item.food]);
}

/**
 * The food after this many more game minutes on the rack. `fireCloseBy` says whether a lit fire stood close by all that time.
 * Food that needs fire keeps its progress without one. Once preserved, food stops counting and loses its spoil time.
 */
export function preservedFor(item: FoodOnRack, gameMinutes: number, fireCloseBy: boolean): FoodOnRack {
  if (isPreserved(item) || (needsFire(item.food) && !fireCloseBy)) return item;
  const whole = PRESERVE_MINUTES[item.food];
  const minutes = item.minutesPreserved + gameMinutes;
  return minutes >= whole - PRESERVED_ALLOWANCE_MINUTES ? { food: item.food, minutesPreserved: whole } : { ...item, minutesPreserved: minutes };
}

/** True if this food waits on the rack for a lit fire close by: it is raw fish not yet smoked, and `fireCloseBy` is false. */
export function waitsForFire(item: FoodOnRack, fireCloseBy: boolean): boolean {
  return needsFire(item.food) && !isPreserved(item) && !fireCloseBy;
}

/** True if fresh food on the rack has spoiled by game minute `now`. Preserved food never spoils. */
export function hasSpoiled(item: FoodOnRack, now: number): boolean {
  return !isPreserved(item) && item.spoilsAt !== undefined && item.spoilsAt <= now;
}

/** What the food goes into the backpack as when taken off: its preserved form once preserved, or else the fresh food itself. */
export function takenAs(item: FoodOnRack): BackpackContent {
  return isPreserved(item) ? PRESERVED_FORM[item.food] : item.food;
}

/** The foods on a rack, preserved first, each kept in the order it was hung. The player takes them off in this order. */
export function preservedFirst(items: readonly FoodOnRack[]): FoodOnRack[] {
  return [...items.filter(isPreserved), ...items.filter((item) => !isPreserved(item))];
}
