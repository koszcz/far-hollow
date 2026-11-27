import { describe, expect, it } from "bun:test";
import { createGame } from "./game";
import { terrainHeightAt } from "./valley";
import { woodpileBeside, logsLyingNear, finishedSledNearPlayer, sendAndSettle, send, stepUntil, onlyPlayer, idOf } from "./sled-test-helpers";

describe("tipping out a sled", () => {
  it("lays every log on the ground beside the sled, each on its own, and leaves the sled empty", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    sled.sled = { log: 4, debarkedLog: 2, plank: 0 };
    const logsBefore = game.entities.with("log").size;
    const debarkedBefore = game.entities.with("debarkedLog").size;

    sendAndSettle(game, { type: "tipOutSled", sledId: idOf(game, sled) });

    expect(sled.sled).toEqual({ log: 0, debarkedLog: 0, plank: 0 });
    expect(game.entities.with("log").size).toBe(logsBefore + 4);
    expect(game.entities.with("debarkedLog").size).toBe(debarkedBefore + 2);
    const tipped = [...game.entities.with("position").entities].filter(
      (entity) =>
        (entity.log !== undefined || entity.debarkedLog !== undefined) &&
        Math.hypot(entity.position.x - sled.position.x, entity.position.z - sled.position.z) < 2.5,
    );
    expect(tipped).toHaveLength(6);
    // Each lies on its own spot, off the sled, and on the ground.
    const spots = new Set(tipped.map(({ position }) => `${position.x.toFixed(2)},${position.z.toFixed(2)}`));
    expect(spots.size).toBe(6);
    for (const { position } of tipped) {
      expect(Math.abs(position.z - sled.position.z)).toBeGreaterThan(0.4);
      expect(position.y).toBeCloseTo(terrainHeightAt(game.valley.terrain, position.x, position.z), 5);
    }
  });
});

describe("tipping out a sled next to a woodpile", () => {
  it("puts every log on a woodpile with room, and lays none on the ground", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    const woodpile = woodpileBeside(game, sled);
    sled.sled = { log: 4, debarkedLog: 2, plank: 0 };
    const lyingBefore = logsLyingNear(game, sled).length;

    sendAndSettle(game, { type: "tipOutSled", sledId: idOf(game, sled) });

    expect(sled.sled).toEqual({ log: 0, debarkedLog: 0, plank: 0 });
    expect(woodpile.woodpile).toEqual({ log: 4, debarkedLog: 2, firewood: 0 });
    expect(logsLyingNear(game, sled)).toHaveLength(lyingBefore);
  });

  it("lays the logs that do not fit on a nearly full woodpile on the ground beside the sled", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    const woodpile = woodpileBeside(game, sled);
    woodpile.woodpile.firewood = 18;
    sled.sled = { log: 4, debarkedLog: 2, plank: 0 };
    const lyingBefore = logsLyingNear(game, sled).length;

    sendAndSettle(game, { type: "tipOutSled", sledId: idOf(game, sled) });

    expect(sled.sled).toEqual({ log: 0, debarkedLog: 0, plank: 0 });
    // A woodpile holds 20 in all, so 2 logs fit. The other 2 logs and both debarked logs go on the ground.
    expect(woodpile.woodpile).toEqual({ log: 2, debarkedLog: 0, firewood: 18 });
    const laid = logsLyingNear(game, sled).slice(lyingBefore);
    expect(laid.filter((entity) => entity.log !== undefined)).toHaveLength(2);
    expect(laid.filter((entity) => entity.debarkedLog !== undefined)).toHaveLength(2);
  });
});

describe("taking down a sled", () => {
  it("gives back its 2 logs on the ground and its 4 sticks in the backpack", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    const backpack = onlyPlayer(game).backpack;
    backpack.contents.stick = 0;
    const logsBefore = game.entities.with("log").size;

    send(game, { type: "takeDown", pieceId: idOf(game, sled) });
    stepUntil(game, () => !game.entities.has(sled));

    expect(game.entities.with("log").size).toBe(logsBefore + 2);
    expect(backpack.contents.stick).toBe(4);
  });

  it("lays any logs on a loaded sled on the ground beside it first, so none is lost", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    sled.sled = { log: 3, debarkedLog: 2, plank: 0 };
    const { x, z } = sled.position;
    const logsBefore = game.entities.with("log").size;
    const debarkedBefore = game.entities.with("debarkedLog").size;

    send(game, { type: "takeDown", pieceId: idOf(game, sled) });
    expect(game.client.getView().notice).toBeNull();
    stepUntil(game, () => !game.entities.has(sled));

    // The 3 logs it held, and the 2 logs it was built from.
    expect(game.entities.with("log").size).toBe(logsBefore + 5);
    expect(game.entities.with("debarkedLog").size).toBe(debarkedBefore + 2);
    const besideSled = [...game.entities.with("debarkedLog", "position").entities].filter(
      ({ position }) => Math.hypot(position.x - x, position.z - z) < 2.5 && Math.abs(position.z - z) > 0.4,
    );
    expect(besideSled).toHaveLength(2);
  });
});

describe("a sled within reach of E", () => {
  it("is what E reaches when the player stands beside it", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    sendAndSettle(game, { type: "tipOutSled", sledId: idOf(game, sled) });

    expect(game.client.nearestInReach()).toEqual({ kind: "sled", id: idOf(game, sled) });
  });
});
