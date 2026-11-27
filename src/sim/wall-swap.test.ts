import { describe, expect, it } from "bun:test";
import type { Command } from "./api-commands";
import { edgeMiddle } from "./edge-pieces";
import { debarkedLogEntities, edgePieceEntities, type Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import type { GroundPoint } from "./ground-point";
import type { QuarterTurns } from "./quarter-turns";
import { roomAround } from "./rooms";
import { readSave, writeSave } from "./save";
import { SAVE_VERSION } from "./save-upgrades";
import { CHIMNEYS_SAVE_VERSION, WALL_SWAPS_SAVE_VERSION } from "./save-versions";
import { costOf } from "./structures";
import { WINDOW_BUILD_SECONDS } from "./structure-cabin-shell";
import { type EdgePieceKind, type StructureKind } from "./structure-kind";
import { addFinished, onlyPlayer, openFoundation, stepUntil } from "./test-steps";
import { canStep, cellIndexAt } from "./walk-map";

describe("placing a swap", () => {
  it("places a window or door frame blueprint on a finished log wall, and the wall stays", () => {
    for (const kind of ["window", "doorFrame"] as const) {
      const game = createGame({ seed: 42 });
      const cabin = cabinNearPlayer(game);

      expect(game.client.checkPlacement(kind, cabin.middle, 0)).toMatchObject({ allowed: true, turns: 0 });
      send(game, place(kind, cabin.middle, 0));

      const swap = swapOf(game);
      expect(swap.blueprint?.structure).toBe(kind);
      expect(swap.position).toMatchObject(cabin.swapEdge);
      expect(wallAt(game, cabin.swapEdge)).toBeDefined();
      expect(game.client.describeBlueprint(idOf(game, swap))?.deliveries).toEqual([]);
    }
  });

  it("refuses a swap at a corner, and says why", () => {
    const game = createGame({ seed: 42 });
    const cabin = cabinNearPlayer(game);

    const atCorner = game.client.checkPlacement("window", cabin.first, 0);

    expect(atCorner.allowed).toBe(false);
    expect(atCorner.refusal).toEqual({ kind: "atCorner" });
    expect(game.client.checkPlacement("doorFrame", cabin.first, 0).refusal).toEqual({ kind: "atCorner" });
  });

  it("goes only on a finished log wall, not on a wall blueprint, a window, a door frame, or a wall with a swap on it", () => {
    const game = createGame({ seed: 42 });
    const first = openFoundation(game);
    const [wallPlan, window, doorFrame, swapped] = [-2, -1, 1, 2].map((step) => ({ x: first.x + step, z: first.z })) as [
      GroundPoint,
      GroundPoint,
      GroundPoint,
      GroundPoint,
    ];
    for (const square of [wallPlan, window, doorFrame, swapped]) addFoundation(game, square);
    send(game, place("logWall", wallPlan, 0));
    addFinished(game, "window", window, 0);
    addFinished(game, "doorFrame", doorFrame, 0);
    addFinished(game, "logWall", swapped, 0);
    send(game, place("window", swapped, 0));

    for (const square of [wallPlan, window, doorFrame, swapped]) {
      expect(game.client.checkPlacement("window", square, 0).allowed).toBe(false);
      expect(game.client.checkPlacement("doorFrame", square, 0).allowed).toBe(false);
    }
  });

  it("does not let a log wall swap for another log wall", () => {
    const game = createGame({ seed: 42 });
    const cabin = cabinNearPlayer(game);

    expect(game.client.checkPlacement("logWall", cabin.middle, 0).allowed).toBe(false);
  });

  it("goes under a finished roof frame, roof section, and chimney, which all stay up", () => {
    const game = createGame({ seed: 42 });
    const cabin = cabinNearPlayer(game);
    expect(game.entities.with("chimney").entities).toHaveLength(1);

    send(game, place("window", cabin.middle, 0));
    buildToTheEnd(game);

    expect(game.entities.with("roofFrame").entities).toHaveLength(3);
    expect(game.entities.with("cabinRoof").entities).toHaveLength(3);
    expect(game.entities.with("chimney").entities).toHaveLength(1);
    expect(pieceAt(game, cabin.swapEdge)?.edgePiece).toBe("window");
  });
});

describe("building a swap", () => {
  it("takes the new piece's 10 seconds and fetches nothing", () => {
    const game = createGame({ seed: 42 });
    const cabin = cabinNearPlayer(game);
    send(game, place("window", cabin.middle, 0));
    const swap = swapOf(game);

    send(game, { type: "build", blueprintId: idOf(game, swap) });
    stepUntil(game, () => (swap.blueprint?.progress ?? 1) > 0);
    runSeconds(game, WINDOW_BUILD_SECONDS - 0.5);
    expect(swap.blueprint?.progress).toBeLessThan(1);
    runSeconds(game, 1);

    expect(swap.blueprint).toBeUndefined();
    expect(onlyPlayer(game).carrying).toBeUndefined();
  });

  it("keeps the wall whole until the swap finishes: it blocks walking, closes the room, and holds up the roof frame", () => {
    const game = createGame({ seed: 42 });
    const cabin = cabinNearPlayer(game);
    send(game, place("doorFrame", cabin.middle, 0));
    const swap = swapOf(game);
    const wall = wallAt(game, cabin.swapEdge);
    if (wall === undefined) throw new Error("No wall");

    send(game, { type: "build", blueprintId: idOf(game, swap) });
    stepUntil(game, () => (swap.blueprint?.progress ?? 1) > 0.5);

    expect(canWalkAcross(game, cabin.middle, 0)).toBe(false);
    expect(roomAround(game.entities, cabin.middle)).toBeDefined();
    expect(game.client.refusal({ type: "takeDown", pieceId: idOf(game, wall) })).toEqual({ kind: "holdsUpPiece" });

    stepUntil(game, () => swap.blueprint === undefined);

    expect(wallAt(game, cabin.swapEdge)).toBeUndefined();
    expect(pieceAt(game, cabin.swapEdge)?.edgePiece).toBe("doorFrame");
    expect(canWalkAcross(game, cabin.middle, 0)).toBe(true);
  });

  it("turns the wall into a window that works like any other, and lays the spare log on the player's side of it", () => {
    const game = createGame({ seed: 42 });
    const cabin = cabinNearPlayer(game);
    const logsBefore = debarkedLogEntities(game.entities).entities.length;
    send(game, place("window", cabin.middle, 0));

    buildToTheEnd(game);

    const window = pieceAt(game, cabin.swapEdge);
    expect(window?.edgePiece).toBe("window");
    expect(window?.swapsWall).toBeUndefined();
    expect(edgePieceEntities(game.entities).entities.filter((piece) => piece.edgePiece === "logWall")).toHaveLength(7);
    expect(canWalkAcross(game, cabin.middle, 0)).toBe(false);
    expect(roomAround(game.entities, cabin.middle)).toBeDefined();
    const logs = debarkedLogEntities(game.entities).entities;
    expect(logs).toHaveLength(logsBefore + 1);
    const spare = logs.at(-1);
    if (spare === undefined) throw new Error("No spare log");
    const playerSide = Math.sign(onlyPlayer(game).position.z - cabin.swapEdge.z);
    expect(Math.sign(spare.position.z - cabin.swapEdge.z)).toBe(playerSide);
    expect(Math.hypot(spare.position.x - onlyPlayer(game).position.x, spare.position.z - onlyPlayer(game).position.z)).toBeLessThan(2);
    // It is a window like any other: it costs a window's 3 logs, which taking it down gives back, and it takes shutters.
    if (window === undefined) throw new Error("No window");
    expect(costOf(window, "window")).toEqual([{ material: "debarkedLog", count: 3 }]);
    expect(game.client.checkPlacement("shutters", cabin.swapEdge, 0).allowed).toBe(true);
  });

  it("can stop partway and carry on later", () => {
    const game = createGame({ seed: 42 });
    const cabin = cabinNearPlayer(game);
    send(game, place("window", cabin.middle, 0));
    const swap = swapOf(game);

    send(game, { type: "build", blueprintId: idOf(game, swap) });
    stepUntil(game, () => (swap.blueprint?.progress ?? 1) > 0.3);
    send(game, { type: "stopBuilding" });
    const kept = swap.blueprint?.progress ?? 0;
    runSeconds(game, 3);

    expect(swap.blueprint?.progress).toBe(kept);
    expect(wallAt(game, cabin.swapEdge)).toBeDefined();

    send(game, { type: "build", blueprintId: idOf(game, swap) });
    stepUntil(game, () => swap.blueprint === undefined);
    expect(pieceAt(game, cabin.swapEdge)?.edgePiece).toBe("window");
  });

  it("finishes the moment it is placed in the instant playground", () => {
    const game = createGame({ seed: 42, instantBuilding: true });
    const cabin = cabinNearPlayer(game, (_game, structure, at, turns) => {
      send(game, place(structure, at, turns));
    });
    const logsBefore = debarkedLogEntities(game.entities).entities.length;

    send(game, place("window", cabin.middle, 0));

    expect(game.entities.with("blueprint").entities).toHaveLength(0);
    expect(wallAt(game, cabin.swapEdge)).toBeUndefined();
    expect(pieceAt(game, cabin.swapEdge)?.edgePiece).toBe("window");
    expect(debarkedLogEntities(game.entities).entities).toHaveLength(logsBefore + 1);
  });
});

describe("taking down around a swap", () => {
  it("takes the swap blueprint down at once and leaves the wall as it was, with nothing lost", () => {
    const game = createGame({ seed: 42 });
    const cabin = cabinNearPlayer(game);
    const logsBefore = debarkedLogEntities(game.entities).entities.length;
    send(game, place("window", cabin.middle, 0));
    const swap = swapOf(game);
    const wall = wallAt(game, cabin.swapEdge);
    if (wall === undefined) throw new Error("No wall");

    expect(game.client.refusal({ type: "takeDown", pieceId: idOf(game, wall) })).toEqual({ kind: "holdsUpPiece" });

    send(game, { type: "takeDown", pieceId: idOf(game, swap) });
    stepUntil(game, () => game.entities.with("blueprint").first === undefined);

    expect(wallAt(game, cabin.swapEdge)).toBe(wall);
    expect(debarkedLogEntities(game.entities).entities).toHaveLength(logsBefore);
    expect(game.client.checkPlacement("window", cabin.middle, 0).allowed).toBe(true);
  });
});

describe("saving a swap", () => {
  it("saves a swap blueprint with its progress", () => {
    const game = createGame({ seed: 42 });
    const cabin = cabinNearPlayer(game);
    send(game, place("window", cabin.middle, 0));
    const swap = swapOf(game);
    send(game, { type: "build", blueprintId: idOf(game, swap) });
    stepUntil(game, () => (swap.blueprint?.progress ?? 1) > 0.4);
    send(game, { type: "stopBuilding" });
    const progress = swap.blueprint?.progress;

    const loaded = readSave(structuredClone(writeSave(game)));
    if (!loaded.ok) throw new Error("The save was rejected");

    const saved = swapOf(loaded.game);
    expect(saved.blueprint?.progress).toBe(progress);
    expect(wallAt(loaded.game, cabin.swapEdge)).toBeDefined();
    send(loaded.game, { type: "build", blueprintId: idOf(loaded.game, saved) });
    stepUntil(loaded.game, () => saved.blueprint === undefined);
    expect(pieceAt(loaded.game, cabin.swapEdge)?.edgePiece).toBe("window");
  });

  it("raises the save version, and loads an older save with no swap", () => {
    const game = createGame({ seed: 42 });
    const cabin = cabinNearPlayer(game);
    expect(WALL_SWAPS_SAVE_VERSION).toBeGreaterThan(CHIMNEYS_SAVE_VERSION);
    expect(WALL_SWAPS_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);

    const loaded = readSave(structuredClone({ ...writeSave(game), version: WALL_SWAPS_SAVE_VERSION - 1 }));
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(wallAt(loaded.game, cabin.swapEdge)).toBeDefined();
    expect(loaded.game.client.checkPlacement("window", cabin.middle, 0).allowed).toBe(true);
  });
});

/** Puts a finished piece on the building grid. */
type Put = (game: Game, structure: StructureKind, at: GroundPoint, turns: QuarterTurns) => unknown;

/**
 * Builds a finished cabin of three foundation squares in a row along +x near the player: log walls all round, a fireplace with
 * a chimney on the middle square, and a roof frame and roof section on every square.
 * `swapEdge` is the middle of the middle square's +z wall, the only wall on that side that meets no other at a corner.
 */
function cabinNearPlayer(game: Game, put: Put = addFinished): { first: GroundPoint; middle: GroundPoint; swapEdge: GroundPoint } {
  const first = openFoundation(game);
  const middle = { x: first.x + 1, z: first.z };
  const last = { x: first.x + 2, z: first.z };
  put(game, "foundation", middle, 0);
  put(game, "foundation", last, 0);
  for (const square of [first, middle, last]) for (const side of [0, 2] as const) put(game, "logWall", square, side);
  put(game, "logWall", first, 1);
  put(game, "logWall", last, 3);
  put(game, "fireplace", middle, 2);
  put(game, "chimney", middle, 2);
  for (const square of [first, middle, last]) {
    put(game, "roofFrame", square, 0);
    put(game, "roof", square, 0);
  }
  return { first, middle, swapEdge: edgeMiddle(middle, 0) };
}

/** Adds a finished foundation on a square next to one placed already. */
function addFoundation(game: Game, square: GroundPoint): void {
  addFinished(game, "foundation", square, 0);
}

/** Has the player build the only swap blueprint through to the end. */
function buildToTheEnd(game: Game): void {
  const swap = swapOf(game);
  send(game, { type: "build", blueprintId: idOf(game, swap) });
  stepUntil(game, () => swap.blueprint === undefined);
}

function swapOf(game: Game): Entity & { position: GroundPoint } {
  const swap = game.entities.with("swapsWall", "blueprint", "position").first;
  if (swap === undefined) throw new Error("No swap blueprint");
  return swap;
}

function pieceAt(game: Game, edge: GroundPoint): Entity | undefined {
  return edgePieceEntities(game.entities).entities.find((piece) => Math.hypot(piece.position.x - edge.x, piece.position.z - edge.z) < 1e-6);
}

function wallAt(game: Game, edge: GroundPoint): Entity | undefined {
  const piece = pieceAt(game, edge);
  return piece?.edgePiece === ("logWall" satisfies EdgePieceKind) ? piece : undefined;
}

/** Whether the player can step from a square across its `side` edge to the square beyond. */
function canWalkAcross(game: Game, square: GroundPoint, side: QuarterTurns): boolean {
  const edge = edgeMiddle(square, side);
  const beyond = { x: 2 * edge.x - square.x, z: 2 * edge.z - square.z };
  const from = cellIndexAt(game.walkMap, square);
  const to = cellIndexAt(game.walkMap, beyond);
  if (from === undefined || to === undefined) throw new Error("Off the map");
  return canStep(game.walkMap, from, to);
}

function place(structure: StructureKind, at: GroundPoint, turns: QuarterTurns): Command {
  return { type: "placeBlueprint", structure, turns, x: at.x, z: at.z };
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
}

function runSeconds(game: Game, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * STEPS_PER_SECOND); i += 1) game.step();
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
