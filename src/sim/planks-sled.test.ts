import { describe, expect, it } from "bun:test";
import { createGame } from "./game";
import { walkAwayFrom, debarkedLogBeside, sledBeside, finishedSawhorseNearPlayer, give, send, stepUntil, runSeconds } from "./planks-test-helpers";

describe("cutting planks with a debarked log on a sled", () => {
  it("uses a debarked log on a sled parked within 2 m of the sawhorse, and takes it off the sled", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    // The sled's middle is 2.4 m away, so its near side, 0.4 m from the middle, is 2 m from the sawhorse.
    const sled = sledBeside(game, sawhorse, 2.4, { log: 1, debarkedLog: 1, plank: 0 });
    give(game, { saw: 1 });
    walkAwayFrom(game, sawhorse);

    send(game, { type: "craft", recipe: "planks" });
    stepUntil(game, () => game.client.getView().action?.kind === "craft");
    runSeconds(game, 8.1);

    expect(game.client.getView().backpack.plank).toBe(4);
    expect(sled.sled).toEqual({ log: 1, debarkedLog: 0, plank: 0 });
  });

  it("does not count a sled parked further than 2 m from the sawhorse", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    const sled = sledBeside(game, sawhorse, 3, { log: 0, debarkedLog: 1, plank: 0 });
    give(game, { saw: 1 });

    send(game, { type: "craft", recipe: "planks" });
    expect(game.client.getView().notice).toEqual({ kind: "noLogBesideStation", station: "sawhorse" });
    runSeconds(game, 10);
    expect(sled.sled).toEqual({ log: 0, debarkedLog: 1, plank: 0 });
    expect(game.client.getView().backpack.plank).toBeUndefined();
  });

  it("uses a debarked log lying on the ground before one on a sled", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    const sled = sledBeside(game, sawhorse, 1.5, { log: 0, debarkedLog: 1, plank: 0 });
    const log = debarkedLogBeside(game, sawhorse, 1.8);
    give(game, { saw: 1 });

    send(game, { type: "craft", recipe: "planks" });
    stepUntil(game, () => game.client.getView().backpack.plank !== undefined);

    expect(game.entities.has(log)).toBe(false);
    expect(sled.sled).toEqual({ log: 0, debarkedLog: 1, plank: 0 });
  });

  it("shows nothing lacking in the craft menu when the only debarked log is on a sled by the sawhorse", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    sledBeside(game, sawhorse, 1.5, { log: 0, debarkedLog: 1, plank: 0 });
    give(game, { saw: 1 });
    game.step();

    expect(game.client.refusal({ type: "craft", recipe: "planks" })).toBeNull();
  });

  it("does not count a sled the player is dragging", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    const sled = sledBeside(game, sawhorse, 1.5, { log: 0, debarkedLog: 1, plank: 0 });
    give(game, { saw: 1 });
    const sledId = game.entities.id(sled);
    if (sledId === undefined) throw new Error("The sled is not in the store");
    send(game, { type: "dragSled", sledId });
    runSeconds(game, 5);
    expect(game.client.getView().dragging).not.toBeNull();

    // Crafting needs free hands, so the player is told to let go. The sled keeps its log.
    send(game, { type: "craft", recipe: "planks" });
    expect(game.client.getView().notice).toMatchObject({ kind: "letGoFirst" });
    runSeconds(game, 10);
    expect(sled.sled).toEqual({ log: 0, debarkedLog: 1, plank: 0 });
    expect(game.client.getView().backpack.plank).toBeUndefined();
  });
});
