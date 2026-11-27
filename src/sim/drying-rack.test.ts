import { describe, expect, it } from "bun:test";
import { nearbyOf } from "./api-game-view";
import { type BackpackContent, type FoodToHang } from "./api";
import { type Command } from "./api-commands";
import { MINUTES_PER_HOUR } from "./clock";
import { type Entity } from "./entities";
import { rainEntities } from "./entity-queries";
import { addToBackpack, CONTENT_WEIGHT_KG } from "./backpack";
import { HUNGER_FILLED_BY } from "./foraging";
import { DRYING_RACK_CORD_COST, DRYING_RACK_STICK_COST } from "./furniture/drying-rack";
import { createGame, type Game } from "./game";
import { DRY_MINUTES, DRYING_RACK_FOOD_LIMIT } from "./rack-food";
import { readSave, writeSave } from "./save";
import { SAVE_VERSION } from "./save-upgrades";
import { DRYING_RACKS_SAVE_VERSION } from "./save-versions";
import { addFinished, finishReach, onlyPlayer, openFoundation, piecesOf, stepUntil } from "./test-steps";
import { isWalkable } from "./walk-map";
import { actionsText } from "../strings/actions";
import { noticesText } from "../strings/notices";

describe("the drying rack in the build menu", () => {
  it("lists the drying rack as furniture after the rain barrel, costing 6 sticks and 2 cord and needing no tool", () => {
    const menu = createGame({ seed: 42 }).client.getView().buildMenu;

    expect(DRYING_RACK_STICK_COST).toBe(6);
    expect(DRYING_RACK_CORD_COST).toBe(2);
    const barrelAt = menu.findIndex(({ structure }) => structure === "rainBarrel");
    expect(menu[barrelAt + 1]).toEqual({
      structure: "dryingRack",
      cost: [
        { material: "stick", count: 6 },
        { material: "cord", count: 2 },
      ],
      placement: "anywhere",
    });
  });
});

describe("building a drying rack", () => {
  it("spends 6 sticks and 2 cord from the backpack, and once built blocks walking, with no food on it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const backpack = onlyPlayer(game).backpack;
    backpack.contents = { ...backpack.contents, stick: 7, cord: 3 };

    send(game, { type: "placeBlueprint", structure: "dryingRack", turns: 0, x: square.x, z: square.z });
    const blueprint = blueprintOf(game);
    while (blueprint.blueprint !== undefined) {
      send(game, { type: "build", blueprintId: idOf(game, blueprint) });
      stepUntil(game, () => blueprint.blueprint === undefined || game.client.getView().action === null);
    }

    expect(blueprint.furniture).toBe("dryingRack");
    expect(blueprint.dryingRack).toEqual([]);
    expect(game.client.getView().backpack).toMatchObject({ stick: 1, cord: 1 });
    expect(isWalkable(game.walkMap, square)).toBe(false);
  });

  it("names the cord a blueprint lacks", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const backpack = onlyPlayer(game).backpack;
    backpack.contents = { ...backpack.contents, stick: 6 };
    send(game, { type: "placeBlueprint", structure: "dryingRack", turns: 0, x: square.x, z: square.z });
    const blueprint = blueprintOf(game);
    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => blueprint.blueprint?.materialsSpent === DRYING_RACK_STICK_COST && game.client.getView().action === null);

    expect(game.client.refusal({ type: "build", blueprintId: idOf(game, blueprint) })).toEqual({
      kind: "cannotBuildYet",
      lacks: { kind: "material", material: "cord" },
    });
  });

  it("stands indoors on a foundation as well as outdoors", () => {
    const game = createGame({ seed: 42 });
    const square = openFoundation(game);

    expect(game.client.checkPlacement("dryingRack", square, 0).allowed).toBe(true);
  });
});

