/**
 * The backpack holds tools and small materials, up to a weight limit.
 * Logs never go in the backpack. The player carries them on their shoulder instead.
 */

/** Every kind of thing that can go in the backpack. Add new kinds here, with a weight in ITEM_WEIGHT_KG. */
export type BackpackItem = "axe" | "knife" | "fireStriker" | "stick" | "firewood";

/** How many of each kind of thing the backpack holds. Kinds it does not hold are missing. */
export type BackpackContents = Partial<Record<BackpackItem, number>>;

export interface Backpack {
  contents: BackpackContents;
}

/** The most the backpack can hold, in kilograms. */
export const BACKPACK_WEIGHT_LIMIT_KG = 20;

/** How much one of each kind of thing weighs, in kilograms. */
export const ITEM_WEIGHT_KG: Readonly<Record<BackpackItem, number>> = {
  axe: 1.5,
  knife: 0.3,
  fireStriker: 0.1,
  stick: 0.5,
  firewood: 1.5,
};

/** What the player starts a new game with. */
export function createStartingBackpack(): Backpack {
  return { contents: { axe: 1, knife: 1, fireStriker: 1 } };
}

export function countInBackpack(backpack: Backpack, item: BackpackItem): number {
  return backpack.contents[item] ?? 0;
}

/** True if the backpack holds at least one of `item`. */
export function hasInBackpack(backpack: Backpack, item: BackpackItem): boolean {
  return countInBackpack(backpack, item) > 0;
}

/** How much everything in the backpack weighs, in kilograms. */
export function backpackWeight(backpack: Backpack): number {
  let total = 0;
  for (const item of Object.keys(backpack.contents) as BackpackItem[]) {
    total += countInBackpack(backpack, item) * ITEM_WEIGHT_KG[item];
  }
  return total;
}

/** True if `count` more of `item` would fit within the weight limit. */
export function fitsInBackpack(backpack: Backpack, item: BackpackItem, count: number): boolean {
  // The small allowance stops rounding errors in the weights from refusing the last thing that fits.
  return backpackWeight(backpack) + count * ITEM_WEIGHT_KG[item] <= BACKPACK_WEIGHT_LIMIT_KG + 1e-9;
}

/**
 * Puts `count` of `item` in the backpack if they all fit within the weight limit.
 * Returns false, and changes nothing, if they do not.
 */
export function addToBackpack(backpack: Backpack, item: BackpackItem, count: number): boolean {
  if (!fitsInBackpack(backpack, item, count)) return false;
  backpack.contents[item] = countInBackpack(backpack, item) + count;
  return true;
}
