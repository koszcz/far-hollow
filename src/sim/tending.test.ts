import { describe, expect, it } from "bun:test";
import type { BackpackContent, Command } from "./api";
import { CAMPFIRE_BUILD_SECONDS, CAMPFIRE_STICK_COST } from "./structures";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { readSave, writeSave } from "./save";
import { isWalkable } from "./walk-map";

describe("tending a campfire from out of reach", () => {
  it("walks the player to the campfire, then adds the fuel", () => {
    const { game, campfire } = gameWithCampfire();
    give(game, "bark", 1);
    walkAway(game);

    send(game, { type: "addFuel", campfireId: idOf(game, campfire), fuel: "bark" });
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
    game.step();

    expect(campfire.campfire.fuelMinutes).toBe(20);
    expect(game.client.getView().backpack.bark).toBe(0);
  });

  it("walks the player to the campfire, then lights it", () => {
    const { game, campfire } = gameWithCampfire();
    campfire.campfire.fuelMinutes = 60;
    walkAway(game);

    arriveAfter(game, { type: "lightCampfire", campfireId: idOf(game, campfire) });

    expect(campfire.campfire.lit).toBe(true);
  });

  it("walks the player to the campfire, then puts the pot on, and later takes it off", () => {
    const { game, campfire } = gameWithCampfire();
    campfire.campfire = { lit: true, fuelMinutes: 300 };
    give(game, "pot", -1);
    give(game, "potOfRiverWater", 1);
    walkAway(game);

    arriveAfter(game, { type: "putPotOnFire", campfireId: idOf(game, campfire) });
    expect(campfire.potOnFire?.water).toBe("river");
    expect(game.client.getView().backpack.potOfRiverWater).toBe(0);

    walkAway(game);
    arriveAfter(game, { type: "takePotOffFire", campfireId: idOf(game, campfire) });
    expect(campfire.potOnFire).toBeUndefined();
    // The water may have boiled while the player was away.
    const { potOfRiverWater = 0, potOfBoiledWater = 0 } = game.client.getView().backpack;
    expect(potOfRiverWater + potOfBoiledWater).toBe(1);
  });

  it("forgets the fuel if the player does something else before arriving", () => {
    const { game, campfire } = gameWithCampfire();
    give(game, "bark", 1);
    walkAway(game);

    send(game, { type: "addFuel", campfireId: idOf(game, campfire), fuel: "bark" });
    expect(onlyPlayer(game).tendTask).toBeDefined();
    send(game, { type: "walkTo", x: onlyPlayer(game).position.x - 5, z: onlyPlayer(game).position.z });
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);

    expect(onlyPlayer(game).tendTask).toBeUndefined();
    expect(campfire.campfire.fuelMinutes).toBe(0);
    expect(game.client.getView().backpack.bark).toBe(1);
  });

  it("acts at once, without stopping other work, when the player already stands within reach", () => {
    const { game, campfire } = gameWithCampfire();
    give(game, "stick", 1);

    send(game, { type: "addFuel", campfireId: idOf(game, campfire), fuel: "stick" });

    expect(campfire.campfire.fuelMinutes).toBe(20);
    expect(onlyPlayer(game).tendTask).toBeUndefined();
  });

  it("keeps walking to the campfire after the game is saved and loaded", () => {
    const { game, campfire } = gameWithCampfire();
    give(game, "bark", 1);
    walkAway(game);
    send(game, { type: "addFuel", campfireId: idOf(game, campfire), fuel: "bark" });

    // Through JSON, as storage keeps it.
    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save was rejected");
    const restored = loaded.game;
    expect(onlyPlayer(restored).tendTask).toEqual({ type: "addFuel", campfireId: idOf(game, campfire), fuel: "bark" });
    stepUntil(restored, () => onlyPlayer(restored).walkPath === undefined);
    restored.step();

    expect(restored.entities.with("campfire").first?.campfire.fuelMinutes).toBe(20);
  });
});

