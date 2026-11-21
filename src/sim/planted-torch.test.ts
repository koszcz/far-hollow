import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import type { BackpackContents } from "./backpack";
import type { Entity } from "./entities";
import { createGame, type Game } from "./game";
import type { GroundPoint } from "./ground-point";
import { FIREPLACES_SAVE_VERSION, PLANTED_TORCHES_SAVE_VERSION, readSave, SAVE_VERSION, TORCHES_SAVE_VERSION, writeSave } from "./save";
import { finishReach } from "./test-steps";
import { isWalkable } from "./walk-map";

describe("planting a torch", () => {
  it("stands the lit torch at the player's feet with the time it had left, and empties the hand", () => {
    const game = createGame({ seed: 42 });
    give(game, { torch: 1 });
    send(game, { type: "lightTorch" });
    send(game, { type: "skipTime", hours: 1 });
    const minutesLeft = game.client.getView().litTorch?.minutesLeft ?? -1;
    const feet = { ...onlyPlayer(game).position };

    send(game, { type: "plantTorch" });

    const view = game.client.getView();
    expect(view.litTorch).toBeNull();
    expect(view.plantedTorches).toHaveLength(1);
    // Reaching down to plant it takes about a game minute, while it burns on.
    expect(minutesLeft - (view.plantedTorches[0]?.minutesLeft ?? 0)).toBeWithin(0, 2);
    expect(view.plantedTorches[0]?.position.x).toBeCloseTo(feet.x, 5);
    expect(view.plantedTorches[0]?.position.z).toBeCloseTo(feet.z, 5);
    expect(view.plantedTorches[0]?.position.y).toBeCloseTo(feet.y, 5);
  });

  it("stands the torch on the deck of a foundation the player stands on", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const foundation = buildNearPlayer(game, "foundation");
    const { x, z, y: deckTop } = foundation.position ?? { x: 0, y: 0, z: 0 };
    walkTo(game, { x, z });
    give(game, { torch: 1 });
    send(game, { type: "lightTorch" });

    send(game, { type: "plantTorch" });

    const [planted] = game.client.getView().plantedTorches;
    expect(planted?.position.x).toBeCloseTo(x, 5);
    expect(planted?.position.y).toBeCloseTo(deckTop, 5);
  });

  it("is refused while the player holds no lit torch, and plants nothing", () => {
    const game = createGame({ seed: 42 });
    give(game, { torch: 1 });

    expect(game.client.refusal({ type: "plantTorch" })).toEqual({ kind: "noLitTorch" });
    send(game, { type: "plantTorch" });

    expect(game.client.getView().plantedTorches).toEqual([]);
    expect(game.client.getView().backpack.torch).toBe(1);
  });
});

describe("the spacing between planted torches", () => {
  it("refuses a torch within 1 m of another planted torch, and keeps it in the hand", () => {
    const game = createGame({ seed: 42 });
    give(game, { torch: 2 });
    plantHere(game);
    send(game, { type: "lightTorch" });
    const at = onlyPlayer(game).position;
    walkTo(game, { x: at.x + 0.9, z: at.z });

    expect(game.client.refusal({ type: "plantTorch" })).toEqual({ kind: "torchTooClose" });
    send(game, { type: "plantTorch" });
    expect(game.client.getView().plantedTorches).toHaveLength(1);
    expect(game.client.getView().litTorch).not.toBeNull();
  });

  it("allows a torch just over 1 m from another", () => {
    const game = createGame({ seed: 42 });
    give(game, { torch: 2 });
    plantHere(game);
    send(game, { type: "lightTorch" });
    const at = onlyPlayer(game).position;
    walkTo(game, { x: at.x + 1.1, z: at.z });

    expect(game.client.refusal({ type: "plantTorch" })).toBeNull();
    send(game, { type: "plantTorch" });
    expect(game.client.getView().plantedTorches).toHaveLength(2);
  });
});

