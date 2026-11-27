import { describe, expect, it } from "bun:test";
import type { BackpackContent } from "./api";
import type { Command } from "./api-commands";
import { nearbyOf } from "./api-game-view";
import { CAMPFIRE_WARMTH_RADIUS_METRES, isWarmedByCampfire } from "./campfires";
import type { Entity } from "./entities";
import { foundationDeckTop } from "./foundations";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { edgeMiddle } from "./edge-pieces";
import type { GroundPoint } from "./ground-point";
import type { QuarterTurns } from "./quarter-turns";
import { FIREPLACE_FIRES_SAVE_VERSION, FIREPLACES_SAVE_VERSION, readSave, SAVE_VERSION, writeSave } from "./save";
import { FIREPLACE_STONE_COST, structureOf } from "./structures";
import { finishReach } from "./test-steps";
import { isWalkable } from "./walk-map";

describe("fuelling a fireplace", () => {
  it("takes sticks, bark, and firewood from the backpack, one at a time, when the player is within reach", () => {
    const { game, fireplace } = gameWithFireplace();
    const campfireId = idOf(game, fireplace);
    give(game, "stick", 1);
    give(game, "bark", 1);
    give(game, "firewood", 1);
    tend(game, fireplace);

    send(game, { type: "addFuel", campfireId, fuel: "stick" });
    send(game, { type: "addFuel", campfireId, fuel: "bark" });
    send(game, { type: "addFuel", campfireId, fuel: "firewood" });

    expect(game.client.getView().backpack).toMatchObject({ stick: 0, bark: 0, firewood: 0 });
    expect(nearbyOf(game.client.getView(), "campfire")).toMatchObject({ id: campfireId, kind: "fireplace", lit: false });
  });

  it("burns each piece of fuel twice as long as a campfire does", () => {
    const { game, fireplace } = gameWithFireplace();
    const campfireId = idOf(game, fireplace);
    give(game, "stick", 1);
    give(game, "bark", 1);
    give(game, "firewood", 1);
    tend(game, fireplace);

    send(game, { type: "addFuel", campfireId, fuel: "stick" });
    expect(fireplace.fireplace?.fuelMinutes).toBe(40);
    send(game, { type: "addFuel", campfireId, fuel: "bark" });
    expect(fireplace.fireplace?.fuelMinutes).toBe(80);
    send(game, { type: "addFuel", campfireId, fuel: "firewood" });
    expect(fireplace.fireplace?.fuelMinutes).toBe(260);
  });

  it("holds up to 16 game hours of burning, and does not take fuel that would go past that", () => {
    const { game, fireplace } = gameWithFireplace();
    const campfireId = idOf(game, fireplace);
    give(game, "firewood", 10);
    tend(game, fireplace);

    // Each piece of firewood burns 3 hours in a fireplace, so five go on and the sixth would make 18 hours.
    for (let i = 0; i < 10; i += 1) send(game, { type: "addFuel", campfireId, fuel: "firewood" });

    expect(fireplace.fireplace?.fuelMinutes).toBe(15 * 60);
    expect(game.client.getView().backpack.firewood).toBe(5);
    expect(game.client.refusal({ type: "addFuel", campfireId, fuel: "firewood" })).toEqual({ kind: "fireFull" });

    // 40 minutes of a stick still fit in the last hour.
    give(game, "stick", 1);
    expect(game.client.refusal({ type: "addFuel", campfireId, fuel: "stick" })).toBeNull();
    send(game, { type: "addFuel", campfireId, fuel: "stick" });
    expect(nearbyOf(game.client.getView(), "campfire")?.fuelLeft).toBeCloseTo((15 * 60 + 40) / (16 * 60));
  });
});

