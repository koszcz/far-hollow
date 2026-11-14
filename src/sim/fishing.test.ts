import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import { BACKPACK_WEIGHT_LIMIT_KG, CONTENT_WEIGHT_KG } from "./backpack";
import { FISH_MAX_WAIT_MINUTES, FISH_MIN_WAIT_MINUTES, fishWaitMinutes } from "./fishing";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { readSave, writeSave } from "./save";
import { distanceToRiver, type GroundPoint } from "./valley";

describe("the wait for a fish", () => {
  it("lasts from 15 to 45 game minutes, and differs from cast to cast", () => {
    const waits = Array.from({ length: 200 }, (_, cast) => fishWaitMinutes(42, cast));

    expect(Math.min(...waits)).toBeGreaterThanOrEqual(FISH_MIN_WAIT_MINUTES);
    expect(Math.max(...waits)).toBeLessThanOrEqual(FISH_MAX_WAIT_MINUTES);
    expect(new Set(waits).size).toBeGreaterThan(10);
  });

  it("comes from the seed, so the same game always waits the same", () => {
    expect(fishWaitMinutes(42, 3)).toBe(fishWaitMinutes(42, 3));
    const first = createGame({ seed: 42 });
    const second = createGame({ seed: 42 });
    startFishing(first);
    startFishing(second);

    expect(onlyPlayer(first).fishTask?.biteAfterMinutes).toBe(fishWaitMinutes(42, 0));
    expect(onlyPlayer(second).fishTask?.biteAfterMinutes).toBe(onlyPlayer(first).fishTask?.biteAfterMinutes);
  });
});

describe("fishing at the river", () => {
  it("walks the player to the bank and catches one raw fish once the wait is over", () => {
    const game = createGame({ seed: 42 });
    startFishing(game);
    expect(distanceToWater(game, onlyPlayer(game).position)).toBeLessThan(3);
    expect(game.client.getView().action?.kind).toBe("fish");
    expect(game.client.getView().action?.progress).toBeLessThan(0.01);
    const wait = fishWaitMinutes(42, 0);

    runGameMinutes(game, wait - 1);
    expect(game.client.getView().backpack.rawFish).toBeUndefined();
    expect(game.client.getView().action?.progress).toBeCloseTo((wait - 1) / wait, 1);
    runGameMinutes(game, 1.1);

    expect(game.client.getView().backpack.rawFish).toBe(1);
  });

  it("casts again on its own, with a new wait, and keeps catching fish", () => {
    const game = createGame({ seed: 42 });
    startFishing(game);

    runGameMinutes(game, fishWaitMinutes(42, 0) + 0.5);
    expect(onlyPlayer(game).fishTask?.biteAfterMinutes).toBe(fishWaitMinutes(42, 1));
    runGameMinutes(game, fishWaitMinutes(42, 1));

    expect(game.client.getView().backpack.rawFish).toBe(2);
    expect(game.client.getView().action?.kind).toBe("fish");
  });

  it("stops when the player walks away", () => {
    const game = createGame({ seed: 42 });
    startFishing(game);
    const player = onlyPlayer(game);

    send(game, { type: "walkTo", x: player.position.x - 10, z: player.position.z });
    runGameMinutes(game, FISH_MAX_WAIT_MINUTES + 1);

    expect(player.fishTask).toBeUndefined();
    expect(game.client.getView().backpack.rawFish).toBeUndefined();
  });

  it("lets the fish get away when the backpack is full, says why, and stops", () => {
    const game = createGame({ seed: 42 });
    fillBackpack(game);
    startFishing(game);

    runGameMinutes(game, fishWaitMinutes(42, 0) + 0.5);

    expect(game.client.getView().backpack.rawFish).toBeUndefined();
    expect(game.client.getView().notice).toEqual({ kind: "fishGotAway" });
    expect(game.client.getView().action).toBeNull();
    expect(onlyPlayer(game).fishTask).toBeUndefined();
  });

  it("is timed work, so it drains fatigue faster than standing still", () => {
    const fishing = createGame({ seed: 42 });
    const idle = createGame({ seed: 42 });
    startFishing(fishing);
    send(idle, { type: "drinkFromRiver", ...riverSpotNearPlayer(idle) });
    stepUntil(idle, () => onlyPlayer(idle).walkPath === undefined);
    const fishingBefore = fishing.client.getView().needs.fatigue;
    const idleBefore = idle.client.getView().needs.fatigue;

    runGameMinutes(fishing, 30);
    runGameMinutes(idle, 30);

    const fishingLoss = fishingBefore - fishing.client.getView().needs.fatigue;
    const idleLoss = idleBefore - idle.client.getView().needs.fatigue;
    expect(fishingLoss).toBeGreaterThan(idleLoss * 1.5);
  });

  it("keeps fishing and the raw fish caught through a save", () => {
    const game = createGame({ seed: 42 });
    startFishing(game);
    runGameMinutes(game, fishWaitMinutes(42, 0) + 5);

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(loaded.game.client.getView().backpack.rawFish).toBe(1);
    expect(onlyPlayer(loaded.game).fishTask).toEqual(onlyPlayer(game).fishTask);
    expect(onlyPlayer(loaded.game).fishCasts).toBe(2);
  });
});

