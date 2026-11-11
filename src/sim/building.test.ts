import { describe, expect, it } from "vitest";
import { CAMPFIRE_BUILD_SECONDS, CAMPFIRE_STICK_COST } from "./structures";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { isWalkable } from "./walk-map";

describe("placing a campfire blueprint", () => {
  it("puts a campfire blueprint on open ground, snapped to the building grid", () => {
    const game = createGame({ seed: 42 });
    const spot = openSpotNearPlayer(game);

    game.client.send({ type: "placeBlueprint", structure: "campfire", turns: 0, x: spot.x + 0.3, z: spot.z - 0.2 });
    game.step();

    const blueprint = onlyBlueprint(game);
    expect(blueprint.blueprint).toMatchObject({ structure: "campfire", progress: 0, materialsSpent: 0, delivered: {} });
    expect(blueprint.position.x).toBe(spot.x);
    expect(blueprint.position.z).toBe(spot.z);
    // A blueprint does not block walking, so the player can stand at it while building.
    expect(blueprint.blocksWalking).toBeUndefined();
    // Placing costs nothing.
    expect(game.client.getView().backpack.stick).toBeUndefined();
  });

  it("faces the way the player turned it", () => {
    const game = createGame({ seed: 42 });
    const spot = openSpotNearPlayer(game);

    game.client.send({ type: "placeBlueprint", structure: "campfire", turns: 3, x: spot.x, z: spot.z });
    game.step();

    expect(onlyBlueprint(game).facing).toEqual({ turns: 3 });
  });

  it("refuses a spot the player cannot walk on, such as a tree", () => {
    const game = createGame({ seed: 42 });
    const tree = game.entities.with("tree", "position").first;
    if (tree === undefined) throw new Error("No tree");

    game.client.send({ type: "placeBlueprint", structure: "campfire", turns: 0, x: tree.position.x, z: tree.position.z });
    game.step();

    expect(game.entities.with("blueprint").size).toBe(0);
  });

  it("refuses a spot taken by another campfire blueprint", () => {
    const game = createGame({ seed: 42 });
    const spot = openSpotNearPlayer(game);

    game.client.send({ type: "placeBlueprint", structure: "campfire", turns: 0, x: spot.x, z: spot.z });
    game.client.send({ type: "placeBlueprint", structure: "campfire", turns: 0, x: spot.x + 1, z: spot.z });
    game.step();

    expect(game.entities.with("blueprint").size).toBe(1);
  });
});

describe("the build menu", () => {
  it("lists the campfire and its stick cost", () => {
    const game = createGame({ seed: 42 });

    expect(game.client.getView().buildMenu[0]).toEqual({ structure: "campfire", cost: [{ material: "stick", count: 5 }] });
  });
});

describe("checking where a blueprint would go", () => {
  it("snaps the spot to the building grid and allows open ground, without placing anything", () => {
    const game = createGame({ seed: 42 });
    const spot = openSpotNearPlayer(game);

    const check = game.client.checkPlacement("campfire", { x: spot.x + 0.4, z: spot.z - 0.3 }, 1);

    expect(check.allowed).toBe(true);
    expect(check.spot).toMatchObject({ x: spot.x, z: spot.z });
    expect(game.entities.with("blueprint").size).toBe(0);
  });

  it("refuses a tree, and a spot beside another campfire blueprint", () => {
    const game = createGame({ seed: 42 });
    const tree = game.entities.with("tree", "position").first;
    if (tree === undefined) throw new Error("No tree");
    const spot = openSpotNearPlayer(game);
    game.client.send({ type: "placeBlueprint", structure: "campfire", turns: 0, x: spot.x, z: spot.z });
    game.step();

    expect(game.client.checkPlacement("campfire", { x: tree.position.x, z: tree.position.z }, 0).allowed).toBe(false);
    expect(game.client.checkPlacement("campfire", { x: spot.x + 1, z: spot.z }, 0).allowed).toBe(false);
  });
});

