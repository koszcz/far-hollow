import { describe, expect, it } from "bun:test";
import type { Command } from "./api-commands";
import { createGame } from "./game";
import { SHUTTERS_PLANK_COST } from "./structure-cabin-fittings";
import { WINDOW_LOG_COST } from "./structure-cabin-shell";
import { structureOf } from "./structures";
import {
  finishedShutters,
  finishedWindow,
  finishShutters,
  idOf,
  lastBlueprint,
  onlyPlayer,
  place,
  runSeconds,
  send,
  stepUntil,
  windowOf,
} from "./window-test-helpers";
describe("opening and closing shutters", () => {
  it("opens and closes them when the player asks, after walking within reach", () => {
    const game = createGame({ seed: 42 });
    const shutters = finishedShutters(game);
    const id = idOf(game, shutters);
    const player = onlyPlayer(game);
    player.position = { x: shutters.position.x + 8, y: player.position.y, z: shutters.position.z + 8 };
    player.previousPosition = { ...player.position };

    send(game, { type: "setShutters", shuttersId: id, open: true });
    expect(shutters.shutters).toEqual({ open: false });
    stepUntil(game, () => shutters.shutters.open);
    expect(Math.hypot(player.position.x - shutters.position.x, player.position.z - shutters.position.z)).toBeLessThan(3);
    expect(game.client.describeThing(id)).toEqual({ kind: "structure", structure: "shutters", open: true });

    send(game, { type: "setShutters", shuttersId: id, open: false });
    stepUntil(game, () => !shutters.shutters.open);
    expect(game.client.getView().action).toBeNull();
  });

  it("stay as they are while time passes: nothing else opens or closes them", () => {
    const game = createGame({ seed: 42 });
    const shutters = finishedShutters(game);
    send(game, { type: "setShutters", shuttersId: idOf(game, shutters), open: true });
    stepUntil(game, () => shutters.shutters.open);

    game.client.send({ type: "skipTime", hours: 30 });
    runSeconds(game, 5);

    expect(shutters.shutters).toEqual({ open: true });
  });

  it("are refused once the shutters are gone", () => {
    const game = createGame({ seed: 42 });
    const shutters = finishedShutters(game);
    const id = idOf(game, shutters);
    game.entities.remove(shutters);

    expect(game.client.refusal({ type: "setShutters", shuttersId: id, open: true })).toEqual({ kind: "gone" });
  });

  it("are in reach of E, which names the shutters", () => {
    const game = createGame({ seed: 42 });
    const shutters = finishedShutters(game);
    const player = onlyPlayer(game);
    player.position = { x: shutters.position.x, y: shutters.position.y, z: shutters.position.z - 1.2 };
    // Nothing else in reach: the window itself is no thing for E.
    for (const lying of game.entities.with("debarkedLog").entities) game.entities.remove(lying);

    expect(game.client.nearestInReach()).toEqual({ kind: "shutters", id: idOf(game, shutters) });
  });

  it("never change where the player can walk, open or closed", () => {
    const game = createGame({ seed: 42 });
    const window = finishedWindow(game);
    const before = { cells: [...game.walkMap.blockerCounts], edges: [...game.walkMap.edgeBlockerCounts] };
    send(game, place("shutters", window.position, 0));
    const shutters = lastBlueprint(game, "shutters");
    finishShutters(game, shutters);
    expect([...game.walkMap.blockerCounts]).toEqual(before.cells);
    expect([...game.walkMap.edgeBlockerCounts]).toEqual(before.edges);

    send(game, { type: "setShutters", shuttersId: idOf(game, shutters), open: true });
    stepUntil(game, () => shutters.shutters?.open === true);

    expect([...game.walkMap.blockerCounts]).toEqual(before.cells);
    expect([...game.walkMap.edgeBlockerCounts]).toEqual(before.edges);
  });
});

describe("taking down windows and shutters", () => {
  it("takes down shutters on their own, open or closed, giving back their planks", () => {
    const game = createGame({ seed: 42 });
    const shutters = finishedShutters(game);
    const window = windowOf(game);
    send(game, { type: "setShutters", shuttersId: idOf(game, shutters), open: true });
    stepUntil(game, () => shutters.shutters.open);
    onlyPlayer(game).backpack.contents = {};

    send(game, { type: "takeDown", pieceId: idOf(game, shutters) });
    stepUntil(game, () => !game.entities.has(shutters));

    expect(game.client.getView().backpack.plank).toBe(SHUTTERS_PLANK_COST);
    expect(game.entities.has(window)).toBe(true);
  });

  it("refuses to take down a window with shutters, finished or as a blueprint, saying to take the shutters down first", () => {
    const game = createGame({ seed: 42 });
    const window = finishedWindow(game);
    const takeDownWindow: Command = { type: "takeDown", pieceId: idOf(game, window) };
    send(game, place("shutters", window.position, 0));
    const shutters = lastBlueprint(game, "shutters");
    expect(game.client.refusal(takeDownWindow)).toEqual({ kind: "takeShuttersDownFirst" });

    finishShutters(game, shutters);
    expect(game.client.refusal(takeDownWindow)).toEqual({ kind: "takeShuttersDownFirst" });

    send(game, { type: "takeDown", pieceId: idOf(game, shutters) });
    stepUntil(game, () => !game.entities.has(shutters));
    expect(game.client.refusal(takeDownWindow)).toBeNull();
  });

  it("says to take the shutters down first when shutters go up while the player takes the window down", () => {
    const game = createGame({ seed: 42 });
    const window = finishedWindow(game);
    send(game, { type: "takeDown", pieceId: idOf(game, window) });
    stepUntil(game, () => onlyPlayer(game).takeDownTask !== undefined);
    game.entities.add({
      ...structureOf("shutters").finish(window.position, window.facing?.turns ?? 0, game.entities),
      facing: { turns: window.facing?.turns ?? 0 },
      position: { ...window.position },
    });

    stepUntil(game, () => onlyPlayer(game).takeDownTask === undefined);

    expect(game.entities.has(window)).toBe(true);
    expect(game.client.getView().notice).toEqual({ kind: "refused", refusal: { kind: "takeShuttersDownFirst" } });
  });

  it("gives back a window's debarked logs", () => {
    const game = createGame({ seed: 42 });
    const window = finishedWindow(game);
    const logsBefore = game.entities.with("debarkedLog").entities.length;

    send(game, { type: "takeDown", pieceId: idOf(game, window) });
    stepUntil(game, () => !game.entities.has(window));

    expect(game.entities.with("debarkedLog").entities.length - logsBefore).toBe(WINDOW_LOG_COST);
  });
});
