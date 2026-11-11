import { describe, expect, it } from "vitest";
import type { Command } from "./api";
import { createEntityStore, type Entity, type EntityStore } from "./entities";
import { foundationDeckTop } from "./foundations";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { DOOR_FRAME_LOG_COST, LOG_WALL_LOG_COST, ROOF_BARK_COST, ROOF_BUILD_SECONDS, ROOF_LOG_COST, type QuarterTurns, type StructureKind } from "./structures";
import { cabinRoofOn, isUnderRoof, roofAbove } from "./roofs";
import { readSave, ROOFS_FACE_SAVE_VERSION, writeSave } from "./save";
import { isWalkable } from "./walk-map";

describe("the roof in the build menu", () => {
  it("lists the roof after the door frame, with its cost in debarked logs and bark", () => {
    const game = createGame({ seed: 42 });

    const menu = game.client.getView().buildMenu;
    expect(menu[menu.findIndex(({ structure }) => structure === "doorFrame") + 1]).toEqual({
      structure: "roof",
      cost: [{ material: "debarkedLog", count: ROOF_LOG_COST }, { material: "bark", count: ROOF_BARK_COST }],
      placement: "overWalls",
    });
  });
});

describe("where a roof can go", () => {
  it("snaps to the foundation square under the mouse, at the height of its deck", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const foundation = finishedFoundationAt(game, square);
    finishedPieceAt(game, "logWall", square, 0);

    const check = game.client.checkPlacement("roof", { x: square.x + 0.3, z: square.z - 0.2 }, 0);

    expect(check.allowed).toBe(true);
    expect(check.spot).toMatchObject({ x: square.x, z: square.z });
    expect(check.spot.y).toBeCloseTo(foundation.position.y, 5);
  });

  it("needs a finished foundation with at least one finished wall or door frame on its edges", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);

    // Open ground.
    expect(game.client.checkPlacement("roof", square, 0).allowed).toBe(false);
    // A bare foundation.
    finishedFoundationAt(game, square);
    expect(game.client.checkPlacement("roof", square, 0).allowed).toBe(false);
    // A wall that is still a blueprint is not enough.
    send(game, place("logWall", square, 2));
    expect(game.client.checkPlacement("roof", square, 0).allowed).toBe(false);
    send(game, place("roof", square, 0));
    expect(game.entities.with("blueprint").entities.every(({ blueprint }) => blueprint.structure === "logWall")).toBe(true);
  });

  it("accepts a door frame on any edge, even one placed from the square beside it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 1, z: square.z };
    finishedFoundationAt(game, square);
    finishedFoundationAt(game, beside);

    // The -x edge of the square beside is the +x edge of the first square.
    finishedPieceAt(game, "doorFrame", beside, 1);

    expect(game.client.checkPlacement("roof", square, 0).allowed).toBe(true);
    expect(game.client.checkPlacement("roof", beside, 0).allowed).toBe(true);
  });

  it("allows one roof on each square", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    finishedPieceAt(game, "logWall", square, 0);

    send(game, place("roof", square, 0));

    expect(onlyBlueprint(game).blueprint).toMatchObject({ structure: "roof", progress: 0, delivered: {} });
    expect(game.client.checkPlacement("roof", square, 0).allowed).toBe(false);
  });
});

describe("building a roof", () => {
  it("spends delivered debarked logs first, then bark from the backpack, and finishes over the square", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    finishedPieceAt(game, "logWall", square, 0);
    send(game, place("roof", square, 0));
    const blueprint = onlyBlueprint(game);
    const id = idOf(game, blueprint);
    give(game, "bark", ROOF_BARK_COST);

    for (let i = 0; i < ROOF_LOG_COST; i += 1) deliverLog(game, blueprint);
    expect(game.client.describeBlueprint(id)?.deliveries).toEqual([{ material: "debarkedLog", has: ROOF_LOG_COST, needs: ROOF_LOG_COST }]);

    send(game, { type: "build", blueprintId: id });
    // Halfway, the logs are laid but most of the bark is still in the backpack.
    runSeconds(game, ROOF_BUILD_SECONDS / 2);
    expect(game.client.getView().backpack.bark).toBeGreaterThan(1);
    runSeconds(game, ROOF_BUILD_SECONDS / 2 + 2);

    expect(game.client.getView().backpack.bark ?? 0).toBe(0);
    expect(blueprint.blueprint).toBeUndefined();
    expect(cabinRoofOn(game.entities, square)).toBe(blueprint);
    expect(cabinRoofOn(game.entities, { x: square.x + 1, z: square.z })).toBeUndefined();
  });

  it("pauses when the bark runs out, and carries on once the player has more", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    finishedPieceAt(game, "logWall", square, 0);
    send(game, place("roof", square, 0));
    const blueprint = onlyBlueprint(game);
    const id = idOf(game, blueprint);
    for (let i = 0; i < ROOF_LOG_COST; i += 1) deliverLog(game, blueprint);
    give(game, "bark", 1);

    send(game, { type: "build", blueprintId: id });
    runSeconds(game, ROOF_BUILD_SECONDS + 1);
    expect(game.client.getView().action).toBeNull();
    expect(blueprint.blueprint?.materialsSpent).toBe(ROOF_LOG_COST + 1);

    give(game, "bark", ROOF_BARK_COST - 1);
    send(game, { type: "build", blueprintId: id });
    runSeconds(game, ROOF_BUILD_SECONDS + 1);

    expect(cabinRoofOn(game.entities, square)).toBe(blueprint);
  });
});

