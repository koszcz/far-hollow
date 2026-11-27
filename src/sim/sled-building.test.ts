import { describe, expect, it } from "bun:test";
import { createGame } from "./game";
import { SLED_BUILD_SECONDS, SLED_LOG_COST, SLED_STICK_COST } from "./structure-freely-placed";
import { terrainHeightAt } from "./valley";
import { isWalkable } from "./walk-map";
import {
  sledBlueprintNearPlayer,
  buildFully,
  deliverLogs,
  nearestTo,
  openSquareNearPlayer,
  place,
  onlyBlueprint,
  send,
  stepUntil,
  runSeconds,
  onlyPlayer,
  idOf,
} from "./sled-test-helpers";

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
    const backpack = onlyPlayer(game).backpack;
    backpack.contents.stick = SLED_STICK_COST;
    expect(game.client.describeBlueprint(id)?.deliveries).toEqual([{ material: "log", has: 0, needs: SLED_LOG_COST }]);

    deliverLogs(game, blueprint, SLED_LOG_COST);
    expect(game.client.describeBlueprint(id)?.deliveries).toEqual([{ material: "log", has: SLED_LOG_COST, needs: SLED_LOG_COST }]);
    send(game, { type: "build", blueprintId: id });
    stepUntil(game, () => blueprint.blueprint === undefined);

    expect(blueprint.sled).toEqual({ log: 0, debarkedLog: 0, plank: 0 });
    expect(blueprint.facing).toEqual({ turns: 0 });
    expect(backpack.contents.stick ?? 0).toBe(0);
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
