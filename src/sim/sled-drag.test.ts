import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import type { Entity, Vec3 } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { readSave, writeSave } from "./save";
import { DRAG_SPEED } from "./sleds";
import { SLED_STICK_COST } from "./structures";
import { WALK_SPEED_METRES_PER_SECOND } from "./walking";
import { isWalkable } from "./walk-map";

describe("starting and stopping dragging a sled", () => {
  it("drags the sled once the player has walked beside it, and lets go of it again", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    const sledId = idOf(game, sled);
    sled.sled = { log: 3, debarkedLog: 1 };

    sendAndSettle(game, { type: "dragSled", sledId });
    expect(game.client.getView().dragging).toEqual({ id: sledId, contents: { log: 3, debarkedLog: 1 }, total: 4, capacity: 6 });

    sendAndSettle(game, { type: "letGoOfSled" });
    expect(game.client.getView().dragging).toBeNull();
    expect(sled.sled).toEqual({ log: 3, debarkedLog: 1 });
  });

  it("drags one sled at a time", () => {
    const game = createGame({ seed: 42 });
    const first = finishedSledNearPlayer(game);
    const second = finishedSledNearPlayer(game, 7);

    sendAndSettle(game, { type: "dragSled", sledId: idOf(game, first) });
    sendAndSettle(game, { type: "dragSled", sledId: idOf(game, second) });

    expect(game.client.getView().dragging?.id).toBe(idOf(game, first));
  });

  it("can start with a log on the shoulder", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    game.entities.addComponent(onlyPlayer(game), "carrying", "log");

    sendAndSettle(game, { type: "dragSled", sledId: idOf(game, sled) });

    expect(game.client.getView().dragging?.id).toBe(idOf(game, sled));
    expect(game.client.getView().carrying).toBe("log");
  });
});

describe("a dragged sled", () => {
  it("follows behind the player, with its load, wherever they walk", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    sled.sled = { log: 2, debarkedLog: 0 };
    sendAndSettle(game, { type: "dragSled", sledId: idOf(game, sled) });
    const start = { ...onlyPlayer(game).position };
    const target = openSpotAway(game, start, 12);

    sendAndSettle(game, { type: "walkTo", x: target.x, z: target.z });

    const player = onlyPlayer(game).position;
    expect(Math.hypot(player.x - start.x, player.z - start.z)).toBeGreaterThan(8);
    const gap = Math.hypot(sled.position.x - player.x, sled.position.z - player.z);
    expect(gap).toBeGreaterThan(0.9);
    expect(gap).toBeLessThan(2);
    // Behind the player: on the side they came from.
    const walked = { x: player.x - start.x, z: player.z - start.z };
    expect((sled.position.x - player.x) * walked.x + (sled.position.z - player.z) * walked.z).toBeLessThan(0);
    expect(sled.sled).toEqual({ log: 2, debarkedLog: 0 });
    // E still reaches it, to let go.
    expect(game.client.nearestInReach()).toEqual({ kind: "sled", id: idOf(game, sled) });
  });

  it("stays where it was let go", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    sendAndSettle(game, { type: "dragSled", sledId: idOf(game, sled) });
    const start = { ...onlyPlayer(game).position };
    const first = openSpotAway(game, start, 8);
    sendAndSettle(game, { type: "walkTo", x: first.x, z: first.z });
    sendAndSettle(game, { type: "letGoOfSled" });
    const where = { ...sled.position };

    sendAndSettle(game, { type: "walkTo", x: start.x, z: start.z });

    expect(sled.position).toEqual(where);
  });
});

describe("walking while dragging", () => {
  it("walks at 70% of normal speed", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    sendAndSettle(game, { type: "dragSled", sledId: idOf(game, sled) });

    expect(DRAG_SPEED).toBe(0.7);
    expect(metresWalkedInOneSecond(game)).toBeCloseTo(WALK_SPEED_METRES_PER_SECOND * 0.7, 1);
  });

  it("stacks with the slowdown from neglected needs", () => {
    const slowed = createGame({ seed: 42 });
    emptyHunger(slowed);
    const unburdened = metresWalkedInOneSecond(slowed);

    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    sendAndSettle(game, { type: "dragSled", sledId: idOf(game, sled) });
    emptyHunger(game);

    expect(unburdened).toBeLessThan(WALK_SPEED_METRES_PER_SECOND * 0.9);
    expect(metresWalkedInOneSecond(game)).toBeCloseTo(unburdened * 0.7, 1);
  });
});

describe("the player's hands while dragging", () => {
  it("refuses shouldering a log, gathering, chopping, building, and crafting, and says to let go first", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    sled.sled = { log: 1, debarkedLog: 0 };
    sendAndSettle(game, { type: "dragSled", sledId: idOf(game, sled) });
    const tree = game.entities.with("tree").first;
    const stick = game.entities.with("stick").first;
    if (tree === undefined || stick === undefined) throw new Error("No tree or stick");
    const log = game.entities.add({ log: { heading: 0 }, position: { ...onlyPlayer(game).position } });

    const refused: Command[] = [
      { type: "pickUpLog", logId: idOf(game, log) },
      { type: "takeFromSled", sledId: idOf(game, sled), log: "log" },
      { type: "pickUpStick", stickId: idOf(game, stick) },
      { type: "chopTree", treeId: idOf(game, tree) },
      { type: "craft", recipe: "saw" },
    ];
    for (const command of refused) {
      send(game, command);
      expect(game.client.getView().notice).toEqual({ kind: "letGoFirst" });
      runSeconds(game, 3);
      expect(game.client.getView().carrying).toBeNull();
      expect(game.client.getView().action).toBeNull();
      expect(onlyPlayer(game).walkPath).toBeUndefined();
    }
    expect(game.client.getView().dragging?.id).toBe(idOf(game, sled));
    expect(sled.sled).toEqual({ log: 1, debarkedLog: 0 });
  });

  it("refuses building a blueprint", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    const blueprint = sledBlueprintNearPlayer(game, 7);
    sendAndSettle(game, { type: "dragSled", sledId: idOf(game, sled) });

    send(game, { type: "build", blueprintId: idOf(game, blueprint) });

    expect(game.client.getView().notice).toEqual({ kind: "letGoFirst" });
    expect(onlyPlayer(game).buildTask).toBeUndefined();
  });
});