describe("a finished cabin roof", () => {
  it("is a roof overhead over its whole square, but not as a blueprint", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    finishedPieceAt(game, "logWall", square, 0);
    send(game, place("roof", square, 0));
    expect(isUnderRoof(game.entities, square)).toBe(false);

    finish(game, onlyBlueprint(game));

    expect(isUnderRoof(game.entities, square)).toBe(true);
    expect(isUnderRoof(game.entities, { x: square.x + 0.45, z: square.z - 0.45 })).toBe(true);
    expect(isUnderRoof(game.entities, { x: square.x + 1, z: square.z })).toBe(false);
  });

  it("keeps the rain from draining the warmth of a player under it", () => {
    const sheltered = createGame({ seed: 42 });
    const square = openSquareNearPlayer(sheltered);
    finishedFoundationAt(sheltered, square);
    finishedPieceAt(sheltered, "logWall", square, 0);
    send(sheltered, place("roof", square, 0));
    finish(sheltered, onlyBlueprint(sheltered));
    walkTo(sheltered, square);
    const exposed = createGame({ seed: 42 });
    for (const game of [sheltered, exposed]) startRain(game);

    for (const game of [sheltered, exposed]) send(game, { type: "skipTime", hours: 1 });

    expect(sheltered.client.getView().raining).toBe(true);
    expect(sheltered.client.getView().needs.warmth).toBe(1);
    expect(exposed.client.getView().needs.warmth).toBeLessThan(0.9);
  });
});

describe("the roof above the player", () => {
  /** A finished cabin roof section over the square with this middle. */
  const sectionAt = (entities: EntityStore, x: number, z: number) =>
    entities.add({ cabinRoof: true, position: { x, y: 0, z }, roof: { min: { x: x - 0.5, z: z - 0.5 }, max: { x: x + 0.5, z: z + 0.5 } } });

  it("is every cabin roof section joined to the one over the player, side by side", () => {
    const entities = createEntityStore();
    const over = sectionAt(entities, 0.5, 0.5);
    const east = sectionAt(entities, 1.5, 0.5);
    const southOfEast = sectionAt(entities, 1.5, -0.5);
    // Only a corner touches, so it is a different roof.
    sectionAt(entities, -0.5, 1.5);
    // Far away.
    sectionAt(entities, 10.5, 10.5);

    expect(new Set(roofAbove(entities, { x: 0.4, z: 0.7 }))).toEqual(new Set([over, east, southOfEast]));
  });

  it("is nothing when the player stands in the open or under a lean-to", () => {
    const entities = createEntityStore();
    sectionAt(entities, 0.5, 0.5);
    entities.add({ leanTo: true, position: { x: 5, y: 0, z: 5 }, roof: { min: { x: 3, z: 4 }, max: { x: 7, z: 6 } } });

    expect(roofAbove(entities, { x: 2.5, z: 0.5 })).toEqual([]);
    expect(roofAbove(entities, { x: 5, z: 5 })).toEqual([]);
  });
});

