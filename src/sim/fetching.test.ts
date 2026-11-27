import { describe, expect, it } from "bun:test";
import type { Command } from "./api-commands";
import type { StructureKind } from "./api";
import { FETCH_METRES } from "./building-sources";
import type { Entity, SledLoad } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import type { GroundPoint } from "./ground-point";
import { finishReach } from "./test-steps";
import { distanceToRiver } from "./valley";
import { isWalkable } from "./walk-map";

/** A blueprint or finished structure, which may lose its blueprint as the test runs. */
type PlacedEntity = Entity & { position: NonNullable<Entity["position"]> };

// A chest costs 4 planks, one per stage, and covers 0.9 m along x by 0.55 m along z.
// A foundation costs 4 debarked logs, one per stage, and covers one 1 m grid square.

describe("fetching a stage's material", () => {
  it("fetches planks from a pile within 10 m, one per trip, carried in the hands and never in the backpack", () => {
    const game = createGame({ seed: 42 });
    const chest = blueprintNearPlayer(game, "chest");
    const pile = pileAt(game, "plank", chest.position.x + 6, chest.position.z, 5);
    send(game, { type: "build", blueprintId: idOf(game, chest) });

    stepUntil(game, () => onlyPlayer(game).carrying !== undefined);
    expect(onlyPlayer(game).carrying).toBe("plank");
    expect(pile.pile?.count).toBe(4);
    expect(onlyPlayer(game).backpack.contents.plank ?? 0).toBe(0);

    stepUntil(game, () => onlyPlayer(game).buildTask === undefined);
    expect(chest.furniture).toBe("chest");
    expect(pile.pile?.count).toBe(1);
    expect(onlyPlayer(game).carrying).toBeUndefined();
    expect(game.client.getView().notice).toBeNull();
  });

  it("fetches debarked logs lying on the ground on the shoulder, one per stage", () => {
    const game = createGame({ seed: 42 });
    const foundation = blueprintNearPlayer(game, "foundation");
    const logs = [0, 1, 2, 3].map((i) => logAt(game, "debarkedLog", foundation.position.x + 4, foundation.position.z - 2 + i));
    send(game, { type: "build", blueprintId: idOf(game, foundation) });

    stepUntil(game, () => onlyPlayer(game).carrying !== undefined);
    expect(onlyPlayer(game).carrying).toBe("debarkedLog");
    expect(logs.filter((log) => game.entities.has(log))).toHaveLength(3);

    stepUntil(game, () => onlyPlayer(game).buildTask === undefined);
    expect(foundation.foundation).toBe(true);
    expect(logs.some((log) => game.entities.has(log))).toBe(false);
  });

  it("fetches from a parked sled, taking only what the blueprint needs", () => {
    const game = createGame({ seed: 42 });
    const chest = blueprintNearPlayer(game, "chest");
    const sled = sledAt(game, chest.position.x, chest.position.z + 4, { log: 1, debarkedLog: 0, plank: 6 });

    build(game, chest);

    expect(chest.furniture).toBe("chest");
    expect(sled.sled).toEqual({ log: 1, debarkedLog: 0, plank: 2 });
  });

  it("does not fetch from a sled the player is dragging", () => {
    const game = createGame({ seed: 42 });
    const chest = blueprintNearPlayer(game, "chest");
    const sled = sledAt(game, chest.position.x, chest.position.z + 2, { log: 0, debarkedLog: 0, plank: 4 });
    game.entities.addComponent(onlyPlayer(game), "dragging", { sledId: idOf(game, sled) });
    game.step();

    expect(game.client.describeBlueprint(idOf(game, chest))?.lacks).toEqual({ kind: "material", material: "plank" });
  });

  it("uses planks in the backpack before fetching any", () => {
    const game = createGame({ seed: 42 });
    const chest = blueprintNearPlayer(game, "chest");
    const pile = pileAt(game, "plank", chest.position.x + 3, chest.position.z, 4);
    onlyPlayer(game).backpack.contents.plank = 3;

    build(game, chest);

    expect(chest.furniture).toBe("chest");
    expect(onlyPlayer(game).backpack.contents.plank ?? 0).toBe(0);
    expect(pile.pile?.count).toBe(3);
  });

  it("fetches from the nearest source first, by walking distance rather than in a straight line", () => {
    const game = createGame({ seed: 42 });
    const chest = blueprintNearPlayer(game, "chest", 7);
    const { x, z } = chest.position;
    // A wall 2 m east of the chest, 7 m long, makes the walk to the pile 3 m east, behind it, about 8 m.
    // That is longer than the walk to the pile 4 m west, though both are within 10 m.
    game.entities.add({ blocksWalkingSpots: Array.from({ length: 7 }, (_, i) => ({ x: x + 2, z: z - 3 + i })) });
    const behindWall = pileAt(game, "plank", x + 3, z, 4);
    const west = pileAt(game, "plank", x - 4, z, 1);

    build(game, chest);

    expect(chest.furniture).toBe("chest");
    expect(game.entities.has(west)).toBe(false);
    expect(behindWall.pile?.count).toBe(1);
  });

  it("does not count a pile across the river, though it lies within 10 m in a straight line", () => {
    const game = createGame({ seed: 7 });
    const { near, far } = banksAcrossRiver(game);
    const chest = blueprintAt(game, "chest", near);
    const pile = pileAt(game, "plank", far.x, far.z, 4);
    expect(Math.abs(far.x - near.x) - 0.45).toBeLessThan(FETCH_METRES);
    game.step();

    expect(game.client.describeBlueprint(idOf(game, chest))?.lacks).toEqual({ kind: "material", material: "plank" });
    send(game, { type: "build", blueprintId: idOf(game, chest) });
    runSeconds(game, 5);

    expect(pile.pile?.count).toBe(4);
    expect(chest.blueprint?.progress).toBe(0);
  });

  it("does not count material further than 10 m along the walking path", () => {
    const game = createGame({ seed: 42 });
    const chest = blueprintNearPlayer(game, "chest", 12);
    pileAt(game, "plank", chest.position.x + 0.45 + FETCH_METRES + 0.5, chest.position.z, 4);
    game.step();
    expect(game.client.describeBlueprint(idOf(game, chest))?.lacks).toEqual({ kind: "material", material: "plank" });

    pileAt(game, "plank", chest.position.x + 0.45 + FETCH_METRES - 1, chest.position.z, 4);
    game.step();
    expect(game.client.describeBlueprint(idOf(game, chest))?.lacks).toBeNull();
  });

  it("never shapes a material on the way: plain logs do not count for debarked logs or for planks", () => {
    const game = createGame({ seed: 42 });
    const foundation = blueprintNearPlayer(game, "foundation");
    const log = logAt(game, "log", foundation.position.x + 2, foundation.position.z);
    const chest = blueprintAt(game, "chest", { x: foundation.position.x - 3, z: foundation.position.z });
    game.step();

    expect(game.client.describeBlueprint(idOf(game, foundation))?.lacks).toEqual({ kind: "material", material: "debarkedLog" });
    expect(game.client.describeBlueprint(idOf(game, chest))?.lacks).toEqual({ kind: "material", material: "plank" });
    send(game, { type: "build", blueprintId: idOf(game, foundation) });
    runSeconds(game, 3);

    expect(game.entities.has(log)).toBe(true);
    expect(onlyPlayer(game).carrying).toBeUndefined();
  });

  it("refuses to start with full hands, and says why", () => {
    const game = createGame({ seed: 42 });
    const chest = blueprintNearPlayer(game, "chest");
    const pile = pileAt(game, "plank", chest.position.x + 3, chest.position.z, 4);
    game.entities.addComponent(onlyPlayer(game), "carrying", "log");
    const command: Command = { type: "build", blueprintId: idOf(game, chest) };

    expect(game.client.refusal(command)).toEqual({ kind: "handsFull" });
    send(game, command);
    runSeconds(game, 3);

    expect(game.client.getView().notice).toEqual({ kind: "refused", refusal: { kind: "handsFull" } });
    expect(onlyPlayer(game).buildTask).toBeUndefined();
    expect(pile.pile?.count).toBe(4);
  });

  it("builds with a needed material already in the hands or on the shoulder", () => {
    const game = createGame({ seed: 42 });
    const foundation = blueprintNearPlayer(game, "foundation");
    const logs = [0, 1, 2].map((i) => logAt(game, "debarkedLog", foundation.position.x + 3, foundation.position.z - 1 + i));
    game.entities.addComponent(onlyPlayer(game), "carrying", "debarkedLog");

    expect(game.client.refusal({ type: "build", blueprintId: idOf(game, foundation) })).toBeNull();
    build(game, foundation);

    expect(foundation.foundation).toBe(true);
    expect(logs.some((log) => game.entities.has(log))).toBe(false);
    expect(onlyPlayer(game).carrying).toBeUndefined();
  });

  it("stops when no material for the next stage is left within 10 m, and says what is missing", () => {
    const game = createGame({ seed: 42 });
    const chest = blueprintNearPlayer(game, "chest");
    const pile = pileAt(game, "plank", chest.position.x + 3, chest.position.z, 2);

    build(game, chest);

    expect(game.entities.has(pile)).toBe(false);
    expect(chest.blueprint).toMatchObject({ materialsSpent: 2, delivered: { plank: 2 } });
    expect(chest.blueprint?.progress).toBeCloseTo(0.5, 5);
    expect(game.client.getView().notice).toEqual({ kind: "refused", refusal: { kind: "cannotBuildYet", lacks: { kind: "material", material: "plank" } } });
  });

  it("stops on a click on the ground, keeping the blueprint's progress and what the player carries", () => {
    const game = createGame({ seed: 42 });
    const chest = blueprintNearPlayer(game, "chest");
    const pile = pileAt(game, "plank", chest.position.x + 6, chest.position.z, 4);
    onlyPlayer(game).backpack.contents.plank = 1;
    send(game, { type: "build", blueprintId: idOf(game, chest) });
    stepUntil(game, () => onlyPlayer(game).carrying === "plank");
    const progress = chest.blueprint?.progress;
    expect(progress).toBeGreaterThan(0);

    send(game, { type: "walkTo", x: onlyPlayer(game).position.x, z: onlyPlayer(game).position.z + 2 });
    runSeconds(game, 3);

    expect(onlyPlayer(game).buildTask).toBeUndefined();
    expect(onlyPlayer(game).carrying).toBe("plank");
    expect(chest.blueprint?.progress).toBe(progress);
    expect(chest.blueprint?.delivered).toEqual({ plank: 1 });
    expect(pile.pile?.count).toBe(3);
  });

  it("drops a plank held in the hands in a pile", () => {
    const game = createGame({ seed: 42 });
    game.entities.addComponent(onlyPlayer(game), "carrying", "plank");

    send(game, { type: "dropLog" });

    expect(onlyPlayer(game).carrying).toBeUndefined();
    const { x, z } = onlyPlayer(game).position;
    expect(game.entities.with("pile", "position").entities.find((pile) => Math.hypot(pile.position.x - x, pile.position.z - z) < 0.1)?.pile).toEqual({
      content: "plank",
      count: 1,
    });
  });

  it("fetches nothing in the playground, where building needs nothing", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const chest = blueprintNearPlayer(game, "chest");
    const pile = pileAt(game, "plank", chest.position.x + 3, chest.position.z, 4);

    build(game, chest);

    expect(chest.furniture).toBe("chest");
    expect(pile.pile?.count).toBe(4);
    expect(onlyPlayer(game).carrying).toBeUndefined();
  });
});

