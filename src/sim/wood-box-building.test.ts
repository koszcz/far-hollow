import { describe, expect, it } from "bun:test";
import type { Entity } from "./entities";
import { WOOD_BOX_BUILD_SECONDS, WOOD_BOX_PLANK_COST } from "./furniture/wood-box";
import { createGame } from "./game";
import { newestBlueprint, onlyPlayer, piecesOf, stepUntil } from "./test-steps";
import { isWalkable } from "./walk-map";
import { gameWithWoodBox, idOf, openSquareNearPlayer, roomNearPlayer, standOn, wallOn } from "./wood-box-test-helpers";

describe("the wood box in the build menu", () => {
  it("lists the wood box as furniture after the drying rack, costing 4 planks and needing no tool", () => {
    const menu = createGame({ seed: 42 }).client.getView().buildMenu;

    expect(WOOD_BOX_PLANK_COST).toBe(4);
    expect(WOOD_BOX_BUILD_SECONDS).toBe(8);
    const rackAt = menu.findIndex(({ structure }) => structure === "dryingRack");
    expect(menu[rackAt + 1]).toEqual({
      structure: "woodBox",
      cost: [{ material: "plank", count: 4 }],
      placement: "anywhere",
    });
  });
});

describe("placing a wood box", () => {
  it("goes inside a room, exactly where the mouse points, and R turns it", () => {
    const game = createGame({ seed: 42 });
    const [, second] = roomNearPlayer(game, 3);
    const at = { x: second.x + 0.1, z: second.z - 0.05 };

    const check = game.client.checkPlacement("woodBox", at, 1);

    expect(check.allowed).toBe(true);
    expect(check.spot).toMatchObject({ x: at.x, z: at.z });
    expect(check.turns).toBe(1);
  });

  it("cannot go on open ground, and says it goes only inside a room", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);

    const check = game.client.checkPlacement("woodBox", square, 0);

    expect(check.allowed).toBe(false);
    expect(check.refusal).toEqual({ kind: "needsRoom" });
  });

  it("cannot go on a foundation that is not in a room", () => {
    const game = createGame({ seed: 42 });
    const [first, second] = roomNearPlayer(game, 3);
    game.entities.remove(wallOn(game, first, 1));

    const check = game.client.checkPlacement("woodBox", second, 0);

    expect(check.allowed).toBe(false);
    expect(check.refusal).toEqual({ kind: "needsRoom" });
  });

  it("is built with held work from 4 planks, and blocks walking once finished, empty", () => {
    const game = createGame({ seed: 42 });
    const [first, second] = roomNearPlayer(game, 3);
    standOn(game, first);
    onlyPlayer(game).backpack.contents.plank = WOOD_BOX_PLANK_COST;
    game.client.send({
      type: "placeBlueprint",
      structure: "woodBox",
      turns: 0,
      x: second.x,
      z: second.z,
    });
    game.step();
    const blueprint: Entity = newestBlueprint(game, "woodBox");

    game.client.send({ type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => blueprint.blueprint === undefined);

    expect(blueprint.furniture).toBe("woodBox");
    expect(blueprint.woodBox).toEqual({ firewood: 0 });
    expect(onlyPlayer(game).backpack.contents.plank).toBe(0);
    expect(isWalkable(game.walkMap, second)).toBe(false);
  });
});

describe("taking down a wood box", () => {
  it("gives back all 4 planks once it is empty", () => {
    const { game, box } = gameWithWoodBox();
    const backpack = onlyPlayer(game).backpack;
    backpack.contents.plank = 0;

    game.client.send({ type: "takeDown", pieceId: box.id });
    stepUntil(game, () => piecesOf(game.entities, "woodBox").length === 0);

    expect(backpack.contents.plank).toBe(WOOD_BOX_PLANK_COST);
  });

  it("is refused while it holds firewood, and the player is told to empty it first", () => {
    const { game, box } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 3 };

    expect(game.client.refusal({ type: "takeDown", pieceId: box.id })).toEqual({
      kind: "emptyFirst",
    });
    game.client.send({ type: "takeDown", pieceId: box.id });
    game.step();

    expect(piecesOf(game.entities, "woodBox")).toHaveLength(1);
    expect(game.client.getView().notice).toMatchObject({ kind: "stillHoldsSomething" });
  });

  it("takes its blueprint down at once", () => {
    const game = createGame({ seed: 42 });
    const [first, second] = roomNearPlayer(game, 3);
    standOn(game, first);
    game.client.send({
      type: "placeBlueprint",
      structure: "woodBox",
      turns: 0,
      x: second.x,
      z: second.z,
    });
    game.step();
    const blueprint = newestBlueprint(game, "woodBox");

    game.client.send({ type: "takeDown", pieceId: idOf(game, blueprint) });
    game.step();
    game.step();

    expect(game.entities.with("blueprint").size).toBe(0);
  });
});
