import { describe, expect, it } from "vitest";
import type { Command } from "./api";
import { clockStartMinutes, isNight, MINUTES_PER_HOUR } from "./clock";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { createRain, passRainTime, type Rain } from "./rain";
import { readSave, writeSave } from "./save";

const GAME_START_MINUTES = clockStartMinutes({ day: 1, hour: 8 });
const DAY_2_MORNING_MINUTES = clockStartMinutes({ day: 2, hour: 6 });
const TEN_DAYS_MINUTES = 10 * 24 * MINUTES_PER_HOUR;

/** Runs the rain minute by minute and lists each spell of rain as [start, end] in game minutes. */
function rainSpells(seed: number, fromMinutes: number, forMinutes: number): [number, number][] {
  const rain = createRain(seed, fromMinutes);
  const spells: [number, number][] = [];
  let startedAt: number | undefined;
  for (let minutes = fromMinutes + 1; minutes <= fromMinutes + forMinutes; minutes += 1) {
    passRainTime(rain, seed, minutes);
    if (rain.falling && startedAt === undefined) startedAt = minutes;
    if (!rain.falling && startedAt !== undefined) {
      spells.push([startedAt, minutes]);
      startedAt = undefined;
    }
  }
  return spells;
}

describe("rain", () => {
  it("starts dry", () => {
    expect(createRain(42, GAME_START_MINUTES).falling).toBe(false);
  });

  it("starts and stops several times over ten days", () => {
    const spells = rainSpells(42, GAME_START_MINUTES, TEN_DAYS_MINUTES);
    expect(spells.length).toBeGreaterThanOrEqual(3);
    for (const [start, end] of spells) {
      expect(end - start).toBeGreaterThanOrEqual(MINUTES_PER_HOUR);
      expect(end - start).toBeLessThanOrEqual(6 * MINUTES_PER_HOUR);
    }
  });

  it("does not fall before the first night is over, so a new player gets one dry day", () => {
    for (const seed of [1, 2, 3, 42, 1234, 99_999]) {
      const [first] = rainSpells(seed, GAME_START_MINUTES, TEN_DAYS_MINUTES);
      expect(first?.[0]).toBeGreaterThanOrEqual(DAY_2_MORNING_MINUTES);
    }
  });

  it("falls at the same times for the same seed", () => {
    expect(rainSpells(7, GAME_START_MINUTES, TEN_DAYS_MINUTES)).toEqual(rainSpells(7, GAME_START_MINUTES, TEN_DAYS_MINUTES));
  });

  it("falls at different times for different seeds", () => {
    expect(rainSpells(7, GAME_START_MINUTES, TEN_DAYS_MINUTES)).not.toEqual(rainSpells(8, GAME_START_MINUTES, TEN_DAYS_MINUTES));
  });

  it("catches up on a long jump in time the same as minute by minute", () => {
    const stepped = createRain(42, GAME_START_MINUTES);
    for (let minutes = GAME_START_MINUTES; minutes <= GAME_START_MINUTES + TEN_DAYS_MINUTES; minutes += 1) {
      passRainTime(stepped, 42, minutes);
    }
    const jumped: Rain = createRain(42, GAME_START_MINUTES);
    passRainTime(jumped, 42, GAME_START_MINUTES + TEN_DAYS_MINUTES);
    expect(jumped).toEqual(stepped);
  });
});

describe("rain in the game", () => {
  it("is not falling when a new game starts", () => {
    expect(createGame({ seed: 42 }).client.getView().raining).toBe(false);
  });

  it("can be reached by skipping time from the debug overlay, and stopped the same way", () => {
    const game = createGame({ seed: 42 });
    putCampfireBesidePlayer(game); // Keeps the player warm through the first night.

    send(game, { type: "skipToRainChange" });
    const started = game.client.getView();
    expect(started.raining).toBe(true);
    expect(clockStartMinutes(started.time)).toBeGreaterThanOrEqual(DAY_2_MORNING_MINUTES);
    expect(started.notice).not.toBe("collapsed");

    send(game, { type: "skipToRainChange" });
    expect(game.client.getView().raining).toBe(false);
  });

  it("drains the player's warmth during the day", () => {
    const game = rainingGame();
    expect(isNight(game.client.getView().time.hourOfDay)).toBe(false);
    const before = game.client.getView().warmth;

    runGameMinutes(game, 20);

    expect(game.client.getView().raining).toBe(true);
    expect(game.client.getView().warmth).toBeCloseTo(before - 0.25 / 3, 2);
  });

  it("does not stop a lit campfire warming the player, or put it out", () => {
    const game = rainingGame();
    onlyPlayer(game).needs.warmth.level = 0.4;
    const campfire = putCampfireBesidePlayer(game);

    runGameMinutes(game, 20);

    expect(game.client.getView().raining).toBe(true);
    expect(game.client.getView().warmth).toBeGreaterThan(0.6);
    expect(campfire.campfire.lit).toBe(true);
  });

  it("is saved: whether it is raining, and for how long", () => {
    const game = rainingGame();
    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save was rejected");
    expect(loaded.game.client.getView().raining).toBe(true);

    for (const each of [game, loaded.game]) send(each, { type: "skipToRainChange" });

    expect(loaded.game.client.getView().raining).toBe(false);
    expect(loaded.game.client.getView().time).toEqual(game.client.getView().time);
  });

  it("starts dry when loading a save made before rain existed", () => {
    const save = writeSave(createGame({ seed: 42 }));
    save.entities = save.entities.filter((entity) => entity.components.rain === undefined);
    const loaded = readSave(save);
    if (!loaded.ok) throw new Error("The save was rejected");
    expect(loaded.game.client.getView().raining).toBe(false);
  });
});

/**
 * A game with seed 4, skipped to the first rain with a campfire keeping the player warm through the night.
 * The campfire is then put away and the player's warmth refilled. Seed 4's first rain starts during the day.
 */
function rainingGame(): Game {
  const game = createGame({ seed: 4 });
  const campfire = putCampfireBesidePlayer(game);
  send(game, { type: "skipToRainChange" });
  game.entities.remove(campfire);
  onlyPlayer(game).needs.warmth.level = 1;
  return game;
}

/** Puts a lit campfire 2 m from the player, inside its warmth range. Its fuel lasts three days, more than any campfire holds. */
function putCampfireBesidePlayer(game: Game) {
  const player = onlyPlayer(game);
  return game.entities.add({
    campfire: { lit: true, fuelMinutes: 72 * 60 },
    position: { x: player.position.x + 2, y: player.position.y, z: player.position.z },
  });
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position", "needs").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
}

/** Runs logic steps for this many game minutes. One game minute passes in one real second. */
function runGameMinutes(game: Game, minutes: number): void {
  for (let i = 0; i < minutes * STEPS_PER_SECOND; i += 1) game.step();
}
