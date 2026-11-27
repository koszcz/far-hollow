import type { Recipe } from "./crafting-recipes";

/** One recipe in the craft menu. What the player lacks to follow it now comes from `GameClient.refusal`. */
export type CraftMenuEntry = Recipe;
