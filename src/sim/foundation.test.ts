import { describe, expect, it } from "vitest";
import type { Command } from "./api";
import type { Entity } from "./entities";
import { foundationLegs } from "./foundations";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { terrainHeightAt } from "./valley";
import { FOUNDATION_BUILD_SECONDS, FOUNDATION_LOG_COST } from "./structures";
import { isWalkable } from "./walk-map";

describe("the foundation in the build menu", () => {
  it("lists the foundation with its cost in debarked logs", () => {
    const game = createGame({ seed: 42 });

    expect(game.client.getView().buildMenu).toContainEqual({ structure: "foundation", cost: [{ material: "debarkedLog", count: FOUNDATION_LOG_COST }] });
    expect(FOUNDATION_LOG_COST).toBeGreaterThan(1);
  });
});

describe("placing a foundation", () => {
  it("covers the one building-grid square under the spot, with nothing delivered yet", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);

    send(game, placeFoundation(square.x + 0.3, square.z - 0.4));

    const blueprint = onlyBlueprint(game);
    expect(blueprint.blueprint).toMatchObject({ structure: "foundation", progress: 0, materialsSpent: 0, delivered: {} });
    expect(blueprint.position).toMatchObject({ x: square.x, z: square.z });
    expect(game.client.describeBlueprint(idOf(game, blueprint))?.deliveries).toEqual([
      { material: "debarkedLog", has: 0, needs: FOUNDATION_LOG_COST },
    ]);
  });

  it("lets foundations sit side by side, but not two on one square", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);

    send(game, placeFoundation(square.x, square.z));
    send(game, placeFoundation(square.x + 1, square.z));
    send(game, placeFoundation(square.x, square.z + 1));
    send(game, placeFoundation(square.x + 0.2, square.z - 0.2));

    const spots = game.entities.with("blueprint", "position").entities.map(({ position }) => [position.x, position.z]);
    expect(spots).toEqual([
      [square.x, square.z],
      [square.x + 1, square.z],
      [square.x, square.z + 1],
    ]);
  });

  it("refuses a square with a standing tree on it", () => {
    const game = createGame({ seed: 42 });
    const tree = nearestTo(game, game.entities.with("tree", "position").entities);

    expect(game.client.checkPlacement("foundation", tree.position, 0).allowed).toBe(false);
    send(game, placeFoundation(tree.position.x, tree.position.z));

    expect(game.entities.with("blueprint").size).toBe(0);
  });

  it("removes the stump under it for good", () => {
    const game = createGame({ seed: 42 });
    const tree = nearestTo(game, game.entities.with("tree", "position").entities);
    send(game, { type: "chopTree", treeId: idOf(game, tree) });
    stepUntil(game, () => tree.stump === true);
    const stumpsBefore = game.entities.with("stump").size;
    const { x, z } = tree.position;
    expect(isWalkable(game.walkMap, { x, z })).toBe(false);

    expect(game.client.checkPlacement("foundation", { x, z }, 0).allowed).toBe(true);
    send(game, placeFoundation(x, z));

    expect(game.entities.with("blueprint").size).toBe(1);
    expect(game.entities.with("stump").size).toBe(stumpsBefore - 1);
    expect(game.entities.has(tree)).toBe(false);
    // Nothing grows back where it stood, even days later.
    send(game, { type: "skipTime", hours: 24 * 5 });
    expect(game.entities.with("stump").size).toBe(stumpsBefore - 1);
    expect(game.entities.with("tree", "position").entities.some((other) => other.position.x === x && other.position.z === z)).toBe(false);
  });
});

describe("delivering debarked logs to a blueprint", () => {
  it("walks the player to the blueprint and adds the debarked log from their shoulder", () => {
    const game = createGame({ seed: 42 });
    const blueprint = foundationBlueprintNearPlayer(game, 8);
    const id = idOf(game, blueprint);
    shoulder(game, "debarkedLog");

    send(game, { type: "deliverToBlueprint", blueprintId: id });
    stepUntil(game, () => game.client.getView().carrying === null);

    const player = onlyPlayer(game);
    expect(Math.hypot(player.position.x - blueprint.position.x, player.position.z - blueprint.position.z)).toBeLessThan(2.6);
    expect(blueprint.blueprint?.delivered).toEqual({ debarkedLog: 1 });
    expect(game.client.describeBlueprint(id)?.deliveries).toEqual([{ material: "debarkedLog", has: 1, needs: FOUNDATION_LOG_COST }]);
    // Delivering is not construction.
    expect(blueprint.blueprint?.progress).toBe(0);
  });

  it("shows the blueprint beside the player, with how many logs it has and needs", () => {
    const game = createGame({ seed: 42 });
    const blueprint = foundationBlueprintNearPlayer(game, 8);
    deliverLogs(game, blueprint, 2);

    expect(game.client.getView().nearbyBlueprint).toEqual({
      id: idOf(game, blueprint),
      structure: "foundation",
      progress: 0,
      deliveries: [{ material: "debarkedLog", has: 2, needs: FOUNDATION_LOG_COST }],
    });
  });

  it("takes no more logs than the blueprint needs", () => {
    const game = createGame({ seed: 42 });
    const blueprint = foundationBlueprintNearPlayer(game);
    deliverLogs(game, blueprint, FOUNDATION_LOG_COST);
    shoulder(game, "debarkedLog");

    send(game, { type: "deliverToBlueprint", blueprintId: idOf(game, blueprint) });
    runSeconds(game, 1);

    expect(blueprint.blueprint?.delivered).toEqual({ debarkedLog: FOUNDATION_LOG_COST });
    expect(game.client.getView().carrying).toBe("debarkedLog");
  });

  it("does not take a log that still has its bark", () => {
    const game = createGame({ seed: 42 });
    const blueprint = foundationBlueprintNearPlayer(game);
    shoulder(game, "log");

    send(game, { type: "deliverToBlueprint", blueprintId: idOf(game, blueprint) });
    runSeconds(game, 1);

    expect(blueprint.blueprint?.delivered).toEqual({});
    expect(game.client.getView().carrying).toBe("log");
  });
});

