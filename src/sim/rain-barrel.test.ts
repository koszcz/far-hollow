import { describe, expect, it } from "bun:test";
import { nearbyOf, type Command, type StructureKind } from "./api";
import { rainEntities, type Entity } from "./entities";
import { addToBackpack } from "./backpack";
import { RAIN_BARREL_BUILD_SECONDS, RAIN_BARREL_DRINK_LIMIT, RAIN_BARREL_MINUTES_PER_DRINK, RAIN_BARREL_PLANK_COST } from "./furniture/rain-barrel";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { FULL_NEED } from "./needs";
import { readSave, writeSave } from "./save";
import { SAVE_VERSION } from "./save-upgrades";
import { RAIN_BARRELS_SAVE_VERSION } from "./save-versions";
import { finishReach, piecesOf } from "./test-steps";
import { isWalkable } from "./walk-map";

describe("the rain barrel in the build menu", () => {
  it("lists the rain barrel as furniture after the stool, costing 6 planks and needing the axe", () => {
    const game = createGame({ seed: 42 });
    const menu = game.client.getView().buildMenu;

    expect(RAIN_BARREL_PLANK_COST).toBe(6);
    expect(RAIN_BARREL_BUILD_SECONDS).toBe(10);
    const stoolAt = menu.findIndex(({ structure }) => structure === "stool");
    expect(menu[stoolAt + 1]).toEqual({ structure: "rainBarrel", cost: [{ material: "plank", count: 6 }], tool: "axe", placement: "anywhere" });
  });
});

describe("building a rain barrel", () => {
  it("goes exactly where the mouse points, off the building grid", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const at = { x: square.x + 0.13, z: square.z - 0.27 };

    const check = game.client.checkPlacement("rainBarrel", at, 1);
    expect(check.allowed).toBe(true);
    expect(check.spot).toMatchObject({ x: at.x, z: at.z });
  });

  it("needs the axe, and once built blocks walking, empty", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("rainBarrel", square.x, square.z, 0));
    const blueprint = blueprintOf(game, "rainBarrel");
    delete onlyPlayer(game).backpack.contents.axe;
    expect(game.client.refusal({ type: "build", blueprintId: idOf(game, blueprint) })).toEqual({
      kind: "cannotBuildYet",
      lacks: { kind: "tool", tool: "axe" },
    });

    onlyPlayer(game).backpack.contents.axe = 1;
    buildFully(game, blueprint);

    expect(blueprint.furniture).toBe("rainBarrel");
    expect(blueprint.rainBarrel).toEqual({ held: 0, progress: 0 });
    expect(isWalkable(game.walkMap, square)).toBe(false);
  });

  it("comes down giving back its 6 planks, and its water spills", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    barrel.rainBarrel = { held: 4, progress: 0.5 };
    const backpack = onlyPlayer(game).backpack;
    backpack.contents.plank = 0;

    send(game, { type: "takeDown", pieceId: idOf(game, barrel) });
    stepUntil(game, () => piecesOf(game.entities, "rainBarrel").length === 0);

    expect(backpack.contents.plank).toBe(RAIN_BARREL_PLANK_COST);
    expect(game.entities.with("rainBarrel").entities).toHaveLength(0);
    expect(backpack.contents.potOfBoiledWater ?? 0).toBe(0);
    expect(isWalkable(game.walkMap, barrel.position)).toBe(true);
  });
});

