import { describe, expect, it } from "bun:test";
import type { Command } from "./api-commands";
import { isWarmedByCampfire } from "./campfires";
import { edgeMiddle } from "./edge-pieces";
import type { Entity } from "./entities";
import { foundationDeckTop } from "./foundations";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import type { GroundPoint } from "./ground-point";
import type { QuarterTurns } from "./quarter-turns";
import { isUnderRoof } from "./roofs";
import { CHIMNEYS_SAVE_VERSION, SEASONS_SAVE_VERSION, readSave, SAVE_VERSION, writeSave } from "./save";
import { CHIMNEY_BUILD_SECONDS, CHIMNEY_STONE_COST, structureOf, type StructureKind } from "./structures";
import { isWalkable } from "./walk-map";

describe("the chimney's cost", () => {
  it("costs 8 stone and no tool, and is built from its fireplace, not the build menu", () => {
    const game = createGame({ seed: 42 });
    const chimney = structureOf("chimney");

    expect(CHIMNEY_STONE_COST).toBe(8);
    expect(chimney.cost).toEqual([{ material: "stone", count: 8 }]);
    expect(chimney.tool).toBeUndefined();
    expect(game.client.getView().buildMenu.map(({ structure }) => structure)).not.toContain("chimney" as StructureKind);
  });
});

describe("where a chimney blueprint can go", () => {
  it("snaps onto a finished fireplace near the mouse, at its deck, facing the way the fireplace faces whatever the player turned it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const fireplace = finishedFireplaceAt(game, square, 3);

    for (const turns of [0, 1, 2, 3] as const) {
      const check = game.client.checkPlacement("chimney", { x: square.x + 0.4, z: square.z - 0.3 }, turns);
      expect(check.allowed).toBe(true);
      expect(check.spot).toMatchObject({ x: square.x, z: square.z });
      expect(check.spot.y).toBeCloseTo(fireplace.position.y, 5);
      expect(check.turns).toBe(3);
      expect(check.refusal).toBeUndefined();
    }
  });

  it("goes on any finished fireplace, wherever it stands on the foundation, with or without walls", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const middle = { x: square.x + 1, z: square.z };
    finishedFoundationAt(game, square);
    finishedFireplaceAt(game, middle, 0);

    expect(game.client.checkPlacement("chimney", middle, 0).allowed).toBe(true);
  });

  it("refuses with a reason anywhere but a finished fireplace", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 1, z: square.z };
    finishedFoundationAt(game, square);
    finishedFoundationAt(game, beside);
    send(game, place("fireplace", beside, 0));

    const open = { x: square.x, z: square.z + 3 };
    for (const at of [open, square, beside]) {
      const check = game.client.checkPlacement("chimney", at, 0);
      expect(check.allowed).toBe(false);
      expect(check.refusal).toEqual({ kind: "chimneyNeedsFireplace" });
    }
  });

  it("refuses with a reason on a fireplace that already has a chimney or a chimney blueprint", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 1, z: square.z };
    finishedFireplaceAt(game, square, 0);
    finishedFireplaceAt(game, beside, 0);
    send(game, place("chimney", square, 0));
    send(game, place("chimney", beside, 0));
    finishChimney(game, lastBlueprint(game, "chimney"));

    for (const at of [square, beside]) {
      const check = game.client.checkPlacement("chimney", at, 0);
      expect(check.allowed).toBe(false);
      expect(check.refusal).toEqual({ kind: "fireplaceHasChimney" });
    }
  });

  it("can go on before or after the roof frame and roof section over its square", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 1, z: square.z };
    finishedFireplaceAt(game, square, 0);
    finishedFireplaceAt(game, beside, 0);
    for (const at of [square, beside]) finishedWallAt(game, at, 2);

    // Before: a chimney blueprint and a finished chimney, then the roof frame and roof section go on over them.
    send(game, place("chimney", square, 0));
    expect(game.client.checkPlacement("roofFrame", square, 0).allowed).toBe(true);
    finishChimney(game, lastBlueprint(game, "chimney"));
    expect(game.client.checkPlacement("roofFrame", square, 0).allowed).toBe(true);
    game.entities.add({ roofFrame: true, facing: { turns: 0 }, position: deckOf(game, square) });
    expect(game.client.checkPlacement("roof", square, 0).allowed).toBe(true);

    // After: the roof frame and roof section are there first.
    game.entities.add({ roofFrame: true, facing: { turns: 0 }, position: deckOf(game, beside) });
    game.entities.add({ ...structureOf("roof").finish(beside, 0, game.entities), facing: { turns: 0 }, position: deckOf(game, beside) });
    expect(game.client.checkPlacement("chimney", beside, 0).allowed).toBe(true);
  });
});