describe("hanging food on the rack", () => {
  it("hangs one berries or one mushroom from the backpack at a time", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    give(game, "berries", 3);
    give(game, "mushroom", 1);

    hang(game, rack, "berries");
    hang(game, rack, "mushroom");

    expect(game.client.getView().backpack).toMatchObject({ berries: 2 });
    expect(game.client.getView().backpack.mushroom ?? 0).toBe(0);
    expect(game.client.describeDryingRack(rack.id)?.food).toMatchObject([
      { food: "berries", preserved: false },
      { food: "mushroom", preserved: false },
    ]);
  });

  it("refuses food the backpack does not hold, with a reason", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);

    expect(game.client.refusal({ type: "hangOnRack", rackId: rack.id, food: "berries" })).toEqual({ kind: "noBerries" });
    expect(game.client.refusal({ type: "hangOnRack", rackId: rack.id, food: "mushroom" })).toEqual({ kind: "noMushroom" });
  });

  it("holds up to 6 foods in any mix, then refuses more with a reason", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    give(game, "berries", 5);
    give(game, "mushroom", 5);

    for (const food of ["berries", "mushroom", "berries", "mushroom", "berries", "mushroom"] as const) hang(game, rack, food);
    expect(rack.entity.dryingRack).toHaveLength(DRYING_RACK_FOOD_LIMIT);

    expect(game.client.refusal({ type: "hangOnRack", rackId: rack.id, food: "berries" })).toEqual({ kind: "rackFull" });
    hang(game, rack, "berries");
    expect(rack.entity.dryingRack).toHaveLength(6);
    expect(game.client.getView().backpack).toMatchObject({ berries: 2, mushroom: 2 });
    expect(actionsText.actionReasons.rackFull).toBe("the rack holds 6 foods");
  });

  it("hangs the oldest one, which keeps the time it has left", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    const now = game.progress().clockMinutes;
    const backpack = onlyPlayer(game).backpack;
    backpack.contents = { ...backpack.contents, berries: 2 };
    backpack.spoilsAt = { berries: [now + 100, now + 900] };

    hang(game, rack, "berries");

    expect(rack.entity.dryingRack).toEqual([{ food: "berries", minutesPreserved: expect.any(Number) as number, spoilsAt: now + 100 }]);
    expect(backpack.spoilsAt.berries).toEqual([now + 900]);
  });

  it("shows the rack nearby in the HUD with what hangs on it", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    give(game, "mushroom", 1);
    hang(game, rack, "mushroom");

    expect(nearbyOf(game.client.getView(), "dryingRack")).toEqual({
      id: rack.id,
      limit: 6,
      food: [{ food: "mushroom", content: "mushroom", preserved: false, progress: expect.any(Number) as number, waitsForFire: false }],
    });
  });
});

describe("drying", () => {
  for (const [food, dried] of [
    ["berries", "driedBerries"],
    ["mushroom", "driedMushroom"],
  ] as const) {
    it(`dries ${food} in 6 game hours with no fire, into ${dried}`, () => {
      const game = createGame({ seed: 42 });
      const rack = rackNearPlayer(game);
      give(game, food, 1);
      hang(game, rack, food);

      expect(DRY_MINUTES).toBe(6 * MINUTES_PER_HOUR);
      skipHours(game, 5.5);
      expect(game.client.describeDryingRack(rack.id)?.food[0]).toMatchObject({ preserved: false });
      expect(game.client.describeDryingRack(rack.id)?.food[0]?.progress).toBeCloseTo(5.5 / 6, 1);

      skipHours(game, 1);
      expect(game.client.describeDryingRack(rack.id)?.food[0]).toEqual({ food, content: dried, preserved: true, progress: 1, waitsForFire: false });

      takeOff(game, rack);
      expect(game.client.getView().backpack).toMatchObject({ [dried]: 1 });
    });
  }

  it("dries just as fast in the rain", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    give(game, "berries", 1);
    hang(game, rack, "berries");
    const rain = rainEntities(game.entities).first?.rain;
    if (rain === undefined) throw new Error("No weather");
    rain.falling = true;
    rain.changeAtMinutes = game.progress().clockMinutes + 1_000_000;
    // A small roof keeps the player dry, so the cold of the rain does not make them collapse. It stops short of the rack.
    const { x, z } = onlyPlayer(game).position;
    game.entities.add({ roof: { min: { x: x - 0.3, z: z - 0.3 }, max: { x: x + 0.3, z: z + 0.3 } } });

    skipHours(game, 6.1);

    expect(game.client.getView().raining).toBe(true);
    expect(game.client.describeDryingRack(rack.id)?.food[0]?.preserved).toBe(true);
  });

  it("lets fresh food on the rack go on spoiling until it is dried, with the usual notice", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    const now = game.progress().clockMinutes;
    const backpack = onlyPlayer(game).backpack;
    backpack.contents = { ...backpack.contents, berries: 1, mushroom: 1 };
    backpack.spoilsAt = { berries: [now + 90], mushroom: [now + 3000] };
    hang(game, rack, "berries");
    hang(game, rack, "mushroom");

    skipHours(game, 2);

    expect(rack.entity.dryingRack?.map(({ food }) => food)).toEqual(["mushroom"]);
    expect(game.client.getView().notice).toEqual({ kind: "foodSpoiled", spoiled: { berries: 1 } });
  });

  it("keeps dried food on the rack for as long as the player likes", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    give(game, "mushroom", 1);
    hang(game, rack, "mushroom");

    // Longer than any fresh food keeps.
    skipHours(game, 24 * 4);

    expect(game.client.describeDryingRack(rack.id)?.food).toEqual([
      { food: "mushroom", content: "driedMushroom", preserved: true, progress: 1, waitsForFire: false },
    ]);
  });
});

