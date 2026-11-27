import { describe, expect, it } from "bun:test";
import type { Command } from "./api-commands";
import { nearbyOf } from "./api-game-view";
import type { Entity } from "./entities";
import { createGame, type Game } from "./game";
import { groundDistance, type GroundPoint } from "./ground-point";
import { readSave, writeSave } from "./save";
import { APPROACHES_SAVE_VERSION } from "./save-versions";
import { isWalkable } from "./walk-map";

// The approach is the walk the player makes to get within reach of a thing or a spot, so they can act on it there.
// These tests use a stool and a bed, but every command that walks first goes through the same approach.

describe("an approach to a thing out of reach", () => {
  it("walks the player within reach of a stool and sits them on it when they arrive", () => {
    const game = createGame({ seed: 42 });
    const stool = addStool(game, openSpotAway(game, 10));

    send(game, { type: "sitOnStool", stoolId: idOf(game, stool) });
    expect(onlyPlayer(game).approach).toEqual({ command: { type: "sitOnStool", stoolId: idOf(game, stool) } });
    expect(game.client.getView().sittingOn).toBeNull();

    stepUntil(game, () => onlyPlayer(game).approach === undefined);
    expect(game.client.getView().sittingOn).toBe(idOf(game, stool));
    expect(groundDistance(onlyPlayer(game).position, stool.position)).toBeLessThanOrEqual(2);
  });

  it("acts at once, with no walk, when the player already stands within reach", () => {
    const game = createGame({ seed: 42 });
    const stool = addStool(game, openSpotAway(game, 1.5));

    send(game, { type: "sitOnStool", stoolId: idOf(game, stool) });
    expect(onlyPlayer(game).approach).toBeUndefined();
    expect(game.client.getView().sittingOn).toBe(idOf(game, stool));
  });

  it("ends when the player sends another command, and nothing happens on arrival", () => {
    const game = createGame({ seed: 42 });
    const stool = addStool(game, openSpotAway(game, 10));
    send(game, { type: "sitOnStool", stoolId: idOf(game, stool) });

    send(game, { type: "walkTo", ...stool.position });
    expect(onlyPlayer(game).approach).toBeUndefined();
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
    game.step();
    expect(game.client.getView().sittingOn).toBeNull();
  });

  it("ends with no notice when the walk ends out of reach", () => {
    const game = createGame({ seed: 42 });
    const stool = addStool(game, openSpotAway(game, 10));
    send(game, { type: "sitOnStool", stoolId: idOf(game, stool) });
    // The stool moves far away while the player walks, so they stop out of its reach.
    Object.assign(stool.position, openSpotAway(game, 25));

    stepUntil(game, () => onlyPlayer(game).approach === undefined);
    expect(game.client.getView().sittingOn).toBeNull();
    expect(game.client.getView().notice).toBeNull();
  });

  it("shows the refusal and does nothing when the thing is gone by the time the player arrives", () => {
    const game = createGame({ seed: 42 });
    const stool = addStool(game, openSpotAway(game, 10));
    send(game, { type: "sitOnStool", stoolId: idOf(game, stool) });
    game.entities.remove(stool);

    stepUntil(game, () => onlyPlayer(game).approach === undefined);
    expect(game.client.getView().sittingOn).toBeNull();
    expect(game.client.getView().notice).toEqual({ kind: "refused", refusal: { kind: "gone" } });
  });

  it("keeps the player busy, so the action queue waits for the arrival", () => {
    const game = createGame({ seed: 42 });
    const stool = addStool(game, openSpotAway(game, 10));
    send(game, { type: "queueAction", action: { type: "sitOnStool", stoolId: idOf(game, stool) } });
    send(game, { type: "queueAction", action: { type: "walkTo", ...onlyPlayer(game).position } });

    expect(game.client.getView().actionQueue.map(({ type }) => type)).toEqual(["sitOnStool", "walkTo"]);
    expect(onlyPlayer(game).approach?.command).toEqual({ type: "sitOnStool", stoolId: idOf(game, stool) });
  });
});

