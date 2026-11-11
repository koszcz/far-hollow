import { describe, expect, it } from "vitest";
import type { BackpackContent, Command } from "./api";
import { CAMPFIRE_BUILD_SECONDS, CAMPFIRE_STICK_COST } from "./building";
import { isWarmedByCampfire } from "./campfires";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { isWalkable } from "./walk-map";

describe("lighting a campfire", () => {
  it("walks the player to a campfire they click on, and shows it as the nearby campfire", () => {
    const { game, campfire } = gameWithCampfire();
    walkAway(game);
    expect(game.client.getView().nearbyCampfire).toBeNull();

    tend(game, campfire);

    expect(game.client.getView().nearbyCampfire).toMatchObject({ id: idOf(game, campfire), lit: false, fuelLeft: 0 });
  });

  it("will not light without fuel", () => {
    const { game, campfire } = gameWithCampfire();
    tend(game, campfire);

    send(game, { type: "lightCampfire", campfireId: idOf(game, campfire) });

    expect(game.client.getView().nearbyCampfire?.lit).toBe(false);
  });

  it("lights with the fire striker once it has fuel", () => {
    const { game, campfire } = gameWithCampfire();
    give(game, "stick", 1);
    tend(game, campfire);

    send(game, { type: "addFuel", campfireId: idOf(game, campfire), fuel: "stick" });
    send(game, { type: "lightCampfire", campfireId: idOf(game, campfire) });

    expect(game.client.getView().nearbyCampfire?.lit).toBe(true);
    expect(game.client.getView().backpack.stick).toBe(0);
    // The striker is a tool, so lighting does not use it up.
    expect(game.client.getView().backpack.fireStriker).toBe(1);
  });

  it("will not light without a fire striker", () => {
    const { game, campfire } = gameWithCampfire();
    give(game, "stick", 1);
    give(game, "fireStriker", -1);
    tend(game, campfire);

    send(game, { type: "addFuel", campfireId: idOf(game, campfire), fuel: "stick" });
    send(game, { type: "lightCampfire", campfireId: idOf(game, campfire) });

    expect(game.client.getView().nearbyCampfire?.lit).toBe(false);
  });

  it("says the campfire can be lit only when it has fuel, is out, and the player has a fire striker", () => {
    const { game, campfire } = gameWithCampfire();
    give(game, "stick", 1);
    tend(game, campfire);
    expect(game.client.getView().nearbyCampfire?.canLight).toBe(false);

    send(game, { type: "addFuel", campfireId: idOf(game, campfire), fuel: "stick" });
    expect(game.client.getView().nearbyCampfire?.canLight).toBe(true);

    give(game, "fireStriker", -1);
    game.step();
    expect(game.client.getView().nearbyCampfire?.canLight).toBe(false);

    give(game, "fireStriker", 1);
    send(game, { type: "lightCampfire", campfireId: idOf(game, campfire) });
    expect(game.client.getView().nearbyCampfire?.lit).toBe(true);
    expect(game.client.getView().nearbyCampfire?.canLight).toBe(false);
  });

  it("does nothing when the player is out of reach", () => {
    const { game, campfire } = gameWithCampfire();
    give(game, "stick", 1);
    walkAway(game);

    send(game, { type: "addFuel", campfireId: idOf(game, campfire), fuel: "stick" });
    send(game, { type: "lightCampfire", campfireId: idOf(game, campfire) });

    expect(campfire.campfire).toEqual({ lit: false, fuelMinutes: 0 });
    expect(game.client.getView().backpack.stick).toBe(1);
  });
});

describe("fuelling a campfire", () => {
  it("takes one piece of fuel from the backpack each time, and shows the campfire filling up", () => {
    const { game, campfire } = gameWithCampfire();
    give(game, "stick", 2);
    tend(game, campfire);

    send(game, { type: "addFuel", campfireId: idOf(game, campfire), fuel: "stick" });
    const afterOne = game.client.getView().nearbyCampfire?.fuelLeft ?? 0;
    send(game, { type: "addFuel", campfireId: idOf(game, campfire), fuel: "stick" });
    const afterTwo = game.client.getView().nearbyCampfire?.fuelLeft ?? 0;

    expect(game.client.getView().backpack.stick).toBe(0);
    expect(afterOne).toBeGreaterThan(0);
    expect(afterTwo).toBeCloseTo(afterOne * 2);
  });

  it("burns bark from the backpack, like sticks", () => {
    const { game, campfire } = gameWithCampfire();
    give(game, "bark", 1);
    tend(game, campfire);
    send(game, { type: "setPaused", paused: true });

    send(game, { type: "addFuel", campfireId: idOf(game, campfire), fuel: "bark" });
    send(game, { type: "lightCampfire", campfireId: idOf(game, campfire) });

    expect(game.client.getView().backpack.bark).toBe(0);
    expect(game.client.getView().nearbyCampfire).toMatchObject({ lit: true, fuelMinutes: 20 });
  });

  it("does nothing when the backpack holds none of that fuel", () => {
    const { game, campfire } = gameWithCampfire();
    tend(game, campfire);

    send(game, { type: "addFuel", campfireId: idOf(game, campfire), fuel: "firewood" });

    expect(game.client.getView().nearbyCampfire?.fuelLeft).toBe(0);
  });

  it("stops taking fuel once it is full", () => {
    const { game, campfire } = gameWithCampfire();
    give(game, "firewood", 20);
    tend(game, campfire);

    for (let i = 0; i < 20; i += 1) send(game, { type: "addFuel", campfireId: idOf(game, campfire), fuel: "firewood" });

    expect(game.client.getView().nearbyCampfire?.fuelLeft).toBeLessThanOrEqual(1);
    expect(game.client.getView().nearbyCampfire?.fuelLeft).toBeGreaterThan(0.8);
    expect(game.client.getView().backpack.firewood).toBeGreaterThan(0);
  });
});

