import { describe, expect, it } from "vitest";
import type { BackpackContent, Command } from "./api";
import { CAMPFIRE_BUILD_SECONDS, CAMPFIRE_STICK_COST } from "./structures";
import type { Entity } from "./entities";
import { FUEL_BURN_MINUTES } from "./campfires";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { BOIL_MINUTES } from "./pot-state";
import { readSave, writeSave } from "./save";
import { distanceToRiver, type GroundPoint } from "./valley";
import { isWalkable } from "./walk-map";

describe("the pot", () => {
  it("is in the backpack, empty, when a new game starts", () => {
    const game = createGame({ seed: 42 });

    expect(game.client.getView().backpack.pot).toBe(1);
  });
});

describe("filling the pot", () => {
  it("walks the player to the nearest riverbank and fills the pot with river water", () => {
    const game = createGame({ seed: 42 });

    fillPot(game);

    expect(game.client.getView().backpack).toMatchObject({ pot: 0, potOfRiverWater: 1 });
    expect(distanceToWater(game, onlyPlayer(game).position)).toBeLessThan(3);
    // Filling the pot is not drinking.
    expect(game.client.getView().sick).toBe(false);
  });

  it("does nothing if the player walks somewhere else before reaching the bank", () => {
    const game = createGame({ seed: 42 });
    const player = onlyPlayer(game);

    send(game, { type: "fillPot" });
    send(game, { type: "walkTo", x: player.position.x - 10, z: player.position.z });
    runUntilStill(game);

    expect(game.client.getView().backpack).toMatchObject({ pot: 1 });
    expect(game.client.getView().backpack.potOfRiverWater ?? 0).toBe(0);
  });

  it("does nothing if the pot is already full", () => {
    const game = createGame({ seed: 42 });
    fillPot(game);

    fillPot(game);

    expect(game.client.getView().backpack).toMatchObject({ pot: 0, potOfRiverWater: 1 });
  });

  it("leaves the pot empty when the backpack has no room for the water", () => {
    const game = createGame({ seed: 42 });
    // 9 pieces of firewood weigh 13.5 kg. With the starting kit's 5.4 kg that makes 18.9 kg, too much to add 2 kg of water.
    give(game, "firewood", 9);

    send(game, { type: "fillPot" });
    runUntilStill(game);

    expect(game.client.getView().backpack).toMatchObject({ pot: 1 });
    expect(game.client.getView().notice).toBe("backpackFull");
  });
});

describe("boiling water", () => {
  it("boils the water in a full pot on a lit campfire after a short wait", () => {
    const { game, campfireId } = gameWithLitCampfire();
    send(game, { type: "setPaused", paused: true });
    send(game, { type: "putPotOnFire", campfireId });
    expect(game.client.getView().backpack.potOfRiverWater).toBe(0);
    expect(game.client.getView().nearbyCampfire?.pot).toEqual({ water: "river", boilProgress: 0 });

    skipMinutes(game, BOIL_MINUTES / 2);
    expect(game.client.getView().nearbyCampfire?.pot?.water).toBe("river");
    expect(game.client.getView().nearbyCampfire?.pot?.boilProgress).toBeCloseTo(0.5, 1);
    skipMinutes(game, BOIL_MINUTES / 2 + 1);

    expect(game.client.getView().nearbyCampfire?.pot).toEqual({ water: "boiled", boilProgress: 1 });
    send(game, { type: "takePotOffFire", campfireId });
    expect(game.client.getView().nearbyCampfire?.pot).toBeNull();
    expect(game.client.getView().backpack).toMatchObject({ potOfRiverWater: 0, potOfBoiledWater: 1 });
  });

  it("leaves the water unboiled if the fire goes out first", () => {
    const { game, campfireId } = gameWithLitCampfire("stick");
    // A stick burns for 20 minutes. Let most of it burn first, so the fire goes out partway through boiling.
    skipMinutes(game, FUEL_BURN_MINUTES.stick - BOIL_MINUTES / 2);
    send(game, { type: "putPotOnFire", campfireId });

    skipMinutes(game, BOIL_MINUTES * 2);
    expect(game.client.getView().nearbyCampfire?.lit).toBe(false);
    expect(game.client.getView().nearbyCampfire?.pot?.water).toBe("river");

    send(game, { type: "takePotOffFire", campfireId });
    expect(game.client.getView().backpack).toMatchObject({ potOfRiverWater: 1 });
    expect(game.client.getView().backpack.potOfBoiledWater ?? 0).toBe(0);
  });

  it("will not take an empty pot, or a pot on a fire that is not lit", () => {
    const empty = gameWithLitCampfire();
    give(empty.game, "potOfRiverWater", -1);
    give(empty.game, "pot", 1);
    send(empty.game, { type: "putPotOnFire", campfireId: empty.campfireId });
    expect(empty.game.client.getView().nearbyCampfire?.pot).toBeNull();
    expect(empty.game.client.getView().backpack.pot).toBe(1);

    const unlit = gameWithLitCampfire();
    const campfire = unlit.game.entities.entity(unlit.campfireId)?.campfire;
    if (campfire === undefined) throw new Error("No campfire");
    campfire.lit = false;
    send(unlit.game, { type: "putPotOnFire", campfireId: unlit.campfireId });
    expect(unlit.game.client.getView().nearbyCampfire?.pot).toBeNull();
    expect(unlit.game.client.getView().backpack.potOfRiverWater).toBe(1);
  });
});

