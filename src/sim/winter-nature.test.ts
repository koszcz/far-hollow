import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import { stickEntities, type Entity } from "./entities";
import { REGROW_MINUTES } from "./foraging";
import { createGame, type Game } from "./game";
import { createNeeds } from "./needs";
import type { GroundPoint } from "./ground-point";
import { finishReach } from "./test-steps";
import { distanceToRiver } from "./valley";
import { isWalkable } from "./walk-map";

describe("food in winter", () => {
  it("refuses foraging a bush or mushroom patch, because nothing grows in winter", () => {
    const game = createGame({ seed: 42, startSeason: "winter" });
    for (const food of ["berries", "mushroom"] as const) {
      const spot = nearestSpot(game, food);
      expect(game.client.refusal({ type: "forage", spotId: idOf(game, spot) })).toEqual({ kind: "nothingGrowsInWinter" });
    }
  });

  it("refuses foraging a planted bush or a mushroom log in winter, even one full of food", () => {
    const game = createGame({ seed: 42, startSeason: "winter" });
    const planted: Entity = game.entities.add({ forageSpot: { food: "berries" }, position: { x: 3, y: 0, z: 3 } });
    const mushroomLog: Entity = game.entities.add({ mushroomLog: { heading: 0 }, forageSpot: { food: "mushroom" }, position: { x: 5, y: 0, z: 5 } });
    for (const spot of [planted, mushroomLog]) {
      expect(game.client.refusal({ type: "forage", spotId: idOf(game, spot) })).toEqual({ kind: "nothingGrowsInWinter" });
    }
  });

  it("is lost when winter starts, so every spot starts growing back from the beginning, with no berries on the bushes", () => {
    const game = createGame({ seed: 42, startSeason: "autumn" });
    const spots = game.entities.with("forageSpot", "position").entities;
    expect(spots.every((spot) => spot.regrowing === undefined)).toBe(true);

    skipToSeason(game);

    expect(game.client.getView().season.season).toBe("winter");
    expect(spots.every((spot) => spot.regrowing?.minutesLeft === REGROW_MINUTES)).toBe(true);
  });

  it("pauses growing back in winter, planted bushes and mushroom logs too, and resumes on day 1 of spring", () => {
    const game = createGame({ seed: 42, startSeason: "winter" });
    const wild = nearestSpot(game, "berries");
    const planted: Entity = game.entities.add({ forageSpot: { food: "berries" }, regrowing: { minutesLeft: 500 }, position: { x: 3, y: 0, z: 3 } });
    const mushroomLog: Entity = game.entities.add({
      mushroomLog: { heading: 0 },
      forageSpot: { food: "mushroom" },
      regrowing: { minutesLeft: 500 },
      position: { x: 5, y: 0, z: 5 },
    });

    passHours(game, 30);
    expect(wild.regrowing?.minutesLeft).toBe(REGROW_MINUTES);
    expect(planted.regrowing?.minutesLeft).toBe(500);
    expect(mushroomLog.regrowing?.minutesLeft).toBe(500);

    // Spring starts at midnight, and the skip stops at 6:00, so the spots have grown for 6 hours.
    skipToSeason(game);
    expect(game.client.getView().season.season).toBe("spring");
    expect(wild.regrowing?.minutesLeft).toBeCloseTo(REGROW_MINUTES - 6 * 60, 0);
    expect(planted.regrowing?.minutesLeft).toBeCloseTo(500 - 6 * 60, 0);
    expect(mushroomLog.regrowing?.minutesLeft).toBeCloseTo(500 - 6 * 60, 0);
  });

  it("grows back in spring once its full time has passed", () => {
    const game = createGame({ seed: 42, startSeason: "winter" });
    passHours(game, 1);
    const spot = nearestSpot(game, "berries");
    skipToSeason(game);

    passHours(game, REGROW_MINUTES / 60 - 6 - 1);
    expect(spot.regrowing).toBeDefined();
    passHours(game, 1);
    expect(spot.regrowing).toBeUndefined();
    expect(game.client.refusal({ type: "forage", spotId: idOf(game, spot) })).toBeNull();
  });
});

