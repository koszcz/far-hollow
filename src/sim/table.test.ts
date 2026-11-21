import { describe, expect, it } from "bun:test";
import type { Command, StructureKind } from "./api";
import type { Entity } from "./entities";
import { HUNGER_FILLED_BY } from "./foraging";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { BEDS_SAVE_VERSION, readSave, SAVE_VERSION, TABLES_SAVE_VERSION, writeSave } from "./save";
import { TABLE_BUILD_SECONDS, TABLE_DEPTH_METRES, TABLE_PLANK_COST } from "./furniture/table";
import { TABLE_HUNGER_FACTOR, TABLE_REACH_METRES } from "./tables";
import { isWalkable } from "./walk-map";
import { piecesOf } from "./test-steps";

describe("the table in the build menu", () => {
  it("lists the table as furniture, with its cost of 6 planks and no tool", () => {
    const game = createGame({ seed: 42 });

    expect(TABLE_PLANK_COST).toBe(6);
    expect(game.client.getView().buildMenu).toContainEqual({
      structure: "table",
      cost: [{ material: "plank", count: 6 }],
      placement: "anywhere",
    });
  });
});

describe("placing a table", () => {
  it("goes exactly where the mouse points, off the building grid, facing the way the player turned it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const at = { x: square.x + 0.13, z: square.z - 0.27 };

    const check = game.client.checkPlacement("table", at, 1);
    expect(check.allowed).toBe(true);
    expect(check.spot).toMatchObject({ x: at.x, z: at.z });

    send(game, place("table", at.x, at.z, 1));
    const blueprint = onlyBlueprint(game);
    expect(blueprint.blueprint).toMatchObject({ structure: "table", progress: 0, materialsSpent: 0, delivered: {} });
    expect(blueprint.position).toMatchObject({ x: at.x, z: at.z });
    expect(blueprint.facing).toEqual({ turns: 1 });
  });

  it("covers 1.2 m by 0.8 m, its length along x when facing the default way and along z when turned a quarter", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("table", square.x, square.z, 0));
    // A table 1 m along x overlaps the first one. The same spot along z is clear of it.
    expect(game.client.checkPlacement("table", { x: square.x + 1, z: square.z }, 0).allowed).toBe(false);
    expect(game.client.checkPlacement("table", { x: square.x, z: square.z + 1 }, 0).allowed).toBe(true);
    // Turned a quarter, a table 0.9 m along z reaches back over the first one.
    expect(game.client.checkPlacement("table", { x: square.x, z: square.z + 0.9 }, 1).allowed).toBe(false);
  });
});

describe("where a table cannot go", () => {
  it("refuses a spot over a standing tree", () => {
    const game = createGame({ seed: 42 });
    const tree = game.entities.with("tree", "position").first;
    if (tree === undefined) throw new Error("No tree");

    expect(game.client.checkPlacement("table", { x: tree.position.x + 0.3, z: tree.position.z }, 0).allowed).toBe(false);
  });

  it("refuses to overlap a structure, such as a foundation blueprint or a campfire", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("foundation", square.x, square.z, 0));
    send(game, place("campfire", square.x + 3, square.z, 0));

    expect(game.client.checkPlacement("table", { x: square.x + 0.7, z: square.z }, 0).allowed).toBe(false);
    expect(game.client.checkPlacement("table", { x: square.x + 3, z: square.z + 0.5 }, 0).allowed).toBe(false);
  });

  it("refuses to overlap other furniture, finished or as a blueprint, and stops furniture going over it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("bed", square.x, square.z, 0));
    expect(game.client.checkPlacement("table", { x: square.x + 0.5, z: square.z + 0.5 }, 0).allowed).toBe(false);

    send(game, place("table", square.x + 2.5, square.z, 0));
    buildFully(game, blueprintOf(game, "table"));
    expect(piecesOf(game.entities, "table").length).toBe(1);
    for (const structure of ["table", "bed", "chest", "shelf", "sled"] as const) {
      expect(game.client.checkPlacement(structure, { x: square.x + 2.8, z: square.z + 0.3 }, 0).allowed).toBe(false);
    }
    for (const structure of ["foundation", "campfire", "woodpile"] as const) {
      expect(game.client.checkPlacement(structure, { x: square.x + 2.5, z: square.z }, 0).allowed).toBe(false);
    }
  });
});

