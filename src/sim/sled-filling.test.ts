import { describe, expect, it } from "bun:test";
import type { Command } from "./api-commands";
import type { Entity, SledLoad } from "./entities";
import { createGame, type Game } from "./game";
import type { GroundPoint } from "./ground-point";
import { FILL_SLED_METRES } from "./sled-filling";
import { addFinished, finishReach, onlyPlayer, stepUntil } from "./test-steps";
import { isWalkable } from "./walk-map";

describe("filling a sled with nearby logs", () => {
  it("fetches every log and debarked log within 10 m, one at a time, and puts each on the sled", () => {
    const { game, sled, at } = sledInTheOpen();
    const logs = [logAt(game, "log", at.x + 4, at.z), logAt(game, "debarkedLog", at.x - 3, at.z + 1), logAt(game, "log", at.x, at.z + 5)];

    fill(game, sled);

    expect(sledLoad(game, sled)).toEqual({ log: 2, debarkedLog: 1, plank: 0 });
    expect(logs.some((log) => game.entities.has(log))).toBe(false);
    expect(onlyPlayer(game).carrying).toBeUndefined();
    expect(onlyPlayer(game).fillSledTask).toBeUndefined();
  });

  it("fetches the nearest log first", () => {
    const { game, sled, at } = sledInTheOpen();
    const far = logAt(game, "log", at.x + 6, at.z);
    const near = logAt(game, "debarkedLog", at.x + 3, at.z);
    send(game, { type: "fillSled", sledId: sled });

    stepUntil(game, () => onlyPlayer(game).carrying !== undefined);
    expect(onlyPlayer(game).carrying).toBe("debarkedLog");
    expect(game.entities.has(near)).toBe(false);
    expect(game.entities.has(far)).toBe(true);
  });

  it("leaves logs further than 10 m from the sled where they lie", () => {
    const { game, sled, at } = sledInTheOpen();
    logAt(game, "log", at.x + 3, at.z);
    const tooFar = logAt(game, "log", at.x + FILL_SLED_METRES + 3, at.z);

    fill(game, sled);

    expect(sledLoad(game, sled).log).toBe(1);
    expect(game.entities.has(tooFar)).toBe(true);
  });

  it("stops once the sled is full, leaving the other logs on the ground", () => {
    const { game, sled, at } = sledInTheOpen();
    const logs = Array.from({ length: 8 }, (_, i) => logAt(game, "log", at.x + 2 + (i % 4), at.z + (i < 4 ? 2 : -2)));

    fill(game, sled);

    expect(sledLoad(game, sled).log).toBe(6);
    expect(logs.filter((log) => game.entities.has(log))).toHaveLength(2);
    expect(onlyPlayer(game).carrying).toBeUndefined();
  });

  it("puts the log on the player's shoulder on the sled first", () => {
    const { game, sled, at } = sledInTheOpen();
    game.entities.addComponent(onlyPlayer(game), "carrying", "debarkedLog");
    logAt(game, "log", at.x + 3, at.z);

    fill(game, sled);

    expect(sledLoad(game, sled)).toEqual({ log: 1, debarkedLog: 1, plank: 0 });
  });

  it("refuses with no log near the sled, with a full sled, and with a plank in the hands", () => {
    const { game, sled, at } = sledInTheOpen();
    const fillCommand: Command = { type: "fillSled", sledId: sled };
    expect(game.client.refusal(fillCommand)).toEqual({ kind: "noLogsNearSled" });

    logAt(game, "log", at.x + 3, at.z);
    expect(game.client.refusal(fillCommand)).toBeNull();

    game.entities.addComponent(onlyPlayer(game), "carrying", "plank");
    expect(game.client.refusal(fillCommand)).toEqual({ kind: "handsFull" });
    game.entities.removeComponent(onlyPlayer(game), "carrying");

    sledEntity(game, sled).sled = { log: 6, debarkedLog: 0, plank: 0 };
    expect(game.client.refusal(fillCommand)).toEqual({ kind: "sledFull" });
  });

  it("refuses while the player drags a sled", () => {
    const { game, sled, at } = sledInTheOpen();
    logAt(game, "log", at.x + 3, at.z);
    game.entities.addComponent(onlyPlayer(game), "dragging", { sledId: sled });

    expect(game.client.refusal({ type: "fillSled", sledId: sled })).toEqual({ kind: "letGoFirst" });
  });

  it("stops on a click on the ground, and the player keeps a log already on their shoulder", () => {
    const { game, sled, at } = sledInTheOpen();
    logAt(game, "log", at.x + 4, at.z);
    logAt(game, "log", at.x + 5, at.z);
    send(game, { type: "fillSled", sledId: sled });
    stepUntil(game, () => onlyPlayer(game).carrying !== undefined);

    send(game, { type: "walkTo", x: at.x - 2, z: at.z - 2 });
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);

    expect(onlyPlayer(game).fillSledTask).toBeUndefined();
    expect(onlyPlayer(game).carrying).toBe("log");
    expect(sledLoad(game, sled).log).toBe(0);
  });
});

/** A finished, empty sled on open ground near the player, with its id and where it stands. */
function sledInTheOpen(): { game: Game; sled: number; at: GroundPoint } {
  const game = createGame({ seed: 42 });
  const player = onlyPlayer(game);
  const clear = Array.from({ length: 2 * FILL_SLED_METRES + 1 }, (_, i) => i - FILL_SLED_METRES);
  for (let distance = 3; distance < 80; distance += 1) {
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
    ] as const) {
      const at = { x: Math.floor(player.position.x + dx * distance) + 0.5, z: Math.floor(player.position.z + dz * distance) + 0.5 };
      const open = clear.every((ax) => [-3, -2, -1, 0, 1, 2, 3].every((az) => isWalkable(game.walkMap, { x: at.x + ax, z: at.z + az })));
      if (!open || !game.client.checkPlacement("sled", at, 0).allowed) continue;
      // Clear the valley's own logs, so only the test's logs lie near the sled.
      for (const log of [...game.entities.with("log").entities, ...game.entities.with("debarkedLog").entities]) game.entities.remove(log);
      const { id } = addFinished(game, "sled", at, 0);
      return { game, sled: id, at };
    }
  }
  throw new Error("No open ground for a sled");
}

function logAt(game: Game, kind: "log" | "debarkedLog", x: number, z: number): Entity {
  const y = onlyPlayer(game).position.y;
  return game.entities.add({ [kind]: { heading: 0 }, position: { x, y, z } });
}

function sledEntity(game: Game, sledId: number): Entity & { sled: SledLoad } {
  const sled = game.entities.entity(sledId);
  if (sled?.sled === undefined) throw new Error("No sled");
  return sled as Entity & { sled: SledLoad };
}

function sledLoad(game: Game, sledId: number): SledLoad {
  return sledEntity(game, sledId).sled;
}

function fill(game: Game, sledId: number): void {
  send(game, { type: "fillSled", sledId });
  stepUntil(game, () => onlyPlayer(game).fillSledTask === undefined && onlyPlayer(game).handReach === undefined);
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
  finishReach(game);
}
