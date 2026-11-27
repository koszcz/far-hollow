import { describe, expect, it } from "bun:test";
import { createGame } from "./game";
import { groundDistance } from "./ground-point";
import {
  walkAwayFrom,
  debarkedLogBeside,
  finishedSawhorseNearPlayer,
  sawhorseBlueprintNearPlayer,
  give,
  send,
  stepUntil,
  runSeconds,
  onlyPlayer,
  idOf,
} from "./planks-test-helpers";

describe("cutting planks at the sawhorse", () => {
  it("walks the player to the sawhorse from the craft menu, then turns the debarked log beside it into four planks in eight seconds", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    const log = debarkedLogBeside(game, sawhorse, 1);
    give(game, { saw: 1 });
    walkAwayFrom(game, sawhorse);
    const start = { ...onlyPlayer(game).position };
    expect(groundDistance(start, sawhorse.position)).toBeGreaterThan(4);

    send(game, { type: "craft", recipe: "planks" });
    stepUntil(game, () => game.client.getView().action?.kind === "craft");
    expect(groundDistance(onlyPlayer(game).position, sawhorse.position)).toBeLessThanOrEqual(2);
    expect(groundDistance(onlyPlayer(game).position, start)).toBeGreaterThan(0);

    runSeconds(game, 7.5);
    expect(game.entities.has(log)).toBe(true);
    expect(game.client.getView().backpack.plank).toBeUndefined();

    runSeconds(game, 0.6);
    expect(game.client.getView().action).toBeNull();
    expect(game.entities.has(log)).toBe(false);
    expect(game.client.getView().backpack.plank).toBe(4);
    expect(game.client.getView().backpack.saw).toBe(1);
  });

  it("walks the player to the sawhorse they chose, when sent with its id, as a right-click does", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    debarkedLogBeside(game, sawhorse, 1);
    give(game, { saw: 1 });
    walkAwayFrom(game, sawhorse);

    send(game, { type: "craft", recipe: "planks", stationId: idOf(game, sawhorse) });
    stepUntil(game, () => game.client.getView().action?.kind === "craft");
    expect(groundDistance(onlyPlayer(game).position, sawhorse.position)).toBeLessThanOrEqual(2);
    runSeconds(game, 8.1);
    expect(game.client.getView().backpack.plank).toBe(4);
  });

  it("does not start without a debarked log within 2 m of the sawhorse, and says why", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    const log = debarkedLogBeside(game, sawhorse, 2.5);
    give(game, { saw: 1 });

    send(game, { type: "craft", recipe: "planks" });
    expect(game.client.getView().notice).toEqual({ kind: "noLogBesideStation", station: "sawhorse" });
    runSeconds(game, 10);
    expect(game.client.getView().action).toBeNull();
    expect(game.entities.has(log)).toBe(true);
    expect(game.client.getView().backpack.plank).toBeUndefined();
  });

  it("stops and says why when the debarked log is gone by the time the player reaches the sawhorse", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    const log = debarkedLogBeside(game, sawhorse, 1);
    give(game, { saw: 1 });
    walkAwayFrom(game, sawhorse);

    send(game, { type: "craft", recipe: "planks", stationId: idOf(game, sawhorse) });
    expect(game.client.getView().notice).toBeNull();
    game.entities.remove(log);
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
    game.step();
    expect(game.client.getView().action).toBeNull();
    expect(game.client.getView().notice).toEqual({ kind: "noLogBesideStation", station: "sawhorse" });
  });

  it("does not start without the saw, and names what is missing, as a right-click on the sawhorse does", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    debarkedLogBeside(game, sawhorse, 1);

    send(game, { type: "craft", recipe: "planks", stationId: idOf(game, sawhorse) });
    expect(game.client.getView().notice).toEqual({ kind: "cannotCraftYet", lacks: [{ kind: "tool", tool: "saw" }] });
    runSeconds(game, 10);
    expect(game.client.getView().backpack.plank).toBeUndefined();
  });

  it("leaves the debarked log where it was when the player stops partway, and starts again from the beginning next time", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    const log = debarkedLogBeside(game, sawhorse, 1);
    const logSpot = { ...log.position };
    give(game, { saw: 1 });

    send(game, { type: "craft", recipe: "planks" });
    stepUntil(game, () => game.client.getView().action?.kind === "craft");
    runSeconds(game, 6);
    walkAwayFrom(game, sawhorse);
    expect(game.client.getView().action).toBeNull();
    expect(game.entities.has(log)).toBe(true);
    expect(log.position).toEqual<unknown>(logSpot);
    expect(game.client.getView().backpack.plank).toBeUndefined();

    send(game, { type: "craft", recipe: "planks" });
    stepUntil(game, () => game.client.getView().action?.kind === "craft");
    runSeconds(game, 2);
    expect(game.client.getView().action?.progress).toBeCloseTo(0.25, 1);
  });

  it("does not start while the player carries a log, and says to put it down first", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    debarkedLogBeside(game, sawhorse, 1);
    give(game, { saw: 1 });
    onlyPlayer(game).carrying = "debarkedLog";

    send(game, { type: "craft", recipe: "planks" });
    expect(game.client.getView().notice?.kind).toBe("putLogDownFirst");
    runSeconds(game, 10);
    expect(game.client.getView().backpack.plank).toBeUndefined();
  });

  it("weighs 2 kg a plank", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    debarkedLogBeside(game, sawhorse, 1);
    // The starting kit (5.5 kg) and the saw (1 kg) weigh 6.5 kg.
    give(game, { saw: 1 });

    send(game, { type: "craft", recipe: "planks" });
    stepUntil(game, () => game.client.getView().backpack.plank !== undefined);
    expect(game.client.getView().backpackWeight).toBeCloseTo(14.5);
  });
});

