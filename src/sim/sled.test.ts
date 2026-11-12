import { describe, expect, it } from "bun:test";
import type { Command, StructureKind } from "./api";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { readSave, ROOF_FRAMES_SAVE_VERSION, SAVE_VERSION, SLEDS_SAVE_VERSION, writeSave } from "./save";
import { SLED_BUILD_SECONDS, SLED_LOG_COST, SLED_STICK_COST } from "./structures";
import { terrainHeightAt } from "./valley";
import { isWalkable } from "./walk-map";

describe("the sled in the build menu", () => {
  it("lists the sled, placed anywhere, with its cost of 2 logs and 4 sticks and the axe it needs", () => {
    const game = createGame({ seed: 42 });

    expect(game.client.getView().buildMenu).toContainEqual({
      structure: "sled",
      cost: [
        { material: "log", count: 2 },
        { material: "stick", count: 4 },
      ],
      tool: "axe",
      placement: "anywhere",
    });
  });
});

describe("placing a sled", () => {
  it("goes exactly where the mouse points, off the building grid, facing the way the player turned it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const at = { x: square.x + 0.13, z: square.z - 0.27 };

    const check = game.client.checkPlacement("sled", at, 1);
    expect(check.allowed).toBe(true);
    expect(check.spot).toMatchObject({ x: at.x, z: at.z });
    expect(check.spot.y).toBeCloseTo(terrainHeightAt(game.valley.terrain, at.x, at.z), 5);

    send(game, place("sled", at.x, at.z, 1));
    const blueprint = onlyBlueprint(game);
    expect(blueprint.blueprint).toMatchObject({ structure: "sled", progress: 0, materialsSpent: 0, delivered: {} });
    expect(blueprint.position).toMatchObject({ x: at.x, z: at.z });
    expect(blueprint.facing).toEqual({ turns: 1 });
  });

  it("covers 1.8 m along its runners, so turning it changes where a second sled fits beside it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("sled", square.x, square.z, 0));
    // Facing the default way, the runners run along x. A spot 1 m along z is clear of the first sled's width,
    // but a sled turned a quarter turn there reaches back over it.
    const beside = { x: square.x, z: square.z + 1 };

    expect(game.client.checkPlacement("sled", beside, 0).allowed).toBe(true);
    expect(game.client.checkPlacement("sled", beside, 1).allowed).toBe(false);
  });

  it("refuses a spot by a standing tree, or over a chest", () => {
    const game = createGame({ seed: 42 });
    const tree = nearestTo(game, game.entities.with("tree", "position").entities);
    expect(game.client.checkPlacement("sled", { x: tree.position.x + 0.3, z: tree.position.z }, 0).allowed).toBe(false);

    const square = openSquareNearPlayer(game);
    send(game, place("chest", square.x, square.z, 0));
    expect(game.client.checkPlacement("sled", { x: square.x + 0.8, z: square.z }, 0).allowed).toBe(false);
  });

  it("refuses ground the player cannot walk on, even where only the far end of the sled reaches it", () => {
    const game = createGame({ seed: 42 });
    const tree = nearestTo(game, game.entities.with("tree", "position").entities);
    // The middle of the sled is clear of the tree, but its runners reach the ground by the trunk.
    const besideTree = { x: tree.position.x + 1, z: tree.position.z };
    expect(isWalkable(game.walkMap, besideTree)).toBe(false);
    const far = { x: tree.position.x + 1.8, z: tree.position.z };

    expect(game.client.checkPlacement("sled", far, 0).allowed).toBe(false);
  });

  it("stops other structures, such as a chest or a woodpile, being placed over a finished sled", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("sled", square.x, square.z, 0));
    buildFully(game, onlyBlueprint(game));

    expect(game.client.checkPlacement("chest", { x: square.x + 0.5, z: square.z }, 0).allowed).toBe(false);
    expect(game.client.checkPlacement("sled", { x: square.x + 0.5, z: square.z + 0.3 }, 0).allowed).toBe(false);
    expect(game.client.checkPlacement("woodpile", { x: square.x + 0.5, z: square.z + 0.5 }, 0).allowed).toBe(false);
  });
});

