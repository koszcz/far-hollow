import { describe, expect, it } from "bun:test";
import type { Command } from "./api-commands";
import type { Entity } from "./entities";
import { foundationDeckTop } from "./foundations";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { isDoorOpen } from "./doors";
import { findPath } from "./pathfinding";
import { type QuarterTurns } from "./quarter-turns";
import { DOORS_SAVE_VERSION, FLOORS_SAVE_VERSION, readSave, SAVE_VERSION, writeSave } from "./save";
import { DOOR_BUILD_SECONDS, DOOR_FRAME_LOG_COST, DOOR_PLANK_COST, LOG_WALL_LOG_COST, structureOf, type StructureKind } from "./structures";
import { isWalkable } from "./walk-map";

describe("the door's cost", () => {
  it("costs 3 planks and no tool", () => {
    expect(DOOR_PLANK_COST).toBe(3);
    expect(structureOf("door").cost).toEqual([{ material: "plank", count: 3 }]);
    expect(structureOf("door").tool).toBeUndefined();
  });
});

describe("where a door can go", () => {
  it("snaps to the finished door frame near the mouse, taking its edge, facing, and height", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    const frame = finishedPieceAt(game, "doorFrame", square, 1);

    // R asks for another turn, but the door takes the frame's.
    const check = game.client.checkPlacement("door", { x: frame.position.x + 0.2, z: frame.position.z - 0.3 }, 0);

    expect(check.allowed).toBe(true);
    expect(check.turns).toBe(1);
    expect(check.spot).toMatchObject({ x: frame.position.x, z: frame.position.z });
    expect(check.spot.y).toBeCloseTo(frame.position.y, 5);
  });

  it("refuses a door frame blueprint, a log wall, and open ground", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    send(game, place("doorFrame", square, 0));
    const frameBlueprint = lastBlueprint(game, "doorFrame");
    const wall = finishedPieceAt(game, "logWall", square, 2);

    expect(game.client.checkPlacement("door", frameBlueprint.position, 0).allowed).toBe(false);
    expect(game.client.checkPlacement("door", wall.position, 2).allowed).toBe(false);
    expect(game.client.checkPlacement("door", { x: square.x + 3, z: square.z + 3 }, 0).allowed).toBe(false);
  });

  it("refuses a door frame that already has a door, finished or as a blueprint", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    const frame = finishedPieceAt(game, "doorFrame", square, 0);

    send(game, place("door", frame.position, 0));
    expect(lastBlueprint(game, "door").position).toMatchObject({ x: frame.position.x, z: frame.position.z });
    expect(game.client.checkPlacement("door", frame.position, 0).allowed).toBe(false);

    finish(game, lastBlueprint(game, "door"));
    expect(game.client.checkPlacement("door", frame.position, 0).allowed).toBe(false);
  });
});

describe("building a door", () => {
  it("takes 6 seconds of work in all, with 3 planks from the backpack and no tool, one plank a stage", () => {
    const game = createGame({ seed: 42 });
    const frame = finishedDoorFrame(game);
    send(game, place("door", frame.position, 0));
    const blueprint = lastBlueprint(game, "door");
    const id = idOf(game, blueprint);
    // No axe, saw, or any other tool in the backpack.
    onlyPlayer(game).backpack.contents = { plank: DOOR_PLANK_COST };
    expect(DOOR_BUILD_SECONDS).toBe(6);
    expect(game.client.describeBlueprint(id)?.deliveries).toEqual([{ material: "plank", has: 0, needs: DOOR_PLANK_COST }]);

    send(game, { type: "build", blueprintId: id });
    stepUntil(game, () => game.client.getView().action?.kind === "build");
    runSeconds(game, DOOR_BUILD_SECONDS / 2);
    expect(blueprint.blueprint?.materialsSpent).toBe(2);
    runSeconds(game, DOOR_BUILD_SECONDS / 2 - 0.5);
    expect(blueprint.blueprint).toBeDefined();
    runSeconds(game, 1);

    expect(blueprint.blueprint).toBeUndefined();
    expect(blueprint.door).toBe(true);
    expect(blueprint.facing).toEqual({ turns: 0 });
    expect(game.client.getView().backpack.plank ?? 0).toBe(0);
  });

  it("keeps the planks it has over several trips, and takes the rest from a parked sled next to it and plank piles within 2 m", () => {
    const game = createGame({ seed: 42 });
    const frame = finishedDoorFrame(game);
    send(game, place("door", frame.position, 0));
    const blueprint = lastBlueprint(game, "door");
    const id = idOf(game, blueprint);
    onlyPlayer(game).backpack.contents = { plank: 1 };

    send(game, { type: "build", blueprintId: id });
    runSeconds(game, DOOR_BUILD_SECONDS + 2);
    expect(blueprint.blueprint).toMatchObject({ delivered: { plank: 1 }, materialsSpent: 1 });
    expect(game.client.describeBlueprint(id)?.lacks).toEqual({ kind: "material", material: "plank" });

    // The frame stands on the foundation's +z edge. A sled lies 1 m beyond it, a pile 1.5 m inside it, and another pile 3 m away.
    const sled = game.entities.add({
      sled: { log: 0, debarkedLog: 0, plank: 1 },
      facing: { turns: 0 },
      position: { x: frame.position.x, y: 0, z: frame.position.z + 1 + 0.4 },
    });
    const near = plankPileAt(game, { x: frame.position.x, z: frame.position.z - 1.5 }, 1);
    const far = plankPileAt(game, { x: frame.position.x + 3, z: frame.position.z + 3 }, 1);
    expect(game.client.describeBlueprint(id)?.lacks).toBeNull();
    send(game, { type: "build", blueprintId: id });
    stepUntil(game, () => blueprint.blueprint === undefined);

    expect(sled.sled.plank).toBe(0);
    expect(game.entities.has(near)).toBe(false);
    expect(far.pile?.count).toBe(1);
    expect(blueprint.door).toBe(true);
  });

  it("spends no planks in the playground", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const frame = finishedDoorFrame(game);
    const planksBefore = game.client.getView().backpack.plank;
    send(game, place("door", frame.position, 0));
    const blueprint = lastBlueprint(game, "door");

    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => blueprint.blueprint === undefined);

    expect(blueprint.door).toBe(true);
    expect(game.client.getView().backpack.plank).toBe(planksBefore);
  });
});

