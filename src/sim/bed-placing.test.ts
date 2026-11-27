import { describe, expect, it } from "bun:test";
import { createGame } from "./game";
import { BED_BUILD_SECONDS, BED_PLANK_COST } from "./furniture/bed";
import { isWalkable } from "./walk-map";
import { piecesOf } from "./test-steps";
import {
  bedBlueprintNearPlayer,
  blueprintOf,
  buildFully,
  idOf,
  onlyBlueprint,
  onlyPlayer,
  openSquareNearPlayer,
  place,
  runSeconds,
  send,
} from "./bed-test-helpers";

describe("the bed in the build menu", () => {
  it("lists the bed as furniture, with its cost of 8 planks and no tool", () => {
    const game = createGame({ seed: 42 });

    expect(BED_PLANK_COST).toBe(8);
    expect(game.client.getView().buildMenu).toContainEqual({
      structure: "bed",
      cost: [{ material: "plank", count: 8 }],
      placement: "anywhere",
    });
  });
});

describe("placing a bed", () => {
  it("goes exactly where the mouse points, off the building grid, facing the way the player turned it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const at = { x: square.x + 0.13, z: square.z - 0.27 };

    const check = game.client.checkPlacement("bed", at, 1);
    expect(check.allowed).toBe(true);
    expect(check.spot).toMatchObject({ x: at.x, z: at.z });

    send(game, place("bed", at.x, at.z, 1));
    const blueprint = onlyBlueprint(game);
    expect(blueprint.blueprint).toMatchObject({ structure: "bed", progress: 0, materialsSpent: 0, delivered: {} });
    expect(blueprint.position).toMatchObject({ x: at.x, z: at.z });
    expect(blueprint.facing).toEqual({ turns: 1 });
  });

  it("covers 1 m by 2 m, along z when facing the default way and along x when turned a quarter", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("bed", square.x, square.z, 0));
    // A spot 1.5 m along z overlaps the first bed. The same spot along x is clear of it.
    expect(game.client.checkPlacement("bed", { x: square.x, z: square.z + 1.5 }, 0).allowed).toBe(false);
    expect(game.client.checkPlacement("bed", { x: square.x + 1.5, z: square.z }, 0).allowed).toBe(true);
    // Turned a quarter, a bed 1.2 m along x reaches back over the first one.
    expect(game.client.checkPlacement("bed", { x: square.x + 1.2, z: square.z }, 1).allowed).toBe(false);
  });
});

describe("where a bed cannot go", () => {
  it("refuses a spot over a standing tree", () => {
    const game = createGame({ seed: 42 });
    const tree = game.entities.with("tree", "position").first;
    if (tree === undefined) throw new Error("No tree");

    expect(game.client.checkPlacement("bed", { x: tree.position.x + 0.3, z: tree.position.z }, 0).allowed).toBe(false);
  });

  it("refuses to overlap a structure, such as a foundation blueprint or a campfire", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("foundation", square.x, square.z, 0));
    send(game, place("campfire", square.x + 3, square.z, 0));

    expect(game.client.checkPlacement("bed", { x: square.x + 0.6, z: square.z }, 0).allowed).toBe(false);
    expect(game.client.checkPlacement("bed", { x: square.x + 3, z: square.z + 0.6 }, 0).allowed).toBe(false);
  });

  it("refuses to overlap other furniture, finished or as a blueprint, and stops furniture going over it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("chest", square.x, square.z, 0));
    expect(game.client.checkPlacement("bed", { x: square.x + 0.3, z: square.z + 0.5 }, 0).allowed).toBe(false);

    send(game, place("bed", square.x + 2, square.z, 0));
    buildFully(game, blueprintOf(game, "bed"));
    expect(piecesOf(game.entities, "bed").length).toBe(1);
    for (const structure of ["bed", "chest", "sled"] as const) {
      expect(game.client.checkPlacement(structure, { x: square.x + 2.2, z: square.z + 0.5 }, 0).allowed).toBe(false);
    }
    for (const structure of ["foundation", "campfire", "woodpile"] as const) {
      expect(game.client.checkPlacement(structure, { x: square.x + 2, z: square.z }, 0).allowed).toBe(false);
    }
  });
});

describe("building a bed", () => {
  it("takes its 8 planks over several trips, needs no tool, and shows its stages as it goes", () => {
    const game = createGame({ seed: 42 });
    const blueprint = bedBlueprintNearPlayer(game);
    const id = idOf(game, blueprint);
    const backpack = onlyPlayer(game).backpack;
    delete backpack.contents.axe;
    delete backpack.contents.knife;
    delete backpack.contents.drawknife;
    delete backpack.contents.saw;
    expect(game.client.describeBlueprint(id)?.deliveries).toEqual([{ material: "plank", has: 0, needs: BED_PLANK_COST }]);

    // The first trip brings 5 planks. The bed takes them all, builds 5 of its 8 stages, and stops.
    backpack.contents.plank = 5;
    send(game, { type: "build", blueprintId: id });
    runSeconds(game, BED_BUILD_SECONDS + 5);
    expect(backpack.contents.plank ?? 0).toBe(0);
    expect(blueprint.blueprint).toMatchObject({ materialsSpent: 5, delivered: { plank: 5 } });
    expect(blueprint.blueprint?.progress).toBeCloseTo(5 / BED_PLANK_COST, 5);
    expect(game.client.getView().action).toBeNull();

    // The second trip brings the rest, and more. It takes only what it still needs.
    backpack.contents.plank = 6;
    send(game, { type: "build", blueprintId: id });
    runSeconds(game, BED_BUILD_SECONDS + 5);
    expect(blueprint.blueprint).toBeUndefined();
    expect(blueprint.furniture).toBe("bed");
    expect(backpack.contents.plank).toBe(3);
  });

  it("spends no planks in the playground", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const blueprint = bedBlueprintNearPlayer(game);
    onlyPlayer(game).backpack.contents.plank = 3;

    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    runSeconds(game, BED_BUILD_SECONDS + 5);

    expect(blueprint.furniture).toBe("bed");
    expect(onlyPlayer(game).backpack.contents.plank).toBe(3);
  });
});

describe("a finished bed", () => {
  it("blocks walking on the ground it covers, and not much past it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("bed", square.x, square.z, 1));
    buildFully(game, blueprintOf(game, "bed"));

    // Turned a quarter, it runs 2 m along x and 1 m along z.
    for (const [dx, dz] of [
      [0, 0],
      [0.9, 0.4],
      [-0.9, -0.4],
      [0.9, -0.4],
      [-0.9, 0.4],
    ] as const) {
      expect(isWalkable(game.walkMap, { x: square.x + dx, z: square.z + dz })).toBe(false);
    }
    expect(isWalkable(game.walkMap, { x: square.x, z: square.z + 1.2 })).toBe(true);
    expect(isWalkable(game.walkMap, { x: square.x + 1.7, z: square.z })).toBe(true);
  });
});
