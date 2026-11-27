import { describe, expect, it } from "bun:test";
import { type Command } from "./api-commands";
import { nearbyOf } from "./api-game-view";
import { createGame, type Game, STEPS_PER_SECOND } from "./game";
import { SEASON_BANNER_MINUTES } from "./game-start";
import { clockStartMinutes, isNightAt, nextMorning } from "./clock";
import { readSave, writeSave } from "./save";
import { SAVE_VERSION } from "./save-upgrades";
import { SEASONS_SAVE_VERSION } from "./save-versions";
import { finishReach } from "./test-steps";
import { firstDayOfSeason, isAfterFirstWinter, isNightHour, nextSeasonStartDay, nightHoursOf, parseSeason, seasonDayOf } from "./season";

describe("the season of a day", () => {
  it("starts a new game's year on day 1 of spring", () => {
    expect(seasonDayOf(1, 1)).toEqual({ season: "spring", dayOfSeason: 1, seasonDays: 7 });
  });

  it("turns through spring, summer, autumn, and winter, 7 days each", () => {
    expect(seasonDayOf(7, 1)).toMatchObject({ season: "spring", dayOfSeason: 7 });
    expect(seasonDayOf(8, 1)).toMatchObject({ season: "summer", dayOfSeason: 1 });
    expect(seasonDayOf(15, 1)).toMatchObject({ season: "autumn", dayOfSeason: 1 });
    expect(seasonDayOf(22, 1)).toMatchObject({ season: "winter", dayOfSeason: 1 });
    expect(seasonDayOf(28, 1)).toMatchObject({ season: "winter", dayOfSeason: 7 });
  });

  it("starts a new year with spring after winter, forever", () => {
    expect(seasonDayOf(29, 1)).toMatchObject({ season: "spring", dayOfSeason: 1 });
    expect(seasonDayOf(29 + 28 * 10 + 21, 1)).toMatchObject({ season: "winter", dayOfSeason: 1 });
  });

  it("counts from the day the year started on", () => {
    expect(seasonDayOf(40, 40)).toMatchObject({ season: "spring", dayOfSeason: 1 });
    expect(seasonDayOf(49, 40)).toMatchObject({ season: "summer", dayOfSeason: 3 });
    expect(seasonDayOf(40 + 28, 40)).toMatchObject({ season: "spring", dayOfSeason: 1 });
  });

  it("finds the first day of the next season", () => {
    expect(nextSeasonStartDay(1, 1)).toBe(8);
    expect(nextSeasonStartDay(7, 1)).toBe(8);
    expect(nextSeasonStartDay(25, 1)).toBe(29);
    expect(nextSeasonStartDay(41, 40)).toBe(47);
  });

  it("finds the first day of a season in the first year", () => {
    expect(firstDayOfSeason("spring")).toBe(1);
    expect(firstDayOfSeason("winter")).toBe(22);
    expect(firstDayOfSeason("summer", 40)).toBe(47);
  });

  it("reads a season's name, and nothing else", () => {
    expect(parseSeason("autumn")).toBe("autumn");
    expect(parseSeason("Winter")).toBeUndefined();
    expect(parseSeason(null)).toBeUndefined();
  });
});

describe("the first winter", () => {
  it("has not come before the first year is over, and has from day 1 of the second spring on", () => {
    expect(isAfterFirstWinter(1, 1)).toBe(false);
    expect(isAfterFirstWinter(28, 1)).toBe(false);
    expect(isAfterFirstWinter(29, 1)).toBe(true);
    expect(isAfterFirstWinter(15, 10)).toBe(false);
  });
});

describe("night hours by season", () => {
  it("runs night from 20:00 to 6:00 in spring and autumn, 21:00 to 5:00 in summer, and 17:00 to 8:00 in winter", () => {
    expect(nightHoursOf("spring")).toEqual({ nightStartHour: 20, morningHour: 6 });
    expect(nightHoursOf("summer")).toEqual({ nightStartHour: 21, morningHour: 5 });
    expect(nightHoursOf("autumn")).toEqual({ nightStartHour: 20, morningHour: 6 });
    expect(nightHoursOf("winter")).toEqual({ nightStartHour: 17, morningHour: 8 });
  });

  it("calls an hour night from the night's start until morning", () => {
    const winter = nightHoursOf("winter");
    expect(isNightHour(16.99, winter)).toBe(false);
    expect(isNightHour(17, winter)).toBe(true);
    expect(isNightHour(0, winter)).toBe(true);
    expect(isNightHour(7.99, winter)).toBe(true);
    expect(isNightHour(8, winter)).toBe(false);
    const summer = nightHoursOf("summer");
    expect(isNightHour(20.5, summer)).toBe(false);
    expect(isNightHour(4.99, summer)).toBe(true);
    expect(isNightHour(5, summer)).toBe(false);
  });
});