describe("opening and shutting a door", () => {
  it("stands open while the player is within 1 m of the middle of its frame, and shut once they are further away", () => {
    const middle = { x: 10.5, z: 4 };

    expect(isDoorOpen(middle, { x: 10.5, z: 4.9 })).toBe(true);
    expect(isDoorOpen(middle, { x: 9.6, z: 4 })).toBe(true);
    expect(isDoorOpen(middle, { x: 10.5, z: 5.1 })).toBe(false);
    expect(isDoorOpen(middle, { x: 11.6, z: 4 })).toBe(false);
  });

  it("is not saved: a loaded game holds the door alone, with nothing about whether it stands open", () => {
    const game = createGame({ seed: 42 });
    const frame = finishedDoorFrame(game);
    send(game, place("door", frame.position, 0));
    const door = lastBlueprint(game, "door");
    finish(game, door);

    const loaded = readSave(structuredClone(writeSave(game)));
    if (!loaded.ok) throw new Error("The save was rejected");

    const doors = loaded.game.entities.with("door", "position").entities;
    expect(doors).toHaveLength(1);
    expect(Object.keys(doors[0] ?? {}).sort()).toEqual(["door", "facing", "position"]);
  });
});

describe("walking through a door", () => {
  it("leaves the walk map and the player's path the same, with or without a door or its blueprint", () => {
    const game = createGame({ seed: 42 });
    const frame = finishedDoorFrame(game);
    const inside = { x: frame.position.x, z: frame.position.z - 0.5 };
    const beyond = { x: frame.position.x, z: frame.position.z + 2.5 };
    const before = { cells: [...game.walkMap.blockerCounts], edges: [...game.walkMap.edgeBlockerCounts], path: findPath(game.walkMap, inside, beyond) };

    send(game, place("door", frame.position, 0));
    expect([...game.walkMap.blockerCounts]).toEqual(before.cells);
    expect([...game.walkMap.edgeBlockerCounts]).toEqual(before.edges);
    finish(game, lastBlueprint(game, "door"));

    expect([...game.walkMap.blockerCounts]).toEqual(before.cells);
    expect([...game.walkMap.edgeBlockerCounts]).toEqual(before.edges);
    expect(findPath(game.walkMap, inside, beyond)).toEqual(before.path);
  });
});

describe("taking down a door", () => {
  it("gives back every plank a door blueprint has been given", () => {
    const game = createGame({ seed: 42 });
    const frame = finishedDoorFrame(game);
    send(game, place("door", frame.position, 0));
    const blueprint = lastBlueprint(game, "door");
    onlyPlayer(game).backpack.contents = { plank: 2 };
    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.entities.with("player", "buildTask").first === undefined && game.entities.with("player", "approach").first === undefined);
    expect(game.client.getView().backpack.plank ?? 0).toBe(0);

    send(game, { type: "takeDown", pieceId: idOf(game, blueprint) });
    stepUntil(game, () => !game.entities.has(blueprint));

    expect(game.client.getView().backpack.plank).toBe(2);
  });

  it("gives back all 3 planks of a finished door, and leaves the frame standing", () => {
    const game = createGame({ seed: 42 });
    const frame = finishedDoorFrame(game);
    send(game, place("door", frame.position, 0));
    const door = lastBlueprint(game, "door");
    finish(game, door);
    onlyPlayer(game).backpack.contents = {};

    send(game, { type: "takeDown", pieceId: idOf(game, door) });
    stepUntil(game, () => !game.entities.has(door));

    expect(game.client.getView().backpack.plank).toBe(DOOR_PLANK_COST);
    expect(game.entities.has(frame)).toBe(true);
    expect(game.client.checkPlacement("door", frame.position, 0).allowed).toBe(true);
  });
});