describe("building a foundation", () => {
  it("spends delivered logs stage by stage, and stops when they run out", () => {
    const game = createGame({ seed: 42 });
    const blueprint = foundationBlueprintNearPlayer(game);
    const id = idOf(game, blueprint);
    deliverLogs(game, blueprint, 2);

    send(game, { type: "build", blueprintId: id });
    stepUntil(game, () => game.client.getView().action?.kind === "build");
    // The first log goes in as soon as work starts.
    expect(blueprint.blueprint?.materialsSpent).toBe(1);
    runSeconds(game, FOUNDATION_BUILD_SECONDS);

    expect(game.client.getView().action).toBeNull();
    expect(blueprint.blueprint?.materialsSpent).toBe(2);
    expect(blueprint.blueprint?.progress).toBeCloseTo(2 / FOUNDATION_LOG_COST, 5);
    // Delivered logs stay delivered once spent.
    expect(game.client.describeBlueprint(id)?.deliveries[0]?.has).toBe(2);
  });

  it("does not start without a delivered log", () => {
    const game = createGame({ seed: 42 });
    const blueprint = foundationBlueprintNearPlayer(game);

    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    runSeconds(game, 3);

    expect(blueprint.blueprint?.progress).toBe(0);
    expect(game.client.getView().action).toBeNull();
  });

  it("finishes once every log is delivered and built in, and the player can walk onto it and across it", () => {
    const game = createGame({ seed: 42 });
    const blueprint = foundationBlueprintNearPlayer(game);
    const { x, z } = blueprint.position;
    deliverLogs(game, blueprint, FOUNDATION_LOG_COST);

    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    runSeconds(game, FOUNDATION_BUILD_SECONDS + 1);

    expect(game.entities.with("blueprint").size).toBe(0);
    expect(blueprint.foundation).toBe(true);
    expect(blueprint.blocksWalking).toBeUndefined();
    expect(isWalkable(game.walkMap, { x, z })).toBe(true);

    const player = onlyPlayer(game);
    const deckTop = blueprint.position.y;
    send(game, { type: "walkTo", x, z });
    stepUntil(game, () => player.walkPath === undefined);
    expect(player.position).toMatchObject({ x, z });
    expect(player.position.y).toBeCloseTo(deckTop, 5);

    send(game, { type: "walkTo", x: x + 3, z });
    stepUntil(game, () => player.walkPath === undefined);
    expect(player.position.x).toBeCloseTo(x + 3, 5);
    expect(player.position.y).toBeLessThan(deckTop);
  });
});

describe("a foundation on sloped ground", () => {
  it("keeps its deck level above the highest ground, on legs that reach down to the ground", () => {
    const game = createGame({ seed: 42 });
    const square = slopedSquare(game);
    const check = game.client.checkPlacement("foundation", square, 0);
    expect(check.allowed).toBe(true);

    const legs = foundationLegs(check.spot, (x, z) => terrainHeightAt(game.valley.terrain, x, z));

    expect(legs).toHaveLength(4);
    for (const leg of legs) {
      expect(leg.bottom).toBeCloseTo(terrainHeightAt(game.valley.terrain, leg.x, leg.z), 5);
      expect(leg.top).toBeGreaterThan(leg.bottom);
      expect(leg.top).toBeLessThan(check.spot.y);
    }
    const lengths = legs.map((leg) => leg.top - leg.bottom);
    // The legs on the low side grow longer.
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeGreaterThan(0.1);
  });
});

/** An open square near the player whose ground drops by more than 0.1 m from one corner to another. */
function slopedSquare(game: Game): { x: number; z: number } {
  const player = onlyPlayer(game);
  const { terrain } = game.valley;
  for (let dx = -20; dx <= 20; dx += 1) {
    for (let dz = -20; dz <= 20; dz += 1) {
      const square = { x: Math.floor(player.position.x) + dx + 0.5, z: Math.floor(player.position.z) + dz + 0.5 };
      const heights = [-0.5, 0.5].flatMap((cx) => [-0.5, 0.5].map((cz) => terrainHeightAt(terrain, square.x + cx, square.z + cz)));
      const open = isWalkable(game.walkMap, square) && game.client.checkPlacement("foundation", square, 0).allowed;
      if (open && Math.max(...heights) - Math.min(...heights) > 0.2) return square;
    }
  }
  throw new Error("No sloped square");
}

/** Places a foundation blueprint on an open square at least `from` metres from the player. */
function foundationBlueprintNearPlayer(game: Game, from = 3) {
  const square = openSquareNearPlayer(game, from);
  send(game, placeFoundation(square.x, square.z));
  return onlyBlueprint(game);
}

/** Puts a log or debarked log on the player's shoulder, as if they had picked it up. */
function shoulder(game: Game, log: "log" | "debarkedLog"): void {
  game.entities.addComponent(onlyPlayer(game), "carrying", log);
}

/** Carries `count` debarked logs to a blueprint, one at a time. */
function deliverLogs(game: Game, blueprint: Entity, count: number): void {
  for (let i = 0; i < count; i += 1) {
    shoulder(game, "debarkedLog");
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
      const open = [-1, 0, 1].every((ax) => [-1, 0, 1].every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      if (open) return square;
    }
  }
  throw new Error("No open square");
}

function placeFoundation(x: number, z: number): Command {
  return { type: "placeBlueprint", structure: "foundation", turns: 0, x, z };
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