describe("a planted torch burning", () => {
  it("burns for the time it had left, then is gone", () => {
    const game = createGame({ seed: 42 });
    give(game, { torch: 1 });
    send(game, { type: "lightTorch" });
    send(game, { type: "skipTime", hours: 2 });
    plantHere(game);
    const minutesLeft = game.client.getView().plantedTorches[0]?.minutesLeft ?? 0;

    send(game, { type: "skipTime", hours: (minutesLeft - 5) / 60 });
    expect(game.client.getView().plantedTorches).toHaveLength(1);
    send(game, { type: "skipTime", hours: 10 / 60 });
    expect(game.client.getView().plantedTorches).toEqual([]);
    expect(game.client.getView().litTorch).toBeNull();
  });

  it("burns on while the player sleeps, so a torch with less time left than the sleep is gone when they wake", () => {
    const game = createGame({ seed: 42 });
    give(game, { torch: 1 });
    // 21:00, so the player sleeps through the night, far longer than a torch burns.
    send(game, { type: "skipTime", hours: 13 });
    send(game, { type: "lightTorch" });
    plantHere(game);
    walkTo(game, { x: onlyPlayer(game).position.x + 3, z: onlyPlayer(game).position.z });
    send(game, { type: "layBedroll" });
    const bedroll = game.entities.with("bedroll").first;
    if (bedroll === undefined) throw new Error("No bedroll");
    expect(game.client.getView().plantedTorches).toHaveLength(1);

    send(game, { type: "sleep", bedrollId: idOf(game, bedroll) });
    stepUntil(game, () => game.client.getView().lastSleep !== null);

    expect(game.client.getView().plantedTorches).toEqual([]);
  });

  it("loses the time the player sleeps, and still burns if it had more", () => {
    const game = createGame({ seed: 42 });
    give(game, { torch: 1 });
    // 13:00. By day, the player sleeps only until rested, less than a torch burns.
    send(game, { type: "skipTime", hours: 5 });
    onlyPlayer(game).needs.fatigue.level = 0.8;
    send(game, { type: "lightTorch" });
    plantHere(game);
    walkTo(game, { x: onlyPlayer(game).position.x + 3, z: onlyPlayer(game).position.z });
    send(game, { type: "layBedroll" });
    const bedroll = game.entities.with("bedroll").first;
    if (bedroll === undefined) throw new Error("No bedroll");
    const before = game.client.getView();
    const minutesBefore = before.plantedTorches[0]?.minutesLeft ?? 0;

    send(game, { type: "sleep", bedrollId: idOf(game, bedroll) });
    stepUntil(game, () => game.client.getView().lastSleep !== null);

    const after = game.client.getView();
    const slept = (after.time.day - before.time.day) * 24 * 60 + (after.time.hourOfDay - before.time.hourOfDay) * 60;
    expect(slept).toBeGreaterThan(5);
    expect(after.plantedTorches).toHaveLength(1);
    expect(minutesBefore - (after.plantedTorches[0]?.minutesLeft ?? 0)).toBeCloseTo(slept, 0);
  });
});

describe("walking past a planted torch", () => {
  it("does not block walking, so the player can walk through it", () => {
    const game = createGame({ seed: 42 });
    give(game, { torch: 1 });
    send(game, { type: "lightTorch" });
    const at = { ...onlyPlayer(game).position };
    plantHere(game);

    expect(isWalkable(game.walkMap, at)).toBe(true);
    walkTo(game, { x: at.x - 2, z: at.z });
    walkTo(game, { x: at.x + 2, z: at.z });
    expect(onlyPlayer(game).position.x).toBeCloseTo(at.x + 2, 5);
  });
});

describe("picking up a planted torch", () => {
  it("is the thing E reaches, and puts the torch in the player's hand with its time left", () => {
    const game = createGame({ seed: 42 });
    give(game, { torch: 1 });
    send(game, { type: "lightTorch" });
    plantHere(game);
    const [planted] = game.client.getView().plantedTorches;
    if (planted === undefined) throw new Error("No planted torch");

    expect(game.client.nearestInReach()).toEqual({ kind: "plantedTorch", id: planted.id });
    expect(game.client.refusal({ type: "pickUpTorch", torchId: planted.id })).toBeNull();
    send(game, { type: "pickUpTorch", torchId: planted.id });

    expect(game.client.getView().plantedTorches).toEqual([]);
    expect(planted.minutesLeft - (game.client.getView().litTorch?.minutesLeft ?? 0)).toBeWithin(0, 2);
  });

  it("walks the player to a torch out of reach first", () => {
    const game = createGame({ seed: 42 });
    give(game, { torch: 1 });
    send(game, { type: "lightTorch" });
    plantHere(game);
    const [planted] = game.client.getView().plantedTorches;
    if (planted === undefined) throw new Error("No planted torch");
    walkTo(game, { x: planted.position.x + 6, z: planted.position.z });

    send(game, { type: "pickUpTorch", torchId: planted.id });
    stepUntil(game, () => game.client.getView().litTorch !== null);

    expect(game.client.getView().plantedTorches).toEqual([]);
  });

  it("is refused while the player already holds a lit torch, and the planted torch stays", () => {
    const game = createGame({ seed: 42 });
    give(game, { torch: 2 });
    plantHere(game);
    send(game, { type: "lightTorch" });
    const [planted] = game.client.getView().plantedTorches;
    if (planted === undefined) throw new Error("No planted torch");

    expect(game.client.refusal({ type: "pickUpTorch", torchId: planted.id })).toEqual({ kind: "torchAlreadyLit" });
    send(game, { type: "pickUpTorch", torchId: planted.id });
    expect(game.client.getView().plantedTorches).toHaveLength(1);
  });
});