describe("a lit campfire burning down", () => {
  it("burns its fuel over game time and goes out when the fuel runs out", () => {
    const { game, campfire } = gameWithCampfire();
    give(game, "stick", 1);
    tend(game, campfire);
    send(game, { type: "addFuel", campfireId: idOf(game, campfire), fuel: "stick" });
    send(game, { type: "lightCampfire", campfireId: idOf(game, campfire) });
    const full = game.client.getView().nearbyCampfire?.fuelLeft ?? 0;

    // One game minute passes each real second.
    runSeconds(game, 10);
    const later = game.client.getView().nearbyCampfire;
    expect(later?.lit).toBe(true);
    expect(later?.fuelLeft).toBeLessThan(full);

    runSeconds(game, 20);
    expect(game.client.getView().nearbyCampfire).toMatchObject({ lit: false, fuelLeft: 0 });
  });

  it("keeps a stick burning 20 game minutes and firewood longer", () => {
    expect(minutesBurnt("stick")).toBe(20);
    expect(minutesBurnt("firewood")).toBe(90);
  });

  it("does not burn fuel while it is unlit", () => {
    const { game, campfire } = gameWithCampfire();
    give(game, "firewood", 1);
    tend(game, campfire);
    send(game, { type: "addFuel", campfireId: idOf(game, campfire), fuel: "firewood" });
    const before = game.client.getView().nearbyCampfire?.fuelLeft;

    send(game, { type: "skipTime", hours: 3 });

    expect(game.client.getView().nearbyCampfire?.fuelLeft).toBe(before);
  });

  it("can be lit again after it goes out, once it has fresh fuel", () => {
    const { game, campfire } = gameWithCampfire();
    give(game, "stick", 2);
    tend(game, campfire);
    const id = idOf(game, campfire);
    send(game, { type: "addFuel", campfireId: id, fuel: "stick" });
    send(game, { type: "lightCampfire", campfireId: id });
    send(game, { type: "skipTime", hours: 1 });
    expect(game.client.getView().nearbyCampfire?.lit).toBe(false);

    send(game, { type: "addFuel", campfireId: id, fuel: "stick" });
    send(game, { type: "lightCampfire", campfireId: id });

    expect(game.client.getView().nearbyCampfire?.lit).toBe(true);
  });
});

describe("warmth from a campfire", () => {
  it("warms a spot near a lit campfire, but not when unlit or far away", () => {
    const { game, campfire } = gameWithCampfire();
    const near = { x: campfire.position.x + 2, z: campfire.position.z };
    const far = { x: campfire.position.x + 10, z: campfire.position.z };
    expect(isWarmedByCampfire(game.entities, near)).toBe(false);

    give(game, "stick", 1);
    tend(game, campfire);
    send(game, { type: "addFuel", campfireId: idOf(game, campfire), fuel: "stick" });
    send(game, { type: "lightCampfire", campfireId: idOf(game, campfire) });

    expect(isWarmedByCampfire(game.entities, near)).toBe(true);
    expect(isWarmedByCampfire(game.entities, far)).toBe(false);
  });
});

/** How many game minutes one piece of fuel keeps a fire lit, timed by skipping the clock a minute at a time. */
function minutesBurnt(fuel: "stick" | "firewood"): number {
  const { game, campfire } = gameWithCampfire();
  give(game, fuel, 1);
  tend(game, campfire);
  send(game, { type: "addFuel", campfireId: idOf(game, campfire), fuel });
  send(game, { type: "setPaused", paused: true });
  send(game, { type: "lightCampfire", campfireId: idOf(game, campfire) });
  let minutes = 0;
  while (campfire.campfire.lit) {
    send(game, { type: "skipTime", hours: 1 / 60 });
    minutes += 1;
  }
  return minutes;
}

type Campfire =Entity & { position: NonNullable<Entity["position"]>; campfire: NonNullable<Entity["campfire"]> };

/** A new game with one finished, unlit campfire beside the player, and nothing left in the backpack but tools. */
function gameWithCampfire(): { game: Game; campfire: Campfire } {
  const game = createGame({ seed: 42 });
  give(game, "stick", CAMPFIRE_STICK_COST);
  const spot = openSpotNearPlayer(game);
  send(game, { type: "placeCampfire", x: spot.x, z: spot.z });
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("No blueprint");
  game.client.send({ type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => game.client.getView().action?.kind === "build");
  runSeconds(game, CAMPFIRE_BUILD_SECONDS + 0.5);
  const campfire = game.entities.with("campfire", "position").first;
  if (campfire === undefined) throw new Error("No campfire");
  return { game, campfire };
}

/** Clicks the campfire and waits for the player to reach it. */
function tend(game: Game, campfire: Entity): void {
  game.client.send({ type: "tendCampfire", campfireId: idOf(game, campfire) });
  game.step();
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
}

/** Walks the player well away from everything they were near. */
function walkAway(game: Game): void {
  const player = onlyPlayer(game);
  game.client.send({ type: "walkTo", x: player.position.x - 15, z: player.position.z });
  game.step();
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

/** An open spot on the building grid, a few metres from the player. */
function openSpotNearPlayer(game: Game): { x: number; z: number } {
  const player = onlyPlayer(game);
  for (let distance = 3; distance < 20; distance += 1) {
    for (const [dx, dz] of [[1, 0], [0, 1], [0, -1], [1, 1], [1, -1]] as const) {
      const spot = { x: Math.round(player.position.x + dx * distance), z: Math.round(player.position.z + dz * distance) };
      const around = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([ax = 0, az = 0]) =>
        isWalkable(game.walkMap, { x: spot.x + ax, z: spot.z + az }),
      );
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
