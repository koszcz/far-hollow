import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import { createEntityStore, type Entity, type EntityStore } from "./entities";
import { foundationDeckTop } from "./foundations";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import {
  DOOR_FRAME_LOG_COST,
  LOG_WALL_LOG_COST,
  ROOF_BARK_COST,
  ROOF_BUILD_SECONDS,
  ROOF_FRAME_LOG_COST,
  type QuarterTurns,
  type StructureKind,
} from "./structures";
import { cabinRoofOn, isUnderRoof, roofAbove } from "./roofs";
import { readSave, ROOFS_FACE_SAVE_VERSION, writeSave } from "./save";
import { isWalkable } from "./walk-map";

describe("where a roof can go", () => {
  it("snaps to the framed square under the mouse, at the height of its deck", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const foundation = framedSquare(game, square, 0);

    const check = game.client.checkPlacement("roof", { x: square.x + 0.3, z: square.z - 0.2 }, 0);

    expect(check.allowed).toBe(true);
    expect(check.spot).toMatchObject({ x: square.x, z: square.z });
    expect(check.spot.y).toBeCloseTo(foundation.position.y, 5);
  });

  it("lets a frame rest on a door frame on any edge, even one placed from the square beside it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 1, z: square.z };
    finishedFoundationAt(game, square);
    finishedFoundationAt(game, beside);

    // The -x edge of the square beside is the +x edge of the first square.
    finishedPieceAt(game, "doorFrame", beside, 1);

    expect(game.client.checkPlacement("roofFrame", square, 0).allowed).toBe(true);
    expect(game.client.checkPlacement("roofFrame", beside, 0).allowed).toBe(true);
  });
});

describe("building a roof", () => {
  it("spends bark from the backpack, and finishes over the square", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    framedSquare(game, square, 0);
    send(game, place("roof", square, 0));
    const blueprint = onlyRoofBlueprint(game);
    const id = idOf(game, blueprint);
    give(game, "bark", ROOF_BARK_COST);
    // Nothing is carried to a roof: it costs only bark.
    expect(game.client.describeBlueprint(id)?.deliveries).toEqual([]);

    send(game, { type: "build", blueprintId: id });
    // Halfway, most of the bark is still in the backpack.
    runSeconds(game, ROOF_BUILD_SECONDS / 2 - 1);
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
    framedSquare(game, square, 0);
    send(game, place("roof", square, 0));
    const blueprint = onlyRoofBlueprint(game);
    const id = idOf(game, blueprint);
    give(game, "bark", 1);

    send(game, { type: "build", blueprintId: id });
    runSeconds(game, ROOF_BUILD_SECONDS + 1);
    expect(game.client.getView().action).toBeNull();
    expect(blueprint.blueprint?.materialsSpent).toBe(1);

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
    framedSquare(game, square, 0);
    send(game, place("roof", square, 0));
    expect(isUnderRoof(game.entities, square)).toBe(false);

    finish(game, onlyRoofBlueprint(game));

    expect(isUnderRoof(game.entities, square)).toBe(true);
    expect(isUnderRoof(game.entities, { x: square.x + 0.45, z: square.z - 0.45 })).toBe(true);
    expect(isUnderRoof(game.entities, { x: square.x + 1, z: square.z })).toBe(false);
  });

  it("keeps the rain from draining the warmth of a player under it", () => {
    const sheltered = createGame({ seed: 42 });
    const square = openSquareNearPlayer(sheltered);
    framedSquare(sheltered, square, 0);
    send(sheltered, place("roof", square, 0));
    finish(sheltered, onlyRoofBlueprint(sheltered));
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
  it("restores roof blueprints with the bark spent on them, and finished roofs that still keep the rain off", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 1, z: square.z };
    framedSquare(game, square, 0);
    framedSquare(game, beside, 0);
    send(game, place("roof", square, 0));
    finish(game, onlyRoofBlueprint(game));
    send(game, place("roof", beside, 0));
    const blueprint = onlyRoofBlueprint(game);
    give(game, "bark", 1);
    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    runSeconds(game, ROOF_BUILD_SECONDS);

    const saved = writeSave(game);
    const loaded = readSave(structuredClone(saved));
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(writeSave(loaded.game)).toEqual(saved);
    expect(onlyRoofBlueprint(loaded.game).blueprint).toMatchObject({ structure: "roof", materialsSpent: 1 });
    expect(cabinRoofOn(loaded.game.entities, square)).toBeDefined();
    expect(isUnderRoof(loaded.game.entities, square)).toBe(true);
  });
});

describe("the way a roof faces", () => {
  it("keeps the turn of the frame under it when finished, and in a save", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    framedSquare(game, square, 1);
    send(game, place("roof", square, 0));
    const blueprint = onlyRoofBlueprint(game);
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
    const foundation = finishedFoundationAt(game, square);
    finishedFoundationAt(game, beside);
    finishedPieceAt(game, "logWall", square, 0);
    finishedPieceAt(game, "logWall", beside, 0);
    // Back then, roofs sat straight on the walls, and a blueprint kept whatever turn R gave it, though the roof ignored it.
    const rect = { min: { x: square.x - 0.5, z: square.z - 0.5 }, max: { x: square.x + 0.5, z: square.z + 0.5 } };
    game.entities.add({ cabinRoof: true, roof: rect, facing: { turns: 2 }, position: { ...foundation.position } });
    game.entities.add({
      blueprint: { structure: "roof", progress: 0, materialsSpent: 0, delivered: {} },
      facing: { turns: 3 },
      position: { x: beside.x, y: 0, z: beside.z },
    });
    const old = { ...writeSave(game), version: ROOFS_FACE_SAVE_VERSION - 1 };

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

    const loadedWall = loaded.game.entities
      .with("edgePiece", "position")
      .entities.find(({ position }) => position.x === wall.position?.x && position.z === wall.position.z);
    expect(loadedWall?.facing).toEqual({ turns: 3 });
  });
});

/** Gives the player a roof section's bark and builds a roof blueprint to the end. */
function finish(game: Game, blueprint: Entity): void {
  give(game, "bark", ROOF_BARK_COST);
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => blueprint.blueprint === undefined);
}

/** Puts a finished foundation on a square, a finished log wall on its +z edge, and a finished roof frame facing `turns` over it. */
function framedSquare(game: Game, square: { x: number; z: number }, turns: QuarterTurns) {
  const foundation = finishedFoundationAt(game, square);
  finishedPieceAt(game, "logWall", square, 0);
  send(game, place("roofFrame", square, turns));
  const frame = game.entities.with("blueprint", "position").entities.at(-1);
  if (frame?.blueprint.structure !== "roofFrame") throw new Error("The frame was not placed");
  for (let i = 0; i < ROOF_FRAME_LOG_COST; i += 1) deliverLog(game, frame);
  send(game, { type: "build", blueprintId: idOf(game, frame) });
  const built: Entity = frame;
  stepUntil(game, () => built.blueprint === undefined);
  return foundation;
}

function onlyRoofBlueprint(game: Game): Entity & { position: NonNullable<Entity["position"]> } {
  const blueprint = game.entities.with("blueprint", "position").entities.find(({ blueprint }) => blueprint.structure === "roof");
  if (blueprint === undefined) throw new Error("No roof blueprint");
  return blueprint;
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
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
      [1, 1],
      [1, -1],
    ] as const) {
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