describe("taking food off the rack", () => {
  it("takes every food off into the backpack, dried food first, and fresh food keeps its time", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    const now = game.progress().clockMinutes;
    rack.entity.dryingRack = [
      { food: "berries", minutesPreserved: 100, spoilsAt: now + 500 },
      { food: "mushroom", minutesPreserved: DRY_MINUTES },
    ];

    takeOff(game, rack);

    expect(rack.entity.dryingRack).toEqual([]);
    expect(game.client.getView().backpack).toMatchObject({ berries: 1, driedMushroom: 1 });
    expect(onlyPlayer(game).backpack.spoilsAt?.berries).toEqual([now + 500]);
  });

  it("leaves what does not fit on the rack, taking dried food first", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    const backpack = onlyPlayer(game).backpack;
    while (addToBackpack(backpack, "stone", 1));
    while (addToBackpack(backpack, "cord", 1));
    // Room for exactly one more food.
    backpack.contents.cord = (backpack.contents.cord ?? 0) - 1;
    rack.entity.dryingRack = [
      { food: "berries", minutesPreserved: 10, spoilsAt: game.progress().clockMinutes + 500 },
      { food: "berries", minutesPreserved: DRY_MINUTES },
    ];

    send(game, { type: "takeFoodOffRack", rackId: rack.id });
    finishReach(game);

    expect(game.client.getView().backpack.driedBerries).toBe(1);
    expect(game.client.getView().backpack.berries ?? 0).toBe(0);
    expect(rack.entity.dryingRack).toEqual([{ food: "berries", minutesPreserved: expect.any(Number) as number, spoilsAt: expect.any(Number) as number }]);
    expect(game.client.getView().notice).toEqual({ kind: "backpackFull" });
  });

  it("is refused while the rack holds no food", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);

    expect(game.client.refusal({ type: "takeFoodOffRack", rackId: rack.id })).toEqual({ kind: "nothingToTake" });
  });
});

describe("dried food", () => {
  it("never spoils, and has no freshness bar", () => {
    const game = createGame({ seed: 42 });
    give(game, "driedBerries", 4);
    give(game, "driedMushroom", 2);
    game.step();

    // Longer than any fresh food keeps.
    skipHours(game, 24 * 4);

    expect(game.client.getView().backpack).toMatchObject({ driedBerries: 4, driedMushroom: 2 });
    expect(game.client.getView().backpackFreshness).toEqual({});
  });

  it("weighs and fills the same as the fresh food it came from", () => {
    expect(CONTENT_WEIGHT_KG.driedBerries).toBe(CONTENT_WEIGHT_KG.berries);
    expect(CONTENT_WEIGHT_KG.driedMushroom).toBe(CONTENT_WEIGHT_KG.mushroom);
    expect(HUNGER_FILLED_BY.driedBerries).toBe(0.1);
    expect(HUNGER_FILLED_BY.driedMushroom).toBe(0.15);

    const game = createGame({ seed: 42 });
    give(game, "driedMushroom", 1);
    const player = onlyPlayer(game) as Entity & Required<Pick<Entity, "needs">>;
    player.needs.hunger.level = 0.5;
    send(game, { type: "eat", food: "driedMushroom" });

    expect(player.needs.hunger.level).toBeCloseTo(0.65, 2);
    expect(player.sickness).toBeUndefined();
  });

  it("can be stored in a chest and dropped like other food", () => {
    const game = createGame({ seed: 42 });
    const chest = addFinished(game, "chest", openSquareNearPlayer(game, 2), 0);
    give(game, "driedBerries", 3);
    send(game, { type: "openChest", chestId: chest.id });
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
    finishReach(game);

    send(game, { type: "putInChest", chestId: chest.id, content: "driedBerries", all: false });
    finishReach(game);
    send(game, { type: "dropFromBackpack", content: "driedBerries" });
    finishReach(game);

    expect(chest.entity.storage?.contents).toEqual({ driedBerries: 1 });
    expect(game.entities.with("pile").entities.map(({ pile }) => pile)).toEqual([{ content: "driedBerries", count: 2 }]);
  });
});

