/**
 * The backpack holds tools and small materials, up to a weight limit.
 * Logs never go in the backpack. The player carries them on their shoulder instead.
 */

/** Every kind of thing that can go in the backpack. Add new kinds here, with a weight in CONTENT_WEIGHT_KG. */
export type BackpackContent = "axe" | "knife" | "drawknife" | "fireStriker" | "bedroll" | "stick" | "firewood" | "bark" | Food | PotContent | CraftingContent;

/** Things that crafting uses or makes: the saw blade, a material, the saw, a tool made from it, and planks, cut at the sawhorse. */
export type CraftingContent = "sawBlade" | "saw" | "plank";

/** Wild food the player forages and eats. One "berries" is a handful of berries. */
export type Food = "berries" | "mushroom";

/**
 * The pot, by what it holds. The player has one pot, so the backpack holds at most one of these.
 * `pot` is empty, `potOfRiverWater` holds unboiled river water, and `potOfBoiledWater` holds water safe to drink.
 */
export type PotContent = "pot" | "potOfRiverWater" | "potOfBoiledWater";

/** How many of each kind of thing the backpack holds. Kinds it does not hold are missing. */
export type BackpackContents = Partial<Record<BackpackContent, number>>;

export interface Backpack {
  contents: BackpackContents;
}

/** The most the backpack can hold, in kilograms. */
export const BACKPACK_WEIGHT_LIMIT_KG = 20;

/** How much one of each kind of thing weighs, in kilograms. */
export const CONTENT_WEIGHT_KG: Readonly<Record<BackpackContent, number>> = {
  axe: 1.5,
  knife: 0.3,
  drawknife: 0.5,
  fireStriker: 0.1,
  bedroll: 1.5,
  stick: 0.5,
  firewood: 1.5,
  bark: 0.3,
  berries: 0.1,
  mushroom: 0.1,
  pot: 1,
  // A pot holds 2 litres of water, which weigh 2 kg.
  potOfRiverWater: 3,
  potOfBoiledWater: 3,
  sawBlade: 0.5,
  saw: 1,
  plank: 2,
};

/** What the player starts a new game with. */
export function createStartingBackpack(): Backpack {
  return { contents: { axe: 1, knife: 1, drawknife: 1, fireStriker: 1, bedroll: 1, pot: 1, sawBlade: 1 } };
}

export function countInBackpack(backpack: Backpack, content: BackpackContent): number {
  return backpack.contents[content] ?? 0;
}

/** True if the backpack holds at least one of `content`. */
export function hasInBackpack(backpack: Backpack, content: BackpackContent): boolean {
  return countInBackpack(backpack, content) > 0;
}

/** How much everything in the backpack weighs, in kilograms. */
export function backpackWeight(backpack: Backpack): number {
  let total = 0;
  for (const content of Object.keys(backpack.contents) as BackpackContent[]) {
    total += countInBackpack(backpack, content) * CONTENT_WEIGHT_KG[content];
  }
  return total;
}

/** True if `count` more of `content` would fit within the weight limit. */
export function fitsInBackpack(backpack: Backpack, content: BackpackContent, count: number): boolean {
  // The small allowance stops rounding errors in the weights from refusing the last thing that fits.
  return backpackWeight(backpack) + count * CONTENT_WEIGHT_KG[content] <= BACKPACK_WEIGHT_LIMIT_KG + 1e-9;
}

/**
 * Puts `count` of `content` in the backpack if they all fit within the weight limit.
 * Returns false, and changes nothing, if they do not.
 */
export function addToBackpack(backpack: Backpack, content: BackpackContent, count: number): boolean {
  if (!fitsInBackpack(backpack, content, count)) return false;
  backpack.contents[content] = countInBackpack(backpack, content) + count;
  return true;
}

/**
 * Takes `count` of `content` out of the backpack if it holds that many.
 * Returns false, and changes nothing, if it does not.
 */
export function removeFromBackpack(backpack: Backpack, content: BackpackContent, count: number): boolean {
  const held = countInBackpack(backpack, content);
  if (held < count) return false;
  backpack.contents[content] = held - count;
  return true;
}
