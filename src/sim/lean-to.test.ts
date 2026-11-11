import { describe, expect, it } from "vitest";
import type { Command } from "./api";
import { createEntityStore, type Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { createNeeds, passNeedsTime, type NeedConditions } from "./needs";
import { isUnderRoof } from "./roofs";
import { readSave, upgradeSave, writeSave } from "./save";
import { LEAN_TO_BARK_COST, LEAN_TO_BUILD_SECONDS, LEAN_TO_STICK_COST, type QuarterTurns } from "./structures";
import { isWalkable } from "./walk-map";

describe("the lean-to in the build menu", () => {
  it("is listed after the campfire, costing sticks and bark", () => {
    const game = createGame({ seed: 42 });

    expect(game.client.getView().buildMenu).toEqual([
      { structure: "campfire", cost: [{ material: "stick", count: 5 }] },
      { structure: "leanTo", cost: [{ material: "stick", count: 10 }, { material: "bark", count: 6 }] },
      { structure: "foundation", cost: [{ material: "debarkedLog", count: 4 }] },
      { structure: "logWall", cost: [{ material: "debarkedLog", count: 4 }] },
      { structure: "doorFrame", cost: [{ material: "debarkedLog", count: 3 }] },
      { structure: "roof", cost: [{ material: "debarkedLog", count: 3 }, { material: "bark", count: 4 }] },
      { structure: "woodpile", cost: [] },
    ]);
  });
});

describe("placing a lean-to blueprint", () => {
  it("puts a blueprint on open ground, snapped to the building grid and facing the way the player turned it", () => {
    const game = createGame({ seed: 42 });
    const spot = openLeanToSpot(game);

    send(game, { type: "placeBlueprint", structure: "leanTo", turns: 1, x: spot.x + 0.3, z: spot.z - 0.2 });

    const blueprint = onlyBlueprint(game);
    expect(blueprint.blueprint).toEqual({ piece: "leanTo", progress: 0, materialsSpent: 0, delivered: {} });
    expect(blueprint.position).toMatchObject({ x: spot.x, z: spot.z });
    expect(blueprint.facing).toEqual({ turns: 1 });
  });

  it("cannot overlap a standing tree", () => {
    const game = createGame({ seed: 42 });
    const tree = game.entities.with("tree", "position").first;
    if (tree === undefined) throw new Error("No tree");
    // The tree stands under the lean-to, about 1 m from its centre.
    const at = { x: Math.round(tree.position.x) + 1, z: Math.round(tree.position.z) };

    expect(game.client.checkPlacement("leanTo", at, 0).allowed).toBe(false);
    send(game, { type: "placeBlueprint", structure: "leanTo", turns: 0, ...at });
    expect(game.entities.with("blueprint").size).toBe(0);
  });

  it("cannot overlap another blueprint", () => {
    const game = createGame({ seed: 42 });
    const spot = openLeanToSpot(game);
    send(game, { type: "placeBlueprint", structure: "leanTo", turns: 0, ...spot });

    expect(game.client.checkPlacement("leanTo", { x: spot.x + 2, z: spot.z }, 0).allowed).toBe(false);
    expect(game.client.checkPlacement("leanTo", { x: spot.x + 4, z: spot.z }, 0).allowed).toBe(true);
  });
});

describe("building a lean-to", () => {
  it("spends its sticks first, then its bark, one at a time as construction goes on", () => {
    const game = createGame({ seed: 42 });
    give(game, "stick", LEAN_TO_STICK_COST);
    give(game, "bark", LEAN_TO_BARK_COST);
    const blueprint = placeLeanTo(game, openLeanToSpot(game), 0);

    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.client.getView().action?.kind === "build");
    expect(game.client.getView().backpack).toMatchObject({ stick: LEAN_TO_STICK_COST - 1, bark: LEAN_TO_BARK_COST });

    // Halfway through, about half the sticks are spent and no bark yet.
    runSeconds(game, LEAN_TO_BUILD_SECONDS / 2 - 1);
    const sticksLeft = game.client.getView().backpack.stick ?? 0;
    expect(sticksLeft).toBeGreaterThan(0);
    expect(sticksLeft).toBeLessThan(LEAN_TO_STICK_COST - 1);
    expect(game.client.getView().backpack.bark).toBe(LEAN_TO_BARK_COST);

    runSeconds(game, LEAN_TO_BUILD_SECONDS / 2 + 2);
    expect(game.client.getView().backpack).toMatchObject({ stick: 0, bark: 0 });
    expect(game.entities.with("leanTo").size).toBe(1);
    expect(game.entities.with("blueprint").size).toBe(0);
  });

  it("pauses when the bark runs out, and carries on once the player has more", () => {
    const game = createGame({ seed: 42 });
    give(game, "stick", LEAN_TO_STICK_COST);
    give(game, "bark", 2);
    const blueprint = placeLeanTo(game, openLeanToSpot(game), 0);
    const id = idOf(game, blueprint);

    send(game, { type: "build", blueprintId: id });
    stepUntil(game, () => game.client.getView().action?.kind === "build");
    runSeconds(game, LEAN_TO_BUILD_SECONDS);

    expect(game.client.getView().action).toBeNull();
    expect(blueprint.blueprint.materialsSpent).toBe(LEAN_TO_STICK_COST + 2);
    expect(game.client.getView().backpack).toMatchObject({ stick: 0, bark: 0 });

    give(game, "bark", LEAN_TO_BARK_COST - 2);
    send(game, { type: "build", blueprintId: id });
    runSeconds(game, LEAN_TO_BUILD_SECONDS);

    expect(game.entities.with("leanTo").size).toBe(1);
  });
});