describe("building a table", () => {
  it("takes its 6 planks over several trips, needs no tool, and shows its stages as it goes", () => {
    const game = createGame({ seed: 42 });
    const blueprint = tableBlueprintNearPlayer(game);
    const id = idOf(game, blueprint);
    const backpack = onlyPlayer(game).backpack;
    delete backpack.contents.axe;
    delete backpack.contents.knife;
    delete backpack.contents.drawknife;
    delete backpack.contents.saw;
    expect(game.client.describeBlueprint(id)?.deliveries).toEqual([{ material: "plank", has: 0, needs: TABLE_PLANK_COST }]);

    // The first trip brings 4 planks. The table takes them all, builds 4 of its 6 stages, and stops.
    backpack.contents.plank = 4;
    send(game, { type: "build", blueprintId: id });
    runSeconds(game, TABLE_BUILD_SECONDS + 5);
    expect(backpack.contents.plank ?? 0).toBe(0);
    expect(blueprint.blueprint).toMatchObject({ materialsSpent: 4, delivered: { plank: 4 } });
    expect(blueprint.blueprint?.progress).toBeCloseTo(4 / TABLE_PLANK_COST, 5);
    expect(game.client.getView().action).toBeNull();

    // The second trip brings the rest, and more. It takes only what it still needs.
    backpack.contents.plank = 5;
    send(game, { type: "build", blueprintId: id });
    runSeconds(game, TABLE_BUILD_SECONDS + 5);
    expect(blueprint.blueprint).toBeUndefined();
    expect(blueprint.furniture).toBe("table");
    expect(backpack.contents.plank).toBe(3);
  });

  it("spends no planks in the playground", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const blueprint = tableBlueprintNearPlayer(game);
    onlyPlayer(game).backpack.contents.plank = 3;

    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    runSeconds(game, TABLE_BUILD_SECONDS + 5);

    expect(blueprint.furniture).toBe("table");
    expect(onlyPlayer(game).backpack.contents.plank).toBe(3);
  });
});

describe("a finished table", () => {
  it("blocks walking on the ground it covers, and not much past it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("table", square.x, square.z, 0));
    buildFully(game, blueprintOf(game, "table"));

    for (const [dx, dz] of [
      [0, 0],
      [0.5, 0.3],
      [-0.5, -0.3],
    ] as const) {
      expect(isWalkable(game.walkMap, { x: square.x + dx, z: square.z + dz })).toBe(false);
    }
    expect(isWalkable(game.walkMap, { x: square.x, z: square.z + 1.2 })).toBe(true);
    expect(isWalkable(game.walkMap, { x: square.x + 1.7, z: square.z })).toBe(true);
  });

  it("is what E reaches, beside the player", () => {
    const game = createGame({ seed: 42 });
    const table = finishedTableNearPlayer(game);

    expect(game.client.nearestInReach()).toEqual({ kind: "furniture", id: idOf(game, table), furniture: "table" });
  });
});

