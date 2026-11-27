// Recipes: what each craft uses, makes, and needs, and what the player lacks to follow one.
// Every recipe is listed in RECIPE_BY_KIND. A new recipe needs only a new entry there, with its name in the strings file.
import { countInBackpack, hasInBackpack, type Backpack, type BackpackContent } from "./backpack";
import type { CarriedLog } from "./entities";
import type { RecipeKind } from "./recipe-kind";
import type { WorkStationKind } from "./structure-kind";

/** How many of one thing a recipe uses or makes. */
export interface RecipeAmount {
  readonly material: BackpackContent;
  readonly count: number;
}

/** How many logs or debarked logs a station recipe uses from the ground beside the station. */
export interface GroundAmount {
  readonly material: CarriedLog;
  readonly count: number;
}

/**
 * A recipe: what it uses, what it makes, and how long the work takes.
 * A hand recipe has no `station`, so the player follows it where they stand.
 * A station recipe names the work station the player follows it at.
 */
export interface Recipe {
  readonly kind: RecipeKind;
  /** What the work uses up from the backpack. These leave the backpack only when the work finishes. */
  readonly materials: readonly RecipeAmount[];
  /**
   * What a station recipe uses up from beside the station: logs or debarked logs lying within STATION_GROUND_METRES of it,
   * or on a sled parked that close to it.
   * They are gone only when the work finishes. Missing if it uses nothing from the ground.
   */
  readonly besideStation?: readonly GroundAmount[];
  /** What the work makes. It goes in the backpack. */
  readonly result: { readonly content: BackpackContent; readonly count: number };
  /** How long the work takes, in seconds. */
  readonly seconds: number;
  /** The tool the player needs in the backpack. The work does not use it up. Missing if no tool is needed. */
  readonly tool?: BackpackContent;
  /** The work station the player follows it at. Missing for a hand recipe. */
  readonly station?: WorkStationKind;
  /**
   * True if the part of the result that does not fit in the backpack goes beside the station: first onto sleds parked
   * within STATION_GROUND_METRES of it, nearest first, as far as they have room, then in a pile at the player's feet.
   * Only planks can go on a sled. The recipe then starts even when the backpack is full. Only a station recipe can have it.
   * Missing if the recipe refuses to start when the result would not fit.
   */
  readonly dropsWhatDoesNotFit?: true;
}

/** How long crafting the saw takes, in seconds. */
export const SAW_CRAFT_SECONDS = 5;
/** How long crafting the fishing rod takes, in seconds. */
export const FISHING_ROD_CRAFT_SECONDS = 5;
/** How long crafting a torch takes, in seconds. */
export const TORCH_CRAFT_SECONDS = 4;
/** How long shaping an unfired jug from clay takes, in seconds. */
export const UNFIRED_JUG_CRAFT_SECONDS = 6;
/** How long twisting bark into cord takes, in seconds. */
export const CORD_CRAFT_SECONDS = 4;
/** How long making a fish trap takes, in seconds. */
export const FISH_TRAP_CRAFT_SECONDS = 8;
/** How long cutting a debarked log into planks takes, in seconds. */
export const PLANKS_CRAFT_SECONDS = 8;
/** How many planks one debarked log makes. */
export const PLANKS_PER_LOG = 4;

/** A station recipe can use logs or debarked logs lying this close to the station, in metres. */
export const STATION_GROUND_METRES = 2;