describe("a finished lean-to", () => {
  it("blocks walking at its back and sides, and leaves its front open", () => {
    const game = createGame({ seed: 42 });
    const spot = openLeanToSpot(game);
    buildLeanTo(game, spot, 0);
    const map = game.walkMap;

    // Facing the default way, the open front faces +z.
    for (const x of [-1.5, -0.5, 0.5, 1.5]) expect(isWalkable(map, { x: spot.x + x, z: spot.z - 0.5 })).toBe(false);
    expect(isWalkable(map, { x: spot.x - 1.5, z: spot.z + 0.5 })).toBe(false);
    expect(isWalkable(map, { x: spot.x + 1.5, z: spot.z + 0.5 })).toBe(false);
    expect(isWalkable(map, { x: spot.x - 0.5, z: spot.z + 0.5 })).toBe(true);
    expect(isWalkable(map, { x: spot.x + 0.5, z: spot.z + 0.5 })).toBe(true);
  });

  it("turns its open front the way it faces", () => {
    const game = createGame({ seed: 42 });
    const spot = openLeanToSpot(game);
    buildLeanTo(game, spot, 2);

    // Turned half round, the open front faces -z and the back is at +z.
    expect(isWalkable(game.walkMap, { x: spot.x + 0.5, z: spot.z + 0.5 })).toBe(false);
    expect(isWalkable(game.walkMap, { x: spot.x + 0.5, z: spot.z - 0.5 })).toBe(true);
  });

  it("lets the player walk in at the open front and stand under the roof", () => {
    const game = createGame({ seed: 42 });
    const spot = openLeanToSpot(game);
    buildLeanTo(game, spot, 0);
    const inside = { x: spot.x + 0.5, z: spot.z + 0.5 };

    walkTo(game, inside);

    expect(game.client.getView().playerPosition).toMatchObject(inside);
    expect(isUnderRoof(game.entities, inside)).toBe(true);
  });
});

