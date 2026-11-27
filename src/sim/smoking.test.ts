import { describe, expect, it } from "bun:test";
import { nearbyOf, type BackpackContent, type Command, type FoodToHang } from "./api";
import { CONTENT_WEIGHT_KG } from "./backpack";
import { MINUTES_PER_HOUR } from "./clock";
import type { Entity } from "./entities";
import type { Fire } from "./fire";
import { HUNGER_FILLED_BY } from "./foraging";
import { createGame, type Game } from "./game";
import { DRYING_RACK_FOOD_LIMIT, SMOKE_MINUTES, SMOKING_FIRE_METRES } from "./rack-food";
import { readSave, writeSave } from "./save";
import { SAVE_VERSION } from "./save-upgrades";
import { SMOKED_FISH_SAVE_VERSION } from "./save-versions";
import { addFinished, finishReach, onlyPlayer, piecesOf, stepUntil } from "./test-steps";
import { isWalkable } from "./walk-map";
import { strings } from "../strings";

describe("hanging raw fish on the drying rack", () => {
  it("hangs raw fish from the backpack like other food, and it counts toward the rack's 6 foods", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    give(game, "rawFish", 2);
    give(game, "berries", 5);

    hang(game, rack, "rawFish");
    for (let i = 0; i < DRYING_RACK_FOOD_LIMIT - 1; i += 1) hang(game, rack, "berries");

    expect(rack.entity.dryingRack?.[0]).toMatchObject({ food: "rawFish", minutesPreserved: 0 });
    expect(rack.entity.dryingRack).toHaveLength(DRYING_RACK_FOOD_LIMIT);
    expect(game.client.getView().backpack.rawFish).toBe(1);
    expect(game.client.refusal({ type: "hangOnRack", rackId: rack.id, food: "rawFish" })).toEqual({ kind: "rackFull" });
  });

  it("refuses raw fish the backpack does not hold, with a reason", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);

    expect(game.client.refusal({ type: "hangOnRack", rackId: rack.id, food: "rawFish" })).toEqual({ kind: "noRawFish" });
  });

  it("refuses cooked fish, with the reason that only raw fish can be smoked", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    give(game, "cookedFish", 1);

    expect(game.client.refusal({ type: "hangOnRack", rackId: rack.id, food: "cookedFish" })).toEqual({ kind: "onlyRawFishSmokes" });
    expect(strings.actionReasons.onlyRawFishSmokes).toBe("only raw fish can be smoked");
    send(game, { type: "hangOnRack", rackId: rack.id, food: "cookedFish" });
    expect(rack.entity.dryingRack).toEqual([]);
    expect(game.client.getView().backpack.cookedFish).toBe(1);
  });
});

