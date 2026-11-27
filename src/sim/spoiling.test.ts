import { describe, expect, it } from "bun:test";
import { nearbyOf, type BackpackContent, type Command, type FreshFood } from "./api";
import { MINUTES_PER_DAY, MINUTES_PER_HOUR } from "./clock";
import type { Entity } from "./entities";
import { KEEPS_FOR_MINUTES } from "./fresh-food";
import { createGame, type Game } from "./game";
import { readSave, writeSave } from "./save";
import { SPOILING_SAVE_VERSION } from "./save-versions";
import { addFinished, finishReach, onlyPlayer, stepUntil } from "./test-steps";
import { isWalkable } from "./walk-map";
import { strings } from "../strings";

describe("fresh food in the backpack", () => {
  for (const food of ["rawFish", "cookedFish", "berries", "mushroom"] as const) {
    it(`keeps ${food} for ${KEEPS_FOR_MINUTES[food] / MINUTES_PER_HOUR} hours, then it is gone`, () => {
      const game = createGame({ seed: 42 });
      give(game, food, 2);
      game.step();

      skipHours(game, KEEPS_FOR_MINUTES[food] / MINUTES_PER_HOUR - 1);
      expect(game.client.getView().backpack[food]).toBe(2);

      skipHours(game, 1.5);
      expect(game.client.getView().backpack[food] ?? 0).toBe(0);
    });
  }

  it("stays fully fresh until it spoils, so it fills its full hunger", () => {
    const game = createGame({ seed: 42 });
    give(game, "berries", 1);
    game.step();
    skipHours(game, 47);
    const player = onlyPlayer(game) as Entity & Required<Pick<Entity, "needs">>;
    player.needs.hunger.level = 0.5;

    send(game, { type: "eat", food: "berries" });

    expect(player.needs.hunger.level).toBeCloseTo(0.6, 2);
  });

  it("says what spoiled", () => {
    const game = createGame({ seed: 42 });
    give(game, "berries", 2);
    give(game, "cookedFish", 1);
    game.step();

    skipHours(game, 47);
    skipMinutesUntil(game, 90, () => (game.client.getView().backpack.berries ?? 0) === 0);

    expect(game.client.getView().notice).toEqual({ kind: "foodSpoiled", spoiled: { berries: 2, cookedFish: 1 } });
    expect(strings.notices.foodSpoiled([["berries", 2]])).toBe("2 berries spoiled.");
    expect(
      strings.notices.foodSpoiled([
        ["berries", 2],
        ["rawFish", 1],
      ]),
    ).toBe("2 berries and 1 raw fish spoiled.");
  });

  it("shows how long the oldest has left, and that as a share of its keeping time", () => {
    const game = createGame({ seed: 42 });
    give(game, "berries", 1);
    game.step();
    skipHours(game, 12);
    give(game, "berries", 1);
    game.step();

    const freshness = game.client.getView().backpackFreshness.berries;
    expect(freshness?.minutesLeft).toBeCloseTo(36 * MINUTES_PER_HOUR, 0);
    expect(freshness?.share).toBeCloseTo(0.75, 2);
    expect(game.client.getView().backpackFreshness.rawFish).toBeUndefined();
  });

  it("eats the oldest first", () => {
    const game = createGame({ seed: 42 });
    give(game, "berries", 1);
    game.step();
    skipHours(game, 24);
    give(game, "berries", 1);
    game.step();

    send(game, { type: "eat", food: "berries" });

    expect(game.client.getView().backpack.berries).toBe(1);
    expect(minutesLeft(game, "berries")).toBeCloseTo(2 * MINUTES_PER_DAY, -1);
  });

  it("spoils at the same rate in winter", () => {
    const game = createGame({ seed: 42, startSeason: "winter" });
    give(game, "mushroom", 1);
    game.step();

    skipHours(game, 71);
    expect(game.client.getView().backpack.mushroom).toBe(1);
    skipHours(game, 1.5);
    expect(game.client.getView().backpack.mushroom ?? 0).toBe(0);
  });
});

