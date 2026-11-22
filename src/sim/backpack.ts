import { addCount, countOf, takeCount, weightedTotal } from "./counts";

/**
 * The backpack holds tools and small materials, up to a weight limit.
 * Logs never go in the backpack. The player carries them on their shoulder instead.
 */

/** Every kind of thing that can go in the backpack. Add new kinds here, with a weight in CONTENT_WEIGHT_KG. */
export type BackpackContent =
  | "axe"
  | "knife"
  | "drawknife"
  | "steelAndFlint"
  | "bedroll"
  | "stick"
  | "firewood"
  | "bark"
  | "stone"
  | "clay"
  | "unfiredJug"
  | "torch"
  | "sapling"
  | "berryBush"
  | Food
  | PotContent
  | CraftingContent
  | FishingContent;

/** Things that crafting uses or makes: the saw blade, a material, the saw, a tool made from it, and planks, cut at the sawhorse. */
export type CraftingContent = "sawBlade" | "saw" | "plank";

/** Fishing gear: the fishing line, from the starting kit, and the fishing rod, a tool crafted from it. */
export type FishingContent = "fishingLine" | "fishingRod";

/** What the player digs up into the backpack and plants again: a sapling, which grows into a tree, or a berry bush. */
export type Plantable = "sapling" | "berryBush";

/** Wild food the player forages. One "berries" is a handful of berries. */
export type WildFood = "berries" | "mushroom";

/** Fish the player catches at the river, raw or cooked on a campfire. Raw fish makes the player sick if they eat it. */
export type Fish = "rawFish" | "cookedFish";

/** Everything the player can eat from the backpack. */
export type Food = WildFood | Fish;

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
  steelAndFlint: 0.1,
  bedroll: 1.5,
  stick: 0.5,
  firewood: 1.5,
  bark: 0.3,
  stone: 2,
  clay: 2,
  // An unfired jug weighs the same as the jug it becomes once fired.
  unfiredJug: 1,
  torch: 0.8,
  sapling: 1,
  berryBush: 1,
  berries: 0.1,
  mushroom: 0.1,
  pot: 1,
  // A pot holds 2 litres of water, which weigh 2 kg.
  potOfRiverWater: 3,
  potOfBoiledWater: 3,
  sawBlade: 0.5,
  saw: 1,
  plank: 2,
  fishingLine: 0.1,
  fishingRod: 0.5,
  rawFish: 0.5,
  cookedFish: 0.5,
};

/** What the player starts a new game with. */
export function createStartingBackpack(): Backpack {
  return { contents: { axe: 1, knife: 1, drawknife: 1, steelAndFlint: 1, bedroll: 1, pot: 1, sawBlade: 1, fishingLine: 1 } };
}

export function countInBackpack(backpack: Backpack, content: BackpackContent): number {
  return countOf(backpack.contents, content);
}

/** True if the backpack holds at least one of `content`. */
export function hasInBackpack(backpack: Backpack, content: BackpackContent): boolean {
  return countInBackpack(backpack, content) > 0;
}

/** How much everything in the backpack weighs, in kilograms. */
export function backpackWeight(backpack: Backpack): number {
  return weightedTotal(backpack.contents, CONTENT_WEIGHT_KG);
}

/** True if `count` more of `content` would fit within the weight limit. */
export function fitsInBackpack(backpack: Backpack, content: BackpackContent, count: number): boolean {
  // The small allowance stops rounding errors in the weights from refusing the last thing that fits.
  return backpackWeight(backpack) + count * CONTENT_WEIGHT_KG[content] <= BACKPACK_WEIGHT_LIMIT_KG + 1e-9;
}

/** True if all of `contents` would fit within the weight limit together. */
export function allFitInBackpack(backpack: Backpack, contents: BackpackContents): boolean {
  // The small allowance stops rounding errors in the weights from refusing the last thing that fits.
  return backpackWeight(backpack) + weightedTotal(contents, CONTENT_WEIGHT_KG) <= BACKPACK_WEIGHT_LIMIT_KG + 1e-9;
}

/**
 * Puts all of `contents` in the backpack if they fit together within the weight limit.
 * Returns false, and changes nothing, if they do not.
 */
export function addAllToBackpack(backpack: Backpack, contents: BackpackContents): boolean {
  if (!allFitInBackpack(backpack, contents)) return false;
  for (const [content, count] of Object.entries(contents) as [BackpackContent, number][]) backpack.contents = addCount(backpack.contents, content, count);
  return true;
}

/** How many of `content`, up to `count`, fit in the backpack within its weight limit. */
export function howManyFit(backpack: Backpack, content: BackpackContent, count: number): number {
  let fit = count;
  while (fit > 0 && !fitsInBackpack(backpack, content, fit)) fit -= 1;
  return fit;
}

/**
 * Puts `count` of `content` in the backpack if they all fit within the weight limit.
 * Returns false, and changes nothing, if they do not.
 */
export function addToBackpack(backpack: Backpack, content: BackpackContent, count: number): boolean {
  if (!fitsInBackpack(backpack, content, count)) return false;
  backpack.contents = addCount(backpack.contents, content, count);
  return true;
}

/**
 * Takes `count` of `content` out of the backpack if it holds that many.
 * Returns false, and changes nothing, if it does not.
 */
export function removeFromBackpack(backpack: Backpack, content: BackpackContent, count: number): boolean {
  if (countInBackpack(backpack, content) < count) return false;
  backpack.contents = takeCount(backpack.contents, content, count);
  return true;
}