describe("catching rain", () => {
  it("gains 1 drink for every 2 game hours that rain falls on it", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    letRainFall(game);

    send(game, { type: "skipTime", hours: 5 });

    expect(RAIN_BARREL_MINUTES_PER_DRINK).toBe(120);
    expect(barrel.rainBarrel?.held).toBe(2);
    expect(barrel.rainBarrel?.progress).toBeCloseTo(0.5, 2);
  });

  it("carries progress over from one spell of rain to the next", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);

    letRainFall(game);
    send(game, { type: "skipTime", hours: 1 });
    stopRain(game);
    send(game, { type: "skipTime", hours: 3 });
    expect(barrel.rainBarrel?.held).toBe(0);
    letRainFall(game);
    send(game, { type: "skipTime", hours: 1 });

    expect(barrel.rainBarrel?.held).toBe(1);
  });

  it("gains nothing while snow falls in winter", () => {
    const game = createGame({ seed: 42, startSeason: "winter" });
    const barrel = finishedBarrelNearPlayer(game);
    letRainFall(game);

    send(game, { type: "skipTime", hours: 5 });

    expect(game.client.getView().snowing).toBe(true);
    expect(barrel.rainBarrel).toEqual({ held: 0, progress: 0 });
  });

  it("gains nothing while no rain falls", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    stopRain(game);

    send(game, { type: "skipTime", hours: 6 });

    expect(barrel.rainBarrel).toEqual({ held: 0, progress: 0 });
  });

  it("goes on filling while the player sleeps", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    letRainFall(game);
    send(game, { type: "layBedroll" });
    finishReach(game);
    const bedroll = game.entities.with("bedroll", "position").first;
    if (bedroll === undefined) throw new Error("No bedroll");
    onlyPlayer(game).needs.fatigue.level = 0.3;
    const before = game.progress().clockMinutes;

    send(game, { type: "sleep", bedrollId: idOf(game, bedroll) });

    const slept = game.progress().clockMinutes - before;
    expect(slept).toBeGreaterThan(RAIN_BARREL_MINUTES_PER_DRINK);
    expect(barrel.rainBarrel?.held).toBe(Math.min(RAIN_BARREL_DRINK_LIMIT, Math.floor(slept / RAIN_BARREL_MINUTES_PER_DRINK)));
  });

  it("holds at most 6 drinks, and builds up no progress while full", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    letRainFall(game);

    barrel.rainBarrel = { held: RAIN_BARREL_DRINK_LIMIT - 1, progress: 0.9 };

    send(game, { type: "skipTime", hours: 2 });
    expect(barrel.rainBarrel).toEqual({ held: RAIN_BARREL_DRINK_LIMIT, progress: 0 });

    drink(game, barrel);
    send(game, { type: "skipTime", hours: 1 });
    expect(barrel.rainBarrel.held).toBe(RAIN_BARREL_DRINK_LIMIT - 1);
    expect(barrel.rainBarrel.progress).toBeCloseTo(0.5, 2);
  });

  it("catches nothing under a roof, where rain would not fall on the player", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    const { x, z } = barrel.position;
    game.entities.add({ roof: { min: { x: x - 1, z: z - 1 }, max: { x: x + 1, z: z + 1 } } });
    letRainFall(game);

    send(game, { type: "skipTime", hours: 6 });

    expect(barrel.rainBarrel).toEqual({ held: 0, progress: 0 });
  });

  it("never lets its water go bad", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    barrel.rainBarrel = { held: 3, progress: 0 };
    stopRain(game);

    // The player may collapse in the cold of the nights. Time runs on all the same.
    send(game, { type: "skipTime", hours: 24 * 3 });

    expect(barrel.rainBarrel.held).toBe(3);
  });
});

describe("the rain barrel's panel", () => {
  it("shows its drinks out of 6 while the player stands beside it", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    barrel.rainBarrel = { held: 2, progress: 0.3 };
    game.step();

    expect(nearbyOf(game.client.getView(), "rainBarrel")).toEqual({ id: idOf(game, barrel), drinks: 2, limit: 6, underRoof: false });
  });

  it("says when it stands under a roof", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    const { x, z } = barrel.position;
    game.entities.add({ roof: { min: { x: x - 1, z: z - 1 }, max: { x: x + 1, z: z + 1 } } });
    game.step();

    expect(nearbyOf(game.client.getView(), "rainBarrel")?.underRoof).toBe(true);
  });
});