describe("describing a campfire or woodpile by its id", () => {
  it("describes a campfire out of reach, with which fuel still fits and whether the player could light it", () => {
    const { game, campfire } = gameWithCampfire();
    // 7 hours 40 minutes of fuel: 20 more minutes of a stick or bark still fit, but not 90 minutes of firewood.
    campfire.campfire.fuelMinutes = 460;
    walkAway(game);

    expect(game.client.describeCampfire(idOf(game, campfire))).toEqual({
      id: idOf(game, campfire),
      lit: false,
      fuelLeft: 460 / 480,
      fuelMinutes: 460,
      canLight: true,
      fits: { stick: true, bark: true, firewood: false },
      pot: null,
    });
  });

  it("says a campfire cannot be lit without a steel and flint, even out of reach", () => {
    const { game, campfire } = gameWithCampfire();
    campfire.campfire.fuelMinutes = 60;
    give(game, "steelAndFlint", -1);
    walkAway(game);

    expect(game.client.describeCampfire(idOf(game, campfire))?.canLight).toBe(false);
  });

  it("describes a woodpile out of reach", () => {
    const game = createGame({ seed: 42 });
    const woodpile = buildWoodpile(game);
    woodpile.woodpile.firewood = 4;
    walkAway(game);

    expect(game.client.describeWoodpile(idOf(game, woodpile))).toEqual({
      id: idOf(game, woodpile),
      contents: { log: 0, debarkedLog: 0, firewood: 4 },
      total: 4,
      capacity: 20,
    });
  });

  it("gives null for anything that is not a campfire or woodpile", () => {
    const { game, campfire } = gameWithCampfire();
    expect(game.client.describeWoodpile(idOf(game, campfire))).toBeNull();
    expect(game.client.describeCampfire(idOf(game, onlyPlayer(game)))).toBeNull();
  });
});

describe("using a woodpile from out of reach", () => {
  it("walks the player to the woodpile, then stacks all their firewood", () => {
    const game = createGame({ seed: 42 });
    const woodpile = buildWoodpile(game);
    give(game, "firewood", 3);
    walkAway(game);

    arriveAfter(game, { type: "stackOnWoodpile", woodpileId: idOf(game, woodpile), wood: "firewood", all: true });

    expect(woodpile.woodpile.firewood).toBe(3);
    expect(game.client.getView().backpack.firewood).toBe(0);
  });

  it("walks the player to the woodpile, then takes a debarked log onto their shoulder", () => {
    const game = createGame({ seed: 42 });
    const woodpile = buildWoodpile(game);
    woodpile.woodpile.debarkedLog = 2;
    walkAway(game);

    arriveAfter(game, { type: "takeFromWoodpile", woodpileId: idOf(game, woodpile), wood: "debarkedLog" });

    expect(woodpile.woodpile.debarkedLog).toBe(1);
    expect(game.client.getView().carrying).toBe("debarkedLog");
  });
});

/** Sends the command, then waits until the player has walked over and carried it out. */
function arriveAfter(game: Game, command: Command): void {
  send(game, command);
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
  game.step();
}

function buildWoodpile(game: Game): Entity & Required<Pick<Entity, "woodpile" | "position">> {
  const spot = openSpotNearPlayer(game);
  send(game, { type: "placeBlueprint", structure: "woodpile", turns: 0, x: spot.x, z: spot.z });
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("No blueprint");
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => game.client.getView().action?.kind === "build");
  runSeconds(game, 5);
  const woodpile = game.entities.with("woodpile", "position").first;
  if (woodpile === undefined) throw new Error("No woodpile");
  return woodpile;
}

type Campfire = Entity & Required<Pick<Entity, "campfire" | "position">>;

function gameWithCampfire(): { game: Game; campfire: Campfire } {
  const game = createGame({ seed: 42 });
  give(game, "stick", CAMPFIRE_STICK_COST);
  const spot = openSpotNearPlayer(game);
  send(game, { type: "placeBlueprint", structure: "campfire", turns: 0, x: spot.x, z: spot.z });
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("No blueprint");
  game.client.send({ type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => game.client.getView().action?.kind === "build");
  runSeconds(game, CAMPFIRE_BUILD_SECONDS + 0.5);
  const campfire = game.entities.with("campfire", "position").first;
  if (campfire === undefined) throw new Error("No campfire");
  return { game, campfire };
}

/** Walks the player well away from everything they were near. */
function walkAway(game: Game): void {
  const player = onlyPlayer(game);
  send(game, { type: "walkTo", x: player.position.x - 15, z: player.position.z });
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
}

function give(game: Game, content: BackpackContent, count: number): void {
  const backpack = onlyPlayer(game).backpack;
  if (backpack === undefined) throw new Error("No backpack");
  backpack.contents[content] = (backpack.contents[content] ?? 0) + count;
}

function openSpotNearPlayer(game: Game): { x: number; z: number } {
  const player = onlyPlayer(game);
  for (let distance = 3; distance < 20; distance += 1) {
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
    ] as const) {
      const spot = { x: Math.round(player.position.x + dx * distance), z: Math.round(player.position.z + dz * distance) };
      const around = [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].every(([ax = 0, az = 0]) => isWalkable(game.walkMap, { x: spot.x + ax, z: spot.z + az }));
      if (around) return spot;
    }
  }
  throw new Error("No open spot");
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
  const player = game.entities.with("player", "position").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
