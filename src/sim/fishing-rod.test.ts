import { describe, expect, it } from "bun:test";
import type { BackpackContent } from "./backpack";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { FISHING_SAVE_VERSION, PLANK_ROOFS_SAVE_VERSION, readSave, SAVE_VERSION, writeSave, type SaveFile } from "./save";
import { finishReach } from "./test-steps";

describe("the fishing line in the starting kit", () => {
  it("is in a new game's backpack, along with the rest of the starting kit", () => {
    const view = createGame({ seed: 42 }).client.getView();
    expect(view.backpack).toEqual({ axe: 1, knife: 1, drawknife: 1, steelAndFlint: 1, bedroll: 1, pot: 1, sawBlade: 1, fishingLine: 1 });
    // The starting tools, bedroll, pot, and saw blade weigh 5.4 kg. The fishing line weighs 0.1 kg.
    expect(view.backpackWeight).toBeCloseTo(5.5);
  });

  it("weighs 0.1 kg, and the fishing rod 0.5 kg", () => {
    const game = createGame({ seed: 42 });
    const before = game.client.getView().backpackWeight;
    give(game, { fishingRod: 1 });
    game.step();
    expect(game.client.getView().backpackWeight - before).toBeCloseTo(0.5);
    delete onlyPlayer(game).backpack.contents.fishingLine;
    game.step();
    expect(game.client.getView().backpackWeight - before).toBeCloseTo(0.4);
  });
});