describe("cutting planks in the craft menu", () => {
  it("lists cutting planks with the debarked log it uses, and shows the saw and the sawhorse as missing until the player has both", () => {
    const game = createGame({ seed: 42 });
    const entry = () => game.client.getView().craftMenu.find(({ kind }) => kind === "planks");
    const refusal = () => game.client.refusal({ type: "craft", recipe: "planks" });
    expect(entry()).toMatchObject({
      materials: [],
      besideStation: [{ material: "debarkedLog", count: 1 }],
      result: { content: "plank", count: 4 },
      seconds: 8,
      tool: "saw",
      station: "sawhorse",
    });
    expect(refusal()).toEqual({
      kind: "cannotCraftYet",
      lacks: [
        { kind: "tool", tool: "saw" },
        { kind: "station", station: "sawhorse" },
      ],
    });

    give(game, { saw: 1 });
    game.step();
    expect(refusal()).toEqual({ kind: "cannotCraftYet", lacks: [{ kind: "station", station: "sawhorse" }] });

    finishedSawhorseNearPlayer(game);
    expect(refusal()).toBeNull();
  });
});

describe("a sawhorse blueprint", () => {
  it("is not a work station: the menu still says the sawhorse is missing, and cutting planks does not start at it", () => {
    const game = createGame({ seed: 42 });
    const blueprint = sawhorseBlueprintNearPlayer(game);
    const log = debarkedLogBeside(game, blueprint, 1);
    give(game, { saw: 1 });
    game.step();
    expect(game.client.refusal({ type: "craft", recipe: "planks" })).toEqual({ kind: "cannotCraftYet", lacks: [{ kind: "station", station: "sawhorse" }] });

    send(game, { type: "craft", recipe: "planks" });
    send(game, { type: "craft", recipe: "planks", stationId: idOf(game, blueprint) });
    runSeconds(game, 10);
    expect(game.client.getView().action).toBeNull();
    expect(game.entities.has(log)).toBe(true);
    expect(game.client.getView().backpack.plank).toBeUndefined();
  });

  it("does not count when a finished sawhorse stands elsewhere: the right-click on the blueprint does nothing", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    debarkedLogBeside(game, sawhorse, 1);
    const blueprint = sawhorseBlueprintNearPlayer(game, 12);
    debarkedLogBeside(game, blueprint, 1);
    give(game, { saw: 1 });

    send(game, { type: "craft", recipe: "planks", stationId: idOf(game, blueprint) });
    runSeconds(game, 10);
    expect(game.client.getView().backpack.plank).toBeUndefined();
  });
});