describe("drinking from a rain barrel", () => {
  it("fills thirst completely, takes out 1 drink, and never makes the player sick", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    barrel.rainBarrel = { held: 2, progress: 0.4 };
    onlyPlayer(game).needs.thirst.level = 0.2;

    drink(game, barrel);

    expect(onlyPlayer(game).needs.thirst.level).toBeCloseTo(FULL_NEED, 2);
    expect(onlyPlayer(game).sickness).toBeUndefined();
    expect(barrel.rainBarrel).toEqual({ held: 1, progress: 0.4 });
  });

  it("walks the player within reach first", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game, 8);
    send(game, place("rainBarrel", square.x, square.z, 0));
    const barrel = blueprintOf(game, "rainBarrel");
    buildFully(game, barrel);
    walkTo(game, { x: square.x + 6, z: square.z });
    barrel.rainBarrel = { held: 1, progress: 0 };
    onlyPlayer(game).needs.thirst.level = 0.2;

    send(game, { type: "drinkFromRainBarrel", barrelId: idOf(game, barrel) });
    stepUntil(game, () => barrel.rainBarrel?.held === 0);

    const { x, z } = onlyPlayer(game).position;
    expect(Math.hypot(x - square.x, z - square.z)).toBeLessThan(2.5);
    expect(onlyPlayer(game).needs.thirst.level).toBeCloseTo(FULL_NEED, 2);
  });

  it("is refused while the barrel is empty", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    onlyPlayer(game).needs.thirst.level = 0.2;
    const command: Command = { type: "drinkFromRainBarrel", barrelId: idOf(game, barrel) };

    expect(game.client.refusal(command)).toEqual({ kind: "barrelEmpty" });
    send(game, command);
    runSeconds(game, 3);
    expect(onlyPlayer(game).needs.thirst.level).toBeLessThan(0.21);
  });
});

describe("filling the pot from a rain barrel", () => {
  it("turns the empty pot into a pot of clean water and takes out 1 drink", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    barrel.rainBarrel = { held: 3, progress: 0 };

    send(game, { type: "fillPotFromRainBarrel", barrelId: idOf(game, barrel) });
    finishReach(game);

    expect(game.client.getView().backpack).toMatchObject({ pot: 0, potOfBoiledWater: 1 });
    expect(barrel.rainBarrel.held).toBe(2);
  });

  it("gives a pot the player can drink from safely", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    barrel.rainBarrel = { held: 1, progress: 0 };
    send(game, { type: "fillPotFromRainBarrel", barrelId: idOf(game, barrel) });
    finishReach(game);
    onlyPlayer(game).needs.thirst.level = 0.2;

    send(game, { type: "drinkFromPot" });

    expect(onlyPlayer(game).needs.thirst.level).toBeCloseTo(FULL_NEED, 2);
    expect(onlyPlayer(game).sickness).toBeUndefined();
    expect(game.client.getView().backpack).toMatchObject({ pot: 1 });
  });

  it("is refused while the barrel is empty, or the backpack holds no empty pot", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    const command: Command = { type: "fillPotFromRainBarrel", barrelId: idOf(game, barrel) };

    expect(game.client.refusal(command)).toEqual({ kind: "barrelEmpty" });

    barrel.rainBarrel = { held: 2, progress: 0 };
    const backpack = onlyPlayer(game).backpack;
    delete backpack.contents.pot;
    backpack.contents.potOfRiverWater = 1;
    expect(game.client.refusal(command)).toEqual({ kind: "noEmptyPot" });

    send(game, command);
    finishReach(game);
    expect(barrel.rainBarrel.held).toBe(2);
  });
});

