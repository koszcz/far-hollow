import { describe, expect, it } from "bun:test";
import { nearbyOf, type BackpackContent, type Command, type StructureKind } from "./api";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { readSave, SAVE_VERSION, SHELVES_SAVE_VERSION, SLED_PLANKS_SAVE_VERSION, writeSave, type SaveFile } from "./save";
import { SHELF_BUILD_SECONDS } from "./furniture/shelf";
import { finishReach, piecesOf, storingPiecesOf, withOldFurnitureParts } from "./test-steps";
import { isWalkable } from "./walk-map";

describe("the shelf in the build menu", () => {
  it("lists the shelf as furniture, with its cost of 4 planks and no tool", () => {
    const game = createGame({ seed: 42 });

    expect(game.client.getView().buildMenu).toContainEqual({
      structure: "shelf",
      cost: [{ material: "plank", count: 4 }],
      placement: "anywhere",
    });
  });
});

describe("placing a shelf", () => {
  it("goes exactly where the mouse points, off the building grid, facing the way the player turned it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const at = { x: square.x + 0.13, z: square.z - 0.27 };

    const check = game.client.checkPlacement("shelf", at, 1);
    expect(check.allowed).toBe(true);
    expect(check.spot).toMatchObject({ x: at.x, z: at.z });

    send(game, place("shelf", at.x, at.z, 1));
    const blueprint = onlyBlueprint(game);
    expect(blueprint.blueprint).toMatchObject({ structure: "shelf", progress: 0, materialsSpent: 0, delivered: {} });
    expect(blueprint.position).toMatchObject({ x: at.x, z: at.z });
    expect(blueprint.facing).toEqual({ turns: 1 });
  });

  it("covers more ground along its front than front to back, so turning it changes what fits beside it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("shelf", square.x, square.z, 0));
    const beside = { x: square.x, z: square.z + 0.45 };

    expect(game.client.checkPlacement("shelf", beside, 0).allowed).toBe(true);
    expect(game.client.checkPlacement("shelf", beside, 1).allowed).toBe(false);
  });
});

describe("where a shelf cannot go", () => {
  it("refuses a spot over a standing tree", () => {
    const game = createGame({ seed: 42 });
    const tree = game.entities.with("tree", "position").first;
    if (tree === undefined) throw new Error("No tree");

    expect(game.client.checkPlacement("shelf", { x: tree.position.x + 0.3, z: tree.position.z }, 0).allowed).toBe(false);
  });

  it("refuses to overlap a structure, such as a foundation blueprint", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("foundation", square.x, square.z, 0));

    expect(game.client.checkPlacement("shelf", { x: square.x + 0.6, z: square.z }, 0).allowed).toBe(false);
  });

  it("refuses to overlap other furniture, finished or as a blueprint", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("chest", square.x, square.z, 0));
    expect(game.client.checkPlacement("shelf", { x: square.x + 0.5, z: square.z }, 0).allowed).toBe(false);

    send(game, place("shelf", square.x + 2, square.z, 0));
    const shelf = game.entities.with("blueprint", "position").entities.find(({ blueprint }) => blueprint.structure === "shelf");
    if (shelf === undefined) throw new Error("No shelf blueprint");
    expect(game.client.checkPlacement("chest", { x: square.x + 2.5, z: square.z }, 0).allowed).toBe(false);

    buildFully(game, shelf);
    expect(shelf.furniture).toBe("shelf");
    expect(shelf.storage).toEqual({ contents: {} });
    for (const structure of ["shelf", "chest", "sled"] as const) {
      expect(game.client.checkPlacement(structure, { x: square.x + 2.5, z: square.z }, 0).allowed).toBe(false);
    }
    for (const structure of ["foundation", "campfire"] as const) {
      expect(game.client.checkPlacement(structure, { x: square.x + 2, z: square.z }, 0).allowed).toBe(false);
    }
  });
});

