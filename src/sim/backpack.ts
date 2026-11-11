/**
 * The backpack holds tools and small materials.
 * Logs never go in the backpack. The player carries them on their shoulder instead.
 */

/** Every kind of thing that can go in the backpack. Add new kinds here, such as firewood. */
export type BackpackItem = "axe" | "knife" | "fireStriker";

/** How many of each kind of thing the backpack holds. Kinds it does not hold are missing. */
export type BackpackContents = Partial<Record<BackpackItem, number>>;

export interface Backpack {
  contents: BackpackContents;
}

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