/** Places a blueprint on an open square at least `from` metres from the player, with open ground `clear` squares all round it. */
function blueprintNearPlayer(game: Game, structure: StructureKind, clear = 4): PlacedEntity {
  const square = openSquareNearPlayer(game, clear);
  send(game, { type: "placeBlueprint", structure, turns: 0, x: square.x, z: square.z });
  const blueprint = game.entities.with("blueprint", "position").entities.at(-1);
  if (blueprint === undefined) throw new Error("No blueprint");
  return blueprint;
}

/** Puts a blueprint straight into the world at a spot, whatever the placing rules say. */
function blueprintAt(game: Game, structure: StructureKind, at: GroundPoint): PlacedEntity {
  const y = onlyPlayer(game).position.y;
  return game.entities.add<PlacedEntity>({
    blueprint: { structure, progress: 0, materialsSpent: 0, delivered: {} },
    facing: { turns: 0 },
    position: { x: at.x, y, z: at.z },
  });
}

/** The middle of a building-grid square with open ground `clear` squares all round it, as near the player as can be. */
function openSquareNearPlayer(game: Game, clear: number): GroundPoint {
  const player = onlyPlayer(game);
  const around = Array.from({ length: clear * 2 + 1 }, (_, i) => i - clear);
  for (let distance = 3; distance < 60; distance += 1) {
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
    ] as const) {
      const square = { x: Math.floor(player.position.x + dx * distance) + 0.5, z: Math.floor(player.position.z + dz * distance) + 0.5 };
      if (around.every((ax) => around.every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })))) return square;
    }
  }
  throw new Error("No open square");
}

