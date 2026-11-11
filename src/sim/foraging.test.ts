import { describe, expect, it } from "vitest";
import type { Command } from "./api";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { createNeeds } from "./needs";
import { readSave, writeSave } from "./save";
import { distanceToRiver, generateValley, groundDistance } from "./valley";

describe("hunger", () => {
  it("drains over time, so full hunger lasts two days", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "skipTime", hours: 12 }); // 20:00 on day 1, before night drains warmth.

    expect(game.client.getView().needs.hunger).toBeCloseTo(0.75, 3);
  });

  it("slows the player once it runs low", () => {
    const fed = createGame({ seed: 42 });
    const hungry = createGame({ seed: 42 });
    onlyPlayer(hungry).needs.hunger.level = 0.05;

    expect(distanceWalkedInOneSecond(hungry)).toBeLessThan(distanceWalkedInOneSecond(fed) * 0.75);
  });
});

describe("where food grows", () => {
  it("is decided by the seed: the same seed always places berry bushes and mushrooms the same way", () => {
    const valley = generateValley(7);
    expect(valley.berryBushes.length).toBeGreaterThan(50);
    expect(valley.mushrooms.length).toBeGreaterThan(50);
    expect(generateValley(7).berryBushes).toEqual(valley.berryBushes);
    expect(generateValley(7).mushrooms).toEqual(valley.mushrooms);
    expect(generateValley(8).berryBushes).not.toEqual(valley.berryBushes);
    expect(generateValley(8).mushrooms).not.toEqual(valley.mushrooms);
  });

  it("is on dry ground inside the valley, clear of tree trunks", () => {
    const valley = generateValley(7);
    for (const spot of [...valley.berryBushes, ...valley.mushrooms]) {
      expect(Math.abs(spot.x)).toBeLessThanOrEqual(valley.size / 2);
      expect(Math.abs(spot.z)).toBeLessThanOrEqual(valley.size / 2);
      expect(distanceToRiver(valley.river, spot)).toBeGreaterThan(valley.river.width / 2);
    }
    const nearestTrunk = (spot: { x: number; z: number }) => Math.min(...valley.trees.map((tree) => groundDistance(tree, spot)));
    for (const spot of [...valley.berryBushes.slice(0, 20), ...valley.mushrooms.slice(0, 20)]) {
      expect(nearestTrunk(spot)).toBeGreaterThanOrEqual(1.5);
    }
  });

  it("puts a ripe berry bush or mushroom spot in the game at each place the seed chose", () => {
    const game = createGame({ seed: 42 });
    const bushes = [...game.entities.with("forageSpot", "position")].filter((spot) => spot.forageSpot.food === "berries");
    const mushrooms = [...game.entities.with("forageSpot", "position")].filter((spot) => spot.forageSpot.food === "mushroom");

    expect(bushes.map(({ position: { x, z } }) => ({ x, z }))).toEqual(game.valley.berryBushes);
    expect(mushrooms.map(({ position: { x, z } }) => ({ x, z }))).toEqual(game.valley.mushrooms);
    expect(game.entities.with("regrowing").size).toBe(0);
  });
});

describe("foraging", () => {
  it("walks the player to a berry bush and puts its berries in the backpack", () => {
    const game = createGame({ seed: 42 });
    const bush = nearestSpot(game, "berries");

    game.client.send({ type: "forage", spotId: idOf(game, bush) });
    stepUntil(game, () => (game.client.getView().backpack.berries ?? 0) > 0);

    expect(groundDistance(onlyPlayer(game).position, bush.position)).toBeLessThan(2);
    expect(game.client.getView().backpack.berries).toBe(3);
    expect(bush.regrowing).toBeDefined();
  });

  it("puts the mushrooms from a mushroom spot in the backpack", () => {
    const game = createGame({ seed: 42 });
    const spot = nearestSpot(game, "mushroom");

    game.client.send({ type: "forage", spotId: idOf(game, spot) });
    stepUntil(game, () => (game.client.getView().backpack.mushroom ?? 0) > 0);

    expect(game.client.getView().backpack.mushroom).toBe(2);
    expect(spot.regrowing).toBeDefined();
  });

  it("leaves the food where it grows, and says so, when the backpack is too full", () => {
    const game = createGame({ seed: 42 });
    fillBackpack(game);
    const bush = nearestSpot(game, "berries");

    send(game, { type: "forage", spotId: idOf(game, bush) });
    expect(game.client.getView().notice).toBe("backpackFull");
    runSeconds(game, 60);

    expect(game.client.getView().backpack.berries).toBeUndefined();
    expect(bush.regrowing).toBeUndefined();
  });

  it("gives nothing from a bush that has not grown back yet", () => {
    const game = createGame({ seed: 42 });
    const bush = nearestSpot(game, "berries");
    game.client.send({ type: "forage", spotId: idOf(game, bush) });
    stepUntil(game, () => bush.regrowing !== undefined);

    send(game, { type: "forage", spotId: idOf(game, bush) });
    runSeconds(game, 5);

    expect(game.client.getView().backpack.berries).toBe(3);
  });
});

