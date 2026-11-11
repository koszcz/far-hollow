import { describe, expect, it } from "vitest";
import type { Command } from "./api";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { readSave, writeSave } from "./save";
import { distanceToRiver, type GroundPoint } from "./valley";

describe("drinking from the river", () => {
  it("walks the player to the bank, then fills thirst", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "skipTime", hours: 6 });
    expect(game.client.getView().needs.thirst).toBeCloseTo(0.75, 2);

    send(game, { type: "drinkFromRiver", ...riverSpotNearPlayer(game) });
    expect(game.client.getView().needs.thirst).toBeLessThan(0.8);
    runUntilStill(game);

    expect(game.client.getView().needs.thirst).toBeCloseTo(1, 2);
    expect(distanceToWater(game, onlyPlayer(game).position)).toBeLessThan(3);
  });

  it("makes the player sick, because the water is not boiled", () => {
    const game = createGame({ seed: 42 });
    expect(game.client.getView().sick).toBe(false);

    drinkFromRiver(game);

    expect(game.client.getView().sick).toBe(true);
  });

  it("does nothing if the player walks somewhere else before reaching the bank", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "skipTime", hours: 6 });
    const player = onlyPlayer(game);

    send(game, { type: "drinkFromRiver", ...riverSpotNearPlayer(game) });
    send(game, { type: "walkTo", x: player.position.x - 10, z: player.position.z });
    runUntilStill(game);

    expect(game.client.getView().needs.thirst).toBeLessThan(0.8);
    expect(game.client.getView().sick).toBe(false);
  });
});

describe("a sick player", () => {
  it("gets thirsty twice as fast", () => {
    const well = createGame({ seed: 42 });
    const sick = createGame({ seed: 42 });
    drinkFromRiver(well);
    drinkFromRiver(sick);
    well.entities.removeComponent(onlyPlayer(well), "sickness");
    const wellBefore = well.client.getView().needs.thirst;
    const sickBefore = sick.client.getView().needs.thirst;

    send(well, { type: "skipTime", hours: 3 });
    send(sick, { type: "skipTime", hours: 3 });

    expect(sickBefore - sick.client.getView().needs.thirst).toBeCloseTo(2 * (wellBefore - well.client.getView().needs.thirst), 2);
  });

  it("gets better after half a day of rest", () => {
    const game = createGame({ seed: 42 });
    drinkFromRiver(game);

    send(game, { type: "skipTime", hours: 11 });
    expect(game.client.getView().sick).toBe(true);
    send(game, { type: "skipTime", hours: 1.1 });

    expect(game.client.getView().sick).toBe(false);
  });

  it("stays sick for longer while walking about", () => {
    const resting = createGame({ seed: 42 });
    const walking = createGame({ seed: 42 });
    drinkFromRiver(resting);
    drinkFromRiver(walking);

    const player = onlyPlayer(walking);
    send(walking, { type: "walkTo", x: player.position.x - 40, z: player.position.z });
    runGameMinutes(walking, 10);
    runGameMinutes(resting, 10);

    const left = (game: Game) => onlyPlayer(game).sickness?.minutesLeft ?? 0;
    expect(left(walking)).toBeGreaterThan(left(resting));
  });

  it("keeps thirst and sickness through a save", () => {
    const game = createGame({ seed: 42 });
    drinkFromRiver(game);
    send(game, { type: "skipTime", hours: 2 });

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(loaded.game.client.getView().sick).toBe(true);
    expect(loaded.game.client.getView().needs.thirst).toBe(game.client.getView().needs.thirst);
    expect(onlyPlayer(loaded.game).sickness).toEqual(onlyPlayer(game).sickness);
  });
});

function drinkFromRiver(game: Game): void {
  send(game, { type: "drinkFromRiver", ...riverSpotNearPlayer(game) });
  runUntilStill(game);
}

/** The middle of the river, level with the player. The player starts on the west bank. */
function riverSpotNearPlayer(game: Game): GroundPoint {
  const { position } = onlyPlayer(game);
  for (let x = position.x; x < position.x + 100; x += 0.25) {
    const spot = { x, z: position.z };
    if (distanceToWater(game, spot) < -1) return spot;
  }
  throw new Error("No river near the player");
}

/** How far a spot is from the water's edge. Negative inside the water. */
function distanceToWater(game: Game, spot: GroundPoint): number {
  return distanceToRiver(game.valley.river, spot) - game.valley.river.width / 2;
}

function runUntilStill(game: Game): void {
  const player = onlyPlayer(game);
  for (let i = 0; player.walkPath !== undefined || player.drinkTask !== undefined; i += 1) {
    if (i > 100_000) throw new Error("The player never stopped");
    game.step();
  }
}

function runGameMinutes(game: Game, minutes: number): void {
  for (let i = 0; i < minutes * STEPS_PER_SECOND; i += 1) game.step();
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