describe("the night across a change of season", () => {
  const at = (day: number, hour: number) => clockStartMinutes({ day, hour });

  it("follows the season of the current day, so the night that starts in autumn ends on a winter morning", () => {
    // Day 21 is the last day of autumn, and day 22 is the first day of winter.
    expect(isNightAt(at(21, 17.5), 1)).toBe(false);
    expect(isNightAt(at(21, 20), 1)).toBe(true);
    expect(isNightAt(at(22, 7.5), 1)).toBe(true);
    expect(isNightAt(at(22, 8), 1)).toBe(false);
    expect(isNightAt(at(22, 17), 1)).toBe(true);
    expect(nextMorning(at(21, 20), 1)).toBe(at(22, 8));
  });

  it("ends the last winter night on a spring morning", () => {
    expect(isNightAt(at(28, 17), 1)).toBe(true);
    expect(isNightAt(at(29, 6), 1)).toBe(false);
    expect(nextMorning(at(28, 17), 1)).toBe(at(29, 6));
  });

  it("counts the season from the day the year started on", () => {
    // With the year starting on day 5, day 26 is the first day of winter.
    expect(isNightAt(at(26, 7), 5)).toBe(true);
    expect(nextMorning(at(26, 2), 5)).toBe(at(26, 8));
    expect(nextMorning(at(26, 9), 5)).toBe(at(27, 8));
  });
});

describe("cold by season in the game", () => {
  it("drains warmth faster on an autumn night than on a spring night", () => {
    const spring = createGame({ seed: 42, freeBuilding: true, startSeason: "spring" });
    const autumn = createGame({ seed: 42, freeBuilding: true, startSeason: "autumn" });
    for (const game of [spring, autumn]) send(game, { type: "skipTime", hours: 15 }); // 21:00, an hour into the night.
    expect(spring.client.getView().needs.warmth).toBeCloseTo(0.75, 2);
    expect(autumn.client.getView().needs.warmth).toBeCloseTo(0.625, 1);
  });

  it("starts the winter night at 17:00, draining warmth", () => {
    const game = createGame({ seed: 42, freeBuilding: true, startSeason: "winter" });
    game.step();
    expect(game.client.getView().night).toBe(false);
    expect(game.client.getView().nightHours).toEqual({ nightStartHour: 17, morningHour: 8 });
    const warmthAtMorning = game.client.getView().needs.warmth;
    send(game, { type: "skipTime", hours: 9 }); // 17:00.
    expect(game.client.getView().night).toBe(true);
    expect(game.client.getView().needs.warmth).toBeLessThan(warmthAtMorning);
  });

  it("collapses a player without a heated room on a winter night", () => {
    const game = createGame({ seed: 42, freeBuilding: true, startSeason: "winter" });
    send(game, { type: "skipTime", hours: 9 }); // 17:00.
    send(game, { type: "skipTime", hours: 4 });
    expect(game.client.getView().notice?.kind).toBe("collapsed");
  });
});

describe("sleeping through the night by season", () => {
  it.each([
    ["summer", 8, 5],
    ["autumn", 15, 6],
    ["winter", 22, 8],
  ] as const)("wakes a sleeper in %s at that season's morning", (season, firstDay, morningHour) => {
    const game = createGame({ seed: 42, freeBuilding: true, startSeason: season });
    putCampfireBesidePlayer(game);
    send(game, { type: "skipTime", hours: 16 }); // 22:00.
    send(game, { type: "layBedroll" });
    const bedrollId = nearbyOf(game.client.getView(), "bedroll")?.id;
    if (bedrollId === undefined) throw new Error("No bedroll was laid");

    send(game, { type: "sleep", bedrollId });

    expect(game.client.getView().time).toMatchObject({ day: firstDay + 1, hour: morningHour, minute: 0 });
  });
});