describe("drinking from the pot", () => {
  it("fills thirst with boiled water without making the player sick, and empties the pot", () => {
    const game = createGame({ seed: 42 });
    give(game, "pot", -1);
    give(game, "potOfBoiledWater", 1);
    skipMinutes(game, 6 * 60);
    expect(game.client.getView().needs.thirst).toBeLessThan(0.8);

    send(game, { type: "drinkFromPot" });

    expect(game.client.getView().needs.thirst).toBeCloseTo(1, 2);
    expect(game.client.getView().sick).toBe(false);
    expect(game.client.getView().backpack).toMatchObject({ pot: 1, potOfBoiledWater: 0 });
  });

  it("makes the player sick when the water was not boiled", () => {
    const game = createGame({ seed: 42 });
    fillPot(game);

    send(game, { type: "drinkFromPot" });

    expect(game.client.getView().sick).toBe(true);
    expect(game.client.getView().backpack).toMatchObject({ pot: 1, potOfRiverWater: 0 });
  });

  it("does nothing when the pot is empty", () => {
    const game = createGame({ seed: 42 });
    skipMinutes(game, 6 * 60);
    const thirst = game.client.getView().needs.thirst;

    send(game, { type: "drinkFromPot" });

    expect(game.client.getView().needs.thirst).toBe(thirst);
  });
});

describe("saving the pot", () => {
  it("keeps the pot empty, full of river water, or full of boiled water", () => {
    for (const content of ["pot", "potOfRiverWater", "potOfBoiledWater"] as const) {
      const game = createGame({ seed: 42 });
      give(game, "pot", -1);
      give(game, content, 1);

      expect(saveAndLoad(game).client.getView().backpack[content]).toBe(1);
    }
  });

  it("keeps a pot on the fire, with how far it has boiled", () => {
    const { game, campfireId } = gameWithLitCampfire();
    send(game, { type: "putPotOnFire", campfireId });
    skipMinutes(game, BOIL_MINUTES / 2);

    const loaded = saveAndLoad(game);

    expect(loaded.entities.entity(campfireId)?.potOnFire).toEqual(game.entities.entity(campfireId)?.potOnFire);
    expect(loaded.client.getView().nearbyCampfire?.pot).toEqual(game.client.getView().nearbyCampfire?.pot);
  });
});

function saveAndLoad(game: Game): Game {
  const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
  if (!loaded.ok) throw new Error("The save was rejected");
  return loaded.game;
}

/**
 * A new game where the player has filled the pot at the river and stands beside a campfire,
 * lit with one piece of fuel of the given kind.
 */
function gameWithLitCampfire(fuel: "stick" | "firewood" = "firewood"): { game: Game; campfireId: number } {
  const game = createGame({ seed: 42 });
  fillPot(game);
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
  const campfireId = idOf(game, campfire);
  game.client.send({ type: "tendCampfire", campfireId });
  game.step();
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
  give(game, fuel, 1);
  send(game, { type: "addFuel", campfireId, fuel });
  send(game, { type: "lightCampfire", campfireId });
  if (game.client.getView().nearbyCampfire?.lit !== true) throw new Error("The campfire did not light");
  return { game, campfireId };
}

/** Moves the clock on. The game is paused first, so the player stays put. */
function skipMinutes(game: Game, minutes: number): void {
  send(game, { type: "setPaused", paused: true });
  send(game, { type: "skipTime", hours: minutes / 60 });
}

/** An open spot on the building grid, a few metres from the player. */
function openSpotNearPlayer(game: Game): { x: number; z: number } {
  const player = onlyPlayer(game);
  for (let distance = 3; distance < 20; distance += 1) {
    for (const [dx, dz] of [[-1, 0], [0, 1], [0, -1], [-1, 1], [-1, -1]] as const) {
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

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}

/** Walks the player to the river and fills the pot, then waits until they stand still. */
function fillPot(game: Game): void {
  send(game, { type: "fillPot" });
  runUntilStill(game);
}

/** How far a spot is from the water's edge. Negative inside the water. */
function distanceToWater(game: Game, spot: GroundPoint): number {
  return distanceToRiver(game.valley.river, spot) - game.valley.river.width / 2;
}

function runUntilStill(game: Game): void {
  const player = onlyPlayer(game);
  for (let i = 0; player.walkPath !== undefined || player.fillPotTask !== undefined; i += 1) {
    if (i > 100_000) throw new Error("The player never stopped");
    game.step();
  }
}

function give(game: Game, content: BackpackContent, count: number): void {
  const backpack = onlyPlayer(game).backpack;
  if (backpack === undefined) throw new Error("No backpack");
  backpack.contents[content] = (backpack.contents[content] ?? 0) + count;
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