describe("taking down a door frame with a door", () => {
  it("refuses while a door or door blueprint hangs in it, saying something stands on it, and allows it once the door is gone", () => {
    const game = createGame({ seed: 42 });
    const frame = finishedDoorFrame(game);
    const takeDownFrame: Command = { type: "takeDown", pieceId: idOf(game, frame) };

    send(game, place("door", frame.position, 0));
    const door = lastBlueprint(game, "door");
    expect(game.client.refusal(takeDownFrame)).toEqual({ kind: "holdsUpPiece" });

    finish(game, door);
    expect(game.client.refusal(takeDownFrame)).toEqual({ kind: "holdsUpPiece" });
    send(game, takeDownFrame);
    expect(game.client.getView().notice).toEqual({ kind: "holdsUpPiece" });
    runSeconds(game, 15);
    expect(game.entities.has(frame)).toBe(true);

    send(game, { type: "takeDown", pieceId: idOf(game, door) });
    stepUntil(game, () => !game.entities.has(door));
    expect(game.client.refusal(takeDownFrame)).toBeNull();
  });
});

describe("saving doors", () => {
  it("restores a door blueprint with its planks, and a finished door in its frame", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 2, z: square.z };
    finishedFoundationAt(game, square);
    finishedFoundationAt(game, beside);
    const frame = finishedPieceAt(game, "doorFrame", square, 3);
    const other = finishedPieceAt(game, "doorFrame", beside, 1);
    send(game, place("door", frame.position, 0));
    finish(game, lastBlueprint(game, "door"));
    send(game, place("door", other.position, 0));
    const blueprint = lastBlueprint(game, "door");
    onlyPlayer(game).backpack.contents = { plank: 2 };
    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.entities.with("player", "buildTask").first === undefined && game.entities.with("player", "approach").first === undefined);

    const loaded = readSave(structuredClone(writeSave(game)));
    if (!loaded.ok) throw new Error("The save was rejected");

    const doors = loaded.game.entities.with("door", "position").entities;
    expect(doors).toHaveLength(1);
    expect(doors[0]?.facing).toEqual({ turns: 3 });
    expect(lastBlueprint(loaded.game, "door").blueprint).toMatchObject({ delivered: { plank: 2 }, materialsSpent: 2 });
  });

  it("raises the save version, and loads a save from before doors with no doors", () => {
    const game = createGame({ seed: 42 });
    expect(DOORS_SAVE_VERSION).toBeGreaterThan(FLOORS_SAVE_VERSION);
    expect(DOORS_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    const old = { ...writeSave(game), version: DOORS_SAVE_VERSION - 1 };

    const loaded = readSave(structuredClone(old));

    if (!loaded.ok) throw new Error("The save was rejected");
    expect(loaded.game.entities.with("door").entities).toHaveLength(0);
  });
});

/** A finished door frame on the +z edge of a finished foundation near the player. */
function finishedDoorFrame(game: Game): Entity & { position: NonNullable<Entity["position"]> } {
  const square = openSquareNearPlayer(game);
  finishedFoundationAt(game, square);
  return finishedPieceAt(game, "doorFrame", square, 0);
}

/** Lays a pile of planks on the ground at a spot. */
function plankPileAt(game: Game, at: { x: number; z: number }, count: number): Entity {
  return game.entities.add({ pile: { content: "plank", count }, position: { x: at.x, y: 0, z: at.z } });
}

/** Gives the player a door's planks and builds a door blueprint to the end. */
function finish(game: Game, blueprint: Entity): void {
  const contents = onlyPlayer(game).backpack.contents;
  contents.plank = (contents.plank ?? 0) + DOOR_PLANK_COST;
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => blueprint.blueprint === undefined);
}

/** Places a wall or door frame blueprint and builds it through to the end, delivering every debarked log it needs. */
function finishedPieceAt(
  game: Game,
  structure: "logWall" | "doorFrame",
  square: { x: number; z: number },
  turns: QuarterTurns,
): Entity & { position: NonNullable<Entity["position"]> } {
  send(game, place(structure, square, turns));
  const blueprint = lastBlueprint(game, structure);
  const logs = structure === "logWall" ? LOG_WALL_LOG_COST : DOOR_FRAME_LOG_COST;
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
function finishedFoundationAt(game: Game, square: { x: number; z: number }) {
  const position = { x: square.x, y: foundationDeckTop(game.valley.terrain, square), z: square.z };
  return game.entities.add({ foundation: true, facing: { turns: 0 }, position });
}

/** The middle of a building-grid square a few metres from the player, with open ground three squares all round it. */
function openSquareNearPlayer(game: Game, from = 4): { x: number; z: number } {
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

function place(structure: StructureKind, at: { x: number; z: number }, turns: QuarterTurns): Command {
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