describe("fresh food in a chest or on a shelf", () => {
  for (const furniture of ["chest", "shelf"] as const) {
    it(`spoils in a ${furniture} at the same rate as in the backpack`, () => {
      const game = createGame({ seed: 42 });
      const piece = addFinished(game, furniture, openSquareNearPlayer(game), 0);
      give(game, "cookedFish", 2);
      game.step();
      open(game, piece.id);
      skipHours(game, 24);

      send(game, { type: "putInChest", chestId: piece.id, content: "cookedFish", all: true });
      expect(piece.entity.storage?.contents.cookedFish).toBe(2);

      skipHours(game, 23);
      expect(piece.entity.storage?.contents.cookedFish).toBe(2);
      skipMinutesUntil(game, 90, () => (piece.entity.storage?.contents.cookedFish ?? 0) === 0);
      expect(game.client.getView().notice).toEqual({ kind: "foodSpoiled", spoiled: { cookedFish: 2 } });
    });
  }

  it("stores and takes the oldest first, and the chest panel shows how fresh the oldest is", () => {
    const game = createGame({ seed: 42 });
    const chest = addFinished(game, "chest", openSquareNearPlayer(game), 0);
    give(game, "berries", 1);
    game.step();
    skipHours(game, 24);
    give(game, "berries", 1);
    game.step();
    open(game, chest.id);

    send(game, { type: "putInChest", chestId: chest.id, content: "berries", all: false });

    expect(nearbyOf(game.client.getView(), "openChest")?.freshness.berries?.minutesLeft).toBeCloseTo(MINUTES_PER_DAY, -1);
    expect(minutesLeft(game, "berries")).toBeCloseTo(2 * MINUTES_PER_DAY, -1);

    give(game, "berries", 0);
    send(game, { type: "takeFromChest", chestId: chest.id, content: "berries", all: false });
    expect(game.client.getView().backpack.berries).toBe(2);
    expect(minutesLeft(game, "berries")).toBeCloseTo(MINUTES_PER_DAY, -1);
  });
});

describe("fresh food on the ground", () => {
  it("keeps its spoil times when dropped and picked up, and spoils in a pile at the same rate", () => {
    const game = createGame({ seed: 42 });
    give(game, "rawFish", 2);
    game.step();
    skipHours(game, 12);

    send(game, { type: "dropFromBackpack", content: "rawFish" });
    const pile = game.entities.with("pile").first;
    if (pile === undefined) throw new Error("No pile");
    expect(pile.pile.spoilsAt?.rawFish?.[0]).toBeCloseTo(game.progress().clockMinutes + 12 * MINUTES_PER_HOUR, -1);

    send(game, { type: "pickUpPile", pileId: idOf(game, pile) });
    stepUntil(game, () => game.entities.with("pile").size === 0);
    expect(minutesLeft(game, "rawFish")).toBeCloseTo(12 * MINUTES_PER_HOUR, -1);

    send(game, { type: "dropFromBackpack", content: "rawFish" });
    skipHours(game, 11);
    expect(game.entities.with("pile").first?.pile.count).toBe(2);
    skipHours(game, 1.5);
    expect(game.entities.with("pile").size).toBe(0);
  });
});