describe("lighting a fireplace", () => {
  it("lights with the steel and flint once it has fuel, and refuses without fuel or without the tool", () => {
    const { game, fireplace } = gameWithFireplace();
    const campfireId = idOf(game, fireplace);
    const light = { type: "lightCampfire", campfireId } as const;
    give(game, "stick", 1);
    tend(game, fireplace);
    expect(game.client.refusal(light)).toEqual({ kind: "fireEmpty" });
    send(game, light);
    expect(fireplace.fireplace?.lit).toBe(false);

    send(game, { type: "addFuel", campfireId, fuel: "stick" });
    give(game, "steelAndFlint", -1);
    expect(game.client.refusal(light)).toEqual({ kind: "needsTool", tool: "steelAndFlint" });

    give(game, "steelAndFlint", 1);
    send(game, light);
    expect(nearbyOf(game.client.getView(), "campfire")).toMatchObject({ kind: "fireplace", lit: true });
    expect(game.client.getView().backpack.steelAndFlint).toBe(1);
  });

  it("burns its fuel over game time and goes out when the fuel runs out", () => {
    const { game, fireplace } = gameWithFireplace();
    const campfireId = idOf(game, fireplace);
    give(game, "stick", 1);
    tend(game, fireplace);
    send(game, { type: "addFuel", campfireId, fuel: "stick" });
    send(game, { type: "lightCampfire", campfireId });

    send(game, { type: "skipTime", hours: 0.5 });
    expect(fireplace.fireplace?.lit).toBe(true);
    expect(fireplace.fireplace?.fuelMinutes).toBeCloseTo(10, 0);

    send(game, { type: "skipTime", hours: 0.5 });
    expect(fireplace.fireplace).toEqual({ lit: false, fuelMinutes: 0 });
  });

  it("does not burn its fuel while it is unlit", () => {
    const { game, fireplace } = gameWithFireplace();
    give(game, "firewood", 1);
    tend(game, fireplace);
    send(game, { type: "addFuel", campfireId: idOf(game, fireplace), fuel: "firewood" });

    send(game, { type: "skipTime", hours: 3 });

    expect(fireplace.fireplace).toEqual({ lit: false, fuelMinutes: 180 });
  });

  it("keeps burning in the rain under a roof", () => {
    const game = createGame({ seed: 42 });
    const [first, second] = roomNearPlayer(game, 2);
    standOn(game, second);
    const fireplace = finishedFireplaceAt(game, first);
    fireplace.fireplace = { lit: true, fuelMinutes: 16 * 60 };
    const weather = game.entities.with("rain").first;
    if (weather === undefined) throw new Error("No weather");
    weather.rain = { falling: true, changeAtMinutes: Number.MAX_SAFE_INTEGER, changes: 1 };

    send(game, { type: "skipTime", hours: 2 });

    expect(fireplace.fireplace.lit).toBe(true);
    expect(fireplace.fireplace.fuelMinutes).toBeCloseTo(14 * 60, 0);
  });
});

describe("warmth from a fireplace", () => {
  it("warms the player anywhere in its room while lit, however far, and nowhere while out", () => {
    const game = createGame({ seed: 42 });
    const squares = roomNearPlayer(game, 7);
    const [first] = squares;
    const far = squares.at(-1) ?? first;
    const fireplace = finishedFireplaceAt(game, first);
    expect(isWarmedByCampfire(game.entities, far)).toBe(false);

    fireplace.fireplace = { lit: true, fuelMinutes: 60 };

    expect(isWarmedByCampfire(game.entities, far)).toBe(true);
    expect(game.client.describeRooms()).toMatchObject([{ heated: true }]);
  });

  it("keeps the player warm at night at the far end of its room", () => {
    const game = createGame({ seed: 42 });
    const squares = roomNearPlayer(game, 7);
    const [first] = squares;
    const fireplace = finishedFireplaceAt(game, first);
    standOn(game, squares.at(-1) ?? first);
    send(game, { type: "skipTime", hours: 14 }); // 22:00, two hours into the night.
    const chilled = game.client.getView().warmth;

    fireplace.fireplace = { lit: true, fuelMinutes: 16 * 60 };
    send(game, { type: "skipTime", hours: 0.5 });

    expect(game.client.getView().warmth).toBeGreaterThan(chilled + 0.2);
  });

  it("warms the player within a campfire's range when it is not in a room", () => {
    const { game, fireplace } = gameWithFireplace();
    const { x, z } = fireplace.position;
    fireplace.fireplace = { lit: true, fuelMinutes: 60 };

    expect(isWarmedByCampfire(game.entities, { x: x + CAMPFIRE_WARMTH_RADIUS_METRES - 0.1, z })).toBe(true);
    expect(isWarmedByCampfire(game.entities, { x: x + CAMPFIRE_WARMTH_RADIUS_METRES + 0.5, z })).toBe(false);
    expect(game.client.describeRooms()).toEqual([]);
  });
});

