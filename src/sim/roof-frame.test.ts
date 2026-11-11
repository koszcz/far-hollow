import { describe, expect, it } from "vitest";
import type { Command } from "./api";
import type { Entity } from "./entities";
import { foundationDeckTop } from "./foundations";
import { createGame, type Game } from "./game";
import { DOOR_FRAME_LOG_COST, LOG_WALL_LOG_COST, ROOF_BARK_COST, ROOF_FRAME_LOG_COST, type QuarterTurns, type StructureKind } from "./structures";
import { isUnderRoof } from "./roofs";
import { readSave, ROOF_FRAMES_SAVE_VERSION, writeSave } from "./save";
import { isWalkable } from "./walk-map";

describe("the roof frame in the build menu", () => {
  it("lists the roof frame between the door frame and the roof, costing debarked logs, and the roof costing only bark", () => {
    const game = createGame({ seed: 42 });

    const menu = game.client.getView().buildMenu;
    const doorFrame = menu.findIndex(({ structure }) => structure === "doorFrame");
    expect(menu.slice(doorFrame + 1, doorFrame + 3)).toEqual([
      { structure: "roofFrame", cost: [{ material: "debarkedLog", count: ROOF_FRAME_LOG_COST }] },
      { structure: "roof", cost: [{ material: "bark", count: ROOF_BARK_COST }] },
    ]);
  });
});

describe("where a roof frame can go", () => {
  it("snaps to the foundation square under the mouse, at the height of its deck, and keeps the turn R gave it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const foundation = finishedFoundationAt(game, square);
    finishedPieceAt(game, "logWall", square, 0);

    const check = game.client.checkPlacement("roofFrame", { x: square.x + 0.3, z: square.z - 0.2 }, 3);

    expect(check).toMatchObject({ allowed: true, turns: 3, spot: { x: square.x, z: square.z } });
    expect(check.spot.y).toBeCloseTo(foundation.position.y, 5);
  });

  it("needs a finished foundation with at least one finished wall or door frame on its edges", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);

    expect(game.client.checkPlacement("roofFrame", square, 0).allowed).toBe(false);
    finishedFoundationAt(game, square);
    expect(game.client.checkPlacement("roofFrame", square, 0).allowed).toBe(false);
    // A wall that is still a blueprint is not enough.
    send(game, place("logWall", square, 2));
    expect(game.client.checkPlacement("roofFrame", square, 0).allowed).toBe(false);
    // A door frame is enough. It stands opposite the wall blueprint, since a door never meets a wall at a corner.
    finishedPieceAt(game, "doorFrame", square, 0);
    expect(game.client.checkPlacement("roofFrame", square, 0).allowed).toBe(true);
  });

  it("allows one frame on each square, finished or as a blueprint", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    finishedPieceAt(game, "logWall", square, 0);

    send(game, place("roofFrame", square, 0));
    expect(game.client.checkPlacement("roofFrame", square, 0).allowed).toBe(false);

    finishedFrameAt(game, { x: square.x, z: square.z }, 0, { placed: true });
    expect(game.client.checkPlacement("roofFrame", square, 0).allowed).toBe(false);
  });

  it("keeps clear of a debarked log lying on the deck", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const foundation = finishedFoundationAt(game, square);
    finishedPieceAt(game, "logWall", square, 0);
    game.entities.add({ debarkedLog: { heading: 0 }, position: { x: square.x + 0.2, y: foundation.position.y, z: square.z } });

    expect(game.client.checkPlacement("roofFrame", square, 0).allowed).toBe(false);
  });
});

describe("where a roof can go", () => {
  it("needs a finished roof frame on the same square", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    finishedPieceAt(game, "logWall", square, 0);
    expect(game.client.checkPlacement("roof", square, 0).allowed).toBe(false);

    send(game, place("roofFrame", square, 0));
    expect(game.client.checkPlacement("roof", square, 0).allowed).toBe(false);

    finishedFrameAt(game, square, 0, { placed: true });
    expect(game.client.checkPlacement("roof", square, 0).allowed).toBe(true);
  });

  it("takes the turn of the frame under it, whatever turn the player gives it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    finishedPieceAt(game, "logWall", square, 0);
    finishedFrameAt(game, square, 1);

    expect(game.client.checkPlacement("roof", square, 3).turns).toBe(1);
    send(game, place("roof", square, 3));

    expect(lastBlueprint(game, "roof").facing).toEqual({ turns: 1 });
  });

  it("allows one roof on each frame", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    finishedPieceAt(game, "logWall", square, 0);
    finishedFrameAt(game, square);

    send(game, place("roof", square, 0));

    expect(game.client.checkPlacement("roof", square, 0).allowed).toBe(false);
  });
});

