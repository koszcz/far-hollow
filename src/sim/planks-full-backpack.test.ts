import { describe, expect, it } from "bun:test";
import { createGame } from "./game";
import { groundDistance } from "./ground-point";
import { cutPlanks, plankPiles, debarkedLogBeside, sledBeside, finishedSawhorseNearPlayer, give, send } from "./planks-test-helpers";
import { readSave, writeSave } from "./save";

describe("cutting planks when the backpack is too full for them", () => {
  // The starting kit (5.5 kg) and the saw (1 kg) weigh 6.5 kg, and the limit is 20 kg. A plank weighs 2 kg.

  it("puts all four planks in the backpack, drops none, and says nothing, when all of them fit", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    debarkedLogBeside(game, sawhorse, 1);
    give(game, { saw: 1 });

    cutPlanks(game);

    expect(game.client.getView().backpack.plank).toBe(4);
    expect(plankPiles(game)).toEqual([]);
    expect(game.client.getView().notice).toBeNull();
  });

  it("starts, puts the planks that fit in the backpack, and drops the rest in one pile beside the sawhorse", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    debarkedLogBeside(game, sawhorse, 1);
    // Seven pieces of firewood (10.5 kg) bring the backpack to 17 kg, so one plank fits and three do not.
    give(game, { saw: 1, firewood: 7 });

    send(game, { type: "craft", recipe: "planks" });
    expect(game.client.getView().notice).toBeNull();
    cutPlanks(game);

    expect(game.client.getView().backpack.plank).toBe(1);
    const piles = plankPiles(game);
    expect(piles.map(({ pile }) => pile)).toEqual([{ content: "plank", count: 3 }]);
    expect(groundDistance(piles[0]?.position ?? { x: Infinity, z: Infinity }, sawhorse.position)).toBeLessThanOrEqual(2);
    expect(game.client.getView().notice).toEqual({ kind: "droppedBesideStation", content: "plank", count: 3, station: "sawhorse" });
  });

  it("starts with no room at all, and drops all four planks beside the sawhorse", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    const log = debarkedLogBeside(game, sawhorse, 1);
    // Nine pieces of firewood (13.5 kg) bring the backpack to exactly 20 kg.
    give(game, { saw: 1, firewood: 9 });

    send(game, { type: "craft", recipe: "planks" });
    expect(game.client.getView().notice).toBeNull();
    cutPlanks(game);

    expect(game.entities.has(log)).toBe(false);
    expect(game.client.getView().backpack.plank).toBeUndefined();
    expect(plankPiles(game).map(({ pile }) => pile)).toEqual([{ content: "plank", count: 4 }]);
    expect(game.client.getView().notice).toEqual({ kind: "droppedBesideStation", content: "plank", count: 4, station: "sawhorse" });
  });

  it("adds the planks to a plank pile already lying within 1 m, as dropped things do", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    debarkedLogBeside(game, sawhorse, 1);
    debarkedLogBeside(game, sawhorse, 1.5);
    give(game, { saw: 1, firewood: 9 });

    cutPlanks(game);
    cutPlanks(game);

    expect(plankPiles(game).map(({ pile }) => pile)).toEqual([{ content: "plank", count: 8 }]);
  });

  it("does not show the planks as lacking anything in the craft menu when the backpack is full", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    debarkedLogBeside(game, sawhorse, 1);
    give(game, { saw: 1, firewood: 9 });
    game.step();

    expect(game.client.refusal({ type: "craft", recipe: "planks" })).toBeNull();
  });

  it("keeps the notice about dropped planks in a save", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    debarkedLogBeside(game, sawhorse, 1);
    give(game, { saw: 1, firewood: 9 });
    cutPlanks(game);
    const notice = game.client.getView().notice;
    expect(notice?.kind).toBe("droppedBesideStation");

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save was rejected");
    expect(loaded.game.client.getView().notice).toEqual(notice);
  });
});

describe("cutting planks next to a parked sled when the backpack is too full for them", () => {
  it("puts the planks that do not fit in the backpack on a sled parked within 2 m of the sawhorse, and drops none", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    debarkedLogBeside(game, sawhorse, 1);
    const sled = sledBeside(game, sawhorse, 2.4, { log: 1, debarkedLog: 0, plank: 0 });
    // Seven pieces of firewood (10.5 kg) bring the backpack to 17 kg, so one plank fits and three do not.
    give(game, { saw: 1, firewood: 7 });

    cutPlanks(game);

    expect(game.client.getView().backpack.plank).toBe(1);
    expect(sled.sled).toEqual({ log: 1, debarkedLog: 0, plank: 3 });
    expect(plankPiles(game)).toEqual([]);
    expect(game.client.getView().notice).toBeNull();
  });

  it("drops the planks the sled has no room for in a pile beside the sawhorse", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    debarkedLogBeside(game, sawhorse, 1);
    // Five logs leave one log space: room for 4 planks, 3 of which are taken.
    const sled = sledBeside(game, sawhorse, 2.4, { log: 5, debarkedLog: 0, plank: 3 });
    give(game, { saw: 1, firewood: 9 });

    cutPlanks(game);

    expect(sled.sled).toEqual({ log: 5, debarkedLog: 0, plank: 4 });
    expect(plankPiles(game).map(({ pile }) => pile)).toEqual([{ content: "plank", count: 3 }]);
    expect(game.client.getView().notice).toEqual({ kind: "droppedBesideStation", content: "plank", count: 3, station: "sawhorse" });
  });

  it("frees the space of a debarked log it cuts from the sled, and puts the planks there", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    const sled = sledBeside(game, sawhorse, 2.4, { log: 5, debarkedLog: 1, plank: 0 });
    give(game, { saw: 1, firewood: 9 });

    cutPlanks(game);

    expect(sled.sled).toEqual({ log: 5, debarkedLog: 0, plank: 4 });
    expect(plankPiles(game)).toEqual([]);
  });

  it("does not put planks on a sled parked further than 2 m from the sawhorse", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    debarkedLogBeside(game, sawhorse, 1);
    const sled = sledBeside(game, sawhorse, 3, { log: 0, debarkedLog: 0, plank: 0 });
    give(game, { saw: 1, firewood: 9 });

    cutPlanks(game);

    expect(sled.sled.plank).toBe(0);
    expect(plankPiles(game).map(({ pile }) => pile)).toEqual([{ content: "plank", count: 4 }]);
  });
});