describe("taking down a fireplace with a fire", () => {
  it("refuses while the fire is lit or the fireplace holds fuel, and comes down once the fire is out and empty", () => {
    const { game, fireplace } = gameWithFireplace();
    const takeDown = { type: "takeDown", pieceId: idOf(game, fireplace) } as const;

    fireplace.fireplace = { lit: true, fuelMinutes: 30 };
    expect(game.client.refusal(takeDown)).toEqual({ kind: "fireNotOut" });
    fireplace.fireplace = { lit: false, fuelMinutes: 30 };
    expect(game.client.refusal(takeDown)).toEqual({ kind: "fireNotOut" });
    send(game, takeDown);
    runSeconds(game, 30);
    expect(game.entities.has(fireplace)).toBe(true);

    fireplace.fireplace = { lit: false, fuelMinutes: 0 };
    expect(game.client.refusal(takeDown)).toBeNull();
    send(game, takeDown);
    runSeconds(game, 30);
    expect(game.entities.has(fireplace)).toBe(false);
  });

  it("still lets a lit campfire come down, losing its fuel", () => {
    const { game, fireplace } = gameWithFireplace();
    const campfire = game.entities.add({ campfire: { lit: true, fuelMinutes: 60 }, position: { x: fireplace.position.x + 3, y: 0, z: fireplace.position.z } });

    expect(game.client.refusal({ type: "takeDown", pieceId: idOf(game, campfire) })).toBeNull();
  });
});

describe("saving a fireplace's fire", () => {
  it("saves the fuel in each fireplace and whether it is lit", () => {
    const { game, fireplace } = gameWithFireplace();
    fireplace.fireplace = { lit: true, fuelMinutes: 500 };

    const loaded = readSave(structuredClone(writeSave(game)));
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(loaded.game.entities.with("fireplace").entities.map(({ fireplace }) => fireplace)).toEqual([{ lit: true, fuelMinutes: 500 }]);
  });

  it("raises the save version, and gives each fireplace in an older save an empty fire that is out", () => {
    const { game } = gameWithFireplace();
    expect(FIREPLACE_FIRES_SAVE_VERSION).toBe(FIREPLACES_SAVE_VERSION + 1);
    expect(FIREPLACE_FIRES_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    const save = structuredClone(writeSave(game)) as unknown as { version: number; entities: { components: Record<string, unknown> }[] };
    for (const { components } of save.entities) if (components.fireplace !== undefined) components.fireplace = true;
    save.version = FIREPLACE_FIRES_SAVE_VERSION - 1;

    const loaded = readSave(save);
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(loaded.game.entities.with("fireplace").entities.map(({ fireplace }) => fireplace)).toEqual([{ lit: false, fuelMinutes: 0 }]);
  });
});

describe("campfires beside the fireplace", () => {
  it("still burn each stick 20 minutes and hold 8 hours of fuel", () => {
    const game = createGame({ seed: 42 });
    const [first, second] = roomNearPlayer(game, 2);
    finishedFireplaceAt(game, first);
    const campfire = game.entities.add({ campfire: { lit: false, fuelMinutes: 470 }, onFoundation: second, position: { ...second, y: 0 } });
    standOn(game, { x: second.x, z: second.z - 0.3 });
    const campfireId = idOf(game, campfire);
    give(game, "stick", 2);

    expect(game.client.refusal({ type: "addFuel", campfireId, fuel: "stick" })).toEqual({ kind: "fireFull" });
    campfire.campfire = { lit: false, fuelMinutes: 0 };
    send(game, { type: "addFuel", campfireId, fuel: "stick" });

    expect(game.client.describeCampfire(campfireId)).toMatchObject({ kind: "campfire", fuelMinutes: 20, fuelLeft: 20 / 480 });
  });
});

type Fireplace = Entity & { position: NonNullable<Entity["position"]> };

/** A new game with one finished, unlit fireplace on a foundation near the player. */
function gameWithFireplace(): { game: Game; fireplace: Fireplace } {
  const game = createGame({ seed: 42 });
  const square = openSquareNearPlayer(game);
  game.entities.add({ foundation: true, facing: { turns: 0 }, position: { x: square.x, y: foundationDeckTop(game.valley.terrain, square), z: square.z } });
  give(game, "stone", FIREPLACE_STONE_COST);
  send(game, { type: "placeBlueprint", structure: "fireplace", turns: 0, x: square.x, z: square.z });
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("No blueprint");
  const built: Entity = blueprint;
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => built.blueprint === undefined);
  const fireplace = game.entities.with("fireplace", "position").first;
  if (fireplace === undefined) throw new Error("No fireplace");
  return { game, fireplace };
}

