import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import { createGame, type Game, SEASON_BANNER_MINUTES, STEPS_PER_SECOND } from "./game";
import { readSave, SEASONS_SAVE_VERSION, SAVE_VERSION, writeSave } from "./save";
import { firstDayOfSeason, nextSeasonStartDay, parseSeason, seasonDayOf } from "./season";

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

describe("the season in the game", () => {
  it("tells the view the season, the day within it, and its length", () => {
    const game = createGame({ seed: 42 });
    game.step();
    expect(game.client.getView().season).toEqual({ season: "spring", dayOfSeason: 1, seasonDays: 7 });
  });

  it("skips to 6:00 on day 1 of the next season and shows its banner", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "skipToSeason" });
    const view = game.client.getView();
    expect(view.time).toMatchObject({ day: 8, hour: 6, minute: 0 });
    expect(view.season).toMatchObject({ season: "summer", dayOfSeason: 1 });
    expect(view.seasonBanner).toBe("summer");
  });

  it("gets to the next season even when the player collapses on the way", () => {
    const game = createGame({ seed: 42 });
    for (let skip = 0; skip < 3; skip += 1) send(game, { type: "skipToSeason" });
    expect(game.client.getView().time).toMatchObject({ day: 22, hour: 6, minute: 0 });
    expect(game.client.getView().season.season).toBe("winter");
  });

  it("shows the season's banner for a while after it starts, then hides it", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "skipToSeason" });
    expect(game.client.getView().seasonBanner).toBe("summer");
    for (let step = 0; step < (SEASON_BANNER_MINUTES + 1) * STEPS_PER_SECOND; step += 1) game.step();
    expect(game.client.getView().seasonBanner).toBeNull();
  });

  it("shows no banner when a game starts", () => {
    const game = createGame({ seed: 42 });
    game.step();
    expect(game.client.getView().seasonBanner).toBeNull();
  });
});

describe("the playground season", () => {
  it("starts at 6:00 on day 1 of the season asked for", () => {
    const game = createGame({ seed: 42, freeBuilding: true, startSeason: "winter" });
    game.step();
    const view = game.client.getView();
    expect(view.time).toMatchObject({ day: 22, hour: 6 });
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

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
}

function load(save: unknown): Game {
  const loaded = readSave(save);
  if (!loaded.ok) throw new Error(`The save did not load: ${loaded.reason}`);
  return loaded.game;
}
