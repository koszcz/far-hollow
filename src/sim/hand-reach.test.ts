import { describe, expect, it } from "bun:test";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { HAND_AT_SECONDS, REACH_SECONDS } from "./hand-reach";
import { readSave, writeSave } from "./save";

describe("reaching down for a stick", () => {
  it("bends down once the player stands at the stick, and takes it only when the hand gets there", () => {
    const game = createGame({ seed: 42 });
    const stick = nearestToPlayer(game, "stick");

    game.client.send({ type: "pickUpStick", stickId: idOf(game, stick) });
    stepUntil(game, () => game.client.getView().reach !== null);
    expect(onlyPlayer(game).walkPath).toBeUndefined();
    expect(game.client.getView().reach?.height).toBe("low");

    runSeconds(game, HAND_AT_SECONDS - 0.1);
    expect(game.entities.has(stick)).toBe(true);
    expect(game.client.getView().backpack.stick).toBeUndefined();

    runSeconds(game, 0.15);
    expect(game.entities.has(stick)).toBe(false);
    expect(game.client.getView().backpack.stick).toBe(1);
    // The player is still straightening up.
    expect(game.client.getView().reach).not.toBeNull();
  });

  it("takes about 0.9 seconds from start to standing again", () => {
    const game = createGame({ seed: 42 });
    const stick = nearestToPlayer(game, "stick");
    game.client.send({ type: "pickUpStick", stickId: idOf(game, stick) });
    stepUntil(game, () => game.client.getView().reach !== null);

    const steps = stepUntil(game, () => game.client.getView().reach === null);

    expect(steps / STEPS_PER_SECOND).toBeCloseTo(REACH_SECONDS, 1);
  });

  it("shows no progress bar and does not tire the player more than standing still", () => {
    const reaching = createGame({ seed: 42 });
    const standing = createGame({ seed: 42 });
    reaching.client.send({ type: "dropFromBackpack", content: "knife" });
    for (let step = 0; step < Math.ceil(REACH_SECONDS * STEPS_PER_SECOND); step += 1) {
      reaching.step();
      standing.step();
      expect(reaching.client.getView().action).toBeNull();
    }

    expect(reaching.client.getView().needs.fatigue).toBe(standing.client.getView().needs.fatigue);
  });

  it("never takes the stick when a new command comes before the hand gets there", () => {
    const game = createGame({ seed: 42 });
    const stick = nearestToPlayer(game, "stick");
    game.client.send({ type: "pickUpStick", stickId: idOf(game, stick) });
    stepUntil(game, () => game.client.getView().reach !== null);
    runSeconds(game, HAND_AT_SECONDS / 2);

    game.client.send({ type: "eat", food: "berries" });
    runSeconds(game, REACH_SECONDS * 2);

    expect(game.client.getView().reach).toBeNull();
    expect(game.entities.has(stick)).toBe(true);
    expect(game.client.getView().backpack.stick).toBeUndefined();
  });

  it("cuts the straightening short for a new command once the hand has the stick", () => {
    const game = createGame({ seed: 42 });
    const stick = nearestToPlayer(game, "stick");
    game.client.send({ type: "pickUpStick", stickId: idOf(game, stick) });
    stepUntil(game, () => game.client.getView().backpack.stick === 1);
    expect(game.client.getView().reach).not.toBeNull();

    const next = nearestToPlayer(game, "stick");
    game.client.send({ type: "pickUpStick", stickId: idOf(game, next) });
    game.step();

    expect(game.client.getView().reach).toBeNull();
    expect(game.client.getView().backpack.stick).toBe(1);
    stepUntil(game, () => game.client.getView().backpack.stick === 2);
  });
});