/** Each recipe by its name. TypeScript reports a name with no entry. The craft menu lists them in this order. */
const RECIPE_BY_KIND: { readonly [Kind in RecipeKind]: Recipe & { readonly kind: Kind } } = {
  // The saw: a hand recipe that fixes the saw blade to a handle made of sticks.
  saw: {
    kind: "saw",
    materials: [
      { material: "sawBlade", count: 1 },
      { material: "stick", count: 3 },
    ],
    result: { content: "saw", count: 1 },
    seconds: SAW_CRAFT_SECONDS,
  },
  // Planks: a station recipe. The player saws a debarked log lying beside the sawhorse into planks.
  planks: {
    kind: "planks",
    materials: [],
    besideStation: [{ material: "debarkedLog", count: 1 }],
    result: { content: "plank", count: PLANKS_PER_LOG },
    seconds: PLANKS_CRAFT_SECONDS,
    tool: "saw",
    station: "sawhorse",
    dropsWhatDoesNotFit: true,
  },
  // The fishing rod: a hand recipe that ties the fishing line to a rod made of sticks. The knife cuts and trims the sticks.
  fishingRod: {
    kind: "fishingRod",
    materials: [
      { material: "fishingLine", count: 1 },
      { material: "stick", count: 2 },
    ],
    result: { content: "fishingRod", count: 1 },
    seconds: FISHING_ROD_CRAFT_SECONDS,
    tool: "knife",
  },
  // The torch: a hand recipe that wraps a strip of bark round the end of a stick. It needs no tool.
  torch: {
    kind: "torch",
    materials: [
      { material: "stick", count: 1 },
      { material: "bark", count: 1 },
    ],
    result: { content: "torch", count: 1 },
    seconds: TORCH_CRAFT_SECONDS,
  },
  // The unfired jug: a hand recipe that shapes 2 clay into a jug. It needs no tool. It holds no water until it is fired.
  unfiredJug: {
    kind: "unfiredJug",
    materials: [{ material: "clay", count: 2 }],
    result: { content: "unfiredJug", count: 1 },
    seconds: UNFIRED_JUG_CRAFT_SECONDS,
  },
  // Cord: a hand recipe that twists strips of bark into a strong string. It needs no tool.
  cord: {
    kind: "cord",
    materials: [{ material: "bark", count: 3 }],
    result: { content: "cord", count: 1 },
    seconds: CORD_CRAFT_SECONDS,
  },
  // The fish trap: a hand recipe that ties sticks with cord into a cone basket. The knife cuts and trims the sticks.
  fishTrap: {
    kind: "fishTrap",
    materials: [
      { material: "cord", count: 2 },
      { material: "stick", count: 6 },
    ],
    result: { content: "fishTrap", count: 1 },
    seconds: FISH_TRAP_CRAFT_SECONDS,
    tool: "knife",
  },
};

/** Every recipe, in the order the craft menu lists them. */
export const RECIPES: readonly Recipe[] = Object.values(RECIPE_BY_KIND);

/** The recipe with this name. */
export function recipeOf(kind: RecipeKind): Recipe {
  return RECIPE_BY_KIND[kind];
}

/**
 * One thing the player lacks to follow a recipe now.
 * `tool`: the tool it needs is not in the backpack. `station`: no finished work station of its kind stands in the valley.
 * `materials`: the backpack does not hold every material it uses.
 */
export type RecipeLack =
  { readonly kind: "tool"; readonly tool: BackpackContent } | { readonly kind: "station"; readonly station: WorkStationKind } | { readonly kind: "materials" };

/**
 * Everything the player lacks to follow `recipe`, given their backpack and whether a finished station of a kind stands anywhere.
 * Empty when they can follow it. The list is in a fixed order: the tool, then the station, then the materials.
 */
export function recipeLacks(recipe: Recipe, backpack: Backpack, hasStation: (station: WorkStationKind) => boolean): readonly RecipeLack[] {
  const lacks: RecipeLack[] = [];
  if (recipe.tool !== undefined && !hasInBackpack(backpack, recipe.tool)) lacks.push({ kind: "tool", tool: recipe.tool });
  if (recipe.station !== undefined && !hasStation(recipe.station)) lacks.push({ kind: "station", station: recipe.station });
  if (recipe.materials.some(({ material, count }) => countInBackpack(backpack, material) < count)) lacks.push({ kind: "materials" });
  return lacks;
}