describe("a finished roof frame", () => {
  it("is no roof overhead: only the roof laid on it keeps the rain off", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    finishedPieceAt(game, "logWall", square, 0);
    finishedFrameAt(game, square);
    expect(isUnderRoof(game.entities, square)).toBe(false);

    send(game, place("roof", square, 0));
    const roof = lastBlueprint(game, "roof");
    give(game, "bark", ROOF_BARK_COST);
    send(game, { type: "build", blueprintId: idOf(game, roof) });
    stepUntil(game, () => roof.blueprint === undefined);

    expect(isUnderRoof(game.entities, square)).toBe(true);
  });

  it("keeps its turn in a save", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    finishedPieceAt(game, "logWall", square, 0);
    finishedFrameAt(game, square, 2);

    const loaded = readSave(structuredClone(writeSave(game)));
    if (!loaded.ok) throw new Error("The save was rejected");

    const frame = loaded.game.entities.with("roofFrame", "position").first;
    expect(frame?.facing).toEqual({ turns: 2 });
    // The game rules store only the turn: no height or corner shape.
    expect(Object.keys(frame ?? {}).sort()).toEqual(["facing", "position", "roofFrame"]);
  });
});

describe("taking down a roof frame", () => {
  it("keeps a frame while a roof rests on it, even a roof blueprint", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    finishedPieceAt(game, "logWall", square, 0);
    const frame = finishedFrameAt(game, square);
    send(game, place("roof", square, 0));
    const roof = lastBlueprint(game, "roof");

    send(game, { type: "takeDown", pieceId: idOf(game, frame) });
    expect(game.client.getView().notice).toEqual({ kind: "holdsUpPiece" });
    expect(game.entities.has(frame)).toBe(true);

    send(game, { type: "takeDown", pieceId: idOf(game, roof) });
    stepUntil(game, () => !game.entities.has(roof));
    send(game, { type: "takeDown", pieceId: idOf(game, frame) });
    stepUntil(game, () => !game.entities.has(frame));
  });

  it("keeps a wall while a frame rests on it, even a frame blueprint", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    const wall = finishedPieceAt(game, "logWall", square, 2);
    send(game, place("roofFrame", square, 0));
    const frame = lastBlueprint(game, "roofFrame");

    send(game, { type: "takeDown", pieceId: idOf(game, wall) });
    expect(game.client.getView().notice).toEqual({ kind: "holdsUpPiece" });
    expect(game.entities.has(wall)).toBe(true);

    send(game, { type: "takeDown", pieceId: idOf(game, frame) });
    stepUntil(game, () => !game.entities.has(frame));
    send(game, { type: "takeDown", pieceId: idOf(game, wall) });
    stepUntil(game, () => !game.entities.has(wall));
  });

  it("keeps a foundation while a frame stands on it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const foundation = finishedFoundationAt(game, square);
    const wall = finishedPieceAt(game, "logWall", square, 2);
    finishedFrameAt(game, square);
    // Take the wall away behind the frame's back, so only the frame stands on the foundation.
    game.entities.remove(wall);

    send(game, { type: "takeDown", pieceId: idOf(game, foundation) });

    expect(game.client.getView().notice).toEqual({ kind: "holdsUpPiece" });
  });

  it("gives back the frame's debarked logs", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    finishedPieceAt(game, "logWall", square, 2);
    const frame = finishedFrameAt(game, square);
    const logsBefore = debarkedLogsOnGround(game);

    send(game, { type: "takeDown", pieceId: idOf(game, frame) });
    stepUntil(game, () => !game.entities.has(frame));

    expect(debarkedLogsOnGround(game)).toBe(logsBefore + ROOF_FRAME_LOG_COST);
  });
});

describe("loading a save from before roof frames", () => {
  /** A save as it was written before roof frames: a finished roof and a roof blueprint, each straight on the walls. */
  function oldSave() {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 1, z: square.z };
    for (const at of [square, beside]) {
      const foundation = finishedFoundationAt(game, at);
      finishedPieceAt(game, "logWall", at, 0);
      const roof = { min: { x: at.x - 0.5, z: at.z - 0.5 }, max: { x: at.x + 0.5, z: at.z + 0.5 } };
      if (at === square) game.entities.add({ cabinRoof: true, roof, facing: { turns: 3 }, position: { ...foundation.position } });
    }
    // Before frames, a roof blueprint took its three rafter logs first, then its bark. This one has all three logs and one strip of bark in.
    game.entities.add({
      blueprint: { structure: "roof", progress: 3.5 / 7, materialsSpent: 4, delivered: { debarkedLog: 3 } },
      facing: { turns: 1 },
      position: { x: beside.x, y: 0, z: beside.z },
    });
    const barkBefore = onlyPlayer(game).backpack.contents.bark ?? 0;
    return { save: { ...writeSave(game), version: ROOF_FRAMES_SAVE_VERSION - 1 }, square, beside, barkBefore };
  }

  it("gives every finished roof a finished frame under it, with the roof's turn", () => {
    const { save, square } = oldSave();

    const loaded = readSave(structuredClone(save));
    if (!loaded.ok) throw new Error("The save was rejected");

    const frames = loaded.game.entities.with("roofFrame", "position").entities;
    expect(frames).toHaveLength(1);
    expect(frames[0]?.position).toMatchObject({ x: square.x, z: square.z });
    expect(frames[0]?.facing).toEqual({ turns: 3 });
    expect(isUnderRoof(loaded.game.entities, square)).toBe(true);
  });

  it("turns every roof blueprint into a frame blueprint with the same turn, keeping its logs, and gives back any bark spent on it", () => {
    const { save, barkBefore } = oldSave();

    const loaded = readSave(structuredClone(save));
    if (!loaded.ok) throw new Error("The save was rejected");

    const blueprint = loaded.game.entities.with("blueprint", "position").entities.find(({ blueprint }) => blueprint.structure !== "logWall");
    expect(blueprint?.blueprint).toEqual({ structure: "roofFrame", progress: 3 / ROOF_FRAME_LOG_COST, materialsSpent: 3, delivered: { debarkedLog: 3 } });
    expect(blueprint?.facing).toEqual({ turns: 1 });
    expect(onlyPlayer(loaded.game).backpack.contents.bark).toBe(barkBefore + 1);
  });
});

