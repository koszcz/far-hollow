import { describe, expect, it } from "bun:test";
import type { BackpackContent } from "../sim/api";
import type { Entity } from "../sim/entities";
import { createGame, type Game } from "../sim/game";
import { chestTakeReason, recipeReason } from "./menu-refusals";

// Each test sets up a real game, so the game's own rules decide what is greyed out.

describe("why the craft menu greys out a recipe", () => {
  it("greys out a recipe the player lacks things for, with what it lacks", () => {
    const game = gameWithBackpack({ stick: 2 });

    expect(recipeReason(game.client, "fishingRod")).toBe("needs the knife and more materials");
  });

  it("greys out a recipe while the player carries a log, and leaves one they can make", () => {
    const game = gameWithBackpack({ knife: 1, fishingLine: 1, stick: 2 });
    expect(recipeReason(game.client, "fishingRod")).toBeNull();

    game.entities.addComponent(player(game), "carrying", "log");

    expect(recipeReason(game.client, "fishingRod")).toBe("put the log down first");
  });
});

describe("why the chest panel greys out a content", () => {
  it("greys out a content that does not fit in the backpack, and leaves one that does", () => {
    const game = gameWithBackpack({ stone: 9, stick: 3 });
    const at = player(game).position ?? { x: 0, y: 0, z: 0 };
    const chestId = game.entities.id(
      game.entities.add({ position: { x: at.x + 1, y: at.y, z: at.z }, furniture: "chest", storage: { contents: { stone: 1, berries: 1 } } }),
    );
    if (chestId === undefined) throw new Error("No chest");
    // The panel only shows an open chest.
    game.client.send({ type: "openChest", chestId });
    game.step();

    expect(chestTakeReason(game.client, chestId, "stone")).toBe("the backpack is full");
    expect(chestTakeReason(game.client, chestId, "berries")).toBeNull();
  });
});

/** A new game whose backpack holds only these. */
function gameWithBackpack(contents: Partial<Record<BackpackContent, number>>): Game {
  const game = createGame({ seed: 42 });
  player(game).backpack = { contents: { ...contents } };
  return game;
}

function player(game: Game): Entity {
  const found = game.entities.with("player").first;
  if (found === undefined) throw new Error("No player");
  return found;
}
