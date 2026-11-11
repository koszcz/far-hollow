import { describe, expect, it } from "vitest";
import type { BackpackContent } from "./backpack";
import { recipeLacks, type Recipe } from "./crafting";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { CRAFTING_SAVE_VERSION, readSave, SAVE_VERSION, writeSave, type SaveFile } from "./save";

describe("the saw blade in the starting kit", () => {
  it("is in a new game's backpack, along with the rest of the starting kit", () => {
    const view = createGame({ seed: 42 }).client.getView();
    expect(view.backpack).toEqual({ axe: 1, knife: 1, drawknife: 1, fireStriker: 1, bedroll: 1, pot: 1, sawBlade: 1 });
    // The starting tools, bedroll, and pot weigh 4.9 kg. The saw blade weighs 0.5 kg.
    expect(view.backpackWeight).toBeCloseTo(5.4);
  });
});

describe("loading a save from before crafting", () => {
  /** A save of a new game, as written by the version before crafting, with the player's backpack as given. */
  function saveFromBeforeCrafting(backpack: Record<string, number>): unknown {
    const save = JSON.parse(JSON.stringify(writeSave(createGame({ seed: 42 })))) as SaveFile;
    save.version = CRAFTING_SAVE_VERSION - 1;
    for (const { components } of save.entities) if (components.backpack !== undefined) components.backpack.contents = backpack;
    return save;
  }

  it("gives the player a saw blade", () => {
    const loaded = readSave(saveFromBeforeCrafting({ axe: 1, stick: 2 }));
    if (!loaded.ok) throw new Error("The save was rejected");
    expect(loaded.game.client.getView().backpack).toEqual({ axe: 1, stick: 2, sawBlade: 1 });
  });

  it("gives no saw blade to a player who already holds a saw", () => {
    const loaded = readSave(saveFromBeforeCrafting({ axe: 1, saw: 1 }));
    if (!loaded.ok) throw new Error("The save was rejected");
    expect(loaded.game.client.getView().backpack).toEqual({ axe: 1, saw: 1 });
  });

  it("saves the saw blade and the saw at the newer version", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).backpack.contents.saw = 1;
    const saved = writeSave(game);
    expect(saved.version).toBe(SAVE_VERSION);
    const loaded = readSave(JSON.parse(JSON.stringify(saved)));
    if (!loaded.ok) throw new Error("The save was rejected");
    expect(loaded.game.client.getView().backpack).toMatchObject({ sawBlade: 1, saw: 1 });
  });
});

describe("the craft menu", () => {
  it("lists the saw recipe with its materials, result, and time", () => {
    const [saw] = createGame({ seed: 42 }).client.getView().craftMenu;
    expect(saw).toMatchObject({
      recipe: "saw",
      materials: [{ material: "sawBlade", count: 1 }, { material: "stick", count: 3 }],
      result: { content: "saw", count: 1 },
      seconds: 5,
    });
    expect(saw?.station).toBeUndefined();
    expect(saw?.tool).toBeUndefined();
  });
});

