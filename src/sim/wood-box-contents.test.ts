import { describe, expect, it } from "bun:test";
import { nearbyOf } from "./api-game-view";
import { type Command } from "./api-commands";
import { addToBackpack } from "./backpack";
import { WOOD_BOX_FIREWOOD_LIMIT } from "./furniture/wood-box";
import { createGame } from "./game";
import { readSave, writeSave } from "./save";
import { SAVE_VERSION } from "./save-upgrades";
import { WOOD_BOXES_SAVE_VERSION } from "./save-versions";
import { onlyPlayer, piecesOf } from "./test-steps";
import { countThatFits, gameWithWoodBox, give, standOn, use } from "./wood-box-test-helpers";

describe("filling and emptying a wood box", () => {
  it("puts one firewood in from the backpack", () => {
    const { game, box } = gameWithWoodBox();
    give(game, "firewood", 3);

    use(game, { type: "putInWoodBox", woodBoxId: box.id, all: false });

    expect(box.entity.woodBox).toEqual({ firewood: 1 });
    expect(onlyPlayer(game).backpack.contents.firewood).toBe(2);
  });

  it("puts in all the firewood that fits", () => {
    const { game, box } = gameWithWoodBox();
    box.entity.woodBox = { firewood: WOOD_BOX_FIREWOOD_LIMIT - 4 };
    give(game, "firewood", 6);

    use(game, { type: "putInWoodBox", woodBoxId: box.id, all: true });

    expect(box.entity.woodBox).toEqual({ firewood: WOOD_BOX_FIREWOOD_LIMIT });
    expect(onlyPlayer(game).backpack.contents.firewood).toBe(2);
  });

  it("holds up to 20 firewood", () => {
    expect(WOOD_BOX_FIREWOOD_LIMIT).toBe(20);
  });

  it("takes as much firewood as fits in the backpack", () => {
    const { game, box } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 12 };
    const backpack = onlyPlayer(game).backpack;
    while (addToBackpack(backpack, "stone", 1));
    // Make room for exactly three pieces of firewood.
    for (let i = 0; i < 3; i += 1) backpack.contents.stone = (backpack.contents.stone ?? 0) - 1;
    const roomFor = countThatFits(game, "firewood");

    use(game, { type: "takeFromWoodBox", woodBoxId: box.id });

    expect(roomFor).toBeGreaterThan(0);
    expect(backpack.contents.firewood).toBe(roomFor);
    expect(box.entity.woodBox).toEqual({ firewood: 12 - roomFor });
  });

  it("takes everything when it all fits", () => {
    const { game, box } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 5 };

    use(game, { type: "takeFromWoodBox", woodBoxId: box.id });

    expect(box.entity.woodBox).toEqual({ firewood: 0 });
    expect(onlyPlayer(game).backpack.contents.firewood).toBe(5);
  });

  it("refuses each action, with the reason, when it cannot be done", () => {
    const { game, box } = gameWithWoodBox();
    const putIn: Command = { type: "putInWoodBox", woodBoxId: box.id, all: false };
    const take: Command = { type: "takeFromWoodBox", woodBoxId: box.id };

    expect(game.client.refusal(putIn)).toEqual({ kind: "noContent", content: "firewood" });
    expect(game.client.refusal(take)).toEqual({ kind: "woodBoxEmpty" });

    give(game, "firewood", 1);
    box.entity.woodBox = { firewood: WOOD_BOX_FIREWOOD_LIMIT };
    expect(game.client.refusal(putIn)).toEqual({ kind: "woodBoxFull" });

    const backpack = onlyPlayer(game).backpack;
    while (addToBackpack(backpack, "stone", 1));
    expect(game.client.refusal(take)).toEqual({ kind: "backpackFull" });
  });

  it("shows how full it is to the player beside it", () => {
    const { game, box } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 7 };
    game.step();

    expect(nearbyOf(game.client.getView(), "woodBox")).toEqual({
      id: box.id,
      firewood: 7,
      limit: WOOD_BOX_FIREWOOD_LIMIT,
    });
  });

  it("holds only firewood", () => {
    const { game, box } = gameWithWoodBox();
    give(game, "stick", 3);
    give(game, "firewood", 1);

    use(game, { type: "putInWoodBox", woodBoxId: box.id, all: true });

    expect(box.entity.woodBox).toEqual({ firewood: 1 });
    expect(onlyPlayer(game).backpack.contents.stick).toBe(3);
  });
});

describe("saving wood boxes", () => {
  it("raises the save version for wood boxes, and loads a save from before then", () => {
    const game = createGame({ seed: 42 });
    expect(WOOD_BOXES_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number };
    save.version = WOOD_BOXES_SAVE_VERSION - 1;

    expect(readSave(save).ok).toBe(true);
  });

  it("keeps a wood box's spot, facing, and firewood, and its blueprint", () => {
    const { game, box, squares } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 9 };
    standOn(game, squares[1]);
    game.client.send({
      type: "placeBlueprint",
      structure: "woodBox",
      turns: 2,
      x: squares[1].x,
      z: squares[1].z + 0.1,
    });
    game.step();

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    const [saved] = piecesOf(loaded.game.entities, "woodBox");
    expect(saved?.position).toMatchObject({ x: box.position.x, z: box.position.z });
    expect(saved?.woodBox).toEqual({ firewood: 9 });
    expect(loaded.game.entities.with("blueprint").entities.map(({ blueprint }) => blueprint.structure)).toEqual(["woodBox"]);
  });

  it("keeps a walk to put firewood in a wood box", () => {
    const { game, box, squares } = gameWithWoodBox();
    give(game, "firewood", 2);
    standOn(game, { x: squares[0].x - 6, z: squares[0].z });
    game.client.send({ type: "putInWoodBox", woodBoxId: box.id, all: true });
    game.step();

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));

    expect(loaded.ok).toBe(true);
  });

  it("turns away a wood box with more firewood than it holds", () => {
    const { game, box } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 4 };
    const save = JSON.parse(JSON.stringify(writeSave(game))) as {
      entities: { components: Record<string, unknown> }[];
    };
    const saved = save.entities.find(({ components }) => components.furniture === "woodBox");
    if (saved === undefined) throw new Error("No saved wood box");
    saved.components.woodBox = { firewood: WOOD_BOX_FIREWOOD_LIMIT + 1 };

    expect(readSave(save).ok).toBe(false);
  });
});