/** Places a wall or door frame blueprint and builds it through to the end, delivering every debarked log it needs. */
function finishedPieceAt(game: Game, structure: "logWall" | "doorFrame", square: { x: number; z: number }, turns: QuarterTurns): Entity {
  send(game, place(structure, square, turns));
  const blueprint = game.entities.with("blueprint", "position").entities.at(-1);
  if (blueprint?.blueprint.structure !== structure) throw new Error("The blueprint was not placed");
  const cost = structure === "logWall" ? LOG_WALL_LOG_COST : DOOR_FRAME_LOG_COST;
  for (let i = 0; i < cost; i += 1) deliverLog(game, blueprint);
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  const built: Entity = blueprint;
  stepUntil(game, () => built.blueprint === undefined);
  return blueprint;
}

/**
 * Places a roof frame blueprint over a square, facing `turns`, and builds it through to the end.
 * With `placed`, the blueprint is already there.
 */
function finishedFrameAt(game: Game, square: { x: number; z: number }, turns: QuarterTurns = 0, { placed = false } = {}): Entity {
  if (!placed) send(game, place("roofFrame", square, turns));
  const blueprint = lastBlueprint(game, "roofFrame");
  for (let i = 0; i < ROOF_FRAME_LOG_COST; i += 1) deliverLog(game, blueprint);
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  const built: Entity = blueprint;
  stepUntil(game, () => built.blueprint === undefined);
  return blueprint;
}

function lastBlueprint(game: Game, structure: StructureKind): Entity & { position: NonNullable<Entity["position"]> } {
  const blueprint = game.entities.with("blueprint", "position").entities.at(-1);
  if (blueprint?.blueprint.structure !== structure) throw new Error(`No ${structure} blueprint was placed`);
  return blueprint;
}

function give(game: Game, content: "bark", count: number): void {
  const contents = onlyPlayer(game).backpack.contents;
  contents[content] = (contents[content] ?? 0) + count;
}

/** Puts a debarked log on the player's shoulder and carries it to a blueprint. */
function deliverLog(game: Game, blueprint: Entity): void {
  game.entities.addComponent(onlyPlayer(game), "carrying", "debarkedLog");
  send(game, { type: "deliverToBlueprint", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => game.client.getView().carrying === null);
}

function debarkedLogsOnGround(game: Game): number {
  return game.entities.with("debarkedLog", "position").entities.length;
}

/** Puts a finished foundation on a square, as if the player had built it. */
function finishedFoundationAt(game: Game, square: { x: number; z: number }) {
  const position = { x: square.x, y: foundationDeckTop(game.valley.terrain, square), z: square.z };
  return game.entities.add({ foundation: true, facing: { turns: 0 }, position });
}

/** The middle of a building-grid square a few metres from the player, with open ground two squares all round it. */
function openSquareNearPlayer(game: Game, from = 4): { x: number; z: number } {
  const player = onlyPlayer(game);
  for (let distance = from; distance < 30; distance += 1) {
    for (const [dx, dz] of [[1, 0], [0, 1], [0, -1], [-1, 0], [1, 1], [1, -1]] as const) {
      const square = { x: Math.floor(player.position.x + dx * distance) + 0.5, z: Math.floor(player.position.z + dz * distance) + 0.5 };
      const reach = [-2, -1, 0, 1, 2];
      const open = reach.every((ax) => reach.every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      if (open && game.client.checkPlacement("foundation", square, 0).allowed) return square;
    }
  }
  throw new Error("No open square");
}

function place(structure: StructureKind, at: { x: number; z: number }, turns: QuarterTurns): Command {
  return { type: "placeBlueprint", structure, turns, x: at.x, z: at.z };
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