describe("building a campfire", () => {
  it("walks the player to the blueprint and builds it in stages while the build action is held", () => {
    const game = createGame({ seed: 42 });
    giveSticks(game, CAMPFIRE_STICK_COST);
    const blueprint = placeBlueprintNearPlayer(game);

    game.client.send({ type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.client.getView().action?.kind === "build");
    runSeconds(game, CAMPFIRE_BUILD_SECONDS / 2);

    expect(game.client.getView().action?.progress).toBeCloseTo(0.5, 1);
    expect(blueprint.blueprint?.progress).toBeCloseTo(0.5, 1);
  });

  it("takes sticks from the backpack as construction goes on, not all at once", () => {
    const game = createGame({ seed: 42 });
    giveSticks(game, CAMPFIRE_STICK_COST);
    const blueprint = placeBlueprintNearPlayer(game);

    game.client.send({ type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.client.getView().action?.kind === "build");
    // The first stick goes down as soon as work starts.
    expect(game.client.getView().backpack.stick).toBe(CAMPFIRE_STICK_COST - 1);

    runSeconds(game, CAMPFIRE_BUILD_SECONDS / 2 - 0.1);
    const halfwayLeft = game.client.getView().backpack.stick ?? 0;
    expect(halfwayLeft).toBeGreaterThan(0);
    expect(halfwayLeft).toBeLessThan(CAMPFIRE_STICK_COST - 1);
    expect(blueprint.blueprint?.materialsSpent).toBe(CAMPFIRE_STICK_COST - halfwayLeft);
  });

  it("finishes as an unlit campfire that blocks walking, having cost exactly its sticks", () => {
    const game = createGame({ seed: 42 });
    giveSticks(game, CAMPFIRE_STICK_COST + 2);
    const blueprint = placeBlueprintNearPlayer(game);
    const { x, z } = blueprint.position;

    game.client.send({ type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.client.getView().action?.kind === "build");
    runSeconds(game, CAMPFIRE_BUILD_SECONDS + 0.5);

    expect(game.client.getView().action).toBeNull();
    expect(game.client.getView().backpack.stick).toBe(2);
    expect(game.entities.with("blueprint").size).toBe(0);
    const campfire = game.entities.with("campfire", "position").first;
    expect(campfire?.campfire).toEqual({ lit: false, fuelMinutes: 0 });
    expect(campfire?.position).toMatchObject({ x, z });
    expect(campfire?.blocksWalking?.radius).toBeGreaterThan(0);
    expect(isWalkable(walkMapOf(game), { x, z })).toBe(false);
  });

  it("pauses when the player runs out of sticks, and carries on once they have more", () => {
    const game = createGame({ seed: 42 });
    giveSticks(game, 2);
    const blueprint = placeBlueprintNearPlayer(game);
    const id = idOf(game, blueprint);

    game.client.send({ type: "build", blueprintId: id });
    stepUntil(game, () => game.client.getView().action?.kind === "build");
    runSeconds(game, CAMPFIRE_BUILD_SECONDS);

    expect(game.client.getView().action).toBeNull();
    expect(game.client.getView().backpack.stick).toBe(0);
    expect(blueprint.blueprint?.materialsSpent).toBe(2);
    const pausedAt = blueprint.blueprint?.progress ?? 0;
    expect(pausedAt).toBeCloseTo(2 / CAMPFIRE_STICK_COST, 1);

    giveSticks(game, CAMPFIRE_STICK_COST - 2);
    game.client.send({ type: "build", blueprintId: id });
    runSeconds(game, CAMPFIRE_BUILD_SECONDS);

    expect(game.entities.with("blueprint").size).toBe(0);
    expect(game.entities.with("campfire").size).toBe(1);
    expect(game.client.getView().backpack.stick).toBe(0);
  });

  it("pauses when the player stops holding the build action, keeping its progress", () => {
    const game = createGame({ seed: 42 });
    giveSticks(game, CAMPFIRE_STICK_COST);
    const blueprint = placeBlueprintNearPlayer(game);

    game.client.send({ type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.client.getView().action?.kind === "build");
    runSeconds(game, CAMPFIRE_BUILD_SECONDS / 2);
    game.client.send({ type: "stopBuilding" });
    game.step();
    const progress = blueprint.blueprint?.progress ?? 0;
    const sticks = game.client.getView().backpack.stick;

    runSeconds(game, CAMPFIRE_BUILD_SECONDS);

    expect(game.client.getView().action).toBeNull();
    expect(blueprint.blueprint?.progress).toBe(progress);
    expect(game.client.getView().backpack.stick).toBe(sticks);
  });

  it("lets the player walk away and resume later from where they stopped", () => {
    const game = createGame({ seed: 42 });
    giveSticks(game, CAMPFIRE_STICK_COST);
    const blueprint = placeBlueprintNearPlayer(game);
    const id = idOf(game, blueprint);

    game.client.send({ type: "build", blueprintId: id });
    stepUntil(game, () => game.client.getView().action?.kind === "build");
    runSeconds(game, CAMPFIRE_BUILD_SECONDS / 2);
    const player = onlyPlayer(game);
    game.client.send({ type: "walkTo", x: player.position.x + 8, z: player.position.z });
    runSeconds(game, 5);
    const progress = blueprint.blueprint?.progress ?? 0;
    expect(progress).toBeGreaterThan(0.4);
    expect(progress).toBeLessThan(1);

    game.client.send({ type: "build", blueprintId: id });
    stepUntil(game, () => game.client.getView().action?.kind === "build");
    expect(game.client.getView().action?.progress).toBeCloseTo(progress, 1);
    runSeconds(game, CAMPFIRE_BUILD_SECONDS * (1 - progress) + 0.5);

    expect(game.entities.with("campfire").size).toBe(1);
    expect(game.client.getView().backpack.stick).toBe(0);
  });

  it("does not start when the player has no sticks", () => {
    const game = createGame({ seed: 42 });
    const blueprint = placeBlueprintNearPlayer(game);

    game.client.send({ type: "build", blueprintId: idOf(game, blueprint) });
    runSeconds(game, 10);

    expect(blueprint.blueprint?.progress).toBe(0);
    expect(game.client.getView().action).toBeNull();
  });
});

/** An open spot on the building grid, a few metres from the player. */
function openSpotNearPlayer(game: Game): { x: number; z: number } {
  const player = onlyPlayer(game);
  const map = walkMapOf(game);
  for (let distance = 3; distance < 20; distance += 1) {
    for (const [dx, dz] of [[1, 0], [0, 1], [0, -1], [1, 1], [1, -1]] as const) {
      const spot = { x: Math.round(player.position.x + dx * distance), z: Math.round(player.position.z + dz * distance) };
      const around = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([ax = 0, az = 0]) =>
        isWalkable(map, { x: spot.x + ax, z: spot.z + az }),
      );
      if (around) return spot;
    }
  }
  throw new Error("No open spot");
}

function placeBlueprintNearPlayer(game: Game) {
  const spot = openSpotNearPlayer(game);
  game.client.send({ type: "placeBlueprint", structure: "campfire", turns: 0, x: spot.x, z: spot.z });
  game.step();
  return onlyBlueprint(game);
}

/** The only blueprint. Typed as a plain entity, because it stops being a blueprint once finished. */
function onlyBlueprint(game: Game): Entity & { position: NonNullable<Entity["position"]> } {
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("No blueprint");
  return blueprint;
}

function giveSticks(game: Game, count: number): void {
  const backpack = onlyPlayer(game).backpack;
  if (backpack === undefined) throw new Error("No backpack");
  backpack.contents.stick = (backpack.contents.stick ?? 0) + count;
}

function walkMapOf(game: Game) {
  return game.walkMap;
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