describe("filling a jug from a rain barrel", () => {
  it("pours 1 drink from the barrel into a jug", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    barrel.rainBarrel = { held: 3, progress: 0 };
    onlyPlayer(game).backpack.contents.jug = 1;

    send(game, { type: "fillJugFromRainBarrel", barrelId: idOf(game, barrel) });
    finishReach(game);

    expect(game.client.getView().backpack).toMatchObject({ jugWith1Drink: 1 });
    expect(game.client.getView().backpack.jug ?? 0).toBe(0);
    expect(barrel.rainBarrel.held).toBe(2);
  });

  it("fills the fullest jug that still has room", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    barrel.rainBarrel = { held: 3, progress: 0 };
    Object.assign(onlyPlayer(game).backpack.contents, { jug: 1, jugWith1Drink: 1, jugWith3Drinks: 1 });

    send(game, { type: "fillJugFromRainBarrel", barrelId: idOf(game, barrel) });
    finishReach(game);

    const view = game.client.getView().backpack;
    expect(view).toMatchObject({ jug: 1, jugWith2Drinks: 1, jugWith3Drinks: 1 });
    expect(view.jugWith1Drink ?? 0).toBe(0);
  });

  it("fills a jug up to 3 drinks, then refuses because every jug is full", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    barrel.rainBarrel = { held: 5, progress: 0 };
    onlyPlayer(game).backpack.contents.jug = 1;
    const command: Command = { type: "fillJugFromRainBarrel", barrelId: idOf(game, barrel) };

    for (let fill = 0; fill < 3; fill += 1) {
      send(game, command);
      finishReach(game);
    }

    expect(game.client.getView().backpack).toMatchObject({ jugWith3Drinks: 1 });
    expect(barrel.rainBarrel.held).toBe(2);
    expect(game.client.refusal(command)).toEqual({ kind: "noJugWithRoom" });
    send(game, command);
    finishReach(game);
    expect(barrel.rainBarrel.held).toBe(2);
  });

  it("is refused while the barrel is empty, or the backpack holds no jug", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    onlyPlayer(game).backpack.contents.jug = 1;
    const command: Command = { type: "fillJugFromRainBarrel", barrelId: idOf(game, barrel) };

    expect(game.client.refusal(command)).toEqual({ kind: "barrelEmpty" });

    barrel.rainBarrel = { held: 2, progress: 0 };
    delete onlyPlayer(game).backpack.contents.jug;
    expect(game.client.refusal(command)).toEqual({ kind: "noJug" });
  });

  it("leaves the jug and the barrel as they were when the heavier jug does not fit in the backpack", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    barrel.rainBarrel = { held: 2, progress: 0 };
    const backpack = onlyPlayer(game).backpack;
    backpack.contents.jug = 1;
    while (addToBackpack(backpack, "stone", 1));

    send(game, { type: "fillJugFromRainBarrel", barrelId: idOf(game, barrel) });
    finishReach(game);

    expect(game.client.getView().backpack).toMatchObject({ jug: 1 });
    expect(barrel.rainBarrel.held).toBe(2);
  });
});

describe("saving rain barrels", () => {
  it("raises the save version for rain barrels, and loads a save from before then", () => {
    const game = createGame({ seed: 42 });
    expect(RAIN_BARRELS_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number };
    save.version = RAIN_BARRELS_SAVE_VERSION - 1;

    expect(readSave(save).ok).toBe(true);
  });

  it("keeps a barrel's spot, facing, drinks, and progress toward the next drink", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("rainBarrel", square.x, square.z, 3));
    const barrel = blueprintOf(game, "rainBarrel");
    buildFully(game, barrel);
    barrel.rainBarrel = { held: 4, progress: 0.25 };

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    const [saved] = piecesOf(loaded.game.entities, "rainBarrel");
    expect(saved?.position).toMatchObject({ x: square.x, z: square.z });
    expect(saved?.facing).toEqual({ turns: 3 });
    expect(saved?.rainBarrel).toEqual({ held: 4, progress: 0.25 });
    expect(isWalkable(loaded.game.walkMap, square)).toBe(false);
  });

  it("turns away a barrel whose water has the wrong shape", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    barrel.rainBarrel = { held: 4, progress: 0.25 };
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { entities: { components: Record<string, unknown> }[] };
    const saved = save.entities.find(({ components }) => components.furniture === "rainBarrel");
    if (saved === undefined) throw new Error("No saved barrel");
    saved.components.rainBarrel = { held: -1, progress: 0.25 };

    expect(readSave(save).ok).toBe(false);
  });
});

