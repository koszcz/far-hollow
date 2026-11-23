import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import { edgeMiddle } from "./edge-pieces";
import type { Entity } from "./entities";
import { foundationDeckTop } from "./foundations";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import type { GroundPoint } from "./ground-point";
import { findPath } from "./pathfinding";
import type { QuarterTurns } from "./quarter-turns";
import { isUnderRoof } from "./roofs";
import { readSave, SAVE_VERSION, SNUG_ROOM_NOTICE_SAVE_VERSION, WINDOWS_SAVE_VERSION, writeSave } from "./save";
import {
  LOG_WALL_LOG_COST,
  SHUTTERS_BUILD_SECONDS,
  SHUTTERS_PLANK_COST,
  structureOf,
  WINDOW_BUILD_SECONDS,
  WINDOW_LOG_COST,
  type EdgePieceKind,
  type StructureKind,
} from "./structures";
import { isWalkable } from "./walk-map";
import { firelitWindows } from "./window-glow";

describe("the window and the shutters in the build menu", () => {
  it("lists the window after the door frame, for 3 debarked logs, 10 seconds, and no tool", () => {
    const menu = createGame({ seed: 42 }).client.getView().buildMenu;
    const frame = menu.findIndex(({ structure }) => structure === "doorFrame");

    expect(menu[frame + 1]).toEqual({ structure: "window", cost: [{ material: "debarkedLog", count: 3 }], placement: "onEdge" });
    expect(WINDOW_LOG_COST).toBe(3);
    expect(WINDOW_BUILD_SECONDS).toBe(10);
  });

  it("lists the shutters after the door, for 2 planks and 4 seconds", () => {
    const menu = createGame({ seed: 42 }).client.getView().buildMenu;
    const door = menu.findIndex(({ structure }) => structure === "door");

    expect(menu[door + 1]).toEqual({ structure: "shutters", cost: [{ material: "plank", count: 2 }], placement: "inWindow", fixedFacing: true });
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

describe("rooms with windows", () => {
  it("count a finished window as a closed side, and its shutters decide whether the room is snug", () => {
    const game = createGame({ seed: 42 });
    const [square] = cabinNearPlayer(game);
    expect(game.client.describeRooms()).toMatchObject([{ snug: false }]);

    const window = windowOf(game);
    const closed: { open: boolean } = { open: false };
    const shutters = game.entities.add({
      shutters: closed,
      facing: { ...(window.facing ?? { turns: 0 }) },
      position: { ...window.position },
    });
    expect(game.client.describeRooms()).toMatchObject([{ snug: true }]);

    shutters.shutters.open = true;
    expect(game.client.describeRooms()).toMatchObject([{ snug: false }]);
    shutters.shutters.open = false;
    expect(game.client.describeRooms()).toMatchObject([{ snug: true }]);
    expect(game.client.describeRooms()[0]?.squares).toContainEqual(square);
  });

  it("does not count a shutters blueprint", () => {
    const game = createGame({ seed: 42 });
    cabinNearPlayer(game);
    send(game, place("shutters", windowOf(game).position, 0));

    expect(game.client.describeRooms()).toMatchObject([{ snug: false }]);
  });

  it("keeps the rain out, whether the shutters are open or closed", () => {
    const game = createGame({ seed: 42 });
    const [square] = cabinNearPlayer(game);
    const window = windowOf(game);
    game.entities.add({ shutters: { open: true }, facing: { ...(window.facing ?? { turns: 0 }) }, position: { ...window.position } });

    expect(isUnderRoof(game.entities, square)).toBe(true);
  });

  it("lets a window hold up a roof frame, so it cannot come down", () => {
    const game = createGame({ seed: 42 });
    cabinNearPlayer(game);

    expect(game.client.refusal({ type: "takeDown", pieceId: idOf(game, windowOf(game)) })).toEqual({ kind: "holdsUpPiece" });
  });
});

describe("the window's night glow", () => {
  it("shows in an open window when a lit campfire, fireplace, or torch is in its room, facing away from the room", () => {
    for (const light of ["campfire", "fireplace", "plantedTorch", "handTorch"] as const) {
      const game = createGame({ seed: 42 });
      const [, second] = cabinNearPlayer(game);
      expect(firelitWindows(game.entities)).toEqual([]);

      lightIn(game, light, second);

      expect(firelitWindows(game.entities)).toEqual([{ window: windowOf(game), outward: 1 }]);
    }
  });

  it("shows in a window with open shutters, but not with closed ones", () => {
    const game = createGame({ seed: 42 });
    const [, second] = cabinNearPlayer(game);
    lightIn(game, "campfire", second);
    const window = windowOf(game);
    const shutters: { open: boolean } = { open: false };
    game.entities.add({ shutters, facing: { ...(window.facing ?? { turns: 0 }) }, position: { ...window.position } });
    expect(firelitWindows(game.entities)).toEqual([]);

    shutters.open = true;
    expect(firelitWindows(game.entities)).toHaveLength(1);
  });

  it("does not show with an unlit fire in the room, or a lit fire outside it", () => {
    const game = createGame({ seed: 42 });
    const [first, second] = cabinNearPlayer(game);
    game.entities.add({ campfire: { lit: false, fuelMinutes: 60 }, onFoundation: second, position: { x: second.x, y: deckTop(game, second), z: second.z } });
    const outside = { x: first.x - 2, z: first.z };
    game.entities.add({ campfire: { lit: true, fuelMinutes: 60 }, position: { x: outside.x, y: 0, z: outside.z } });
    game.entities.add({ plantedTorch: { minutesLeft: 60 }, position: { x: outside.x, y: 0, z: outside.z + 1 } });

    expect(firelitWindows(game.entities)).toEqual([]);
  });

  it("does not show in a window whose foundations are not a room", () => {
    const game = createGame({ seed: 42 });
    const [, second] = cabinNearPlayer(game);
    lightIn(game, "plantedTorch", second);
    const roof = game.entities.with("cabinRoof", "position").entities.find(({ position }) => position.x === second.x && position.z === second.z);
    if (roof === undefined) throw new Error("No roof");
    game.entities.remove(roof);

    expect(firelitWindows(game.entities)).toEqual([]);
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

  it("gives back a window's debarked logs", () => {
    const game = createGame({ seed: 42 });
    const window = finishedWindow(game);
    const logsBefore = game.entities.with("debarkedLog").entities.length;

    send(game, { type: "takeDown", pieceId: idOf(game, window) });
    stepUntil(game, () => !game.entities.has(window));

    expect(game.entities.with("debarkedLog").entities.length - logsBefore).toBe(WINDOW_LOG_COST);
  });
});

describe("saving windows and shutters", () => {
  it("restores a window with its edge and facing, and shutters with their state", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    const shut = finishedPieceAt(game, "window", square, 0);
    const open = finishedPieceAt(game, "window", square, 2);
    send(game, place("shutters", shut.position, 0));
    finishShutters(game, lastBlueprint(game, "shutters"));
    send(game, place("shutters", open.position, 0));
    const opened = lastBlueprint(game, "shutters");
    finishShutters(game, opened);
    send(game, { type: "setShutters", shuttersId: idOf(game, opened), open: true });
    stepUntil(game, () => opened.shutters?.open === true);

    const loaded = readSave(structuredClone(writeSave(game)));
    if (!loaded.ok) throw new Error("The save was rejected");

    const windows = loaded.game.entities.with("edgePiece", "position").entities.filter(({ edgePiece }) => edgePiece === "window");
    const byZ = (a: { z: number }, b: { z: number }) => a.z - b.z;
    expect(windows.map(({ facing, position }) => ({ turns: facing?.turns as number | undefined, x: position.x, z: position.z })).sort(byZ)).toEqual(
      [
        { turns: 0, x: shut.position.x, z: shut.position.z },
        { turns: 2, x: open.position.x, z: open.position.z },
      ].sort(byZ),
    );
    const shutters = loaded.game.entities.with("shutters", "position").entities;
    expect(shutters.map(({ shutters: { open: isOpen }, position }) => ({ open: isOpen, z: position.z })).sort(byZ)).toEqual(
      [
        { open: false, z: shut.position.z },
        { open: true, z: open.position.z },
      ].sort(byZ),
    );
  });

  it("saves a player on the way to open shutters", () => {
    const game = createGame({ seed: 42 });
    const shutters = finishedShutters(game);
    const player = onlyPlayer(game);
    player.position = { x: shutters.position.x + 8, y: player.position.y, z: shutters.position.z + 8 };
    send(game, { type: "setShutters", shuttersId: idOf(game, shutters), open: true });

    const loaded = readSave(structuredClone(writeSave(game)));

    expect(loaded.ok).toBe(true);
  });

  it("raises the save version, and loads a save from before windows", () => {
    const game = createGame({ seed: 42 });
    expect(WINDOWS_SAVE_VERSION).toBeGreaterThan(SNUG_ROOM_NOTICE_SAVE_VERSION);
    expect(WINDOWS_SAVE_VERSION).toBe(SAVE_VERSION);
    const old = { ...writeSave(game), version: WINDOWS_SAVE_VERSION - 1 };

    const loaded = readSave(structuredClone(old));

    if (!loaded.ok) throw new Error("The save was rejected");
    expect(loaded.game.entities.with("shutters").entities).toHaveLength(0);
  });
});

/** A finished window on the +z edge of a finished foundation near the player. */
function finishedWindow(game: Game): Entity & { position: NonNullable<Entity["position"]> } {
  const square = openSquareNearPlayer(game);
  finishedFoundationAt(game, square);
  return finishedPieceAt(game, "window", square, 0);
}

/** Finished, closed shutters in a finished window near the player. */
function finishedShutters(game: Game): Entity & { position: NonNullable<Entity["position"]>; shutters: { open: boolean } } {
  const window = finishedWindow(game);
  send(game, place("shutters", window.position, 0));
  const blueprint = lastBlueprint(game, "shutters");
  finishShutters(game, blueprint);
  const shutters = blueprint;
  if (shutters.shutters === undefined) throw new Error("The shutters were not finished");
  return shutters as Entity & { position: NonNullable<Entity["position"]>; shutters: { open: boolean } };
}

/** Gives the player the shutters' planks and builds a shutters blueprint to the end. */
function finishShutters(game: Game, blueprint: Entity): void {
  const contents = onlyPlayer(game).backpack.contents;
  contents.plank = (contents.plank ?? 0) + SHUTTERS_PLANK_COST;
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => blueprint.blueprint === undefined);
}

/** Puts a lit campfire, fireplace, or planted torch on `square`, or stands the player there holding a lit torch. */
function lightIn(game: Game, light: "campfire" | "fireplace" | "plantedTorch" | "handTorch", square: GroundPoint): void {
  const position = { x: square.x, y: deckTop(game, square), z: square.z };
  if (light === "campfire") game.entities.add({ campfire: { lit: true, fuelMinutes: 60 }, onFoundation: square, position });
  if (light === "fireplace") game.entities.add({ fireplace: { lit: true, fuelMinutes: 60 }, position });
  if (light === "plantedTorch") game.entities.add({ plantedTorch: { minutesLeft: 60 }, position: { ...position, x: square.x + 0.2 } });
  if (light === "handTorch") {
    const player = onlyPlayer(game);
    Object.assign(player.position, position);
    game.entities.addComponent(player, "litTorch", { minutesLeft: 60 });
  }
}

/** The one finished window. */
function windowOf(game: Game): Entity & { position: NonNullable<Entity["position"]> } {
  const window = game.entities.with("edgePiece", "position").entities.find(({ edgePiece }) => edgePiece === "window");
  if (window === undefined) throw new Error("No window");
  return window;
}

/**
 * Builds a finished room of two foundation squares in a row along +x near the player, with a floor on each square,
 * log walls all round except a window on the first square's outer end, a roof frame and roof on every square, and no door frame.
 * Returns the squares' middles.
 */
function cabinNearPlayer(game: Game): [GroundPoint, GroundPoint] {
  const start = openSquareNearPlayer(game);
  const squares: [GroundPoint, GroundPoint] = [start, { x: start.x + 1, z: start.z }];
  for (const square of squares) finishedFoundationAt(game, square);
  const [first, second] = squares;
  for (const side of [0, 2] as const) {
    finishedEdge(game, "logWall", first, side);
    finishedEdge(game, "logWall", second, side);
  }
  finishedEdge(game, "window", first, 1);
  finishedEdge(game, "logWall", second, 3);
  for (const square of squares) {
    for (const kind of ["roofFrame", "roof"] as const) {
      game.entities.add({
        ...structureOf(kind).finish(square, 0, game.entities),
        facing: { turns: 0 },
        position: { x: square.x, y: deckTop(game, square), z: square.z },
      });
    }
    game.entities.add({ floor: true, position: { x: square.x, y: deckTop(game, square), z: square.z } });
  }
  return squares;
}

function finishedEdge(game: Game, kind: EdgePieceKind, square: GroundPoint, side: QuarterTurns): Entity {
  const edge = edgeMiddle(square, side);
  return game.entities.add({
    ...structureOf(kind).finish(edge, side, game.entities),
    facing: { turns: side },
    position: { x: edge.x, y: deckTop(game, square), z: edge.z },
  });
}

function deckTop(game: Game, square: GroundPoint): number {
  return foundationDeckTop(game.valley.terrain, square);
}

/** Places a wall, door frame, or window blueprint and builds it through to the end, delivering every debarked log it needs. */
function finishedPieceAt(
  game: Game,
  structure: EdgePieceKind,
  square: GroundPoint,
  turns: QuarterTurns,
): Entity & { position: NonNullable<Entity["position"]> } {
  send(game, place(structure, square, turns));
  const blueprint = lastBlueprint(game, structure);
  const logs = structure === "logWall" ? LOG_WALL_LOG_COST : WINDOW_LOG_COST;
  for (let i = 0; i < logs; i += 1) {
    game.entities.addComponent(onlyPlayer(game), "carrying", "debarkedLog");
    send(game, { type: "deliverToBlueprint", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.client.getView().carrying === null);
  }
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  const built: Entity = blueprint;
  stepUntil(game, () => built.blueprint === undefined);
  return blueprint;
}

/** Puts a finished foundation on a square, as if the player had built it. */
function finishedFoundationAt(game: Game, square: GroundPoint) {
  const position = { x: square.x, y: foundationDeckTop(game.valley.terrain, square), z: square.z };
  return game.entities.add({ foundation: true, facing: { turns: 0 }, position });
}

/** The middle of a building-grid square a few metres from the player, with open ground three squares all round it. */
function openSquareNearPlayer(game: Game, from = 4): GroundPoint {
  const player = onlyPlayer(game);
  for (let distance = from; distance < 30; distance += 1) {
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
      [1, 1],
      [1, -1],
    ] as const) {
      const square = { x: Math.floor(player.position.x + dx * distance) + 0.5, z: Math.floor(player.position.z + dz * distance) + 0.5 };
      const reach = [-3, -2, -1, 0, 1, 2, 3, 4];
      const open = reach.every((ax) => reach.every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      if (open && game.client.checkPlacement("foundation", square, 0).allowed) return square;
    }
  }
  throw new Error("No open square");
}

function place(structure: StructureKind, at: GroundPoint, turns: QuarterTurns): Command {
  return { type: "placeBlueprint", structure, turns, x: at.x, z: at.z };
}

function lastBlueprint(game: Game, structure: StructureKind): Entity & { position: NonNullable<Entity["position"]> } {
  const blueprint = game.entities
    .with("blueprint", "position")
    .entities.filter((entity) => entity.blueprint.structure === structure)
    .at(-1);
  if (blueprint === undefined) throw new Error(`No ${structure} blueprint`);
  return blueprint;
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
}

function stepUntil(game: Game, done: () => boolean, maxSteps = 100_000): void {
  for (let i = 0; i < maxSteps; i += 1) {
    if (done()) return;
    game.step();
  }
  throw new Error("Never happened");
}

function runSeconds(game: Game, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * STEPS_PER_SECOND); i += 1) game.step();
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position", "backpack", "needs").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