describe("what a chimney blocks", () => {
  it("blocks no ground beyond its fireplace's square", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 1, z: square.z };
    finishedFoundationAt(game, beside);
    finishedFireplaceAt(game, square, 0);
    send(game, place("chimney", square, 0));
    finishChimney(game, lastBlueprint(game, "chimney"));

    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      expect(isWalkable(game.walkMap, { x: square.x + dx, z: square.z + dz })).toBe(true);
    }
    // A wall on the square's edge, and a stool on the square beside it, can still go up.
    expect(game.client.checkPlacement("logWall", square, 1).allowed).toBe(true);
    expect(game.client.checkPlacement("stool", beside, 0).allowed).toBe(true);
  });
});

describe("building a chimney", () => {
  it("takes 16 seconds of work in all, with 8 stone from the backpack and no tool", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFireplaceAt(game, square, 1);
    send(game, place("chimney", square, 0));
    const blueprint = lastBlueprint(game, "chimney");
    const id = idOf(game, blueprint);
    onlyPlayer(game).backpack.contents = { stone: CHIMNEY_STONE_COST };
    expect(CHIMNEY_BUILD_SECONDS).toBe(16);
    expect(game.client.describeBlueprint(id)?.deliveries).toEqual([{ material: "stone", has: 0, needs: CHIMNEY_STONE_COST }]);

    send(game, { type: "build", blueprintId: id });
    stepUntil(game, () => game.client.getView().action?.kind === "build");
    runSeconds(game, CHIMNEY_BUILD_SECONDS - 0.5);
    expect(blueprint.blueprint).toBeDefined();
    expect(blueprint.blueprint?.delivered).toEqual({ stone: CHIMNEY_STONE_COST });
    runSeconds(game, 1);

    expect(blueprint.blueprint).toBeUndefined();
    expect(blueprint.chimney).toBe(true);
    expect(blueprint.facing).toEqual({ turns: 1 });
    expect(game.client.getView().backpack.stone ?? 0).toBe(0);
  });

  it("keeps the stone it has been given over several trips, and takes stone from piles within 2 m", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFireplaceAt(game, square, 0);
    send(game, place("chimney", square, 0));
    const blueprint = lastBlueprint(game, "chimney");
    const id = idOf(game, blueprint);
    onlyPlayer(game).backpack.contents = { stone: 3 };

    send(game, { type: "build", blueprintId: id });
    runSeconds(game, CHIMNEY_BUILD_SECONDS + 5);
    expect(blueprint.blueprint).toMatchObject({ delivered: { stone: 3 }, materialsSpent: 3 });
    expect(game.client.describeBlueprint(id)?.lacks).toEqual({ kind: "material", material: "stone" });

    // A second trip brings 2 more in the backpack, and a pile 1.5 m from the blueprint holds the last 3.
    onlyPlayer(game).backpack.contents = { stone: 2 };
    const near = stonePileAt(game, { x: square.x, z: square.z - 0.5 - 1.5 }, 3);
    send(game, { type: "build", blueprintId: id });
    stepUntil(game, () => blueprint.blueprint === undefined);

    expect(game.client.getView().backpack.stone ?? 0).toBe(0);
    expect(game.entities.has(near)).toBe(false);
    expect(blueprint.chimney).toBe(true);
  });

  it("spends no stone in the playground", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const square = openSquareNearPlayer(game);
    finishedFireplaceAt(game, square, 0);
    const stoneBefore = game.client.getView().backpack.stone;
    send(game, place("chimney", square, 0));
    const blueprint = lastBlueprint(game, "chimney");

    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => blueprint.blueprint === undefined);

    expect(game.client.getView().backpack.stone).toBe(stoneBefore);
    expect(blueprint.chimney).toBe(true);
  });
});

