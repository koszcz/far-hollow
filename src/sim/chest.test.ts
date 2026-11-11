import { describe, expect, it } from "vitest";
import type { Command, StructureKind } from "./api";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { readSave, writeSave } from "./save";
import { CHEST_BUILD_SECONDS, CHEST_DEPTH_METRES, CHEST_LOG_COST, CHEST_WIDTH_METRES } from "./structures";
import { terrainHeightAt } from "./valley";
import { isWalkable } from "./walk-map";

describe("the chest in the build menu", () => {
  it("lists the chest with its cost of 2 debarked logs and the axe it needs", () => {
    const game = createGame({ seed: 42 });

    expect(CHEST_LOG_COST).toBe(2);
    expect(game.client.getView().buildMenu).toContainEqual({ structure: "chest", cost: [{ material: "debarkedLog", count: 2 }], tool: "axe" });
  });
});

describe("placing a chest", () => {
  it("goes exactly where the mouse points, off the building grid, on the ground", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const at = { x: square.x + 0.13, z: square.z - 0.27 };

    const check = game.client.checkPlacement("chest", at, 0);
    expect(check.allowed).toBe(true);
    expect(check.spot.x).toBe(at.x);
    expect(check.spot.z).toBe(at.z);
    expect(check.spot.y).toBeCloseTo(terrainHeightAt(game.valley.terrain, at.x, at.z), 5);

    send(game, place("chest", at.x, at.z, 0));
    const blueprint = onlyBlueprint(game);
    expect(blueprint.blueprint).toMatchObject({ piece: "chest", progress: 0, materialsSpent: 0, delivered: {} });
    expect(blueprint.position).toMatchObject({ x: at.x, z: at.z });
    // Placing costs nothing.
    expect(game.client.getView().backpack.axe).toBe(1);
  });

  it("faces the way the player turned it, and turning it changes the ground it covers", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    // A spot that a chest facing the default way fits beside, but one turned a quarter turn does not.
    send(game, place("chest", square.x, square.z, 0));
    const besideAlongDepth = square.z + CHEST_DEPTH_METRES + 0.05;

    expect(game.client.checkPlacement("chest", { x: square.x, z: besideAlongDepth }, 0).allowed).toBe(true);
    expect(game.client.checkPlacement("chest", { x: square.x, z: besideAlongDepth }, 1).allowed).toBe(false);

    send(game, place("chest", square.x, besideAlongDepth, 2));
    const turned = game.entities.with("blueprint", "position").entities.find(({ position }) => position.z === besideAlongDepth);
    expect(turned?.facing).toEqual({ turns: 2 });
  });
});

describe("where a chest cannot go", () => {
  it("refuses a spot over a standing tree", () => {
    const game = createGame({ seed: 42 });
    const tree = nearestTo(game, game.entities.with("tree", "position").entities);

    expect(game.client.checkPlacement("chest", { x: tree.position.x + 0.3, z: tree.position.z }, 0).allowed).toBe(false);
  });

  it("refuses to overlap another chest, finished or as a blueprint", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("chest", square.x, square.z, 0));

    expect(game.client.checkPlacement("chest", { x: square.x + 0.5, z: square.z }, 0).allowed).toBe(false);
    send(game, place("chest", square.x + 0.5, square.z, 0));
    expect(game.entities.with("blueprint").size).toBe(1);

    buildFully(game, onlyBlueprint(game));
    expect(game.entities.with("chest").size).toBe(1);
    expect(game.client.checkPlacement("chest", { x: square.x + 0.5, z: square.z }, 0).allowed).toBe(false);
    // Just clear of it is fine.
    expect(game.client.checkPlacement("chest", { x: square.x + CHEST_WIDTH_METRES + 0.05, z: square.z }, 0).allowed).toBe(true);
  });

  it("refuses to overlap a structure, such as a campfire or a foundation blueprint", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("foundation", square.x, square.z, 0));

    expect(game.client.checkPlacement("chest", { x: square.x + 0.6, z: square.z }, 0).allowed).toBe(false);
  });

  it("stops other structures being placed over a chest", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("chest", square.x, square.z, 0));
    buildFully(game, onlyBlueprint(game));

    for (const structure of ["foundation", "campfire", "leanTo"] as const) {
      expect(game.client.checkPlacement(structure, square, 0).allowed).toBe(false);
    }
  });
});

describe("a chest on a foundation", () => {
  it("stands on the deck, and may not hang off the edge", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("foundation", square.x, square.z, 0));
    buildFully(game, onlyBlueprint(game));
    const deck = game.entities.with("foundation", "position").first;
    if (deck === undefined) throw new Error("No foundation");

    const check = game.client.checkPlacement("chest", { x: square.x + 0.02, z: square.z }, 0);
    expect(check.allowed).toBe(true);
    expect(check.spot.y).toBeCloseTo(deck.position.y, 5);
    expect(game.client.checkPlacement("chest", { x: square.x + 0.4, z: square.z }, 0).allowed).toBe(false);
  });

  it("holds the foundation up, so the foundation cannot be taken down under it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("foundation", square.x, square.z, 0));
    const foundation = onlyBlueprint(game);
    buildFully(game, foundation);
    send(game, place("chest", square.x, square.z, 0));

    send(game, { type: "takeDown", pieceId: idOf(game, foundation) });
    expect(game.client.getView().notice).toBe("holdsUpPiece");
    runSeconds(game, 10);

    expect(foundation.foundation).toBe(true);
  });
});