describe("saving during a reach", () => {
  it("loads with the stick still on the ground when the hand had not got there", () => {
    const game = createGame({ seed: 42 });
    const stick = nearestToPlayer(game, "stick");
    const stickId = idOf(game, stick);
    game.client.send({ type: "pickUpStick", stickId });
    stepUntil(game, () => game.client.getView().reach !== null);

    const loaded = load(game);
    runSeconds(loaded, REACH_SECONDS * 2);

    expect(loaded.client.getView().reach).toBeNull();
    expect(loaded.entities.entity(stickId)?.stick).toBe(true);
    expect(loaded.client.getView().backpack.stick).toBeUndefined();
  });

  it("loads with the stick in the backpack when the hand had got there", () => {
    const game = createGame({ seed: 42 });
    const stick = nearestToPlayer(game, "stick");
    const stickId = idOf(game, stick);
    game.client.send({ type: "pickUpStick", stickId });
    stepUntil(game, () => game.client.getView().backpack.stick === 1);
    expect(game.client.getView().reach).not.toBeNull();

    const loaded = load(game);

    expect(loaded.client.getView().reach).toBeNull();
    expect(loaded.entities.entity(stickId)).toBeUndefined();
    expect(loaded.client.getView().backpack.stick).toBe(1);
  });
});

describe("reaching out at waist height", () => {
  it("stacks firewood on a woodpile within reach when the hand gets there", () => {
    const game = createGame({ seed: 42 });
    const player = onlyPlayer(game);
    player.backpack.contents.firewood = 2;
    const woodpile = game.entities.add({
      woodpile: { log: 0, debarkedLog: 0, firewood: 0 },
      position: { x: player.position.x + 1, y: player.position.y, z: player.position.z },
    });

    game.client.send({ type: "stackOnWoodpile", woodpileId: idOf(game, woodpile), wood: "firewood", all: true });
    game.step();
    expect(game.client.getView().reach?.height).toBe("waist");
    expect(woodpile.woodpile.firewood).toBe(0);

    runSeconds(game, HAND_AT_SECONDS);
    expect(woodpile.woodpile.firewood).toBe(2);
    expect(game.client.getView().backpack.firewood).toBe(0);
  });

  it("tells the player the backpack is full when the hand gets to a woodpile with no room to take from it", () => {
    const game = createGame({ seed: 42 });
    const player = onlyPlayer(game);
    player.backpack.contents.firewood = 10;
    player.backpack.contents.steelAndFlint = 3;
    const woodpile = game.entities.add({
      woodpile: { log: 0, debarkedLog: 0, firewood: 5 },
      position: { x: player.position.x + 1, y: player.position.y, z: player.position.z },
    });

    game.client.send({ type: "takeFromWoodpile", woodpileId: idOf(game, woodpile), wood: "firewood" });
    game.step();
    expect(game.client.getView().notice).toBeNull();
    runSeconds(game, HAND_AT_SECONDS);

    expect(game.client.getView().notice?.kind).toBe("backpackFull");
    expect(woodpile.woodpile.firewood).toBe(5);
  });
});

/** Saves the game and loads the save, as closing and reopening the game does. */
function load(game: Game): Game {
  const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
  if (!loaded.ok) throw new Error("The save did not load");
  return loaded.game;
}

function stepUntil(game: Game, done: () => boolean, maxSteps = 100_000): number {
  for (let i = 0; i < maxSteps; i += 1) {
    if (done()) return i;
    game.step();
  }
  throw new Error("Never happened");
}

function runSeconds(game: Game, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * STEPS_PER_SECOND); i += 1) game.step();
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position", "backpack").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function nearestToPlayer(game: Game, kind: "stick") {
  const player = onlyPlayer(game);
  const candidates = [...game.entities.with(kind, "position")];
  const distance = (entity: (typeof candidates)[number]) => Math.hypot(entity.position.x - player.position.x, entity.position.z - player.position.z);
  const nearest = candidates.sort((a, b) => distance(a) - distance(b))[0];
  if (nearest === undefined) throw new Error(`No ${kind}`);
  return nearest;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