describe("saving roofs", () => {
  it("restores roof blueprints with their delivered logs, and finished roofs that still keep the rain off", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 1, z: square.z };
    finishedFoundationAt(game, square);
    finishedFoundationAt(game, beside);
    finishedPieceAt(game, "doorFrame", square, 3);
    send(game, place("roof", square, 0));
    finish(game, onlyBlueprint(game));
    send(game, place("roof", beside, 0));
    deliverLog(game, onlyBlueprint(game));

    const saved = writeSave(game);
    const loaded = readSave(structuredClone(saved));
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(writeSave(loaded.game)).toEqual(saved);
    expect(onlyBlueprint(loaded.game).blueprint).toMatchObject({ structure: "roof", delivered: { debarkedLog: 1 } });
    expect(cabinRoofOn(loaded.game.entities, square)).toBeDefined();
    expect(isUnderRoof(loaded.game.entities, square)).toBe(true);
  });
});

describe("the way a roof faces", () => {
  it("keeps the turn its blueprint was placed with when finished, and in a save", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    finishedPieceAt(game, "logWall", square, 0);
    send(game, place("roof", square, 1));
    const blueprint = onlyBlueprint(game);
    expect(blueprint.facing).toEqual({ turns: 1 });

    finish(game, blueprint);
    expect(cabinRoofOn(game.entities, square)?.facing).toEqual({ turns: 1 });

    const loaded = readSave(structuredClone(writeSave(game)));
    if (!loaded.ok) throw new Error("The save was rejected");
    const section = cabinRoofOn(loaded.game.entities, square);
    expect(section?.facing).toEqual({ turns: 1 });
    // The game rules store only the turn: no height or corner shape.
    expect(Object.keys(section ?? {}).sort()).toEqual(["cabinRoof", "facing", "position", "roof"]);
  });

  it("loads roofs from a save made before roofs faced a direction sloping to +z, as they did then", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 1, z: square.z };
    finishedFoundationAt(game, square);
    finishedFoundationAt(game, beside);
    finishedPieceAt(game, "logWall", square, 0);
    finishedPieceAt(game, "logWall", beside, 0);
    // Back then, the blueprint kept whatever turn R gave it, though the roof ignored it.
    send(game, place("roof", square, 2));
    finish(game, onlyBlueprint(game));
    send(game, place("roof", beside, 3));
    const saved = writeSave(game);
    const old = { ...saved, version: ROOFS_FACE_SAVE_VERSION - 1 };

    const loaded = readSave(structuredClone(old));
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(cabinRoofOn(loaded.game.entities, square)?.facing).toEqual({ turns: 0 });
    expect(onlyBlueprint(loaded.game).facing).toEqual({ turns: 0 });
  });

  it("leaves other structures' turns in an older save alone", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    const wall = finishedPieceAt(game, "logWall", square, 3);
    const old = { ...writeSave(game), version: ROOFS_FACE_SAVE_VERSION - 1 };

    const loaded = readSave(structuredClone(old));
    if (!loaded.ok) throw new Error("The save was rejected");

    const loadedWall = loaded.game.entities.with("edgePiece", "position").entities.find(({ position }) => position.x === wall.position?.x && position.z === wall.position.z);
    expect(loadedWall?.facing).toEqual({ turns: 3 });
  });
});

/** Delivers every debarked log a roof blueprint needs, gives the player its bark, and builds it to the end. */
function finish(game: Game, blueprint: Entity): void {
  for (let i = 0; i < ROOF_LOG_COST; i += 1) deliverLog(game, blueprint);
  give(game, "bark", ROOF_BARK_COST);
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => blueprint.blueprint === undefined);
}

function give(game: Game, content: "bark", count: number): void {
  const contents = onlyPlayer(game).backpack.contents;
  contents[content] = (contents[content] ?? 0) + count;
}

function walkTo(game: Game, to: { x: number; z: number }): void {
  send(game, { type: "walkTo", ...to });
  stepUntil(game, () => game.entities.with("player", "walkPath").first === undefined);
}

/** Starts rain that keeps falling for a day. */
function startRain(game: Game): void {
  const rain = game.entities.with("rain").first?.rain;
  if (rain === undefined) throw new Error("No weather");
  rain.falling = true;
  const { day, hour, minute } = game.client.getView().time;
  rain.changeAtMinutes = ((day - 1) * 24 + hour) * 60 + minute + 24 * 60;
}

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

/** Puts a debarked log on the player's shoulder and carries it to a blueprint. */
function deliverLog(game: Game, blueprint: Entity): void {
  game.entities.addComponent(onlyPlayer(game), "carrying", "debarkedLog");
  send(game, { type: "deliverToBlueprint", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => game.client.getView().carrying === null);
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

function onlyBlueprint(game: Game): Entity & { position: NonNullable<Entity["position"]> } {
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("No blueprint");
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