describe("saving planted torches", () => {
  it("keeps each planted torch where it stands, with its burning time left", () => {
    const game = createGame({ seed: 42 });
    give(game, { torch: 2 });
    plantHere(game);
    send(game, { type: "skipTime", hours: 1 });
    walkTo(game, { x: onlyPlayer(game).position.x + 3, z: onlyPlayer(game).position.z });
    plantHere(game);
    const before = game.client.getView().plantedTorches;

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    const after = loaded.game.client.getView().plantedTorches;
    // Planted torches come in no set order, so both lists are sorted from west to east.
    const placesAndTimes = (torches: typeof before) =>
      torches.map(({ position, minutesLeft }) => ({ position, minutesLeft })).sort((a, b) => a.position.x - b.position.x);
    expect(placesAndTimes(after)).toEqual(placesAndTimes(before));
    const [first, second] = placesAndTimes(after);
    expect(first?.minutesLeft).toBeLessThan(second?.minutesLeft ?? 0);
  });

  it("raises the save version for planted torches, and loads a save from before then", () => {
    expect(PLANTED_TORCHES_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    expect(PLANTED_TORCHES_SAVE_VERSION).toBeGreaterThan(TORCHES_SAVE_VERSION);
    expect(TORCHES_SAVE_VERSION).toBeGreaterThan(FIREPLACES_SAVE_VERSION);
    const save = JSON.parse(JSON.stringify(writeSave(createGame({ seed: 42 })))) as { version: number };
    save.version = PLANTED_TORCHES_SAVE_VERSION - 1;

    const loaded = readSave(save);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.game.client.getView().plantedTorches).toEqual([]);
  });
});

/** Lights a torch from the backpack and plants it at the player's feet. */
function plantHere(game: Game): void {
  if (game.client.getView().litTorch === null) send(game, { type: "lightTorch" });
  send(game, { type: "plantTorch" });
  if (game.client.getView().litTorch !== null) throw new Error("The torch was not planted");
}

/** Places a blueprint on open ground near the player, builds it in the playground, and returns it. */
function buildNearPlayer(game: Game, structure: "foundation"): Entity {
  const { position } = onlyPlayer(game);
  const square = { x: Math.floor(position.x - 3) + 0.5, z: Math.floor(position.z) + 0.5 };
  send(game, { type: "placeBlueprint", structure, turns: 0, x: square.x, z: square.z });
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("No blueprint");
  const id = idOf(game, blueprint);
  send(game, { type: "build", blueprintId: id });
  stepUntil(game, () => game.entities.entity(id)?.blueprint === undefined);
  return blueprint;
}

function walkTo(game: Game, spot: GroundPoint): void {
  send(game, { type: "walkTo", x: spot.x, z: spot.z });
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
}

/** Puts at least this many of each kind in the backpack, with the steel and flint to light torches. */
function give(game: Game, contents: BackpackContents): void {
  const { backpack } = onlyPlayer(game);
  for (const [content, count] of Object.entries({ steelAndFlint: 1, ...contents }) as [keyof BackpackContents, number][]) {
    backpack.contents = { ...backpack.contents, [content]: Math.max(backpack.contents[content] ?? 0, count) };
  }
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}

function stepUntil(game: Game, done: () => boolean): void {
  for (let i = 0; !done(); i += 1) {
    if (i > 1_000_000) throw new Error("It never happened");
    game.step();
  }
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position", "needs", "backpack").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
  finishReach(game);
}