describe("trees and sticks in winter", () => {
  it("stops stumps, saplings, and young trees growing, and they grow on in spring", () => {
    const game = createGame({ seed: 42, startSeason: "winter" });
    const tree = nearestTree(game);
    send(game, { type: "chopTree", treeId: idOf(game, tree) });
    stepUntil(game, () => tree.stump === true);
    const sapling: Entity = game.entities.add({ growth: { stage: "sapling", minutesLeft: 100 }, position: { x: 3, y: 0, z: 3 } });
    const young: Entity = game.entities.add({ growth: { stage: "youngTree", minutesLeft: 100 }, position: { x: 6, y: 0, z: 6 } });
    const stumpLeft = tree.growth?.minutesLeft;

    passHours(game, 30);
    expect(tree.growth?.minutesLeft).toBe(stumpLeft);
    expect(sapling.growth).toEqual({ stage: "sapling", minutesLeft: 100 });
    expect(young.growth).toEqual({ stage: "youngTree", minutesLeft: 100 });

    skipToSeason(game);
    expect(tree.growth?.minutesLeft).toBeLessThan(stumpLeft ?? 0);
    expect(sapling.growth?.stage).toBe("youngTree");
    expect(young.tree).toBe(true);
  });

  it("keeps sticks falling", () => {
    const game = createGame({ seed: 42, startSeason: "winter" });
    for (const stick of [...stickEntities(game.entities)].slice(0, 100)) game.entities.remove(stick);
    const before = stickEntities(game.entities).entities.length;

    passHours(game, 12);

    expect(stickEntities(game.entities).entities.length).toBeGreaterThan(before);
  });
});

describe("the frozen river", () => {
  it("still lets the player drink, and the unboiled water still makes them sick", () => {
    const game = createGame({ seed: 42, startSeason: "winter" });
    onlyPlayer(game).needs.thirst.level = 0.5;

    send(game, { type: "drinkFromRiver", ...riverMiddleNearPlayer(game) });
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined && onlyPlayer(game).approach === undefined);

    expect(game.client.getView().needs.thirst).toBeCloseTo(1, 2);
    expect(game.client.getView().sick).toBe(true);
  });

  it("refuses fishing with a rod, because the river is frozen", () => {
    const game = createGame({ seed: 42, startSeason: "winter" });
    give(game, { fishingRod: 1 });
    expect(game.client.refusal({ type: "fish", ...riverMiddleNearPlayer(game) })).toEqual({ kind: "riverFrozen" });
  });

  it("stops the player fishing when winter starts", () => {
    const game = createGame({ seed: 42, startSeason: "autumn" });
    give(game, { fishingRod: 1 });
    send(game, { type: "fish", ...riverMiddleNearPlayer(game) });
    stepUntil(game, () => game.client.getView().action?.kind === "fish");

    // Autumn started at 6:00, and winter starts at midnight 7 days later. This stops a little after 23:00 on its last day.
    passHours(game, 7 * 24 - 7);
    expect(game.client.getView().action?.kind).toBe("fish");
    passHours(game, 1);
    game.step();

    expect(game.client.getView().action).toBeNull();
  });

  it("refuses setting a fish trap, because the river is frozen", () => {
    const game = createGame({ seed: 42, startSeason: "winter" });
    give(game, { fishTrap: 1 });
    expect(game.client.refusal({ type: "setFishTrap", ...riverMiddleNearPlayer(game) })).toEqual({ kind: "riverFrozen" });
  });

  it("stops a set trap catching in winter, and its time to the next catch waits for spring", () => {
    const game = createGame({ seed: 42, startSeason: "autumn" });
    give(game, { fishTrap: 1 });
    send(game, { type: "setFishTrap", ...riverMiddleNearPlayer(game) });
    stepUntil(game, () => traps(game).length > 0);
    const trap = onlyTrap(game);
    skipToSeason(game);
    // The skip may have let the trap catch a fish before winter. Take it, so the trap waits for its next one.
    if (trap.fishTrap.holding) takeFish(game);
    const waiting = structuredClone(trap.fishTrap);

    passHours(game, 48);
    expect(trap.fishTrap).toEqual(waiting);

    skipToSeason(game);
    passHours(game, 12);
    expect(trap.fishTrap.holding).toBe(true);
  });

  it("lets a trap keep the fish it already holds, and the player can take it", () => {
    const game = createGame({ seed: 42, startSeason: "autumn" });
    give(game, { fishTrap: 1 });
    send(game, { type: "setFishTrap", ...riverMiddleNearPlayer(game) });
    stepUntil(game, () => traps(game).length > 0);
    passHours(game, 13);
    expect(onlyTrap(game).fishTrap.holding).toBe(true);

    skipToSeason(game);
    expect(game.client.getView().season.season).toBe("winter");
    expect(onlyTrap(game).fishTrap.holding).toBe(true);

    const fishBefore = onlyPlayer(game).backpack.contents.rawFish ?? 0;
    takeFish(game);
    expect(onlyPlayer(game).backpack.contents.rawFish).toBe(fishBefore + 1);
  });

  it("cannot be walked on, while the bank can", () => {
    const game = createGame({ seed: 42, startSeason: "winter" });
    expect(isWalkable(game.walkMap, riverMiddleNearPlayer(game))).toBe(false);
    expect(isWalkable(game.walkMap, onlyPlayer(game).position)).toBe(true);
  });

  it("thaws on day 1 of spring, so the player can fish and set traps again", () => {
    const game = createGame({ seed: 42, startSeason: "winter" });
    give(game, { fishingRod: 1, fishTrap: 1 });
    skipToSeason(game);

    expect(game.client.refusal({ type: "fish", ...riverMiddleNearPlayer(game) })).toBeNull();
    expect(game.client.refusal({ type: "setFishTrap", ...riverMiddleNearPlayer(game) })).toBeNull();
  });
});