describe("the roof check", () => {
  it("counts any entity with a roof, so cabin roofs can use it too", () => {
    const entities = createEntityStore();
    entities.add({ roof: { min: { x: 0, z: 0 }, max: { x: 1, z: 1 } } });

    expect(isUnderRoof(entities, { x: 0.5, z: 0.5 })).toBe(true);
    expect(isUnderRoof(entities, { x: 1.5, z: 0.5 })).toBe(false);
  });

  it("covers the ground under a finished lean-to, but not under its blueprint", () => {
    const game = createGame({ seed: 42 });
    const spot = openLeanToSpot(game);
    const blueprint = placeLeanTo(game, spot, 0);
    expect(isUnderRoof(game.entities, { x: spot.x + 0.5, z: spot.z + 0.5 })).toBe(false);

    finish(game, blueprint);

    expect(isUnderRoof(game.entities, { x: spot.x + 0.5, z: spot.z + 0.5 })).toBe(true);
    expect(isUnderRoof(game.entities, { x: spot.x - 1.9, z: spot.z - 0.9 })).toBe(true);
    expect(isUnderRoof(game.entities, { x: spot.x + 0.5, z: spot.z + 1.5 })).toBe(false);
  });
});

describe("rain and the lean-to", () => {
  it("does not drain the warmth of a player under the roof", () => {
    const sheltered = createGame({ seed: 42 });
    const spot = openLeanToSpot(sheltered);
    buildLeanTo(sheltered, spot, 0);
    walkTo(sheltered, { x: spot.x + 0.5, z: spot.z + 0.5 });
    const exposed = createGame({ seed: 42 });
    for (const game of [sheltered, exposed]) startRain(game);

    // One hour of daytime rain.
    for (const game of [sheltered, exposed]) send(game, { type: "skipTime", hours: 1 });

    expect(sheltered.client.getView().raining).toBe(true);
    expect(sheltered.client.getView().needs.warmth).toBe(1);
    expect(exposed.client.getView().needs.warmth).toBeLessThan(0.9);
  });
});

describe("sleeping under a roof", () => {
  it("restores fatigue faster than in the open", () => {
    const sleep: NeedConditions = { night: false, warmedByCampfire: true, working: false, asleep: true, sick: false };
    const open = createNeeds();
    const roofed = createNeeds();
    open.fatigue.level = 0.2;
    roofed.fatigue.level = 0.2;

    passNeedsTime(open, 60, sleep);
    passNeedsTime(roofed, 60, { ...sleep, underRoof: true });

    expect(roofed.fatigue.level - 0.2).toBeGreaterThan((open.fatigue.level - 0.2) * 1.2);
  });

  it("on a bedroll under a lean-to restores fatigue fully in less time than in the open", () => {
    const sheltered = createGame({ seed: 42 });
    const spot = openLeanToSpot(sheltered);
    buildLeanTo(sheltered, spot, 0);
    walkTo(sheltered, { x: spot.x + 0.5, z: spot.z + 0.5 });
    const exposed = createGame({ seed: 42 });
    const minutesAsleep = (game: Game) => {
      onlyPlayer(game).needs.fatigue.level = 0.5;
      send(game, { type: "layBedroll" });
      const bedrollId = game.client.getView().nearbyBedroll?.id;
      if (bedrollId === undefined) throw new Error("No bedroll");
      const before = minutesOf(game);
      send(game, { type: "sleep", bedrollId });
      expect(game.client.getView().needs.fatigue).toBeCloseTo(1, 2);
      return minutesOf(game) - before;
    };

    expect(minutesAsleep(sheltered)).toBeLessThan(minutesAsleep(exposed) * 0.85);
  });
});