describe("smoking raw fish", () => {
  it("smokes raw fish in 4 game hours while a lit campfire stands close by, into smoked fish", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    addFire(game, rack, "campfire", 1.5);
    give(game, "rawFish", 1);
    hang(game, rack, "rawFish");

    expect(SMOKE_MINUTES).toBe(4 * MINUTES_PER_HOUR);
    skipHours(game, 3.5);
    expect(foodOn(game, rack)).toMatchObject({ food: "rawFish", content: "rawFish", preserved: false, waitsForFire: false });
    expect(foodOn(game, rack)?.progress).toBeCloseTo(3.5 / 4, 1);

    skipHours(game, 1);
    expect(foodOn(game, rack)).toEqual({ food: "rawFish", content: "smokedFish", preserved: true, progress: 1, waitsForFire: false });

    takeOff(game, rack);
    expect(game.client.getView().backpack).toMatchObject({ smokedFish: 1 });
  });

  it("smokes raw fish beside a lit fireplace too", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    addFire(game, rack, "fireplace", 1.5);
    give(game, "rawFish", 1);
    hang(game, rack, "rawFish");

    skipHours(game, 4.1);

    expect(foodOn(game, rack)?.preserved).toBe(true);
  });

  it("makes no progress with no fire, and the panel says it needs a lit fire close by", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    give(game, "rawFish", 1);
    hang(game, rack, "rawFish");
    const progress = foodOn(game, rack)?.progress ?? 0;

    skipHours(game, 5);

    expect(foodOn(game, rack)).toMatchObject({ preserved: false, progress, waitsForFire: true });
    expect(nearbyOf(game.client.getView(), "dryingRack")?.food[0]?.waitsForFire).toBe(true);
  });

  it("makes no progress beside a campfire that is out", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    addFire(game, rack, "campfire", 1, { lit: false, fuelMinutes: 200 });
    give(game, "rawFish", 1);
    hang(game, rack, "rawFish");

    skipHours(game, 2);

    expect(foodOn(game, rack)).toMatchObject({ preserved: false, waitsForFire: true });
    expect(foodOn(game, rack)?.progress).toBeLessThan(0.01);
  });

  it("keeps its progress while the fire is out, and goes on smoking once the fire is lit again", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    const fire = addFire(game, rack, "campfire", 1.5);
    give(game, "rawFish", 1);
    hang(game, rack, "rawFish");

    skipHours(game, 2);
    if (fire.campfire === undefined) throw new Error("No campfire");
    fire.campfire = { lit: false, fuelMinutes: 0 };
    const kept = foodOn(game, rack)?.progress ?? 0;
    expect(kept).toBeCloseTo(0.5, 1);
    skipHours(game, 3);
    expect(foodOn(game, rack)?.progress).toBeCloseTo(kept, 5);

    fire.campfire = { lit: true, fuelMinutes: 48 * MINUTES_PER_HOUR };
    skipHours(game, 2.1);
    expect(foodOn(game, rack)?.preserved).toBe(true);
  });

  it("smokes only while the fire is within 2 m of the rack", () => {
    expect(SMOKING_FIRE_METRES).toBe(2);
    const far = createGame({ seed: 42 });
    const farRack = rackNearPlayer(far);
    addFire(far, farRack, "campfire", 2.1);
    give(far, "rawFish", 1);
    hang(far, farRack, "rawFish");
    skipHours(far, 2);
    expect(foodOn(far, farRack)).toMatchObject({ waitsForFire: true });
    expect(foodOn(far, farRack)?.progress).toBeLessThan(0.01);

    const near = createGame({ seed: 42 });
    const nearRack = rackNearPlayer(near);
    addFire(near, nearRack, "campfire", 1.9);
    give(near, "rawFish", 1);
    hang(near, nearRack, "rawFish");
    skipHours(near, 2);
    expect(foodOn(near, nearRack)?.progress).toBeCloseTo(0.5, 1);
  });

  it("lets raw fish on the rack go on spoiling until it is smoked, with the usual notice", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    addFire(game, rack, "campfire", 1.5);
    const now = game.progress().clockMinutes;
    const backpack = onlyPlayer(game).backpack;
    backpack.contents = { ...backpack.contents, rawFish: 2 };
    backpack.spoilsAt = { rawFish: [now + 90, now + 900] };
    hang(game, rack, "rawFish");
    hang(game, rack, "rawFish");

    skipHours(game, 2);

    expect(rack.entity.dryingRack).toHaveLength(1);
    expect(rack.entity.dryingRack?.[0]?.spoilsAt).toBe(now + 900);
    expect(game.client.getView().notice).toEqual({ kind: "foodSpoiled", spoiled: { rawFish: 1 } });
  });

  it("counts a finished smoked fish for the journal goal to preserve food for winter", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    addFire(game, rack, "campfire", 1.5);
    give(game, "rawFish", 1);
    hang(game, rack, "rawFish");

    skipHours(game, 3);
    expect(game.client.getView().journal?.done).not.toContain("preserveFood");

    skipHours(game, 1.5);
    expect(game.client.getView().journal?.done).toContain("preserveFood");
  });
});

describe("smoked fish", () => {
  it("never spoils, and has no freshness bar", () => {
    const game = createGame({ seed: 42 });
    give(game, "smokedFish", 3);
    game.step();

    // Longer than any fresh food keeps.
    skipHours(game, 24 * 4);

    expect(game.client.getView().backpack).toMatchObject({ smokedFish: 3 });
    expect(game.client.getView().backpackFreshness).toEqual({});
  });

  it("weighs the same as raw fish, fills as much hunger as cooked fish, and does not make the player sick", () => {
    expect(CONTENT_WEIGHT_KG.smokedFish).toBe(CONTENT_WEIGHT_KG.rawFish);
    expect(HUNGER_FILLED_BY.smokedFish).toBe(HUNGER_FILLED_BY.cookedFish);
    expect(HUNGER_FILLED_BY.smokedFish).toBe(0.3);

    const game = createGame({ seed: 42 });
    give(game, "smokedFish", 1);
    const player = onlyPlayer(game) as Entity & Required<Pick<Entity, "needs">>;
    player.needs.hunger.level = 0.5;
    send(game, { type: "eat", food: "smokedFish" });

    expect(player.needs.hunger.level).toBeCloseTo(0.8, 2);
    expect(player.sickness).toBeUndefined();
    expect(game.client.getView().backpack.smokedFish ?? 0).toBe(0);
  });

  it("can be stored in a chest and on a shelf, and dropped like other food", () => {
    const game = createGame({ seed: 42 });
    const chest = addFinished(game, "chest", openSquareNearPlayer(game, 2), 0);
    give(game, "smokedFish", 4);
    send(game, { type: "openChest", chestId: chest.id });
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
    finishReach(game);

    send(game, { type: "putInChest", chestId: chest.id, content: "smokedFish", all: false });
    finishReach(game);
    send(game, { type: "dropFromBackpack", content: "smokedFish" });
    finishReach(game);

    expect(chest.entity.storage?.contents).toEqual({ smokedFish: 1 });
    expect(game.entities.with("pile").entities.map(({ pile }) => pile)).toEqual([{ content: "smokedFish", count: 3 }]);

    const shelfGame = createGame({ seed: 42 });
    const shelf = addFinished(shelfGame, "shelf", openSquareNearPlayer(shelfGame, 2), 0);
    give(shelfGame, "smokedFish", 1);
    send(shelfGame, { type: "openChest", chestId: shelf.id });
    stepUntil(shelfGame, () => onlyPlayer(shelfGame).walkPath === undefined);
    finishReach(shelfGame);
    send(shelfGame, { type: "putInChest", chestId: shelf.id, content: "smokedFish", all: false });
    finishReach(shelfGame);
    expect(shelf.entity.storage?.contents).toEqual({ smokedFish: 1 });
  });

  it("names smoked fish for the player", () => {
    expect(strings.backpackContents.smokedFish).toBe("Smoked fish");
    expect(strings.pile.holds("smokedFish", 2)).toBe("2 smoked fish");
  });
});