describe("loading a save from before fishing", () => {
  /** A save of a new game, as written by the version before fishing, with the player's backpack as given. */
  function saveFromBeforeFishing(backpack: Partial<Record<BackpackContent, number>>): unknown {
    const save = JSON.parse(JSON.stringify(writeSave(createGame({ seed: 42 })))) as SaveFile;
    save.version = FISHING_SAVE_VERSION - 1;
    for (const { components } of save.entities) if (components.backpack !== undefined) components.backpack.contents = backpack;
    return save;
  }

  it("raises the save version", () => {
    expect(FISHING_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    expect(FISHING_SAVE_VERSION).toBeGreaterThan(PLANK_ROOFS_SAVE_VERSION);
  });

  it("gives the player a fishing line", () => {
    const loaded = readSave(saveFromBeforeFishing({ axe: 1, stick: 2 }));
    if (!loaded.ok) throw new Error("The save was rejected");
    expect(loaded.game.client.getView().backpack).toEqual({ axe: 1, stick: 2, fishingLine: 1 });
  });

  it("gives no fishing line to a player who already holds a fishing rod", () => {
    const loaded = readSave(saveFromBeforeFishing({ axe: 1, fishingRod: 1 }));
    if (!loaded.ok) throw new Error("The save was rejected");
    expect(loaded.game.client.getView().backpack).toEqual({ axe: 1, fishingRod: 1 });
  });

  it("gives no second fishing line to a player who already holds one", () => {
    const loaded = readSave(saveFromBeforeFishing({ fishingLine: 1 }));
    if (!loaded.ok) throw new Error("The save was rejected");
    expect(loaded.game.client.getView().backpack).toEqual({ fishingLine: 1 });
  });
});

describe("dropping fishing gear", () => {
  it("drops the fishing line and the fishing rod as piles at the player's feet", () => {
    const game = createGame({ seed: 42 });
    give(game, { fishingRod: 2 });
    send(game, { type: "dropFromBackpack", content: "fishingLine" });
    send(game, { type: "dropFromBackpack", content: "fishingRod" });

    expect(game.client.getView().backpack.fishingLine ?? 0).toBe(0);
    expect(game.client.getView().backpack.fishingRod ?? 0).toBe(0);
    const piles = [...game.entities.with("pile")].map(({ pile }) => pile);
    expect(piles).toContainEqual({ content: "fishingLine", count: 1 });
    expect(piles).toContainEqual({ content: "fishingRod", count: 2 });
  });
});

describe("saving fishing gear", () => {
  it("saves the fishing line and the fishing rod in the backpack, in a pile, and in a chest", () => {
    const game = createGame({ seed: 42 });
    give(game, { fishingRod: 2 });
    game.entities.add({ pile: { content: "fishingRod", count: 3 }, position: { x: 1, y: 0, z: 1 } });
    game.entities.add({ chest: { contents: { fishingLine: 2, fishingRod: 1 } }, facing: { turns: 0 }, position: { x: 4, y: 0, z: 4 } });

    const saved = writeSave(game);
    expect(saved.version).toBe(SAVE_VERSION);
    const loaded = readSave(JSON.parse(JSON.stringify(saved)));
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(loaded.game.client.getView().backpack).toMatchObject({ fishingLine: 1, fishingRod: 2 });
    expect([...loaded.game.entities.with("pile")].map(({ pile }) => pile)).toContainEqual({ content: "fishingRod", count: 3 });
    expect([...loaded.game.entities.with("chest")].map(({ chest }) => chest.contents)).toContainEqual({ fishingLine: 2, fishingRod: 1 });
  });
});

describe("the craft menu", () => {
  it("lists the fishing rod as a hand recipe that needs the knife", () => {
    const rod = createGame({ seed: 42 })
      .client.getView()
      .craftMenu.find((entry) => entry.kind === "fishingRod");
    expect(rod).toMatchObject({
      materials: [
        { material: "fishingLine", count: 1 },
        { material: "stick", count: 2 },
      ],
      result: { content: "fishingRod", count: 1 },
      seconds: 5,
      tool: "knife",
    });
    expect(rod?.station).toBeUndefined();
  });

  it("says the recipe needs the knife when the backpack holds none", () => {
    const game = createGame({ seed: 42 });
    give(game, { stick: 2 });
    delete onlyPlayer(game).backpack.contents.knife;
    game.step();
    const rod = game.client.getView().craftMenu.find((entry) => entry.kind === "fishingRod");
    expect(rod?.lacks).toEqual([{ kind: "tool", tool: "knife" }]);
  });
});

describe("crafting the fishing rod", () => {
  it("works for five seconds where the player stands, then turns a fishing line and two sticks into a fishing rod, keeping the knife", () => {
    const game = createGame({ seed: 42 });
    give(game, { stick: 3 });
    const start = { ...onlyPlayer(game).position };

    send(game, { type: "craft", recipe: "fishingRod" });
    expect(game.client.getView().action?.kind).toBe("craft");
    runSeconds(game, 2.5);
    expect(game.client.getView().action?.progress).toBeCloseTo(0.5, 1);
    expect(game.client.getView().backpack).toMatchObject({ fishingLine: 1, stick: 3 });

    runSeconds(game, 2.6);
    expect(game.client.getView().action).toBeNull();
    expect(game.client.getView().backpack).toMatchObject({ fishingLine: 0, stick: 1, fishingRod: 1, knife: 1 });
    expect(onlyPlayer(game).position).toEqual(start);
  });

  it("uses nothing up when the player stops partway", () => {
    const game = createGame({ seed: 42 });
    give(game, { stick: 2 });
    send(game, { type: "craft", recipe: "fishingRod" });
    runSeconds(game, 4);
    const { x, z } = onlyPlayer(game).position;
    game.client.send({ type: "walkTo", x: x + 1, z });
    runSeconds(game, 2);
    expect(game.client.getView().action).toBeNull();
    expect(game.client.getView().backpack).toMatchObject({ fishingLine: 1, stick: 2 });
    expect(game.client.getView().backpack.fishingRod).toBeUndefined();
  });

  it("does not start without the knife, and says so", () => {
    const game = createGame({ seed: 42 });
    give(game, { stick: 2 });
    delete onlyPlayer(game).backpack.contents.knife;
    send(game, { type: "craft", recipe: "fishingRod" });
    expect(game.client.getView().action).toBeNull();
    expect(game.client.getView().notice).toEqual({ kind: "cannotCraftYet", lacks: [{ kind: "tool", tool: "knife" }] });
  });

  it("does not start without the fishing line", () => {
    const game = createGame({ seed: 42 });
    give(game, { stick: 2 });
    delete onlyPlayer(game).backpack.contents.fishingLine;
    send(game, { type: "craft", recipe: "fishingRod" });
    expect(game.client.getView().action).toBeNull();
    expect(game.client.getView().notice).toEqual({ kind: "cannotCraftYet", lacks: [{ kind: "materials" }] });
  });

  it("does not start while the player carries a log, and says to put it down first", () => {
    const game = createGame({ seed: 42 });
    give(game, { stick: 2 });
    onlyPlayer(game).carrying = "log";
    send(game, { type: "craft", recipe: "fishingRod" });
    expect(game.client.getView().action).toBeNull();
    expect(game.client.getView().notice?.kind).toBe("putLogDownFirst");
    runSeconds(game, 6);
    expect(game.client.getView().backpack.fishingRod).toBeUndefined();
  });

  it("does not start if the fishing rod would not fit even after the materials it uses are freed, and says the backpack is full", () => {
    const game = createGame({ seed: 42 });
    // The rod (0.5 kg) is lighter than what it uses (1.1 kg), so it only fails to fit in a backpack already over its limit:
    // here the starting kit (5.5 kg), 2 sticks (1 kg), and 10 pieces of firewood (15 kg) weigh 21.5 kg.
    give(game, { stick: 2, firewood: 10 });
    send(game, { type: "craft", recipe: "fishingRod" });
    expect(game.client.getView().action).toBeNull();
    expect(game.client.getView().notice?.kind).toBe("backpackFull");
  });
});

/** Puts more things in the player's backpack, whatever their weight. */
function give(game: Game, contents: Partial<Record<BackpackContent, number>>): void {
  const backpack = onlyPlayer(game).backpack.contents;
  for (const [content, count] of Object.entries(contents) as [BackpackContent, number][]) backpack[content] = (backpack[content] ?? 0) + count;
}

function send(game: Game, command: Parameters<Game["client"]["send"]>[0]): void {
  game.client.send(command);
  game.step();
  finishReach(game);
}

function runSeconds(game: Game, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * STEPS_PER_SECOND); i += 1) game.step();
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position", "backpack").first;
  if (player === undefined) throw new Error("No player");
  return player;
}