describe("saving lean-tos", () => {
  it("restores a lean-to blueprint with its progress, and a finished lean-to that still blocks walking", () => {
    const game = createGame({ seed: 42 });
    const finishedAt = openLeanToSpot(game);
    buildLeanTo(game, finishedAt, 1);
    const plannedAt = openLeanToSpot(game);
    give(game, "stick", 3);
    const blueprint = placeLeanTo(game, plannedAt, 3);
    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.client.getView().backpack.stick === 0 && game.client.getView().action === null);

    const loaded = readSave(structuredClone(writeSave(game)));
    if (!loaded.ok) throw new Error("The save did not load");

    const restored = loaded.game;
    expect(restored.entities.with("blueprint").first?.blueprint).toEqual(blueprint.blueprint);
    expect(restored.entities.with("blueprint").first?.facing).toEqual({ turns: 3 });
    expect(restored.entities.with("leanTo").size).toBe(1);
    // Turned a quarter, the back runs along -x.
    expect(isWalkable(restored.walkMap, { x: finishedAt.x - 0.5, z: finishedAt.z + 1.5 })).toBe(false);
    expect(isUnderRoof(restored.entities, { x: finishedAt.x - 0.5, z: finishedAt.z + 0.5 })).toBe(true);
  });

  it("upgrades a blueprint from an older save, which counted only the sticks spent", () => {
    const save = structuredClone(writeSave(createGame({ seed: 42 }))) as unknown as { version: number; entities: { id: number; components: object }[] };
    save.version = 5;
    save.entities.push({ id: 99_999, components: { blueprint: { piece: "campfire", progress: 0.4, sticksSpent: 2 }, position: { x: 0, y: 0, z: 0 } } });

    const upgraded = upgradeSave(save) as { entities: { components: Entity }[] };

    expect(upgraded.entities.at(-1)?.components.blueprint).toEqual({ piece: "campfire", progress: 0.4, materialsSpent: 2, delivered: {} });
    expect(readSave(save).ok).toBe(true);
  });
});

/** A spot near the player where a lean-to blueprint is allowed, facing any way, away from anything already placed. */
function openLeanToSpot(game: Game): { x: number; z: number } {
  const player = onlyPlayer(game);
  for (let distance = 4; distance < 40; distance += 1) {
    for (const [dx, dz] of [[1, 0], [0, 1], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      const spot = { x: Math.round(player.position.x + dx * distance), z: Math.round(player.position.z + dz * distance) };
      const turns = [0, 1, 2, 3] as const;
      // Leave room around it, so the player can walk round to its front.
      const roomy = [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]].every(([ax = 0, az = 0]) =>
        turns.every((turn) => game.client.checkPlacement("leanTo", { x: spot.x + ax, z: spot.z + az }, turn).allowed),
      );
      if (roomy) return spot;
    }
  }
  throw new Error("No open spot");
}

function placeLeanTo(game: Game, spot: { x: number; z: number }, turns: QuarterTurns) {
  send(game, { type: "placeBlueprint", structure: "leanTo", turns, ...spot });
  const blueprint = game.entities.with("blueprint", "position").entities.find((entity) => entity.position.x === spot.x && entity.position.z === spot.z);
  if (blueprint === undefined) throw new Error("No blueprint was placed");
  return blueprint;
}

/** Gives the player the materials and builds a blueprint to the end. */
function finish(game: Game, blueprint: Entity): void {
  give(game, "stick", LEAN_TO_STICK_COST);
  give(game, "bark", LEAN_TO_BARK_COST);
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => blueprint.blueprint === undefined);
}

function buildLeanTo(game: Game, spot: { x: number; z: number }, turns: QuarterTurns): void {
  finish(game, placeLeanTo(game, spot, turns));
}

function onlyBlueprint(game: Game) {
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("No blueprint");
  return blueprint;
}

/** Starts rain that keeps falling for a day. */
function startRain(game: Game): void {
  const rain = game.entities.with("rain").first?.rain;
  if (rain === undefined) throw new Error("No weather");
  rain.falling = true;
  rain.changeAtMinutes = minutesOf(game) + 24 * 60;
}

function minutesOf(game: Game): number {
  const { day, hour, minute } = game.client.getView().time;
  return ((day - 1) * 24 + hour) * 60 + minute;
}

function give(game: Game, content: "stick" | "bark", count: number): void {
  const contents = onlyPlayer(game).backpack.contents;
  contents[content] = (contents[content] ?? 0) + count;
}

function walkTo(game: Game, to: { x: number; z: number }): void {
  send(game, { type: "walkTo", ...to });
  stepUntil(game, () => game.entities.with("player", "walkPath").first === undefined);
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

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
}

function stepUntil(game: Game, done: () => boolean): void {
  for (let steps = 0; !done(); steps += 1) {
    if (steps > 100_000) throw new Error("Gave up waiting");
    game.step();
  }
}

function runSeconds(game: Game, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * STEPS_PER_SECOND); i += 1) game.step();
}