describe("building a shelf", () => {
  it("takes its 4 planks from the backpack with the build action, needs no tool, and finishes as an empty shelf", () => {
    const game = createGame({ seed: 42 });
    const blueprint = shelfBlueprintNearPlayer(game);
    const id = idOf(game, blueprint);
    const backpack = onlyPlayer(game).backpack;
    backpack.contents.plank = 6;
    delete backpack.contents.axe;
    expect(game.client.describeBlueprint(id)?.deliveries).toEqual([{ material: "plank", has: 0, needs: 4 }]);

    send(game, { type: "build", blueprintId: id });
    runSeconds(game, SHELF_BUILD_SECONDS + 5);

    expect(blueprint.blueprint).toBeUndefined();
    expect(blueprint.furniture).toBe("shelf");
    expect(blueprint.storage).toEqual({ contents: {} });
    expect(blueprint.furniture).not.toBe("chest");
    expect(backpack.contents.plank).toBe(2);
  });

  it("keeps the planks it has had, so the player can bring the rest on later trips", () => {
    const game = createGame({ seed: 42 });
    const blueprint = shelfBlueprintNearPlayer(game);
    const id = idOf(game, blueprint);
    const backpack = onlyPlayer(game).backpack;

    backpack.contents.plank = 3;
    send(game, { type: "build", blueprintId: id });
    runSeconds(game, SHELF_BUILD_SECONDS + 5);
    expect(backpack.contents.plank ?? 0).toBe(0);
    expect(blueprint.blueprint).toMatchObject({ materialsSpent: 3, delivered: { plank: 3 } });

    backpack.contents.plank = 2;
    send(game, { type: "build", blueprintId: id });
    runSeconds(game, SHELF_BUILD_SECONDS + 5);
    expect(blueprint.furniture).toBe("shelf");
    expect(blueprint.storage).toEqual({ contents: {} });
    expect(backpack.contents.plank).toBe(1);
  });

  it("spends no planks in the playground", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const blueprint = shelfBlueprintNearPlayer(game);
    onlyPlayer(game).backpack.contents.plank = 3;

    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    runSeconds(game, SHELF_BUILD_SECONDS + 5);

    expect(blueprint.furniture).toBe("shelf");

    expect(blueprint.storage).toEqual({ contents: {} });
    expect(onlyPlayer(game).backpack.contents.plank).toBe(3);
  });
});

describe("a finished shelf", () => {
  it("blocks walking on the ground it covers", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    // One shelf in the middle of a walk-map cell, and one where four cells meet.
    for (const at of [square, { x: square.x + 1.5, z: square.z + 1.5 }]) {
      expect(isWalkable(game.walkMap, at)).toBe(true);
      send(game, place("shelf", at.x, at.z, 0));
      buildFully(game, onlyBlueprint(game));
    }

    for (const shelf of storingPiecesOf(game.entities, "shelf")) {
      for (const [dx, dz] of [
        [0, 0],
        [0.4, 0.15],
        [-0.4, 0.15],
        [0.4, -0.15],
        [-0.4, -0.15],
      ] as const) {
        expect(isWalkable(game.walkMap, { x: shelf.position.x + dx, z: shelf.position.z + dz })).toBe(false);
      }
    }
  });
});

describe("opening a shelf", () => {
  it("walks the player to the shelf and opens it in the chest panel, named as a shelf, empty at first", () => {
    const game = createGame({ seed: 42 });
    const shelf = buildShelf(game);
    expect(nearbyOf(game.client.getView(), "openChest")).toBeNull();

    open(game, shelf);

    expect(nearbyOf(game.client.getView(), "openChest")).toEqual({ id: idOf(game, shelf), furniture: "shelf", contents: {}, weight: 0, weightLimit: 30 });
  });

  it("moves small materials, tools, and food between the backpack and the shelf", () => {
    const game = createGame({ seed: 42 });
    const shelf = buildShelf(game);
    give(game, "stick", 3);
    give(game, "berries", 2);
    open(game, shelf);

    send(game, { type: "putInChest", chestId: idOf(game, shelf), content: "stick", all: true });
    send(game, { type: "putInChest", chestId: idOf(game, shelf), content: "axe", all: false });
    send(game, { type: "putInChest", chestId: idOf(game, shelf), content: "berries", all: false });
    expect(shelf.storage?.contents).toEqual({ stick: 3, axe: 1, berries: 1 });

    send(game, { type: "takeFromChest", chestId: idOf(game, shelf), content: "stick", all: false });
    expect(shelf.storage?.contents).toEqual({ stick: 2, axe: 1, berries: 1 });
    expect(game.client.getView().backpack.stick).toBe(1);
  });
});