/**
 * A spot on the player's bank of the river and one level with it on the far bank, each on open ground just beyond the
 * strip by the water that cannot be walked on.
 */
function banksAcrossRiver(game: Game): { near: GroundPoint; far: GroundPoint } {
  const { river } = game.valley;
  const { z } = onlyPlayer(game).position;
  const water = (x: number) => distanceToRiver(river, { x, z }) - river.width / 2;
  let x = onlyPlayer(game).position.x;
  while (water(x) > 1.6) x += 0.05;
  const near = { x, z };
  while (water(x) > 0) x += 0.05;
  while (water(x) <= 0) x += 0.05;
  while (water(x) < 1.1) x += 0.05;
  const far = { x, z };
  if (!isWalkable(game.walkMap, far)) throw new Error("The far bank is not open ground");
  return { near, far };
}

/** Puts a pile straight on the ground. */
function pileAt(game: Game, content: "plank" | "stone", x: number, z: number, count: number): Entity {
  const y = onlyPlayer(game).position.y;
  return game.entities.add({ pile: { content, count }, position: { x, y, z } });
}

/** Lays a log or debarked log straight on the ground. */
function logAt(game: Game, kind: "log" | "debarkedLog", x: number, z: number): Entity {
  const y = onlyPlayer(game).position.y;
  return game.entities.add({ [kind]: { heading: 0 }, position: { x, y, z } });
}

/** Puts a finished sled, loaded with `load`, straight on the ground. */
function sledAt(game: Game, x: number, z: number, load: SledLoad): Entity & { sled: SledLoad } {
  const sled = { ...load };
  const y = onlyPlayer(game).position.y;
  return Object.assign(game.entities.add({ sled, facing: { turns: 0 }, position: { x, y, z } }), { sled });
}

/** Builds a blueprint until the player stops. */
function build(game: Game, blueprint: Entity): void {
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => onlyPlayer(game).buildTask === undefined && onlyPlayer(game).approach === undefined);
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
  finishReach(game);
}

function stepUntil(game: Game, done: () => boolean, maxSteps = 20_000): void {
  for (let i = 0; i < maxSteps; i += 1) {
    if (done()) return;
    game.step();
  }
  throw new Error("Never happened");
}

function runSeconds(game: Game, seconds: number): void {
  for (let i = 0; i < seconds * STEPS_PER_SECOND; i += 1) game.step();
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position", "backpack").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