describe("saving during an approach", () => {
  it("loads with the approach under way, and the player acts when they arrive", () => {
    const game = createGame({ seed: 42 });
    const stool = addStool(game, openSpotAway(game, 10));
    const stoolId = idOf(game, stool);
    send(game, { type: "sitOnStool", stoolId });

    const loaded = load(writeSave(game));
    expect(onlyPlayer(loaded).approach).toEqual({ command: { type: "sitOnStool", stoolId } });
    stepUntil(loaded, () => onlyPlayer(loaded).approach === undefined);
    expect(loaded.client.getView().sittingOn).toBe(stoolId);
  });

  it("loads a save made while the player walks to a chest, and the chest opens when they arrive", () => {
    const game = createGame({ seed: 42 });
    const chest = game.entities.add({
      furniture: "chest",
      storage: { contents: {} },
      position: { ...openSpotAway(game, 10), y: 0 },
      facing: { turns: 0 },
    });
    const chestId = idOf(game, chest);
    send(game, { type: "openChest", chestId });

    const loaded = readSave(writeSave(game));
    if (!loaded.ok) throw new Error(`The save did not load: ${loaded.reason}`);
    expect(onlyPlayer(loaded.game).approach).toEqual({ command: { type: "openChest", chestId } });
    stepUntil(loaded.game, () => nearbyOf(loaded.game.client.getView(), "openChest") !== null);
    expect(nearbyOf(loaded.game.client.getView(), "openChest")?.id).toBe(chestId);
  });

  it("upgrades a save from before approaches, with the player walking to a bed, and they sleep when they arrive", () => {
    const game = createGame({ seed: 42 });
    const bed = game.entities.add({ furniture: "bed", position: { ...openSpotAway(game, 10), y: 0 }, facing: { turns: 0 } });
    const bedId = idOf(game, bed);
    send(game, { type: "sleepInBed", bedId });

    const save = olderSave(game, { bedTask: { bedId } });
    const loaded = load(save);
    expect(onlyPlayer(loaded).approach).toEqual({ command: { type: "sleepInBed", bedId } });
    stepUntil(loaded, () => loaded.client.getView().lastSleep !== null);
  });

  it("upgrades a save from before approaches, with the player walking to a stool", () => {
    const game = createGame({ seed: 42 });
    const stoolId = idOf(game, addStool(game, openSpotAway(game, 10)));
    send(game, { type: "sitOnStool", stoolId });

    const loaded = load(olderSave(game, { stoolTask: { stoolId } }));
    stepUntil(loaded, () => onlyPlayer(loaded).approach === undefined);
    expect(loaded.client.getView().sittingOn).toBe(stoolId);
  });

  it("upgrades a save from before approaches, with the player walking to pick up a stick", () => {
    const game = createGame({ seed: 42 });
    const stick = nearestStick(game);
    const stickId = idOf(game, stick);
    const sticksBefore = game.client.getView().backpack.stick ?? 0;
    send(game, { type: "pickUpStick", stickId });

    const loaded = load(olderSave(game, { stickPickUpTask: { stickId } }));
    expect(onlyPlayer(loaded).approach).toEqual({ command: { type: "pickUpStick", stickId } });
    stepUntil(loaded, () => loaded.entities.entity(stickId) === undefined);
    expect(loaded.client.getView().backpack.stick).toBe(sticksBefore + 1);
  });

  it("upgrades a save from before approaches, with the player walking to a sled to tip it out", () => {
    const game = createGame({ seed: 42 });
    const sled = game.entities.add({
      sled: { log: 1, debarkedLog: 0, plank: 0 },
      position: { ...openSpotAway(game, 10), y: 0 },
      facing: { turns: 0 },
    });
    const sledId = idOf(game, sled);
    const command = { type: "tipOutSled", sledId } as const;
    send(game, command);

    const loaded = load(olderSave(game, { tendTask: command }));
    expect(onlyPlayer(loaded).approach).toEqual({ command });
    stepUntil(loaded, () => loaded.entities.entity(sledId)?.sled?.log === 0);
  });
});

/** The stick lying nearest the player. */
function nearestStick(game: Game): Entity {
  const { position } = onlyPlayer(game);
  const sticks = [...game.entities.with("stick", "position")];
  sticks.sort((a, b) => groundDistance(a.position, position) - groundDistance(b.position, position));
  const stick = sticks[0];
  if (stick === undefined) throw new Error("No stick");
  return stick;
}

/**
 * A save of the game as the version before approaches would have written it: the player's approach is replaced by the
 * walk-only task component given.
 */
function olderSave(game: Game, task: Record<string, unknown>): unknown {
  const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number; entities: { components: Record<string, unknown> }[] };
  save.version = APPROACHES_SAVE_VERSION - 1;
  for (const entity of save.entities) {
    if (entity.components.player !== true) continue;
    delete entity.components.approach;
    Object.assign(entity.components, task);
  }
  return save;
}

function load(save: unknown): Game {
  const loaded = readSave(save);
  if (!loaded.ok) throw new Error("The save did not load");
  return loaded.game;
}

type Stool = Entity & Required<Pick<Entity, "furniture" | "position">>;

/** Adds a finished stool at a spot. It blocks no walking, so a test can move it. */
function addStool(game: Game, at: GroundPoint): Stool {
  return game.entities.add<Stool>({ furniture: "stool", position: { x: at.x, y: 0, z: at.z }, facing: { turns: 0 } });
}

/** An open spot about `distance` metres from the player. */
function openSpotAway(game: Game, distance: number): GroundPoint {
  const { position } = onlyPlayer(game);
  for (let turn = 0; turn < 64; turn += 1) {
    const angle = (turn / 64) * 2 * Math.PI;
    const spot = { x: position.x + Math.cos(angle) * distance, z: position.z + Math.sin(angle) * distance };
    if (isWalkable(game.walkMap, spot)) return spot;
  }
  throw new Error("No open spot");
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

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