describe("collapsing while dragging", () => {
  it("lets go, and leaves the sled with its load where the player fell", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    sled.sled = { log: 4, debarkedLog: 0 };
    sendAndSettle(game, { type: "dragSled", sledId: idOf(game, sled) });
    const start = { ...onlyPlayer(game).position };
    const away = openSpotAway(game, start, 10);
    sendAndSettle(game, { type: "walkTo", x: away.x, z: away.z });
    const where = { ...sled.position };

    onlyPlayer(game).needs.thirst = { level: 0, minutesWithout: 10_000 };
    game.step();

    expect(game.client.getView().notice).toEqual({ kind: "collapsed" });
    expect(game.client.getView().dragging).toBeNull();
    expect(sled.position).toEqual(where);
    expect(sled.sled).toEqual({ log: 4, debarkedLog: 0 });
  });
});

describe("saving while dragging", () => {
  it("keeps the player dragging the sled", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    sendAndSettle(game, { type: "dragSled", sledId: idOf(game, sled) });

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    expect(loaded.game.client.getView().dragging?.id).toBe(idOf(game, sled));
  });

  it("turns away a save where the player drags something that is not a sled", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    sendAndSettle(game, { type: "dragSled", sledId: idOf(game, sled) });
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { entities: { components: Record<string, unknown> }[] };
    for (const { components } of save.entities) if (components.dragging !== undefined) components.dragging = { sledId: "far" };

    expect(readSave(save).ok).toBe(false);
  });
});

/** How far the player walks in one second, heading for open ground 15 m away. */
function metresWalkedInOneSecond(game: Game): number {
  const start = { ...onlyPlayer(game).position };
  const target = openSpotAway(game, start, 15);
  send(game, { type: "walkTo", x: target.x, z: target.z });
  const from = { ...onlyPlayer(game).position };
  runSeconds(game, 1);
  const to = onlyPlayer(game).position;
  return Math.hypot(to.x - from.x, to.z - from.z);
}

/** Empties the player's hunger, without it being empty long enough for a collapse. */
function emptyHunger(game: Game): void {
  onlyPlayer(game).needs.hunger = { level: 0, minutesWithout: 0 };
}

/** A walkable spot about `distance` metres from `from`, with a straight, open line to it. */
function openSpotAway(game: Game, from: { x: number; z: number }, distance: number): { x: number; z: number } {
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 16) {
    const steps = Math.ceil(distance * 4);
    const along = (t: number) => ({ x: from.x + Math.cos(angle) * distance * t, z: from.z + Math.sin(angle) * distance * t });
    if (Array.from({ length: steps + 1 }, (_, i) => along(i / steps)).every((spot) => isWalkable(game.walkMap, spot))) return along(1);
  }
  throw new Error("No open line");
}

/** Builds a finished, empty sled on open ground about `from` metres from the player. */
function finishedSledNearPlayer(game: Game, from = 3) {
  const blueprint = sledBlueprintNearPlayer(game, from);
  const contents = onlyPlayer(game).backpack.contents;
  for (let i = 0; i < 2; i += 1) {
    game.entities.addComponent(onlyPlayer(game), "carrying", "log");
    send(game, { type: "deliverToBlueprint", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.client.getView().carrying === null);
  }
  contents.stick = (contents.stick ?? 0) + SLED_STICK_COST;
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => blueprint.blueprint === undefined);
  return blueprint;
}

/** Places a sled blueprint on open ground about `from` metres from the player. */
function sledBlueprintNearPlayer(game: Game, from = 3): Entity & { position: Vec3 } {
  const square = openSquareNearPlayer(game, from);
  const before = new Set(game.entities.with("blueprint").entities);
  send(game, { type: "placeBlueprint", structure: "sled", turns: 0, x: square.x + 0.1, z: square.z + 0.2 });
  const blueprint = game.entities.with("blueprint", "position").entities.find((entity) => !before.has(entity));
  if (blueprint === undefined) throw new Error("No blueprint");
  return blueprint;
}

/** The middle of a building-grid square about `from` metres from the player, with open ground all round it. */
function openSquareNearPlayer(game: Game, from: number): { x: number; z: number } {
  const player = onlyPlayer(game);
  for (let distance = from; distance < 30; distance += 1) {
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
    ] as const) {
      const square = { x: Math.floor(player.position.x + dx * distance) + 0.5, z: Math.floor(player.position.z + dz * distance) + 0.5 };
      const open = [-2, -1, 0, 1, 2].every((ax) => [-2, -1, 0, 1, 2].every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      const clear = game.entities.with("sled", "position").entities.every(({ position }) => Math.hypot(position.x - square.x, position.z - square.z) > 3);
      if (open && clear) return square;
    }
  }
  throw new Error("No open square");
}

/** Sends a command, then lets the player walk to where they carry it out. */
function sendAndSettle(game: Game, command: Command): void {
  send(game, command);
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined && onlyPlayer(game).tendTask === undefined);
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

function runSeconds(game: Game, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * STEPS_PER_SECOND); i += 1) game.step();
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position", "backpack", "needs").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