describe("building a sled", () => {
  it("takes the logs carried to it, then sticks from the backpack, with the build action, and finishes as an empty sled", () => {
    const game = createGame({ seed: 42 });
    const blueprint = sledBlueprintNearPlayer(game);
    const id = idOf(game, blueprint);
    const contents = onlyPlayer(game).backpack.contents;
    contents.stick = SLED_STICK_COST;
    expect(game.client.describeBlueprint(id)?.deliveries).toEqual([{ material: "log", has: 0, needs: SLED_LOG_COST }]);

    deliverLogs(game, blueprint, SLED_LOG_COST);
    expect(game.client.describeBlueprint(id)?.deliveries).toEqual([{ material: "log", has: SLED_LOG_COST, needs: SLED_LOG_COST }]);
    send(game, { type: "build", blueprintId: id });
    stepUntil(game, () => blueprint.blueprint === undefined);

    expect(blueprint.sled).toEqual({ log: 0, debarkedLog: 0 });
    expect(blueprint.facing).toEqual({ turns: 0 });
    expect(contents.stick ?? 0).toBe(0);
    // A parked sled blocks no walking, since the player drags it about.
    expect(isWalkable(game.walkMap, blueprint.position)).toBe(true);
  });

  it("refuses a debarked log, since its runners are logs with the bark on", () => {
    const game = createGame({ seed: 42 });
    const blueprint = sledBlueprintNearPlayer(game);
    game.entities.addComponent(onlyPlayer(game), "carrying", "debarkedLog");

    send(game, { type: "deliverToBlueprint", blueprintId: idOf(game, blueprint) });
    runSeconds(game, 10);

    expect(game.client.getView().carrying).toBe("debarkedLog");
    expect(blueprint.blueprint?.delivered).toEqual({});
  });

  it("stops when the sticks run out, after building with the logs", () => {
    const game = createGame({ seed: 42 });
    const blueprint = sledBlueprintNearPlayer(game);
    onlyPlayer(game).backpack.contents.stick = 1;
    deliverLogs(game, blueprint, SLED_LOG_COST);

    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    runSeconds(game, SLED_BUILD_SECONDS + 1);

    // Two log stages and one stick stage of six.
    expect(blueprint.blueprint?.materialsSpent).toBe(3);
    expect(blueprint.blueprint?.progress).toBeCloseTo(3 / 6, 5);
    expect(game.client.getView().action).toBeNull();
  });

  it("needs the axe", () => {
    const game = createGame({ seed: 42 });
    const blueprint = sledBlueprintNearPlayer(game);
    onlyPlayer(game).backpack.contents.stick = SLED_STICK_COST;
    deliverLogs(game, blueprint, SLED_LOG_COST);
    delete onlyPlayer(game).backpack.contents.axe;

    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    runSeconds(game, SLED_BUILD_SECONDS + 1);

    expect(blueprint.blueprint?.progress).toBe(0);
  });

  it("lets the player build as many sleds as they like", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    for (const dz of [-1.5, 0, 1.5]) {
      send(game, place("sled", square.x, square.z + dz, 0));
      const blueprint = game.entities.with("blueprint", "position").entities.find(({ position }) => position.z === square.z + dz);
      if (blueprint === undefined) throw new Error("The sled was not placed");
      buildFully(game, blueprint);
    }

    expect(game.entities.with("sled").size).toBe(3);
  });
});

describe("saving sleds", () => {
  it("keeps sleds and sled blueprints, where they stand and which way they face", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("sled", square.x, square.z, 1));
    buildFully(game, onlyBlueprint(game));
    send(game, place("sled", square.x + 1.3, square.z + 0.1, 2));
    deliverLogs(game, onlyBlueprint(game), 1);

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    const sleds = loaded.game.entities.with("sled", "position").entities;
    expect(sleds.map(({ position, facing, sled }) => ({ x: position.x, z: position.z, facing, sled }))).toEqual([
      { x: square.x, z: square.z, facing: { turns: 1 }, sled: { log: 0, debarkedLog: 0 } },
    ]);
    const plans = loaded.game.entities.with("blueprint", "position").entities;
    expect(plans.map(({ blueprint, position, facing }) => ({ structure: blueprint.structure, x: position.x, facing, delivered: blueprint.delivered }))).toEqual(
      [{ structure: "sled", x: square.x + 1.3, facing: { turns: 2 }, delivered: { log: 1 } }],
    );
  });

  it("raises the save version, and upgrades an older save when it is loaded", () => {
    const game = createGame({ seed: 42 });
    const save = { ...writeSave(game), version: SLEDS_SAVE_VERSION - 1 };

    expect(SLEDS_SAVE_VERSION).toBe(SAVE_VERSION);
    expect(SLEDS_SAVE_VERSION).toBeGreaterThan(ROOF_FRAMES_SAVE_VERSION);
    const loaded = readSave(JSON.parse(JSON.stringify(save)));
    if (!loaded.ok) throw new Error("The older save did not load");
    expect(writeSave(loaded.game).version).toBe(SAVE_VERSION);
    expect(loaded.game.entities.with("sled").size).toBe(0);
  });

  it("turns away a saved sled holding something other than logs", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("sled", square.x, square.z, 0));
    buildFully(game, onlyBlueprint(game));
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { entities: { components: Record<string, unknown> }[] };
    for (const { components } of save.entities) if (components.sled !== undefined) components.sled = { log: 0, debarkedLog: 0, firewood: 2 };

    expect(readSave(save).ok).toBe(false);
  });
});

/** Places a sled blueprint on open ground near the player. */
function sledBlueprintNearPlayer(game: Game) {
  const square = openSquareNearPlayer(game);
  send(game, place("sled", square.x + 0.1, square.z + 0.2, 0));
  return onlyBlueprint(game);
}

/** Carries the logs a blueprint needs to it, gives the player the sticks, and holds the build action until it is finished. */
function buildFully(game: Game, blueprint: Entity): void {
  const deliveries = game.client.describeBlueprint(idOf(game, blueprint))?.deliveries ?? [];
  for (const { material, needs } of deliveries) deliverLogs(game, blueprint, needs, material);
  const contents = onlyPlayer(game).backpack.contents;
  contents.stick = (contents.stick ?? 0) + SLED_STICK_COST;
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => blueprint.blueprint === undefined);
}

/** Carries `count` logs, or debarked logs, to a blueprint, one at a time. */
function deliverLogs(game: Game, blueprint: Entity, count: number, kind: "log" | "debarkedLog" = "log"): void {
  for (let i = 0; i < count; i += 1) {
    game.entities.addComponent(onlyPlayer(game), "carrying", kind);
    send(game, { type: "deliverToBlueprint", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.client.getView().carrying === null);
  }
}

function nearestTo<T extends Entity & { position: { x: number; z: number } }>(game: Game, candidates: T[]): T {
  const { x, z } = onlyPlayer(game).position;
  const sorted = [...candidates].sort((a, b) => Math.hypot(a.position.x - x, a.position.z - z) - Math.hypot(b.position.x - x, b.position.z - z));
  const nearest = sorted[0];
  if (nearest === undefined) throw new Error("Nothing to pick");
  return nearest;
}

/** The middle of a building-grid square a few metres from the player, with open ground all round it. */
function openSquareNearPlayer(game: Game, from = 3): { x: number; z: number } {
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