/**
 * Makes rain fall from now on, without stopping. A small roof over the player keeps them dry, so the cold of the rain
 * does not make them collapse while time is skipped. It stops short of any barrel beside them.
 */
function letRainFall(game: Game): void {
  const { x, z } = onlyPlayer(game).position;
  if (game.entities.with("roof").size === 0) game.entities.add({ roof: { min: { x: x - 0.5, z: z - 0.5 }, max: { x: x + 0.5, z: z + 0.5 } } });
  const rain = rainEntities(game.entities).first?.rain;
  if (rain === undefined) throw new Error("No weather");
  rain.falling = true;
  rain.changeAtMinutes = game.progress().clockMinutes + 1_000_000;
}

/** Stops rain from now on, without starting again. */
function stopRain(game: Game): void {
  const rain = rainEntities(game.entities).first?.rain;
  if (rain === undefined) throw new Error("No weather");
  rain.falling = false;
  rain.changeAtMinutes = game.progress().clockMinutes + 1_000_000;
}

/** Drinks from the barrel beside the player, once the reach is done. */
function drink(game: Game, barrel: Entity): void {
  send(game, { type: "drinkFromRainBarrel", barrelId: idOf(game, barrel) });
  finishReach(game);
}

/** Builds a rain barrel on open ground 2 m from the player, so the player stands within reach of it. */
function finishedBarrelNearPlayer(game: Game) {
  const square = openSquareNearPlayer(game, 2);
  send(game, place("rainBarrel", square.x, square.z, 0));
  const barrel = blueprintOf(game, "rainBarrel");
  buildFully(game, barrel);
  return barrel;
}

function walkTo(game: Game, to: { x: number; z: number }): void {
  send(game, { type: "walkTo", x: to.x, z: to.z });
  stepUntil(game, () => game.entities.with("player", "walkPath").first === undefined);
}

/** Gives the player the planks a blueprint still needs and holds the build action until it is finished. */
function buildFully(game: Game, blueprint: Entity): void {
  const contents = onlyPlayer(game).backpack.contents;
  for (const { material, has, needs } of game.client.describeBlueprint(idOf(game, blueprint))?.deliveries ?? []) {
    if (material === "plank") contents.plank = (contents.plank ?? 0) + needs - has;
  }
  while (blueprint.blueprint !== undefined) {
    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => blueprint.blueprint === undefined || game.client.getView().action === null);
  }
}

/** The middle of a building-grid square a few metres from the player, with open ground all round it. */
function openSquareNearPlayer(game: Game, from = 3): { x: number; z: number } {
  const player = onlyPlayer(game);
  for (let distance = from; distance < 30; distance += 1) {
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
      [1, 1],
      [1, -1],
    ] as const) {
      const square = { x: Math.floor(player.position.x + dx * distance) + 0.5, z: Math.floor(player.position.z + dz * distance) + 0.5 };
      const open = [-3, -2, -1, 0, 1, 2, 3].every((ax) =>
        [-3, -2, -1, 0, 1, 2, 3].every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })),
      );
      if (open) return square;
    }
  }
  throw new Error("No open square");
}

function place(structure: StructureKind, x: number, z: number, turns: 0 | 1 | 2 | 3): Command {
  return { type: "placeBlueprint", structure, turns, x, z };
}

function blueprintOf(game: Game, structure: StructureKind): Entity & { position: NonNullable<Entity["position"]> } {
  const blueprint = game.entities.with("blueprint", "position").entities.find((entity) => entity.blueprint.structure === structure);
  if (blueprint === undefined) throw new Error(`No ${structure} blueprint`);
  return blueprint;
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
  const player = game.entities.with("player", "position", "backpack", "needs", "respawnPoint").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