/** Puts these things in the backpack, beside what it holds. */
function give(game: Game, contents: Partial<Record<"fishingRod" | "fishTrap", number>>): void {
  const { backpack } = onlyPlayer(game);
  backpack.contents = { ...backpack.contents, ...contents };
}

function traps(game: Game) {
  return game.entities.with("fishTrap", "position").entities;
}

function onlyTrap(game: Game) {
  const [trap] = traps(game);
  if (trap === undefined) throw new Error("No trap");
  return trap;
}

/** Takes the fish from the only set trap, and waits until it is in the backpack. */
function takeFish(game: Game): void {
  send(game, { type: "takeFishFromTrap", trapId: idOf(game, onlyTrap(game)) });
  stepUntil(game, () => !onlyTrap(game).fishTrap.holding);
}

/** The spot on the middle line of the river level with the player. The player starts on the west bank. */
function riverMiddleNearPlayer(game: Game): GroundPoint {
  const { position } = onlyPlayer(game);
  let best = { x: position.x, z: position.z };
  for (let x = position.x; x < position.x + 100; x += 0.1) {
    if (distanceToRiver(game.valley.river, { x, z: position.z }) < distanceToRiver(game.valley.river, best)) best = { x, z: position.z };
  }
  return best;
}

function nearestTree(game: Game) {
  const { position } = onlyPlayer(game);
  const distance = (at: { x: number; z: number }) => Math.hypot(at.x - position.x, at.z - position.z);
  return game.entities.with("tree", "position").entities.reduce((best, tree) => (distance(tree.position) < distance(best.position) ? tree : best));
}

function stepUntil(game: Game, done: () => boolean): void {
  for (let i = 0; !done(); i += 1) {
    if (i > 2_000_000) throw new Error("It never happened");
    game.step();
  }
}

function nearestSpot(game: Game, food: "berries" | "mushroom") {
  const { position } = onlyPlayer(game);
  const spots = game.entities.with("forageSpot", "position").entities.filter((spot) => spot.forageSpot.food === food);
  const distance = (spot: { position: { x: number; z: number } }) => Math.hypot(spot.position.x - position.x, spot.position.z - position.z);
  const nearest = spots.reduce((best, spot) => (distance(spot) < distance(best) ? spot : best));
  return nearest;
}

/** Skips this many game hours, an hour at a time, filling the player's needs before each, so a long skip does not end in a collapse. */
function passHours(game: Game, hours: number): void {
  for (let hour = 0; hour < hours; hour += 1) {
    Object.assign(onlyPlayer(game).needs, createNeeds());
    send(game, { type: "skipTime", hours: 1 });
  }
}

/** Skips to 6:00 on day 1 of the next season. */
function skipToSeason(game: Game): void {
  Object.assign(onlyPlayer(game).needs, createNeeds());
  send(game, { type: "skipToSeason" });
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
  finishReach(game);
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position", "needs", "backpack").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("No id");
  return id;
}