describe("refusing to fish", () => {
  it("does nothing without a fishing rod", () => {
    const game = createGame({ seed: 42 });

    send(game, { type: "fish", ...riverSpotNearPlayer(game) });

    expect(onlyPlayer(game).fishTask).toBeUndefined();
    expect(onlyPlayer(game).walkPath).toBeUndefined();
  });

  it("tells the player to put the log down first", () => {
    const game = createGame({ seed: 42 });
    giveRod(game);
    game.entities.addComponent(onlyPlayer(game), "carrying", "log");

    send(game, { type: "fish", ...riverSpotNearPlayer(game) });

    expect(onlyPlayer(game).fishTask).toBeUndefined();
    expect(game.client.getView().notice).toEqual({ kind: "putLogDownFirst" });
  });

  it("tells the player to let go of the sled first", () => {
    const game = createGame({ seed: 42 });
    giveRod(game);
    game.entities.addComponent(onlyPlayer(game), "dragging", { sledId: 9999 });

    send(game, { type: "fish", ...riverSpotNearPlayer(game) });

    expect(onlyPlayer(game).fishTask).toBeUndefined();
    expect(game.client.getView().notice).toEqual({ kind: "letGoFirst" });
  });
});

describe("eating raw fish", () => {
  it("fills hunger by 0.15 and makes the player sick", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).backpack.contents.rawFish = 2;
    onlyPlayer(game).needs.hunger.level = 0.5;

    send(game, { type: "eat", food: "rawFish" });

    expect(game.client.getView().needs.hunger).toBeCloseTo(0.65, 2);
    expect(game.client.getView().sick).toBe(true);
    expect(game.client.getView().backpack.rawFish).toBe(1);
  });

  it("weighs 0.5 kg", () => {
    expect(CONTENT_WEIGHT_KG.rawFish).toBe(0.5);
  });
});

function giveRod(game: Game): void {
  onlyPlayer(game).backpack.contents.fishingRod = 1;
}

/** Gives the player a fishing rod and fills the rest of the backpack with berries, so not even one raw fish fits. */
function fillBackpack(game: Game): void {
  giveRod(game);
  const room = BACKPACK_WEIGHT_LIMIT_KG - game.client.getView().backpackWeight;
  onlyPlayer(game).backpack.contents.berries = Math.floor(room / CONTENT_WEIGHT_KG.berries + 1e-6);
}

/** Gives the player a fishing rod, sends them fishing at the river beside them, and waits until they reach the bank. */
function startFishing(game: Game): void {
  giveRod(game);
  send(game, { type: "fish", ...riverSpotNearPlayer(game) });
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
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

function stepUntil(game: Game, done: () => boolean): void {
  for (let i = 0; !done(); i += 1) {
    if (i > 100_000) throw new Error("It never happened");
    game.step();
  }
}

/** Runs the game for this many game minutes. One game minute is one real second. */
function runGameMinutes(game: Game, minutes: number): void {
  for (let i = 0; i < minutes * STEPS_PER_SECOND; i += 1) game.step();
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position", "needs", "backpack").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
}