describe("saving smoked fish", () => {
  it("keeps raw fish on the rack with its smoking progress, and smoked fish in the backpack", () => {
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    const now = game.progress().clockMinutes;
    rack.entity.dryingRack = [
      { food: "rawFish", minutesPreserved: 90, spoilsAt: now + 900 },
      { food: "rawFish", minutesPreserved: SMOKE_MINUTES },
    ];
    give(game, "smokedFish", 2);

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    const [saved] = piecesOf(loaded.game.entities, "dryingRack");
    expect(saved?.dryingRack).toEqual([
      { food: "rawFish", minutesPreserved: 90, spoilsAt: now + 900 },
      { food: "rawFish", minutesPreserved: SMOKE_MINUTES },
    ]);
    expect(loaded.game.client.getView().backpack).toMatchObject({ smokedFish: 2 });
  });

  it("raises the save version, and loads an older save's rack with how far each food has dried", () => {
    expect(SMOKED_FISH_SAVE_VERSION).toBe(SAVE_VERSION);
    const game = createGame({ seed: 42 });
    const rack = rackNearPlayer(game);
    const now = game.progress().clockMinutes;
    rack.entity.dryingRack = [
      { food: "berries", minutesPreserved: 120, spoilsAt: now + 900 },
      { food: "mushroom", minutesPreserved: 360 },
    ];
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number; entities: { components: { dryingRack?: Record<string, unknown>[] } }[] };
    save.version = SMOKED_FISH_SAVE_VERSION - 1;
    // An older save calls how far each food has come `minutesDried`.
    for (const { components } of save.entities) {
      if (components.dryingRack === undefined) continue;
      components.dryingRack = components.dryingRack.map(({ minutesPreserved, ...rest }) => ({ ...rest, minutesDried: minutesPreserved }));
    }

    const loaded = readSave(save);
    if (!loaded.ok) throw new Error("The older save did not load");
    expect(piecesOf(loaded.game.entities, "dryingRack")[0]?.dryingRack).toEqual([
      { food: "berries", minutesPreserved: 120, spoilsAt: now + 900 },
      { food: "mushroom", minutesPreserved: 360 },
    ]);
  });
});

/** A finished drying rack on open ground 2 m from the player, so the player stands within reach of it. */
function rackNearPlayer(game: Game) {
  return addFinished(game, "dryingRack", openSquareNearPlayer(game, 2), 0);
}

/**
 * Adds a finished campfire or fireplace this many metres from the rack's middle, along the rack's rails, away from the player.
 * It is lit, with fuel for two days, unless `fire` says otherwise.
 */
function addFire(
  game: Game,
  rack: { position: { x: number; y: number; z: number } },
  kind: "campfire" | "fireplace",
  metres: number,
  fire: Fire = { lit: true, fuelMinutes: 48 * MINUTES_PER_HOUR },
): Entity {
  const player = onlyPlayer(game).position;
  // Away from the player, across the rack from them, so the fire is not between them.
  const away = Math.sign(rack.position.z - player.z) || 1;
  const position = { x: rack.position.x, y: rack.position.y, z: rack.position.z + away * metres };
  return game.entities.add(kind === "campfire" ? { campfire: { ...fire }, position } : { fireplace: { ...fire }, position });
}

/** The first food on the rack, as the rack's panel shows it. */
function foodOn(game: Game, rack: { id: number }) {
  return game.client.describeDryingRack(rack.id)?.food[0];
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