describe("saving fresh food", () => {
  it("keeps when each food spoils, in the backpack, a chest, and a pile", () => {
    const game = createGame({ seed: 42 });
    const chest = addFinished(game, "chest", openSquareNearPlayer(game), 0);
    give(game, "berries", 3);
    game.step();
    open(game, chest.id);
    send(game, { type: "putInChest", chestId: chest.id, content: "berries", all: false });
    skipHours(game, 5);
    give(game, "mushroom", 1);
    game.step();
    send(game, { type: "dropFromBackpack", content: "mushroom" });

    const loaded = readSave(structuredClone(writeSave(game)));
    if (!loaded.ok) throw new Error("The save did not load");

    const spoilTimes = (of: Game) =>
      [...of.entities.entities]
        .flatMap((entity) => [entity.backpack?.spoilsAt, entity.storage?.spoilsAt, entity.pile?.spoilsAt])
        .filter((times) => times !== undefined)
        .map((times) => JSON.stringify(times))
        .sort();
    expect(spoilTimes(loaded.game)).toEqual(spoilTimes(game));
    expect(spoilTimes(game)).toHaveLength(3);
  });

  it("gives every food in an older save its full keeping time from the moment the save loads", () => {
    const game = createGame({ seed: 42 });
    const chest = addFinished(game, "chest", openSquareNearPlayer(game), 0);
    give(game, "rawFish", 2);
    give(game, "cookedFish", 1);
    game.step();
    open(game, chest.id);
    send(game, { type: "putInChest", chestId: chest.id, content: "rawFish", all: false });
    give(game, "berries", 1);
    game.step();
    send(game, { type: "dropFromBackpack", content: "berries" });
    skipHours(game, 10);
    const save = writeSave(game);
    for (const { components } of save.entities) {
      delete components.backpack?.spoilsAt;
      delete components.storage?.spoilsAt;
      delete components.pile?.spoilsAt;
    }

    const loaded = readSave({ ...save, version: SPOILING_SAVE_VERSION - 1 });
    if (!loaded.ok) throw new Error("The save did not load");

    const now = save.clockMinutes;
    const loadedPlayer = onlyPlayer(loaded.game);
    expect(loadedPlayer.backpack.spoilsAt).toEqual({ rawFish: [now + MINUTES_PER_DAY], cookedFish: [now + 2 * MINUTES_PER_DAY] });
    expect(loaded.game.entities.with("storage").first?.storage.spoilsAt).toEqual({ rawFish: [now + MINUTES_PER_DAY] });
    expect(loaded.game.entities.with("pile").first?.pile.spoilsAt).toEqual({ berries: [now + 2 * MINUTES_PER_DAY] });
  });
});

/** How long the oldest of `food` in the backpack has left, in game minutes. */
function minutesLeft(game: Game, food: FreshFood): number | undefined {
  return game.client.getView().backpackFreshness[food]?.minutesLeft;
}

/** Jumps the clock forward an hour at a time, filling the player's needs before each, so they never collapse. */
function skipHours(game: Game, hours: number): void {
  for (let left = hours; left > 0; left -= 1) {
    const { needs } = onlyPlayer(game) as Entity & Required<Pick<Entity, "needs">>;
    for (const need of Object.values(needs)) need.level = 1;
    send(game, { type: "skipTime", hours: Math.min(1, left) });
  }
}

/** Jumps the clock forward a game minute at a time until `done` holds. It throws if that takes longer than `minutes`. */
function skipMinutesUntil(game: Game, minutes: number, done: () => boolean): void {
  for (let left = minutes; left > 0 && !done(); left -= 1) send(game, { type: "skipTime", hours: 1 / MINUTES_PER_HOUR });
  if (!done()) throw new Error("Never happened");
}

/** Walks the player to a chest or shelf and opens it. */
function open(game: Game, chestId: number): void {
  send(game, { type: "openChest", chestId });
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
  finishReach(game);
}

function give(game: Game, content: BackpackContent, count: number): void {
  const backpack = onlyPlayer(game).backpack;
  backpack.contents = { ...backpack.contents, [content]: (backpack.contents[content] ?? 0) + count };
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
  finishReach(game);
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}

/** The middle of a building-grid square a few metres from the player, with open ground all round it. */
function openSquareNearPlayer(game: Game): { x: number; z: number } {
  const player = onlyPlayer(game);
  for (let distance = 3; distance < 30; distance += 1) {
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
    ] as const) {
      const square = { x: Math.floor(player.position.x + dx * distance) + 0.5, z: Math.floor(player.position.z + dz * distance) + 0.5 };
      const open = [-2, -1, 0, 1, 2].every((ax) => [-2, -1, 0, 1, 2].every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      if (open) return square;
    }
  }
  throw new Error("No open square");
}
