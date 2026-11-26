/**
 * Food on a drying rack, and how it dries (see GLOSSARY.md). It imports only types, so entities and the UI's API can use it.
 * Berries or a mushroom on the rack dry in DRY_MINUTES with no fire, and become dried berries or a dried mushroom.
 * Fresh food on the rack keeps its spoil time until it is dried. Dried food has none, since preserved food never spoils.
 * Each function returns a new value. The caller assigns it back to the rack. See ADR 0009.
 */
import type { BackpackContent, PreservedFood } from "./backpack";

/** The fresh food the player can hang on a drying rack. */
export type RackFood = "berries" | "mushroom";

/** Every food the player can hang on a drying rack, in the order the action menu offers them. */
export const RACK_FOODS: readonly RackFood[] = ["berries", "mushroom"];

/** The most foods one drying rack holds at once, in any mix. */
export const DRYING_RACK_FOOD_LIMIT = 6;

/** Berries or a mushroom on a drying rack dry after this many game minutes. Six game hours. */
export const DRY_MINUTES = 6 * 60;

/** What each food on the rack becomes once dried. */
export const PRESERVED_FORM: Readonly<Record<RackFood, PreservedFood>> = { berries: "driedBerries", mushroom: "driedMushroom" };

/**
 * One food on a drying rack: what was hung, and how many game minutes it has dried, up to DRY_MINUTES.
 * `spoilsAt` is the game minute fresh food spoils at. Dried food has none.
 */
export interface FoodOnRack {
  readonly food: RackFood;
  readonly minutesDried: number;
  readonly spoilsAt?: number;
}

/** A food just hung on the rack, which spoils at game minute `spoilsAt` unless it dries first. */
export function hungOnRack(food: RackFood, spoilsAt: number): FoodOnRack {
  return { food, minutesDried: 0, spoilsAt };
}

/** A food this close to dried counts as dried, so rounding errors in the clock cannot leave it a sliver short. */
const DRIED_ALLOWANCE_MINUTES = 1e-6;

/** True once a food on the rack has dried, so it is preserved and never spoils. */
export function isDried(item: FoodOnRack): boolean {
  return item.minutesDried >= DRY_MINUTES;
}

/** How far a food on the rack is through drying, from 0 (just hung) to 1 (dried). */
export function dryProgress(item: FoodOnRack): number {
  return Math.min(1, item.minutesDried / DRY_MINUTES);
}

/** The food after drying for this many more game minutes. Once dried, it stops counting and loses its spoil time. */
export function driedFor(item: FoodOnRack, gameMinutes: number): FoodOnRack {
  if (isDried(item)) return item;
  const minutes = item.minutesDried + gameMinutes;
  return minutes >= DRY_MINUTES - DRIED_ALLOWANCE_MINUTES ? { food: item.food, minutesDried: DRY_MINUTES } : { ...item, minutesDried: minutes };
}

/** True if fresh food on the rack has spoiled by game minute `now`. Dried food never spoils. */
export function hasSpoiled(item: FoodOnRack, now: number): boolean {
  return !isDried(item) && item.spoilsAt !== undefined && item.spoilsAt <= now;
}

/** What the food goes into the backpack as when taken off: its dried form once dried, or else the fresh food itself. */
export function takenAs(item: FoodOnRack): BackpackContent {
  return isDried(item) ? PRESERVED_FORM[item.food] : item.food;
}

/** The foods on a rack, dried first, each kept in the order it was hung. The player takes them off in this order. */
export function driedFirst(items: readonly FoodOnRack[]): FoodOnRack[] {
  return [...items.filter(isDried), ...items.filter((item) => !isDried(item))];
}