describe("crafting the saw", () => {
  it("works for five seconds where the player stands, then turns a saw blade and three sticks into a saw", () => {
    const game = createGame({ seed: 42 });
    give(game, { stick: 4 });
    const start = { ...onlyPlayer(game).position };

    game.client.send({ type: "craft", recipe: "saw" });
    game.step();
    expect(game.client.getView().action?.kind).toBe("craft");
    runSeconds(game, 2.5);
    expect(game.client.getView().action?.progress).toBeCloseTo(0.5, 1);
    expect(game.client.getView().backpack).toMatchObject({ sawBlade: 1, stick: 4 });

    runSeconds(game, 2.6);
    expect(game.client.getView().action).toBeNull();
    expect(game.client.getView().backpack).toMatchObject({ sawBlade: 0, stick: 1, saw: 1 });
    expect(onlyPlayer(game).position).toEqual(start);
  });

  it("drains fatigue faster than standing idle, like other timed work", () => {
    const idle = createGame({ seed: 42 });
    const working = createGame({ seed: 42 });
    give(working, { stick: 3 });
    working.client.send({ type: "craft", recipe: "saw" });
    runSeconds(idle, 5);
    runSeconds(working, 5);
    const loss = (game: Game) => 1 - game.client.getView().needs.fatigue;
    expect(loss(working)).toBeGreaterThan(loss(idle) * 1.5);
  });

  it("uses nothing up when the player stops partway, and starts again from the beginning next time", () => {
    const game = createGame({ seed: 42 });
    give(game, { stick: 3 });
    game.client.send({ type: "craft", recipe: "saw" });
    runSeconds(game, 4);
    const { x, z } = onlyPlayer(game).position;
    game.client.send({ type: "walkTo", x: x + 1, z });
    runSeconds(game, 2);
    expect(game.client.getView().action).toBeNull();
    expect(game.client.getView().backpack).toMatchObject({ sawBlade: 1, stick: 3 });
    expect(game.client.getView().backpack.saw).toBeUndefined();

    game.client.send({ type: "craft", recipe: "saw" });
    runSeconds(game, 1);
    expect(game.client.getView().action?.progress).toBeCloseTo(0.2, 1);
  });

  it("does not start without the materials", () => {
    const game = createGame({ seed: 42 });
    give(game, { stick: 2 });
    game.client.send({ type: "craft", recipe: "saw" });
    runSeconds(game, 6);
    expect(game.client.getView().backpack.saw).toBeUndefined();
    expect(game.client.getView().craftMenu[0]?.hasMaterials).toBe(false);
  });

  it("does not start while the player carries a log, and says to put it down first", () => {
    const game = createGame({ seed: 42 });
    give(game, { stick: 3 });
    onlyPlayer(game).carrying = "log";
    game.client.send({ type: "craft", recipe: "saw" });
    game.step();
    expect(game.client.getView().action).toBeNull();
    expect(game.client.getView().notice).toBe("putLogDownFirst");
    runSeconds(game, 6);
    expect(game.client.getView().backpack.saw).toBeUndefined();
  });

  it("counts the weight of the materials it uses as freed, so a full backpack still has room for the saw", () => {
    const game = createGame({ seed: 42 });
    // The starting kit (5.4 kg), 3 sticks (1.5 kg), 8 pieces of firewood (12 kg), and 11 fire strikers (1.1 kg) weigh 20 kg, the limit.
    give(game, { stick: 3, firewood: 8, fireStriker: 11 });
    game.step();
    expect(game.client.getView().backpackWeight).toBeCloseTo(20, 5);
    game.client.send({ type: "craft", recipe: "saw" });
    runSeconds(game, 5.1);
    expect(game.client.getView().backpack.saw).toBe(1);
  });

  it("does not start if the saw would not fit even after the materials it uses are freed, and says the backpack is full", () => {
    const game = createGame({ seed: 42 });
    // The saw (1 kg) is lighter than what it uses (2 kg), so it only fails to fit in a backpack already over its limit: here 21.9 kg.
    give(game, { stick: 3, firewood: 10 });
    game.client.send({ type: "craft", recipe: "saw" });
    game.step();
    expect(game.client.getView().action).toBeNull();
    expect(game.client.getView().notice).toBe("backpackFull");
  });
});

describe("what a recipe lacks", () => {
  // A made-up station recipe that needs the saw at a woodpile, to check tools and stations before real ones exist.
  const recipe: Recipe = {
    kind: "saw",
    materials: [{ material: "stick", count: 2 }],
    result: { content: "firewood", count: 1 },
    seconds: 1,
    tool: "saw",
    station: "woodpile",
  };

  it("names the tool that is not in the backpack and the station that does not stand", () => {
    expect(recipeLacks(recipe, { contents: { stick: 2 } }, () => false)).toEqual({ tool: "saw", station: "woodpile" });
  });

  it("lacks nothing once the player has the tool, the station, and the materials", () => {
    expect(recipeLacks(recipe, { contents: { saw: 1, stick: 2 } }, (station) => station === "woodpile")).toEqual({});
  });

  it("says when materials are missing", () => {
    expect(recipeLacks(recipe, { contents: { saw: 1, stick: 1 } }, () => true)).toEqual({ materials: true });
  });
});

/** Puts more things in the player's backpack, whatever their weight. */
function give(game: Game, contents: Partial<Record<BackpackContent, number>>): void {
  const backpack = onlyPlayer(game).backpack.contents;
  for (const [content, count] of Object.entries(contents) as [BackpackContent, number][]) backpack[content] = (backpack[content] ?? 0) + count;
}

export function runSeconds(game: Game, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * STEPS_PER_SECOND); i += 1) game.step();
}

export function onlyPlayer(game: Game): Entity & Required<Pick<Entity, "backpack" | "position">> {
  const player = game.entities.with("player", "position", "backpack").first;
  if (player === undefined) throw new Error("No player");
  return player;
}