describe("the shelf's weight limit", () => {
  it("holds up to 30 kg: a shift-click puts in as many as fit, and the rest stay in the backpack", () => {
    const game = createGame({ seed: 42 });
    const shelf = buildShelf(game);
    give(game, "firewood", 25);
    open(game, shelf);

    send(game, { type: "putInChest", chestId: idOf(game, shelf), content: "firewood", all: true });

    expect(nearbyOf(game.client.getView(), "openChest")).toMatchObject({ contents: { firewood: 20 }, weight: 30, weightLimit: 30 });
    expect(game.client.getView().backpack.firewood).toBe(5);
  });

  it("refuses even one more once full, and tells the player the shelf is full", () => {
    const game = createGame({ seed: 42 });
    const shelf = buildShelf(game);
    if (shelf.storage === undefined) throw new Error("No shelf");
    shelf.storage.contents.firewood = 20;
    give(game, "stick", 1);
    open(game, shelf);

    send(game, { type: "putInChest", chestId: idOf(game, shelf), content: "stick", all: false });

    expect(game.client.getView().backpack.stick).toBe(1);
    expect(shelf.storage.contents).toEqual({ firewood: 20 });
    expect(game.client.getView().notice?.kind).toBe("shelfFull");
  });

  it("never takes a log or debarked log", () => {
    const game = createGame({ seed: 42 });
    const shelf = buildShelf(game);
    open(game, shelf);

    for (const log of ["log", "debarkedLog"]) {
      send(game, { type: "putInChest", chestId: idOf(game, shelf), content: log as BackpackContent, all: true });
    }

    expect(shelf.storage?.contents).toEqual({});
  });
});

describe("taking down a shelf", () => {
  it("gives back its 4 planks in the backpack once it is empty", () => {
    const game = createGame({ seed: 42 });
    const shelf = buildShelf(game);
    expect(onlyPlayer(game).backpack.contents.plank ?? 0).toBe(0);

    send(game, { type: "takeDown", pieceId: idOf(game, shelf) });
    stepUntil(game, () => !game.entities.has(shelf));

    expect(onlyPlayer(game).backpack.contents.plank).toBe(4);
  });

  it("is refused while the shelf holds anything, and the player is told to empty it first", () => {
    const game = createGame({ seed: 42 });
    const shelf = buildShelf(game);
    if (shelf.storage === undefined) throw new Error("No shelf");
    shelf.storage.contents.knife = 1;

    send(game, { type: "takeDown", pieceId: idOf(game, shelf) });
    expect(game.client.getView().notice?.kind).toBe("stillHoldsSomething");
    runSeconds(game, SHELF_BUILD_SECONDS);

    expect(game.entities.has(shelf)).toBe(true);
    expect(shelf.storage.contents).toEqual({ knife: 1 });
  });

  it("removes a shelf blueprint at once and gives back every plank it took, spent or not", () => {
    const game = createGame({ seed: 42 });
    const blueprint = shelfBlueprintNearPlayer(game);
    const backpack = onlyPlayer(game).backpack;
    backpack.contents.plank = 2;
    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    runSeconds(game, SHELF_BUILD_SECONDS + 5);
    expect(blueprint.blueprint).toMatchObject({ delivered: { plank: 2 } });

    send(game, { type: "takeDown", pieceId: idOf(game, blueprint) });
    stepUntil(game, () => !game.entities.has(blueprint));

    expect(backpack.contents.plank).toBe(2);
  });

  it("holds up the foundation it stands on, so the foundation cannot be taken down under it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("foundation", square.x, square.z, 0));
    const foundation = onlyBlueprint(game);
    onlyPlayer(game).backpack.contents.axe = 1;
    deliverDebarkedLogs(game, foundation);
    buildFully(game, foundation);
    send(game, place("shelf", square.x, square.z, 0));
    buildFully(game, onlyBlueprint(game));

    send(game, { type: "takeDown", pieceId: idOf(game, foundation) });
    expect(game.client.getView().notice?.kind).toBe("holdsUpPiece");
  });
});

describe("reaching a shelf", () => {
  it("is what E acts on when the player stands beside it", () => {
    const game = createGame({ seed: 42 });
    const shelf = buildShelf(game);
    open(game, shelf);

    expect(game.client.nearestInReach()).toEqual({ kind: "furniture", id: idOf(game, shelf), furniture: "shelf" });
  });
});

