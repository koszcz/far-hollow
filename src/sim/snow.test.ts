import { describe, expect, it } from "bun:test";
import { snapToGridSquare } from "./build-grid";
import type { Command } from "./api";
import { isRaining, isSnowing, rainEntities } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";

describe("snowfall in place of rain", () => {
  it("falls as snow in winter, where the same spell would be rain in any other season", () => {
    const winter = createGame({ seed: 4, startSeason: "winter" });
    const spring = createGame({ seed: 4, startSeason: "spring" });
    for (const game of [winter, spring]) letRainFall(game);

    expect(winter.client.getView()).toMatchObject({ snowing: true, raining: false });
    expect(spring.client.getView()).toMatchObject({ snowing: false, raining: true });
  });

  it("tells drawing and sound that snow falls, not rain, so no rain is drawn or heard", () => {
    const game = createGame({ seed: 4, startSeason: "winter" });
    letRainFall(game);
    expect(isRaining(game.entities)).toBe(false);
    expect(isSnowing(game.entities)).toBe(true);
  });

  it("is reached and stopped by the debug skip to the next rain change", () => {
    const game = createGame({ seed: 4, startSeason: "winter" });
    // The next spell starts in 2 hours, so the player stays well through the skip.
    weatherOf(game).changeAtMinutes = game.progress().clockMinutes + 120;
    send(game, { type: "skipToRainChange" });
    expect(game.client.getView()).toMatchObject({ snowing: true, raining: false });

    // The snow stops in 2 hours too, before the winter cold can make the player collapse.
    keepPlayerWell(game);
    weatherOf(game).changeAtMinutes = game.progress().clockMinutes + 120;
    send(game, { type: "skipToRainChange" });
    expect(game.client.getView()).toMatchObject({ snowing: false, raining: false });
  });

  it("drains warmth outdoors by 0.25 an hour more than dry weather", () => {
    const snowy = createGame({ seed: 4, startSeason: "winter" });
    const dry = createGame({ seed: 4, startSeason: "winter" });
    letRainFall(snowy);
    stopRain(dry);
    // From 6:00 to 7:00, so neither game crosses into or out of the night.
    for (const game of [snowy, dry]) {
      game.step();
      keepPlayerWell(game);
      runGameMinutes(game, 60);
    }

    expect(dry.client.getView().warmth - snowy.client.getView().warmth).toBeCloseTo(0.25, 2);
  });
});

describe("snow cover in the game", () => {
  it("shows in the view, deepening through winter and gone in summer", () => {
    const winter = createGame({ seed: 4, startSeason: "winter" });
    winter.step();
    expect(winter.client.getView().snowCover).toBeCloseTo(8 / 72, 2); // 8:00 on day 1: 8 of the 72 hours snow takes to lie deep.
    skipHoursKeepingWell(winter, 72);
    expect(winter.client.getView().snowCover).toBe(1);

    const summer = createGame({ seed: 4, startSeason: "summer" });
    summer.step();
    expect(summer.client.getView().snowCover).toBe(0);
  });

  it("lies nowhere in the first spring of a new game, before any winter has come", () => {
    const game = createGame({ seed: 4 });
    game.step();
    expect(game.client.getView().snowCover).toBe(0);
  });

  it("melts in the spring after a winter", () => {
    const game = createGame({ seed: 4, startSeason: "winter" });
    keepPlayerWell(game);
    send(game, { type: "skipToSeason" });
    // 6:00 on spring day 1: a quarter of a day into the two days of melting.
    expect(game.client.getView().snowCover).toBeCloseTo(0.875, 2);
  });
});

describe("walking in snow", () => {
  it("slows walking outdoors to 0.85 in full snow cover", () => {
    const snowy = createGame({ seed: 4, startSeason: "winter" });
    skipHoursKeepingWell(snowy, 72);
    const clear = createGame({ seed: 4, startSeason: "summer" });
    clear.step();

    expect(walkedMetres(snowy, 15) / walkedMetres(clear, 15)).toBeCloseTo(0.85, 2);
  });

  it("does not slow walking on a floor", () => {
    const snowy = createGame({ seed: 4, startSeason: "winter" });
    skipHoursKeepingWell(snowy, 72);
    const clear = createGame({ seed: 4, startSeason: "summer" });
    clear.step();
    for (const game of [snowy, clear]) standOnFloor(game);

    expect(walkedMetres(snowy, 3) / walkedMetres(clear, 3)).toBeCloseTo(1, 3);
  });

  it("stacks with the sled's slowdown", () => {
    const snowy = createGame({ seed: 4, startSeason: "winter" });
    skipHoursKeepingWell(snowy, 72);
    const clear = createGame({ seed: 4, startSeason: "summer" });
    clear.step();
    // Dragging a sled no longer in the valley still slows walking.
    for (const game of [snowy, clear]) onlyPlayer(game).dragging = { sledId: 99_999 };

    expect(walkedMetres(snowy, 15) / walkedMetres(clear, 15)).toBeCloseTo(0.85, 2);
  });
});

/** How many metres the player walks across the ground in this many logic steps, heading 8 m east. */
function walkedMetres(game: Game, steps: number): number {
  keepPlayerWell(game);
  const player = onlyPlayer(game);
  send(game, { type: "walkTo", x: player.position.x + 8, z: player.position.z });
  let metres = 0;
  for (let step = 0; step < steps; step += 1) {
    const { x, z } = player.position;
    game.step();
    metres += Math.hypot(player.position.x - x, player.position.z - z);
  }
  return metres;
}

/** Moves the player to the middle of their grid square and lays a finished floor there. */
function standOnFloor(game: Game): void {
  const player = onlyPlayer(game);
  const square = snapToGridSquare(player.position);
  Object.assign(player.position, { x: square.x, z: square.z });
  Object.assign(player.previousPosition, { x: square.x, z: square.z });
  game.entities.add({ floor: true, facing: { turns: 0 }, position: { x: square.x, y: player.position.y, z: square.z } });
}

/** Makes rain fall from now on, without stopping. */
function letRainFall(game: Game): void {
  const rain = weatherOf(game);
  rain.falling = true;
  rain.changeAtMinutes = game.progress().clockMinutes + 1_000_000;
  game.step();
}

/** Stops rain from now on, without starting again. */
function stopRain(game: Game): void {
  const rain = weatherOf(game);
  rain.falling = false;
  rain.changeAtMinutes = game.progress().clockMinutes + 1_000_000;
  game.step();
}

function weatherOf(game: Game) {
  const rain = rainEntities(game.entities).first?.rain;
  if (rain === undefined) throw new Error("No weather");
  return rain;
}

/** Skips this many hours, an hour at a time, filling every need before each hour so the player never collapses. */
function skipHoursKeepingWell(game: Game, hours: number): void {
  for (let hour = 0; hour < hours; hour += 1) {
    keepPlayerWell(game);
    send(game, { type: "skipTime", hours: 1 });
  }
  keepPlayerWell(game);
}

function keepPlayerWell(game: Game): void {
  for (const need of Object.values(onlyPlayer(game).needs)) need.level = 1;
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position", "previousPosition", "needs").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
}

function runGameMinutes(game: Game, minutes: number): void {
  for (let i = 0; i < minutes * STEPS_PER_SECOND; i += 1) game.step();
}
