// Why the craft menu greys out a recipe, and why the chest panel greys out a content to take.
// Each asks the game whether it would refuse the command, so the HUD never copies the game's rules.
import type { BackpackContent, RecipeKind } from "../sim/api";
import type { Command } from "../sim/api-commands";
import type { GameClient } from "../sim/api-client";
import { refusalText } from "./refusal-text";

/** What the module reads. game.client satisfies it, so tests can pass a real game. */
export type RefusalReader = Pick<GameClient, "refusal">;

/** Why the game would refuse `command` now, in words, or null if it would carry it out. */
function reasonFor(reader: RefusalReader, command: Command): string | null {
  const refusal = reader.refusal(command);
  return refusal === null ? null : refusalText(refusal);
}

/** Why the player cannot craft `recipe` now, such as "needs the knife", or null if they can. */
export function recipeReason(reader: RefusalReader, recipe: RecipeKind): string | null {
  return reasonFor(reader, { type: "craft", recipe });
}

/** Why the player cannot take one of `content` from the chest or shelf now, such as "the backpack is full", or null if they can. */
export function chestTakeReason(reader: RefusalReader, chestId: number, content: BackpackContent): string | null {
  return reasonFor(reader, { type: "takeFromChest", chestId, content, all: false });
}