describe("eating at a table", () => {
  it("fills 25% more hunger within reach of a finished table", () => {
    const game = createGame({ seed: 42 });
    const table = finishedTableNearPlayer(game);
    standBeside(game, table, TABLE_REACH_METRES - 0.2);

    expect(hungerFilledByEating(game, "berries")).toBeCloseTo(HUNGER_FILLED_BY.berries * 1.25, 4);
    expect(hungerFilledByEating(game, "cookedFish")).toBeCloseTo(HUNGER_FILLED_BY.cookedFish * TABLE_HUNGER_FACTOR, 4);
  });

  it("fills the usual hunger out of reach of the table", () => {
    const game = createGame({ seed: 42 });
    const table = finishedTableNearPlayer(game);
    standBeside(game, table, TABLE_REACH_METRES + 0.5);

    expect(hungerFilledByEating(game, "berries")).toBeCloseTo(HUNGER_FILLED_BY.berries, 4);
  });

  it("gives no bonus beside a table blueprint, even one with all its planks but one", () => {
    const game = createGame({ seed: 42 });
    const blueprint = tableBlueprintNearPlayer(game);
    blueprint.blueprint = { structure: "table", progress: 5 / 6, materialsSpent: 5, delivered: { plank: 5 } };
    standBeside(game, blueprint, 0.5);

    expect(hungerFilledByEating(game, "berries")).toBeCloseTo(HUNGER_FILLED_BY.berries, 4);
  });

  it("still makes the player sick from raw fish, as eating anywhere does", () => {
    const game = createGame({ seed: 42 });
    const table = finishedTableNearPlayer(game);
    standBeside(game, table, 0.5);

    expect(hungerFilledByEating(game, "rawFish")).toBeCloseTo(HUNGER_FILLED_BY.rawFish * TABLE_HUNGER_FACTOR, 4);
    expect(onlyPlayer(game).sickness).toBeDefined();
  });
});

describe("saving tables", () => {
  it("raises the save version for tables, and loads a save from before then", () => {
    const game = createGame({ seed: 42 });
    expect(TABLES_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    expect(TABLES_SAVE_VERSION).toBeGreaterThan(BEDS_SAVE_VERSION);
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number };
    save.version = TABLES_SAVE_VERSION - 1;

    expect(readSave(save).ok).toBe(true);
  });

  it("keeps tables and table blueprints, with which way they face and the planks a blueprint has had", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("table", square.x, square.z, 1));
    buildFully(game, blueprintOf(game, "table"));
    send(game, place("table", square.x + 2, square.z, 2));
    blueprintOf(game, "table").blueprint = { structure: "table", progress: 0.5, materialsSpent: 3, delivered: { plank: 4 } };

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    const tables = piecesOf(loaded.game.entities, "table");
    expect(tables.map(({ position, facing }) => ({ x: position.x, z: position.z, facing }))).toEqual([{ x: square.x, z: square.z, facing: { turns: 1 } }]);
    expect(isWalkable(loaded.game.walkMap, { x: square.x, z: square.z })).toBe(false);
    const blueprint = blueprintOf(loaded.game, "table");
    expect(blueprint.blueprint).toEqual({ structure: "table", progress: 0.5, materialsSpent: 3, delivered: { plank: 4 } });
    expect(blueprint.facing).toEqual({ turns: 2 });
  });
});

describe("a table on a foundation", () => {
  it("holds the foundation up, so the foundation cannot be taken down under it", () => {
    // In the playground, so the foundation needs no debarked logs.
    const game = createGame({ seed: 42, freeBuilding: true });
    const square = openSquareNearPlayer(game);
    send(game, place("foundation", square.x, square.z, 0));
    const foundation = blueprintOf(game, "foundation");
    buildFully(game, foundation);
    send(game, place("table", square.x, square.z, 0));
    buildFully(game, blueprintOf(game, "table"));

    send(game, { type: "takeDown", pieceId: idOf(game, foundation) });
    expect(game.client.getView().notice?.kind).toBe("holdsUpPiece");
  });
});