describe("growing back", () => {
  it("takes three days for a foraged spot", () => {
    const game = createGame({ seed: 42 });
    const bush = nearestSpot(game, "berries");
    game.client.send({ type: "forage", spotId: idOf(game, bush) });
    stepUntil(game, () => bush.regrowing !== undefined);

    skipHoursWellFed(game, 71);
    expect(bush.regrowing).toBeDefined();

    skipHoursWellFed(game, 1.5);
    expect(bush.regrowing).toBeUndefined();

    game.client.send({ type: "forage", spotId: idOf(game, bush) });
    stepUntil(game, () => (game.client.getView().backpack.berries ?? 0) > 3);
    expect(game.client.getView().backpack.berries).toBe(6);
  });
});

describe("eating", () => {
  it("takes one handful of berries from the backpack and fills hunger", () => {
    const game = createGame({ seed: 42 });
    give(game, "berries", 2);
    onlyPlayer(game).needs.hunger.level = 0.5;

    send(game, { type: "eat", food: "berries" });

    expect(game.client.getView().backpack.berries).toBe(1);
    expect(game.client.getView().needs.hunger).toBeCloseTo(0.6, 3);
  });

  it("fills more hunger with a mushroom, leaves the other needs alone, and does not make the player sick", () => {
    const game = createGame({ seed: 42 });
    give(game, "mushroom", 1);
    onlyPlayer(game).needs.hunger.level = 0.5;
    const before = game.client.getView().needs;

    send(game, { type: "eat", food: "mushroom" });

    const after = game.client.getView().needs;
    expect(after.hunger).toBeCloseTo(0.65, 3);
    // One logic step passes, so thirst drains by a hair.
    expect(after.thirst).toBeCloseTo(before.thirst, 3);
    expect(after).toMatchObject({ warmth: before.warmth, fatigue: before.fatigue });
    expect(game.client.getView().backpack.mushroom).toBe(0);
    expect(game.client.getView().sick).toBe(false);
  });

  it("never fills hunger past full", () => {
    const game = createGame({ seed: 42 });
    give(game, "berries", 1);
    onlyPlayer(game).needs.hunger.level = 0.95;

    send(game, { type: "eat", food: "berries" });

    expect(game.client.getView().needs.hunger).toBeCloseTo(1, 3);
  });

  it("does nothing when the backpack holds none of that food", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).needs.hunger.level = 0.5;

    send(game, { type: "eat", food: "mushroom" });

    expect(game.client.getView().needs.hunger).toBeCloseTo(0.5, 3);
  });
});

describe("saving food", () => {
  it("keeps hunger, foraged food, and which spots are growing back", () => {
    const game = createGame({ seed: 42 });
    const bush = nearestSpot(game, "berries");
    game.client.send({ type: "forage", spotId: idOf(game, bush) });
    stepUntil(game, () => bush.regrowing !== undefined);
    send(game, { type: "eat", food: "berries" });

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(loaded.game.client.getView().needs.hunger).toBe(game.client.getView().needs.hunger);
    expect(loaded.game.client.getView().backpack.berries).toBe(2);
    const loadedBush = loaded.game.entities.entity(idOf(game, bush));
    expect(loadedBush?.regrowing).toEqual(bush.regrowing);
    expect(loaded.game.entities.with("forageSpot").size).toBe(game.entities.with("forageSpot").size);
  });

  it("adds the valley's food to a save from before food grew", () => {
    const game = createGame({ seed: 42 });
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number; entities: { components: Entity }[] };
    save.version = 1;
    save.entities = save.entities.filter((entity) => entity.components.forageSpot === undefined);

    const loaded = readSave(save);
    if (!loaded.ok) throw new Error("The save was rejected");

    const spots = loaded.game.entities.with("forageSpot");
    expect(spots.size).toBe(game.valley.berryBushes.length + game.valley.mushrooms.length);
  });
});

/** Skips game time in short stretches, topping the player's needs up between them so no collapse cuts the skip short. */
function skipHoursWellFed(game: Game, hours: number): void {
  for (let left = hours; left > 0; left -= 3) {
    onlyPlayer(game).needs = createNeeds();
    send(game, { type: "skipTime", hours: Math.min(3, left) });
  }
}

/** Sends the player walking away from the river and returns how far they got in one real second. */
function distanceWalkedInOneSecond(game: Game): number {
  const player = onlyPlayer(game);
  send(game, { type: "walkTo", x: player.position.x - 30, z: player.position.z });
  const start = { ...player.position };
  runSeconds(game, 1);
  return groundDistance(player.position, start);
}

function give(game: Game, food: "berries" | "mushroom", count: number): void {
  const contents = onlyPlayer(game).backpack.contents;
  contents[food] = (contents[food] ?? 0) + count;
}

/** Packs the backpack so full that no food fits: the tools and 12 pieces of firewood weigh 19.9 kg. */
function fillBackpack(game: Game): void {
  onlyPlayer(game).backpack.contents.firewood = 12;
}

function nearestSpot(game: Game, food: "berries" | "mushroom") {
  const player = onlyPlayer(game);
  const spots = [...game.entities.with("forageSpot", "position")].filter((spot) => spot.forageSpot.food === food);
  const nearest = spots.sort((a, b) => groundDistance(a.position, player.position) - groundDistance(b.position, player.position))[0];
  if (nearest === undefined) throw new Error(`No ${food}`);
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
  const player = game.entities.with("player", "position", "backpack", "needs").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