describe("the season in the game", () => {
  it("tells the view the season, the day within it, and its length", () => {
    const game = createGame({ seed: 42 });
    game.step();
    expect(game.client.getView().season).toEqual({ season: "spring", dayOfSeason: 1, seasonDays: 7 });
  });

  it("skips to the morning hour on day 1 of the next season and shows its banner", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "skipToSeason" });
    const view = game.client.getView();
    expect(view.time).toMatchObject({ day: 8, hour: 5, minute: 0 });
    expect(view.season).toMatchObject({ season: "summer", dayOfSeason: 1 });
    expect(view.seasonBanner).toBe("summer");
  });

  it("gets to the next season even when the player collapses on the way", () => {
    const game = createGame({ seed: 42 });
    for (let skip = 0; skip < 3; skip += 1) send(game, { type: "skipToSeason" });
    expect(game.client.getView().time).toMatchObject({ day: 22, hour: 8, minute: 0 });
    expect(game.client.getView().season.season).toBe("winter");
  });

  it("shows the season's banner for a while after it starts, then hides it", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "skipToSeason" });
    expect(game.client.getView().seasonBanner).toBe("summer");
    for (let step = 0; step < (SEASON_BANNER_MINUTES + 1) * STEPS_PER_SECOND; step += 1) game.step();
    expect(game.client.getView().seasonBanner).toBeNull();
  });

  it("tells the view whether a winter has come before today", () => {
    const game = createGame({ seed: 42 });
    game.step();
    expect(game.client.getView().afterFirstWinter).toBe(false);
    for (let skip = 0; skip < 4; skip += 1) send(game, { type: "skipToSeason" });
    expect(game.client.getView().season.season).toBe("spring");
    expect(game.client.getView().afterFirstWinter).toBe(true);
  });

  it("shows no banner when a game starts", () => {
    const game = createGame({ seed: 42 });
    game.step();
    expect(game.client.getView().seasonBanner).toBeNull();
  });
});

describe("the playground season", () => {
  it("starts at the morning hour on day 1 of the season asked for", () => {
    const game = createGame({ seed: 42, freeBuilding: true, startSeason: "winter" });
    game.step();
    const view = game.client.getView();
    expect(view.time).toMatchObject({ day: 22, hour: 8 });
    expect(view.season).toMatchObject({ season: "winter", dayOfSeason: 1 });
    expect(view.seasonBanner).toBeNull();
    expect(view.notice).toBeNull();
  });

  it("starts in spring without a season", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    game.step();
    expect(game.client.getView().season.season).toBe("spring");
  });
});

describe("saving the season", () => {
  it("saves the day the year started on", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "skipToSeason" });
    const save = writeSave(game);
    expect(save.yearStartDay).toBe(1);

    const loaded = load(JSON.parse(JSON.stringify(save)));
    expect(loaded.client.getView().season).toMatchObject({ season: "summer", dayOfSeason: 1 });
  });

  it("resumes an older save on day 1 of spring", () => {
    expect(SEASONS_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    const game = createGame({ seed: 42 });
    for (let skip = 0; skip < 2; skip += 1) send(game, { type: "skipToSeason" });
    const older = JSON.parse(JSON.stringify(writeSave(game))) as Record<string, unknown>;
    older.version = SEASONS_SAVE_VERSION - 1;
    delete older.yearStartDay;

    const loaded = load(older);
    expect(loaded.progress().yearStartDay).toBe(15);
    expect(loaded.client.getView().season).toEqual({ season: "spring", dayOfSeason: 1, seasonDays: 7 });
  });
});

/** Puts a lit campfire with two days' fuel beside the player. */
function putCampfireBesidePlayer(game: Game): void {
  const { x, y, z } = game.client.getView().playerPosition;
  game.entities.add({ campfire: { lit: true, fuelMinutes: 48 * 60 }, position: { x: x + 2, y, z } });
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
  finishReach(game);
}

function load(save: unknown): Game {
  const loaded = readSave(save);
  if (!loaded.ok) throw new Error(`The save did not load: ${loaded.reason}`);
  return loaded.game;
}
