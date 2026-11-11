// Crafting: timed work that turns materials in the backpack into something new that goes in the backpack.
// Every recipe is listed in RECIPES. A new recipe needs only a new entry there, with its name in the strings file.
import { BACKPACK_WEIGHT_LIMIT_KG, backpackWeight, CONTENT_WEIGHT_KG, countInBackpack, hasInBackpack, type Backpack, type BackpackContent } from "./backpack";
import { playerEntities, setComponent, type EntityStore } from "./entities";
import type { RecipeKind } from "./recipe-kind";
import { structureKindOf, type StructureKind } from "./structures";

export type { RecipeKind } from "./recipe-kind";

/** How many of one thing a recipe uses or makes. */
export interface RecipeAmount {
  readonly material: BackpackContent;
  readonly count: number;
}

/**
 * A recipe: what it uses, what it makes, and how long the work takes.
 * A hand recipe has no `station`, so the player follows it where they stand.
 * A station recipe names the work station the player follows it at.
 */
export interface Recipe {
  readonly kind: RecipeKind;
  /** What the work uses up. These leave the backpack only when the work finishes. */
  readonly materials: readonly RecipeAmount[];
  /** What the work makes. It goes in the backpack. */
  readonly result: { readonly content: BackpackContent; readonly count: number };
  /** How long the work takes, in seconds. */
  readonly seconds: number;
  /** The tool the player needs in the backpack. The work does not use it up. Missing if no tool is needed. */
  readonly tool?: BackpackContent;
  /** The work station the player follows it at. Missing for a hand recipe. */
  readonly station?: StructureKind;
}

/** How long crafting the saw takes, in seconds. */
export const SAW_CRAFT_SECONDS = 5;

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
};

/** Every recipe, in the order the craft menu lists them. */
export const RECIPES: readonly Recipe[] = Object.values(RECIPE_BY_KIND);

/** The recipe with this name. */
export function recipeOf(kind: RecipeKind): Recipe {
  return RECIPE_BY_KIND[kind];
}

/** What the player lacks to follow a recipe now. Each field is missing when the player has that. */
export interface RecipeLacks {
  /** The tool the recipe needs, when it is not in the backpack. */
  readonly tool?: BackpackContent;
  /** The work station the recipe needs, when no finished one stands in the valley. */
  readonly station?: StructureKind;
  /** True when the backpack does not hold every material the recipe uses. */
  readonly materials?: true;
}

/** What the player lacks to follow `recipe`, given their backpack and whether a finished station of a kind stands anywhere. */
export function recipeLacks(recipe: Recipe, backpack: Backpack, hasStation: (station: StructureKind) => boolean): RecipeLacks {
  return {
    ...(recipe.tool !== undefined && !hasInBackpack(backpack, recipe.tool) ? { tool: recipe.tool } : {}),
    ...(recipe.station !== undefined && !hasStation(recipe.station) ? { station: recipe.station } : {}),
    ...(recipe.materials.some(({ material, count }) => countInBackpack(backpack, material) < count) ? { materials: true as const } : {}),
  };
}

/**
 * True if the result fits in the backpack once the materials the recipe uses are taken out.
 * The small allowance stops rounding errors in the weights from refusing a result that fits.
 */
function resultFits(recipe: Recipe, backpack: Backpack): boolean {
  const freed = recipe.materials.reduce((total, { material, count }) => total + count * CONTENT_WEIGHT_KG[material], 0);
  const added = recipe.result.count * CONTENT_WEIGHT_KG[recipe.result.content];
  return backpackWeight(backpack) - freed + added <= BACKPACK_WEIGHT_LIMIT_KG + 1e-9;
}

/**
 * Why the player could not start crafting.
 * `putLogDownFirst`: they carry a log on their shoulder. `backpackFull`: the result would not fit.
 */
export type CraftRefusal = "putLogDownFirst" | "backpackFull";

export interface Crafting {
  /**
   * Starts the player crafting a hand recipe where they stand.
   * Does nothing if they lack its tool, station, or materials. Refuses if they carry a log or the result would not fit.
   */
  start(kind: RecipeKind): CraftRefusal | undefined;
  /** Stops the player crafting. Nothing is used up, and the work starts again from the beginning next time. */
  cancel(): void;
  /** Moves crafting on by one logic step. When the work finishes, the materials leave the backpack and the result goes in. */
  step(stepSeconds: number): void;
  /** What the player lacks to follow a recipe now. */
  lacks(kind: RecipeKind): RecipeLacks;
}

/** Lets the player craft: turn materials in the backpack into something new, by timed work. */
export function createCrafting(entities: EntityStore): Crafting {
  const players = playerEntities(entities);
  const crafters = entities.with("craftTask", "backpack");

  function hasStation(station: StructureKind): boolean {
    // Only a finished station counts. A blueprint does not.
    return entities.entities.some((entity) => entity.blueprint === undefined && structureKindOf(entity) === station);
  }

  function lacksAnything(lacks: RecipeLacks): boolean {
    return lacks.tool !== undefined || lacks.station !== undefined || lacks.materials === true;
  }

  return {
    start(kind) {
      const recipe = recipeOf(kind);
      // Station recipes need the player to walk to the station first, which is not built yet, so they do not start.
      if (recipe.station !== undefined) return undefined;
      let refusal: CraftRefusal | undefined;
      for (const player of players) {
        if (player.backpack === undefined || lacksAnything(recipeLacks(recipe, player.backpack, hasStation))) continue;
        if (player.carrying !== undefined) {
          refusal = "putLogDownFirst";
          continue;
        }
        if (!resultFits(recipe, player.backpack)) {
          refusal = "backpackFull";
          continue;
        }
        entities.removeComponent(player, "walkPath");
        setComponent(entities, player, "craftTask", { recipe: kind, secondsDone: 0 });
      }
      return refusal;
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "craftTask");
    },
    step(stepSeconds) {
      // Copy the list first, because players who finish or give up leave the query while it is being walked.
      for (const crafter of [...crafters]) {
        const recipe = recipeOf(crafter.craftTask.recipe);
        if (crafter.carrying !== undefined || lacksAnything(recipeLacks(recipe, crafter.backpack, hasStation)) || !resultFits(recipe, crafter.backpack)) {
          entities.removeComponent(crafter, "craftTask");
          continue;
        }
        crafter.craftTask.secondsDone += stepSeconds;
        if (crafter.craftTask.secondsDone < recipe.seconds) continue;
        entities.removeComponent(crafter, "craftTask");
        for (const { material, count } of recipe.materials) crafter.backpack.contents[material] = countInBackpack(crafter.backpack, material) - count;
        crafter.backpack.contents[recipe.result.content] = countInBackpack(crafter.backpack, recipe.result.content) + recipe.result.count;
      }
    },
    lacks(kind) {
      const player = players.first;
      return player?.backpack === undefined ? {} : recipeLacks(recipeOf(kind), player.backpack, hasStation);
    },
  };
}