describe("taking down a chimney", () => {
  it("gives back every stone a blueprint has been given", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFireplaceAt(game, square, 0);
    send(game, place("chimney", square, 0));
    const blueprint = lastBlueprint(game, "chimney");
    onlyPlayer(game).backpack.contents = { stone: 5 };
    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.entities.with("player", "buildTask").first === undefined && game.entities.with("player", "approach").first === undefined);
    expect(game.client.getView().backpack.stone ?? 0).toBe(0);

    send(game, { type: "takeDown", pieceId: idOf(game, blueprint) });
    stepUntil(game, () => !game.entities.has(blueprint));

    expect(game.client.getView().backpack.stone).toBe(5);
  });

  it("gives back all 8 stone of a finished chimney, even while the fire burns", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const fireplace = finishedFireplaceAt(game, square, 0);
    send(game, place("chimney", square, 0));
    const chimney = lastBlueprint(game, "chimney");
    finishChimney(game, chimney);
    fireplace.fireplace = { lit: true, fuelMinutes: 600 };
    onlyPlayer(game).backpack.contents = {};
    const takeDown: Command = { type: "takeDown", pieceId: idOf(game, chimney) };
    expect(game.client.refusal(takeDown)).toBeNull();

    send(game, takeDown);
    stepUntil(game, () => !game.entities.has(chimney));

    expect(game.client.getView().backpack.stone).toBe(CHIMNEY_STONE_COST);
    expect(fireplace.fireplace.lit).toBe(true);
  });

  it("must come down before its fireplace, finished or as a blueprint", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const fireplace = finishedFireplaceAt(game, square, 0);
    const takeDownFireplace: Command = { type: "takeDown", pieceId: idOf(game, fireplace) };
    expect(game.client.refusal(takeDownFireplace)).toBeNull();

    send(game, place("chimney", square, 0));
    const chimney = lastBlueprint(game, "chimney");
    expect(game.client.refusal(takeDownFireplace)).toEqual({ kind: "takeChimneyDownFirst" });
    finishChimney(game, chimney);
    expect(game.client.refusal(takeDownFireplace)).toEqual({ kind: "takeChimneyDownFirst" });

    send(game, takeDownFireplace);
    runSeconds(game, 20);
    expect(game.entities.has(fireplace)).toBe(true);

    send(game, { type: "takeDown", pieceId: idOf(game, chimney) });
    stepUntil(game, () => !game.entities.has(chimney));
    expect(game.client.refusal(takeDownFireplace)).toBeNull();
  });
});

describe("a chimney in play", () => {
  it("changes nothing about warmth, rooms, or rain", () => {
    const game = createGame({ seed: 42 });
    const [first, second] = roomNearPlayer(game, 3);
    const fireplace = finishedFireplaceAt(game, first, 0);
    fireplace.fireplace = { lit: true, fuelMinutes: 600 };
    const before = { warmed: isWarmedByCampfire(game.entities, second), rooms: game.client.describeRooms(), roofed: isUnderRoof(game.entities, first) };

    game.entities.add({ ...structureOf("chimney").finish(first, 0, game.entities), facing: { turns: 0 }, position: deckOf(game, first) });

    expect(isWarmedByCampfire(game.entities, second)).toBe(before.warmed);
    expect(before.warmed).toBe(true);
    expect(game.client.describeRooms()).toEqual(before.rooms);
    expect(isUnderRoof(game.entities, first)).toBe(true);
    expect(before.roofed).toBe(true);
  });
});