describe("saving shelves", () => {
  it("raises the save version for shelves", () => {
    expect(SHELVES_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    expect(SHELVES_SAVE_VERSION).toBeGreaterThan(SLED_PLANKS_SAVE_VERSION);
  });

  it("keeps shelves, shelf blueprints with their planks, which way each faces, and what each shelf holds", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("shelf", square.x, square.z, 1));
    const shelf = onlyBlueprint(game);
    buildFully(game, shelf);
    if (shelf.storage === undefined) throw new Error("No shelf");
    shelf.storage.contents = { stick: 4, pot: 1 };
    send(game, place("shelf", square.x + 1.5, square.z, 3));
    onlyBlueprint(game).blueprint = { structure: "shelf", progress: 0.25, materialsSpent: 1, delivered: { plank: 2 } };

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    const shelves = storingPiecesOf(loaded.game.entities, "shelf");
    expect(shelves.map(({ position, facing, storage }) => ({ x: position.x, z: position.z, facing, storage }))).toEqual([
      { x: square.x, z: square.z, facing: { turns: 1 }, storage: { contents: { stick: 4, pot: 1 } } },
    ]);
    expect(onlyBlueprint(loaded.game)).toMatchObject({
      blueprint: { structure: "shelf", progress: 0.25, materialsSpent: 1, delivered: { plank: 2 } },
      facing: { turns: 3 },
    });
    expect(isWalkable(loaded.game.walkMap, { x: square.x, z: square.z })).toBe(false);
  });

  it("loads a save from before shelves", () => {
    const game = createGame({ seed: 42 });
    buildChestNearPlayer(game);
    const save = withOldFurnitureParts(JSON.parse(JSON.stringify({ ...writeSave(game), version: SHELVES_SAVE_VERSION - 1 })) as SaveFile);

    const loaded = readSave(save);
    if (!loaded.ok) throw new Error("The older save did not load");
    expect(piecesOf(loaded.game.entities, "chest").length).toBe(1);
    expect(piecesOf(loaded.game.entities, "shelf").length).toBe(0);
  });

  it("turns away a save whose shelf holds a log", () => {
    const game = createGame({ seed: 42 });
    buildShelf(game);
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { entities: { components: Record<string, unknown> }[] };
    for (const { components } of save.entities) if (components.storage !== undefined) components.storage = { contents: { log: 1 } };

    expect(readSave(save).ok).toBe(false);
  });
});

/** Builds a chest on open ground near the player. */
function buildChestNearPlayer(game: Game): void {
  const square = openSquareNearPlayer(game);
  send(game, place("chest", square.x, square.z, 0));
  buildFully(game, onlyBlueprint(game));
}

/** Carries every debarked log a blueprint still needs to it, one at a time. */
function deliverDebarkedLogs(game: Game, blueprint: Entity): void {
  for (const { material, has, needs } of game.client.describeBlueprint(idOf(game, blueprint))?.deliveries ?? []) {
    if (material !== "debarkedLog") continue;
    for (let i = has; i < needs; i += 1) {
      game.entities.addComponent(onlyPlayer(game), "carrying", "debarkedLog");
      send(game, { type: "deliverToBlueprint", blueprintId: idOf(game, blueprint) });
      stepUntil(game, () => game.client.getView().carrying === null);
    }
  }
}

/** Builds a shelf on open ground near the player and returns it. */
function buildShelf(game: Game) {
  const blueprint = shelfBlueprintNearPlayer(game);
  buildFully(game, blueprint);
  return blueprint;
}

function open(game: Game, shelf: Entity): void {
  send(game, { type: "openChest", chestId: idOf(game, shelf) });
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
  finishReach(game);
}

function give(game: Game, content: BackpackContent, count: number): void {
  const backpack = onlyPlayer(game).backpack;
  backpack.contents[content] = (backpack.contents[content] ?? 0) + count;
}

/** Places a shelf blueprint on open ground near the player. */
function shelfBlueprintNearPlayer(game: Game) {
  const square = openSquareNearPlayer(game);
  send(game, place("shelf", square.x + 0.1, square.z + 0.2, 0));
  return onlyBlueprint(game);
}

/** Gives a blueprint the planks it needs and holds the build action until it is finished. */
function buildFully(game: Game, blueprint: Entity): void {
  const contents = onlyPlayer(game).backpack.contents;
  for (const { material, needs } of game.client.describeBlueprint(idOf(game, blueprint))?.deliveries ?? []) {
    if (material === "plank") contents.plank = (contents.plank ?? 0) + needs;
  }
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => blueprint.blueprint === undefined);
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
  finishReach(game);
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