/** Puts a finished fireplace on a foundation square, facing the default way, as if the player had built it. */
function finishedFireplaceAt(game: Game, square: GroundPoint): Fireplace {
  const position = { x: square.x, y: foundationDeckTop(game.valley.terrain, square), z: square.z };
  const fireplace = game.entities.add({ ...structureOf("fireplace").finish(square, 0, game.entities), facing: { turns: 0 }, position });
  return Object.assign(fireplace, { position });
}

/**
 * Builds a finished room of `length` foundation squares in a row along +x near the player, with log walls all round and a roof
 * on every square. Returns the squares' middles, in order.
 */
function roomNearPlayer(game: Game, length: number): [GroundPoint, GroundPoint, ...GroundPoint[]] {
  const start = openSquareNearPlayer(game);
  const squares = Array.from({ length }, (_, i) => ({ x: start.x + i, z: start.z }));
  const deck = (square: GroundPoint) => ({ x: square.x, y: foundationDeckTop(game.valley.terrain, square), z: square.z });
  for (const square of squares) game.entities.add({ foundation: true, facing: { turns: 0 }, position: deck(square) });
  squares.forEach((square, i) => {
    const sides: QuarterTurns[] = [0, 2];
    if (i === 0) sides.push(1);
    if (i === length - 1) sides.push(3);
    for (const side of sides) {
      const edge = edgeMiddle(square, side);
      game.entities.add({ ...structureOf("logWall").finish(edge, side, game.entities), facing: { turns: side }, position: { x: edge.x, y: 0, z: edge.z } });
    }
  });
  for (const square of squares) game.entities.add({ ...structureOf("roof").finish(square, 0, game.entities), facing: { turns: 0 }, position: deck(square) });
  const [first, second, ...rest] = squares;
  if (first === undefined || second === undefined) throw new Error("A room here needs at least two squares");
  return [first, second, ...rest];
}

/** Puts the player straight onto a spot, as if they had walked there. */
function standOn(game: Game, spot: GroundPoint): void {
  const player = onlyPlayer(game);
  player.position = { x: spot.x, y: foundationDeckTop(game.valley.terrain, spot), z: spot.z };
  player.previousPosition = { ...player.position };
}

/** Clicks the fireplace and waits for the player to reach it. */
function tend(game: Game, fireplace: Entity): void {
  game.client.send({ type: "tendCampfire", campfireId: idOf(game, fireplace) });
  game.step();
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
  finishReach(game);
}

function give(game: Game, content: BackpackContent, count: number): void {
  const contents = onlyPlayer(game).backpack.contents;
  contents[content] = (contents[content] ?? 0) + count;
}

/** The middle of a building-grid square a few metres from the player, with open ground three squares all round it. */
function openSquareNearPlayer(game: Game): { x: number; z: number } {
  const player = onlyPlayer(game);
  for (let distance = 4; distance < 30; distance += 1) {
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
    ] as const) {
      const square = { x: Math.floor(player.position.x + dx * distance) + 0.5, z: Math.floor(player.position.z + dz * distance) + 0.5 };
      const reach = [-3, -2, -1, 0, 1, 2, 3];
      const open = reach.every((ax) => reach.every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      if (open && game.client.checkPlacement("foundation", square, 0).allowed) return square;
    }
  }
  throw new Error("No open square");
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
  const player = game.entities.with("player", "position", "backpack").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