describe("taking down a table", () => {
  it("gives back every plank of a finished table, and lets the player walk there again", () => {
    const game = createGame({ seed: 42 });
    const blueprint = tableBlueprintNearPlayer(game);
    buildFully(game, blueprint);
    const backpack = onlyPlayer(game).backpack;
    backpack.contents.plank = 0;

    send(game, { type: "takeDown", pieceId: idOf(game, blueprint) });
    stepUntil(game, () => piecesOf(game.entities, "table").length === 0);

    // The backpack holds the tools too, so any planks that do not fit drop in a pile.
    const piled = game.entities.with("pile").entities.reduce((sum, { pile }) => sum + (pile.content === "plank" ? pile.count : 0), 0);
    expect((backpack.contents.plank ?? 0) + piled).toBe(TABLE_PLANK_COST);
    expect(isWalkable(game.walkMap, blueprint.position)).toBe(true);
  });

  it("gives back the planks a table blueprint has had so far", () => {
    const game = createGame({ seed: 42 });
    const blueprint = tableBlueprintNearPlayer(game);
    const backpack = onlyPlayer(game).backpack;
    backpack.contents.plank = 3;
    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    runSeconds(game, TABLE_BUILD_SECONDS + 5);
    expect(backpack.contents.plank ?? 0).toBe(0);

    send(game, { type: "takeDown", pieceId: idOf(game, blueprint) });
    stepUntil(game, () => game.entities.with("blueprint").size === 0);

    expect(backpack.contents.plank).toBe(3);
  });
});

/** Gives the player one of a food, eats it from low hunger, and returns how much hunger it filled. */
function hungerFilledByEating(game: Game, food: "berries" | "cookedFish" | "rawFish"): number {
  const player = onlyPlayer(game);
  player.backpack.contents[food] = 1;
  player.needs.hunger.level = 0.2;
  game.client.send({ type: "eat", food });
  game.step();
  return player.needs.hunger.level - 0.2;
}

/** Moves the player to stand this far outside the front edge of a table or table blueprint facing the default way. */
function standBeside(game: Game, table: Entity & { position: NonNullable<Entity["position"]> }, metres: number): void {
  const player = onlyPlayer(game);
  player.position.x = table.position.x;
  player.position.z = table.position.z + TABLE_DEPTH_METRES / 2 + metres;
}

/** Places a table blueprint on open ground near the player, facing the default way. */
function tableBlueprintNearPlayer(game: Game) {
  const square = openSquareNearPlayer(game);
  send(game, place("table", square.x + 0.1, square.z + 0.2, 0));
  return onlyBlueprint(game);
}

/** Builds a table on open ground 2 m from the player, facing the default way, so the player stands beside it. */
function finishedTableNearPlayer(game: Game) {
  const square = openSquareNearPlayer(game, 2);
  send(game, place("table", square.x, square.z, 0));
  const table = blueprintOf(game, "table");
  buildFully(game, table);
  return table;
}

/** Gives the player the planks a blueprint still needs and holds the build action until it is finished. */
function buildFully(game: Game, blueprint: Entity): void {
  const contents = onlyPlayer(game).backpack.contents;
  for (const { material, has, needs } of game.client.describeBlueprint(idOf(game, blueprint))?.deliveries ?? []) {
    if (material === "plank") contents.plank = (contents.plank ?? 0) + needs - has;
  }
  // The backpack may not hold them all at once, so the player keeps building until the blueprint has them all.
  while (blueprint.blueprint !== undefined) {
    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => blueprint.blueprint === undefined || game.client.getView().action === null);
  }
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
      const open = [-3, -2, -1, 0, 1, 2, 3].every((ax) =>
        [-3, -2, -1, 0, 1, 2, 3].every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })),
      );
      if (open) return square;
    }
  }
  throw new Error("No open square");
}

function place(structure: StructureKind, x: number, z: number, turns: 0 | 1 | 2 | 3): Command {
  return { type: "placeBlueprint", structure, turns, x, z };
}

function blueprintOf(game: Game, structure: StructureKind): Entity & { position: NonNullable<Entity["position"]> } {
  const blueprint = game.entities.with("blueprint", "position").entities.find((entity) => entity.blueprint.structure === structure);
  if (blueprint === undefined) throw new Error(`No ${structure} blueprint`);
  return blueprint;
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
  const player = game.entities.with("player", "position", "backpack", "needs", "respawnPoint").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