describe("saving chimneys", () => {
  it("restores a chimney blueprint with its stone, and a finished chimney with its facing", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const beside = { x: square.x + 2, z: square.z };
    finishedFireplaceAt(game, square, 2);
    finishedFireplaceAt(game, beside, 0);
    send(game, place("chimney", square, 0));
    finishChimney(game, lastBlueprint(game, "chimney"));
    send(game, place("chimney", beside, 0));
    const blueprint = lastBlueprint(game, "chimney");
    onlyPlayer(game).backpack.contents = { stone: 4 };
    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.entities.with("player", "buildTask").first === undefined && game.entities.with("player", "approach").first === undefined);

    const loaded = readSave(structuredClone(writeSave(game)));
    if (!loaded.ok) throw new Error("The save was rejected");

    const chimneys = loaded.game.entities.with("chimney", "position").entities;
    expect(chimneys).toHaveLength(1);
    expect(chimneys[0]?.facing).toEqual({ turns: 2 });
    expect(lastBlueprint(loaded.game, "chimney").blueprint).toMatchObject({ delivered: { stone: 4 }, materialsSpent: 4 });
  });

  it("raises the save version, and loads a fireplace from an older save with no chimney", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFireplaceAt(game, square, 0);
    expect(CHIMNEYS_SAVE_VERSION).toBeGreaterThan(SEASONS_SAVE_VERSION);
    expect(CHIMNEYS_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    const old = { ...writeSave(game), version: CHIMNEYS_SAVE_VERSION - 1 };

    const loaded = readSave(structuredClone(old));
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(loaded.game.entities.with("fireplace").entities).toHaveLength(1);
    expect(loaded.game.entities.with("chimney").entities).toHaveLength(0);
    expect(loaded.game.client.checkPlacement("chimney", square, 0).allowed).toBe(true);
  });
});

/** Gives the player a chimney's stone and builds a chimney blueprint to the end. */
function finishChimney(game: Game, blueprint: Entity): void {
  const contents = onlyPlayer(game).backpack.contents;
  contents.stone = (contents.stone ?? 0) + CHIMNEY_STONE_COST;
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => blueprint.blueprint === undefined);
}

/** Puts a finished foundation and a finished fireplace facing `turns` on a square, as if the player had built them. */
function finishedFireplaceAt(game: Game, square: GroundPoint, turns: QuarterTurns) {
  finishedFoundationAt(game, square);
  const position = deckOf(game, square);
  const fireplace = game.entities.add({ ...structureOf("fireplace").finish(square, turns, game.entities), facing: { turns }, position });
  return Object.assign(fireplace, { position, fireplace: fireplace.fireplace ?? { lit: false, fuelMinutes: 0 } });
}

/** Puts a finished foundation on a square, unless one is there already. */
function finishedFoundationAt(game: Game, square: GroundPoint) {
  const there = game.entities.with("foundation", "position").entities.find(({ position }) => position.x === square.x && position.z === square.z);
  return there ?? game.entities.add({ foundation: true, facing: { turns: 0 }, position: deckOf(game, square) });
}

/** Puts a finished log wall on one edge of a square. */
function finishedWallAt(game: Game, square: GroundPoint, side: QuarterTurns): void {
  const edge = edgeMiddle(square, side);
  game.entities.add({ ...structureOf("logWall").finish(edge, side, game.entities), facing: { turns: side }, position: { x: edge.x, y: 0, z: edge.z } });
}

/** The middle of a square's foundation deck. */
function deckOf(game: Game, square: GroundPoint) {
  return { x: square.x, y: foundationDeckTop(game.valley.terrain, square), z: square.z };
}

/** Builds a finished room of `length` foundation squares in a row along +x, with log walls all round and a roof on every square. */
function roomNearPlayer(game: Game, length: number): [GroundPoint, GroundPoint, ...GroundPoint[]] {
  const start = openSquareNearPlayer(game);
  const squares = Array.from({ length }, (_, i) => ({ x: start.x + i, z: start.z }));
  for (const square of squares) finishedFoundationAt(game, square);
  squares.forEach((square, i) => {
    const sides: QuarterTurns[] = [0, 2];
    if (i === 0) sides.push(1);
    if (i === length - 1) sides.push(3);
    for (const side of sides) finishedWallAt(game, square, side);
  });
  for (const square of squares)
    game.entities.add({ ...structureOf("roof").finish(square, 0, game.entities), facing: { turns: 0 }, position: deckOf(game, square) });
  const [first, second, ...rest] = squares;
  if (first === undefined || second === undefined) throw new Error("A room here needs at least two squares");
  return [first, second, ...rest];
}

/** Lays a pile of stone on the ground at a spot. */
function stonePileAt(game: Game, at: GroundPoint, count: number): Entity {
  return game.entities.add({ pile: { content: "stone", count }, position: { x: at.x, y: 0, z: at.z } });
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
