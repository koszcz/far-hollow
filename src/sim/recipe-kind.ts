// The names of recipes, apart from crafting.ts, so entity components and the save check can name a recipe without importing crafting.

/** The name of each recipe. Add a name here, then its recipe in crafting.ts. */
export const RECIPE_KINDS = ["saw", "planks", "fishingRod", "torch", "unfiredJug"] as const;

/** The name of a recipe. */
export type RecipeKind = (typeof RECIPE_KINDS)[number];