describe("taking a drying rack down", () => {
  it("is refused while the rack holds food, as with a chest", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    give(game, "berries", 1);
    hang(game, rack, "berries");

    expect(game.client.refusal({ type: "takeDown", pieceId: rack.id })).toEqual({ kind: "emptyFirst" });
  });

  it("gives back its 6 sticks and 2 cord once empty", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    const backpack = onlyPlayer(game).backpack;
    backpack.contents = { ...backpack.contents, stick: 0, cord: 0 };

    send(game, { type: "takeDown", pieceId: rack.id });
    stepUntil(game, () => piecesOf(game.entities, "dryingRack").length === 0);

    expect(game.client.getView().backpack).toMatchObject({ stick: 6, cord: 2 });
  });
});

describe("the journal's last goal", () => {
  it("is done the first time any food finishes on a rack", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    give(game, "berries", 1);
    hang(game, rack, "berries");

    skipHours(game, 5);
    expect(game.client.getView().journal?.done).not.toContain("preserveFood");

    skipHours(game, 1.5);
    expect(game.client.getView().journal?.done).toContain("preserveFood");
    expect(noticesText.journal.goals.preserveFood.name).toBe("Preserve some food for winter.");
  });
});

describe("saving drying racks", () => {
  it("raises the save version for drying racks, and loads a save from before then", () => {
    const game = createGame({ seed: 42 });
    expect(DRYING_RACKS_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number };
    save.version = DRYING_RACKS_SAVE_VERSION - 1;

    const loaded = readSave(save);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(piecesOf(loaded.game.entities, "dryingRack")).toEqual([]);
  });

  it("keeps the rack, the food on it, and how far each has dried", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    const now = game.progress().clockMinutes;
    rack.entity.dryingRack = [
      { food: "berries", minutesPreserved: 120, spoilsAt: now + 900 },
      { food: "mushroom", minutesPreserved: DRY_MINUTES },
    ];
    give(game, "driedBerries", 2);

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    const [saved] = piecesOf(loaded.game.entities, "dryingRack");
    expect(saved?.position).toMatchObject({ x: rack.position.x, z: rack.position.z });
    expect(saved?.dryingRack).toEqual([
      { food: "berries", minutesPreserved: 120, spoilsAt: now + 900 },
      { food: "mushroom", minutesPreserved: DRY_MINUTES },
    ]);
    expect(loaded.game.client.getView().backpack).toMatchObject({ driedBerries: 2 });
  });

  it("turns away a rack that holds more than 6 foods", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    rack.entity.dryingRack = Array.from({ length: 7 }, () => ({ food: "berries" as const, minutesPreserved: DRY_MINUTES }));

    expect(readSave(JSON.parse(JSON.stringify(writeSave(game)))).ok).toBe(false);
  });
});

/** A finished drying rack on open ground 2 m from the player, so the player stands within reach of it. */
function rackNearPlayer(game: Game) {
  return addFinished(game, "dryingRack", openSquareNearPlayer(game, 2), 0);
}

/** Hangs one food on the rack, once the walk and the reach are done. */
function hang(game: Game, rack: { id: number }, food: FoodToHang): void {
  send(game, { type: "hangOnRack", rackId: rack.id, food });
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
  finishReach(game);
}

/** Takes every food off the rack, once the walk and the reach are done. */
function takeOff(game: Game, rack: { id: number }): void {
  send(game, { type: "takeFoodOffRack", rackId: rack.id });
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
  finishReach(game);
}

/** Jumps the clock forward an hour at a time, filling the player's needs before each, so they never collapse. */
function skipHours(game: Game, hours: number): void {
  for (let left = hours; left > 0; left -= 1) {
    const { needs } = onlyPlayer(game) as Entity & Required<Pick<Entity, "needs">>;
    for (const need of Object.values(needs)) need.level = 1;
    send(game, { type: "skipTime", hours: Math.min(1, left) });
  }
}

function give(game: Game, content: BackpackContent, count: number): void {
  const backpack = onlyPlayer(game).backpack;
  backpack.contents = { ...backpack.contents, [content]: (backpack.contents[content] ?? 0) + count };
}

function blueprintOf(game: Game): Entity & { position: NonNullable<Entity["position"]> } {
  const blueprint = game.entities.with("blueprint", "position").entities.find((entity) => entity.blueprint.structure === "dryingRack");
  if (blueprint === undefined) throw new Error("No drying rack blueprint");
  return blueprint;
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
    ] as const) {
      const square = { x: Math.floor(player.position.x + dx * distance) + 0.5, z: Math.floor(player.position.z + dz * distance) + 0.5 };
      const open = [-2, -1, 0, 1, 2].every((ax) => [-2, -1, 0, 1, 2].every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      if (open && game.client.checkPlacement("dryingRack", square, 0).allowed) return square;
    }
  }
  throw new Error("No open square near the player");
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
