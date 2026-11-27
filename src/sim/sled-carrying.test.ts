import { describe, expect, it } from "bun:test";
import { createGame } from "./game";
import { distanceOutside } from "./building";
import { findPath } from "./pathfinding";
import { USE_REACH_METRES } from "./reach";
import { footprintOfEntity } from "./structure-queries";
import { finishReach } from "./test-steps";
import {
  woodpileBeside,
  finishedSledNearPlayer,
  finishedSledInOpenGround,
  standAt,
  pathLength,
  shoulder,
  sendAndSettle,
  send,
  stepUntil,
  onlyPlayer,
  idOf,
} from "./sled-test-helpers";

describe("loading a sled", () => {
  it("puts the log or debarked log on the player's shoulder on the sled, walking the player to it first", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);

    shoulder(game, "log");
    sendAndSettle(game, { type: "loadSled", sledId: idOf(game, sled) });
    shoulder(game, "debarkedLog");
    sendAndSettle(game, { type: "loadSled", sledId: idOf(game, sled) });

    expect(sled.sled).toEqual({ log: 1, debarkedLog: 1, plank: 0 });
    expect(game.client.getView().carrying).toBeNull();
    expect(game.client.describeSled(idOf(game, sled))).toEqual({
      id: idOf(game, sled),
      contents: { log: 1, debarkedLog: 1, plank: 0 },
      total: 2,
      capacity: 6,
      logsThatFit: 4,
      planksThatFit: 16,
    });
  });
});

describe("walking to a sled", () => {
  it("stops beside the sled's long side, 1.3 m from its middle, on open ground", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledInOpenGround(game);
    const player = onlyPlayer(game);
    standAt(game, { x: sled.position.x, z: sled.position.z - 5 });

    shoulder(game, "log");
    sendAndSettle(game, { type: "loadSled", sledId: idOf(game, sled) });

    expect(player.position.x).toBeCloseTo(sled.position.x, 6);
    expect(player.position.z).toBeCloseTo(sled.position.z - 1.3, 6);
    expect(sled.sled.log).toBe(1);
  });

  it("walks the short way round a tree between the player and the sled, and loads the log from within reach", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledInOpenGround(game);
    const player = onlyPlayer(game);
    const start = standAt(game, { x: sled.position.x, z: sled.position.z - 8 });
    // The tree covers the spot 1.3 m from the sled's middle, on the line towards the player, where the walk used to aim.
    const tree = { x: sled.position.x, z: sled.position.z - 2.4 };
    game.entities.add({ tree: true, position: { ...tree, y: 0 }, blocksWalking: { radius: 1.2 } });
    const oldRoute = pathLength(start, findPath(game.walkMap, start, { x: sled.position.x, z: sled.position.z - 1.3 }));

    shoulder(game, "log");
    send(game, { type: "loadSled", sledId: idOf(game, sled) });
    let walked = 0;
    let at = { x: player.position.x, z: player.position.z };
    stepUntil(game, () => {
      walked += Math.hypot(player.position.x - at.x, player.position.z - at.z);
      at = { x: player.position.x, z: player.position.z };
      return player.walkPath === undefined && player.approach === undefined;
    });
    finishReach(game);

    // The old route went round the tree, then back in to the one spot in line with the player.
    expect(walked).toBeLessThan(oldRoute - 0.5);
    expect(Math.hypot(player.position.x - tree.x, player.position.z - tree.z)).toBeGreaterThan(1);
    expect(distanceOutside(footprintOfEntity(sled), player.position)).toBeLessThanOrEqual(USE_REACH_METRES);
    expect(sled.sled.log).toBe(1);
  });

  it("loads the log from the side of a woodpile beside the sled", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledInOpenGround(game);
    const woodpile = woodpileBeside(game, sled);
    const player = onlyPlayer(game);
    standAt(game, { x: woodpile.position.x, z: woodpile.position.z + 5 });

    shoulder(game, "log");
    sendAndSettle(game, { type: "loadSled", sledId: idOf(game, sled) });

    expect(distanceOutside(footprintOfEntity(sled), player.position)).toBeLessThanOrEqual(USE_REACH_METRES);
    expect(player.position.z).toBeGreaterThan(sled.position.z);
    expect(sled.sled.log).toBe(1);
  });

  it("does not walk when the player already stands within reach of the sled's edge", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledInOpenGround(game);
    const player = onlyPlayer(game);
    // 2.2 m from the sled's end, but 3.1 m from its middle.
    const spot = standAt(game, { x: sled.position.x + 3.1, z: sled.position.z });

    shoulder(game, "log");
    send(game, { type: "loadSled", sledId: idOf(game, sled) });

    expect(player.walkPath).toBeUndefined();
    expect(player.position).toMatchObject(spot);
    expect(sled.sled.log).toBe(1);
  });
});

describe("the sled's limit", () => {
  it("holds up to 6 logs and debarked logs in any mix, and keeps the seventh on the player's shoulder", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    const sledId = idOf(game, sled);

    for (const log of ["log", "debarkedLog", "log", "debarkedLog", "log", "log", "debarkedLog"] as const) {
      shoulder(game, log);
      sendAndSettle(game, { type: "loadSled", sledId });
    }

    expect(sled.sled).toEqual({ log: 4, debarkedLog: 2, plank: 0 });
    expect(game.client.getView().carrying).toBe("debarkedLog");
  });
});

describe("taking a log off a sled", () => {
  it("puts one log of the kind asked for on the player's free shoulder", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    sled.sled = { log: 2, debarkedLog: 1, plank: 0 };

    sendAndSettle(game, { type: "takeFromSled", sledId: idOf(game, sled), log: "debarkedLog" });
    expect(game.client.getView().carrying).toBe("debarkedLog");
    expect(sled.sled).toEqual({ log: 2, debarkedLog: 0, plank: 0 });

    // The shoulder is full now, so the next log stays on the sled.
    sendAndSettle(game, { type: "takeFromSled", sledId: idOf(game, sled), log: "log" });
    expect(sled.sled).toEqual({ log: 2, debarkedLog: 0, plank: 0 });

    send(game, { type: "dropLog" });
    sendAndSettle(game, { type: "takeFromSled", sledId: idOf(game, sled), log: "log" });
    expect(game.client.getView().carrying).toBe("log");
    expect(sled.sled).toEqual({ log: 1, debarkedLog: 0, plank: 0 });
  });

  it("takes nothing of a kind the sled does not hold", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    sled.sled = { log: 1, debarkedLog: 0, plank: 0 };

    sendAndSettle(game, { type: "takeFromSled", sledId: idOf(game, sled), log: "debarkedLog" });

    expect(game.client.getView().carrying).toBeNull();
    expect(sled.sled).toEqual({ log: 1, debarkedLog: 0, plank: 0 });
  });
});
