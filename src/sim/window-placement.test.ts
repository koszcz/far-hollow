import { describe, expect, it } from "bun:test";
import { createGame } from "./game";
import { findPath } from "./pathfinding";
import { SHUTTERS_BUILD_SECONDS, SHUTTERS_PLANK_COST } from "./structure-cabin-fittings";
import { WINDOW_BUILD_SECONDS, WINDOW_LOG_COST } from "./structure-cabin-shell";
import { structureOf } from "./structures";
import {
  finishedFoundationAt,
  finishedPieceAt,
  finishedWindow,
  finishShutters,
  idOf,
  lastBlueprint,
  onlyPlayer,
  openSquareNearPlayer,
  place,
  runSeconds,
  send,
  stepUntil,
} from "./window-test-helpers";
describe("the window and the shutters in the build menu", () => {
  it("lists the window after the door frame, for 3 debarked logs, 10 seconds, and no tool", () => {
    const menu = createGame({ seed: 42 }).client.getView().buildMenu;
    const frame = menu.findIndex(({ structure }) => structure === "doorFrame");

    expect(menu[frame + 1]).toEqual({ structure: "window", cost: [{ material: "debarkedLog", count: 3 }], placement: "onEdge" });
    expect(WINDOW_LOG_COST).toBe(3);
    expect(WINDOW_BUILD_SECONDS).toBe(10);
  });

  it("makes the shutters cost 2 planks and 4 seconds", () => {
    expect(structureOf("shutters").cost).toEqual([{ material: "plank", count: 2 }]);
    expect(SHUTTERS_PLANK_COST).toBe(2);
    expect(SHUTTERS_BUILD_SECONDS).toBe(4);
  });
});

describe("where a window can go", () => {
  it("snaps to an empty edge of a finished foundation, and R picks the edge, as a log wall does", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);

    const check = game.client.checkPlacement("window", { x: square.x + 0.1, z: square.z - 0.2 }, 1);

    expect(check.allowed).toBe(true);
    expect(check.turns).toBe(1);
    expect(check.spot).toMatchObject({ x: square.x - 0.5, z: square.z });
    expect(game.client.checkPlacement("window", { x: square.x + 3, z: square.z + 3 }, 0).allowed).toBe(false);
  });

  it("refuses an edge that holds a log wall, door frame, or window, finished or as a blueprint", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 3, z: square.z };
    finishedFoundationAt(game, square);
    finishedFoundationAt(game, beside);
    send(game, place("logWall", square, 0));
    finishedPieceAt(game, "window", square, 2);
    send(game, place("window", beside, 0));
    finishedPieceAt(game, "doorFrame", beside, 2);

    expect(game.client.checkPlacement("window", square, 0).allowed).toBe(false);
    expect(game.client.checkPlacement("window", square, 2).allowed).toBe(false);
    expect(game.client.checkPlacement("window", beside, 0).allowed).toBe(false);
    expect(game.client.checkPlacement("window", beside, 2).allowed).toBe(false);
    expect(game.client.checkPlacement("logWall", square, 2).allowed).toBe(false);
  });

  it("refuses to meet a wall, door frame, or window at a right angle at a corner, and says why", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    send(game, place("logWall", square, 1));

    const atCorner = game.client.checkPlacement("window", square, 0);
    expect(atCorner.allowed).toBe(false);
    expect(atCorner.refusal).toEqual({ kind: "atCorner" });
    expect(game.client.checkPlacement("window", square, 3)).toMatchObject({ allowed: true });
    expect(game.client.checkPlacement("window", square, 3).refusal).toBeUndefined();

    // Whichever goes first: a wall or a door frame refuses a window's corner too.
    send(game, place("window", square, 3));
    expect(game.client.checkPlacement("logWall", square, 0)).toMatchObject({ allowed: false, refusal: { kind: "atCorner" } });
    expect(game.client.checkPlacement("doorFrame", square, 2)).toMatchObject({ allowed: false, refusal: { kind: "atCorner" } });
  });

  it("goes in line with walls on either side", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const left = { x: square.x - 1, z: square.z };
    const right = { x: square.x + 1, z: square.z };
    for (const each of [left, square, right]) finishedFoundationAt(game, each);
    send(game, place("logWall", left, 0));
    send(game, place("window", right, 0));

    expect(game.client.checkPlacement("window", square, 0).allowed).toBe(true);
  });
});

describe("building a window", () => {
  it("spends 3 delivered debarked logs over 10 seconds and finishes on the edge", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);

    const window = finishedPieceAt(game, "window", square, 0);

    expect(window.edgePiece).toBe("window");
    expect(window.position).toMatchObject({ x: square.x, z: square.z + 0.5 });
  });

  it("blocks walking like a log wall once finished", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    const inside = square;
    const beyond = { x: square.x, z: square.z + 1 };
    const before = findPath(game.walkMap, inside, beyond);

    finishedPieceAt(game, "window", square, 0);

    expect(findPath(game.walkMap, inside, beyond).length).toBeGreaterThan(before.length);
    expect(game.walkMap.edgeBlockerCounts.some((count) => count > 0)).toBe(true);
  });
});

describe("where shutters can go", () => {
  it("snap to the nearest finished window with no shutters, taking its edge and facing", () => {
    const game = createGame({ seed: 42 });
    const window = finishedWindow(game);

    const check = game.client.checkPlacement("shutters", { x: window.position.x + 0.2, z: window.position.z - 0.3 }, 1);

    expect(check.allowed).toBe(true);
    expect(check.turns).toBe(0);
    expect(check.spot).toMatchObject({ x: window.position.x, z: window.position.z });
  });

  it("refuse a window blueprint, a door frame, a window with shutters, and open ground", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 3, z: square.z };
    finishedFoundationAt(game, square);
    finishedFoundationAt(game, beside);
    const window = finishedPieceAt(game, "window", square, 0);
    const frame = finishedPieceAt(game, "doorFrame", beside, 0);
    send(game, place("window", beside, 2));
    const windowBlueprint = lastBlueprint(game, "window");

    expect(game.client.checkPlacement("shutters", windowBlueprint.position, 2).allowed).toBe(false);
    expect(game.client.checkPlacement("shutters", frame.position, 0).allowed).toBe(false);
    expect(game.client.checkPlacement("shutters", { x: square.x + 3, z: square.z + 3 }, 0).allowed).toBe(false);

    send(game, place("shutters", window.position, 0));
    expect(game.client.checkPlacement("shutters", window.position, 0).allowed).toBe(false);
    finishShutters(game, lastBlueprint(game, "shutters"));
    expect(game.client.checkPlacement("shutters", window.position, 0).allowed).toBe(false);
  });
});

describe("building shutters", () => {
  it("takes 4 seconds with 2 planks, and starts closed", () => {
    const game = createGame({ seed: 42 });
    const window = finishedWindow(game);
    send(game, place("shutters", window.position, 0));
    const blueprint = lastBlueprint(game, "shutters");
    onlyPlayer(game).backpack.contents = { plank: SHUTTERS_PLANK_COST };

    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.client.getView().action?.kind === "build");
    runSeconds(game, SHUTTERS_BUILD_SECONDS - 0.5);
    expect(blueprint.blueprint).toBeDefined();
    runSeconds(game, 1);

    expect(blueprint.blueprint).toBeUndefined();
    expect(blueprint.shutters).toEqual({ open: false });
    expect(blueprint.facing).toEqual({ turns: 0 });
    expect(game.client.getView().backpack.plank ?? 0).toBe(0);
  });
});