describe("building a chest", () => {
  it("takes the debarked logs carried to it and the build action, and finishes as a chest", () => {
    const game = createGame({ seed: 42 });
    const blueprint = chestBlueprintNearPlayer(game);
    const id = idOf(game, blueprint);
    deliverLogs(game, blueprint, 1);
    expect(game.client.describeBlueprint(id)?.deliveries).toEqual([{ material: "debarkedLog", has: 1, needs: CHEST_LOG_COST }]);

    send(game, { type: "build", blueprintId: id });
    runSeconds(game, CHEST_BUILD_SECONDS + 1);
    // One log builds only the first stage.
    expect(blueprint.blueprint?.progress).toBeCloseTo(1 / CHEST_LOG_COST, 5);

    deliverLogs(game, blueprint, 1);
    send(game, { type: "build", blueprintId: id });
    runSeconds(game, CHEST_BUILD_SECONDS + 1);

    expect(blueprint.blueprint).toBeUndefined();
    expect(blueprint.chest).toEqual({});
    expect(blueprint.facing).toEqual({ turns: 0 });
  });

  it("needs the axe", () => {
    const game = createGame({ seed: 42 });
    const blueprint = chestBlueprintNearPlayer(game);
    deliverLogs(game, blueprint, CHEST_LOG_COST);
    delete onlyPlayer(game).backpack.contents.axe;

    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    runSeconds(game, CHEST_BUILD_SECONDS + 1);

    expect(blueprint.blueprint?.progress).toBe(0);
    expect(blueprint.blueprint?.materialsSpent).toBe(0);
    expect(game.client.getView().action).toBeNull();
  });
});

describe("saving chests", () => {
  it("keeps chests and chest blueprints, with which way they face", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("chest", square.x, square.z, 1));
    buildFully(game, onlyBlueprint(game));
    send(game, place("chest", square.x + 1.2, square.z + 0.1, 3));

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    const chests = loaded.game.entities.with("chest", "position").entities;
    expect(chests.map(({ position, facing }) => ({ x: position.x, z: position.z, facing }))).toEqual([{ x: square.x, z: square.z, facing: { turns: 1 } }]);
    const plans = loaded.game.entities.with("blueprint", "position").entities;
    expect(plans.map(({ blueprint, position, facing }) => ({ piece: blueprint.piece, x: position.x, facing }))).toEqual([
      { piece: "chest", x: square.x + 1.2, facing: { turns: 3 } },
    ]);
  });
});

/** Places a chest blueprint on open ground near the player. */
function chestBlueprintNearPlayer(game: Game) {
  const square = openSquareNearPlayer(game);
  send(game, place("chest", square.x + 0.1, square.z + 0.2, 0));
  return onlyBlueprint(game);
}

/** Carries the logs a blueprint needs to it and holds the build action until it is finished. */
function buildFully(game: Game, blueprint: Entity): void {
  const needs = game.client.describeBlueprint(idOf(game, blueprint))?.deliveries[0]?.needs ?? 0;
  deliverLogs(game, blueprint, needs);
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => blueprint.blueprint === undefined);
}

/** Carries `count` debarked logs to a blueprint, one at a time. */
function deliverLogs(game: Game, blueprint: Entity, count: number): void {
  for (let i = 0; i < count; i += 1) {
    game.entities.addComponent(onlyPlayer(game), "carrying", "debarkedLog");
    send(game, { type: "deliverToBlueprint", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.client.getView().carrying === null);
  }
}

/** The middle of a building-grid square a few metres from the player, with open ground all round it. */
function openSquareNearPlayer(game: Game, from = 3): { x: number; z: number } {
  const player = onlyPlayer(game);
  for (let distance = from; distance < 30; distance += 1) {
    for (const [dx, dz] of [[1, 0], [0, 1], [0, -1], [-1, 0], [1, 1], [1, -1]] as const) {
      const square = { x: Math.floor(player.position.x + dx * distance) + 0.5, z: Math.floor(player.position.z + dz * distance) + 0.5 };
      const open = [-2, -1, 0, 1, 2].every((ax) => [-2, -1, 0, 1, 2].every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      if (open) return square;
    }
  }
  throw new Error("No open square");
}

function place(structure: StructureKind, x: number, z: number, turns: 0 | 1 | 2 | 3): Command {
  return { type: "placeBlueprint", structure, turns, x, z };
}

function onlyBlueprint(game: Game): Entity & { position: NonNullable<Entity["position"]> } {
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("No blueprint");
  return blueprint;
}

function nearestTo<T extends Entity & { position: { x: number; z: number } }>(game: Game, candidates: T[]): T {
  const { x, z } = onlyPlayer(game).position;
  const sorted = [...candidates].sort((a, b) => Math.hypot(a.position.x - x, a.position.z - z) - Math.hypot(b.position.x - x, b.position.z - z));
  const nearest = sorted[0];
  if (nearest === undefined) throw new Error("Nothing to pick");
  return nearest;
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
  const player = game.entities.with("player", "position", "backpack").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
