import { describe, expect, it } from "vitest";
import type { BackpackContent, CarriedLog, Command } from "./api";
import { nearbyOf } from "./api";
import { CONTENT_WEIGHT_KG } from "./backpack";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { readSave, SAVE_VERSION, writeSave } from "./save";
import { isWalkable } from "./walk-map";

describe("building a woodpile", () => {
  it("is in the build menu, costs nothing, and takes a short construction", () => {
    const game = createGame({ seed: 42 });
    expect(game.client.getView().buildMenu).toContainEqual({ structure: "woodpile", cost: [], placement: "onGround" });
    const backpackBefore = { ...game.client.getView().backpack };

    const woodpile = buildWoodpile(game);

    expect(woodpile.woodpile).toEqual({ log: 0, debarkedLog: 0, firewood: 0 });
    expect(game.client.getView().backpack).toEqual(backpackBefore);
  });

  it("snaps to the building grid, like a campfire", () => {
    const game = createGame({ seed: 42 });
    const spot = openSpotNearPlayer(game);

    const check = game.client.checkPlacement("woodpile", { x: spot.x + 0.3, z: spot.z - 0.2 }, 0);

    expect(check).toMatchObject({ spot: { x: spot.x, z: spot.z }, allowed: true });
  });
});

describe("a finished woodpile", () => {
  it("blocks walking on the ground it covers", () => {
    const game = createGame({ seed: 42 });
    const woodpile = buildWoodpile(game);
    walkAway(game);

    // A woodpile sits on a grid point, where four walk-map cells meet. It covers a corner of each.
    for (const [dx, dz] of [[0.25, 0.25], [-0.25, 0.25], [0.25, -0.25], [-0.25, -0.25]] as const) {
      expect(isWalkable(game.walkMap, { x: woodpile.position.x + dx, z: woodpile.position.z + dz })).toBe(false);
    }
  });
});

describe("stacking wood on a woodpile", () => {
  it("walks the player to a woodpile they click, and shows it as the nearby woodpile", () => {
    const game = createGame({ seed: 42 });
    const woodpile = buildWoodpile(game);
    walkAway(game);
    expect(nearbyOf(game.client.getView(), "woodpile")).toBeNull();

    tend(game, woodpile);

    expect(nearbyOf(game.client.getView(), "woodpile")).toEqual({
      id: idOf(game, woodpile), contents: { log: 0, debarkedLog: 0, firewood: 0 }, total: 0, capacity: 20,
    });
  });

  it("takes the log or debarked log off the player's shoulder", () => {
    const game = createGame({ seed: 42 });
    const woodpile = buildWoodpile(game);
    tend(game, woodpile);

    shoulder(game, "log");
    send(game, { type: "stackOnWoodpile", woodpileId: idOf(game, woodpile), wood: "log", all: false });
    shoulder(game, "debarkedLog");
    send(game, { type: "stackOnWoodpile", woodpileId: idOf(game, woodpile), wood: "debarkedLog", all: false });

    expect(woodpile.woodpile).toEqual({ log: 1, debarkedLog: 1, firewood: 0 });
    expect(game.client.getView().carrying).toBeNull();
    expect(nearbyOf(game.client.getView(), "woodpile")?.total).toBe(2);
  });

  it("stacks nothing when the player carries a different kind of log, or none", () => {
    const game = createGame({ seed: 42 });
    const woodpile = buildWoodpile(game);
    tend(game, woodpile);

    send(game, { type: "stackOnWoodpile", woodpileId: idOf(game, woodpile), wood: "log", all: false });
    shoulder(game, "debarkedLog");
    send(game, { type: "stackOnWoodpile", woodpileId: idOf(game, woodpile), wood: "log", all: false });

    expect(woodpile.woodpile).toEqual({ log: 0, debarkedLog: 0, firewood: 0 });
    expect(game.client.getView().carrying).toBe("debarkedLog");
  });

  it("moves one piece of firewood from the backpack with a click, and all of it with a shift-click", () => {
    const game = createGame({ seed: 42 });
    const woodpile = buildWoodpile(game);
    give(game, "firewood", 5);
    tend(game, woodpile);

    send(game, { type: "stackOnWoodpile", woodpileId: idOf(game, woodpile), wood: "firewood", all: false });
    expect(woodpile.woodpile.firewood).toBe(1);
    expect(game.client.getView().backpack.firewood).toBe(4);

    send(game, { type: "stackOnWoodpile", woodpileId: idOf(game, woodpile), wood: "firewood", all: true });
    expect(woodpile.woodpile.firewood).toBe(5);
    expect(game.client.getView().backpack.firewood).toBe(0);
  });

  it("does nothing when the player is out of reach", () => {
    const game = createGame({ seed: 42 });
    const woodpile = buildWoodpile(game);
    give(game, "firewood", 2);
    walkAway(game);

    send(game, { type: "stackOnWoodpile", woodpileId: idOf(game, woodpile), wood: "firewood", all: true });

    expect(woodpile.woodpile.firewood).toBe(0);
    expect(game.client.getView().backpack.firewood).toBe(2);
  });
});

describe("the woodpile's limit", () => {
  it("holds up to 20 pieces in any mix, and leaves the rest of the firewood in the backpack", () => {
    const game = createGame({ seed: 42 });
    const woodpile = buildWoodpile(game);
    woodpile.woodpile.log = 6;
    woodpile.woodpile.debarkedLog = 6;
    give(game, "firewood", 10);
    tend(game, woodpile);

    send(game, { type: "stackOnWoodpile", woodpileId: idOf(game, woodpile), wood: "firewood", all: true });

    expect(woodpile.woodpile).toEqual({ log: 6, debarkedLog: 6, firewood: 8 });
    expect(game.client.getView().backpack.firewood).toBe(2);
    expect(nearbyOf(game.client.getView(), "woodpile")?.total).toBe(20);
  });

  it("keeps the log on the player's shoulder when the woodpile is full", () => {
    const game = createGame({ seed: 42 });
    const woodpile = buildWoodpile(game);
    woodpile.woodpile.firewood = 20;
    tend(game, woodpile);
    shoulder(game, "log");

    send(game, { type: "stackOnWoodpile", woodpileId: idOf(game, woodpile), wood: "log", all: false });

    expect(woodpile.woodpile).toEqual({ log: 0, debarkedLog: 0, firewood: 20 });
    expect(game.client.getView().carrying).toBe("log");
  });
});

describe("taking wood off a woodpile", () => {
  it("puts a log or debarked log on the player's free shoulder", () => {
    const game = createGame({ seed: 42 });
    const woodpile = buildWoodpile(game);
    woodpile.woodpile.log = 2;
    woodpile.woodpile.debarkedLog = 1;
    tend(game, woodpile);

    send(game, { type: "takeFromWoodpile", woodpileId: idOf(game, woodpile), wood: "debarkedLog" });

    expect(game.client.getView().carrying).toBe("debarkedLog");
    expect(woodpile.woodpile).toEqual({ log: 2, debarkedLog: 0, firewood: 0 });
  });

  it("leaves the log on the woodpile when the player's shoulder is not free", () => {
    const game = createGame({ seed: 42 });
    const woodpile = buildWoodpile(game);
    woodpile.woodpile.log = 2;
    tend(game, woodpile);
    shoulder(game, "debarkedLog");

    send(game, { type: "takeFromWoodpile", woodpileId: idOf(game, woodpile), wood: "log" });

    expect(game.client.getView().carrying).toBe("debarkedLog");
    expect(woodpile.woodpile.log).toBe(2);
  });

  it("puts as much firewood in the backpack as fits, and leaves the rest", () => {
    const game = createGame({ seed: 42 });
    const woodpile = buildWoodpile(game);
    woodpile.woodpile.firewood = 20;
    tend(game, woodpile);
    const room = game.client.getView().backpackWeightLimit - game.client.getView().backpackWeight;
    const fits = Math.floor(room / CONTENT_WEIGHT_KG.firewood + 1e-9);

    send(game, { type: "takeFromWoodpile", woodpileId: idOf(game, woodpile), wood: "firewood" });

    expect(fits).toBeGreaterThan(0);
    expect(fits).toBeLessThan(20);
    expect(game.client.getView().backpack.firewood).toBe(fits);
    expect(woodpile.woodpile.firewood).toBe(20 - fits);
  });

  it("tells the player the backpack is full when no firewood fits", () => {
    const game = createGame({ seed: 42 });
    const woodpile = buildWoodpile(game);
    woodpile.woodpile.firewood = 3;
    give(game, "stick", 40);
    tend(game, woodpile);

    send(game, { type: "takeFromWoodpile", woodpileId: idOf(game, woodpile), wood: "firewood" });

    expect(woodpile.woodpile.firewood).toBe(3);
    expect(game.client.getView().notice?.kind).toBe("backpackFull");
  });
});

describe("what a woodpile does not do", () => {
  it("cannot fuel a campfire: firewood goes through the backpack first", () => {
    const game = createGame({ seed: 42 });
    const woodpile = buildWoodpile(game);
    woodpile.woodpile.firewood = 5;
    const campfire = game.entities.add({ campfire: { lit: false, fuelMinutes: 0 }, position: { ...woodpile.position, x: woodpile.position.x + 2 } });
    tend(game, woodpile);

    send(game, { type: "addFuel", campfireId: idOf(game, campfire), fuel: "firewood" });

    expect(campfire.campfire.fuelMinutes).toBe(0);
    expect(woodpile.woodpile.firewood).toBe(5);
  });

  it("keeps everything stacked on it through the rain", () => {
    const game = createGame({ seed: 42 });
    const woodpile = buildWoodpile(game);
    Object.assign(woodpile.woodpile, { log: 2, debarkedLog: 3, firewood: 4 });

    const rain = game.entities.with("rain").first?.rain;
    if (rain === undefined) throw new Error("No weather");
    Object.assign(rain, { falling: true, changeAtMinutes: Infinity });
    send(game, { type: "skipTime", hours: 2 });
    expect(game.client.getView().raining).toBe(true);

    expect(woodpile.woodpile).toEqual({ log: 2, debarkedLog: 3, firewood: 4 });
  });
});

describe("saving woodpiles", () => {
  it("restores woodpiles, what they hold, and a woodpile blueprint", () => {
    const game = createGame({ seed: 42 });
    const woodpile = buildWoodpile(game);
    Object.assign(woodpile.woodpile, { log: 1, debarkedLog: 2, firewood: 3 });
    const spot = openSpotNearPlayer(game);
    send(game, { type: "placeBlueprint", structure: "woodpile", turns: 1, x: spot.x, z: spot.z });
    expect(game.entities.with("blueprint").entities.map(({ blueprint }) => blueprint.structure)).toEqual(["woodpile"]);
    tend(game, woodpile);

    const saved = writeSave(game);
    const loaded = readSave(JSON.parse(JSON.stringify(saved)));
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(writeSave(loaded.game)).toEqual(saved);
    expect(nearbyOf(loaded.game.client.getView(), "woodpile")?.contents).toEqual({ log: 1, debarkedLog: 2, firewood: 3 });
  });

  it("turns away a save whose woodpile holds a broken count", () => {
    const game = createGame({ seed: 42 });
    buildWoodpile(game);
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { entities: { components: Record<string, unknown> }[] };
    for (const { components } of save.entities) if (components.woodpile !== undefined) components.woodpile = { log: -1, debarkedLog: 0, firewood: 0 };

    expect(readSave(save).ok).toBe(false);
  });

  it("loads a save from before woodpiles existed, with no woodpiles in it", () => {
    const game = createGame({ seed: 42 });
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number };
    // Version 9 is the last save version before woodpiles.
    save.version = 9;

    const loaded = readSave(save);
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(SAVE_VERSION).toBeGreaterThan(9);
    expect(writeSave(loaded.game)).toEqual(writeSave(game));
    expect(loaded.game.entities.with("woodpile").entities).toEqual([]);
  });
});

/** Places a woodpile blueprint near the player and builds it. The whole build takes only a few seconds. */
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

function tend(game: Game, woodpile: Entity): void {
  send(game, { type: "tendWoodpile", woodpileId: idOf(game, woodpile) });
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
}

function walkAway(game: Game): void {
  const player = onlyPlayer(game);
  send(game, { type: "walkTo", x: player.position.x - 15, z: player.position.z });
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
}

/** Puts a log or debarked log on the player's shoulder, as if they had picked it up. */
function shoulder(game: Game, log: CarriedLog): void {
  const player = onlyPlayer(game);
  if (player.carrying === undefined) game.entities.addComponent(player, "carrying", log);
  else player.carrying = log;
}

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

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
}

function give(game: Game, content: BackpackContent, count: number): void {
  const backpack = onlyPlayer(game).backpack;
  if (backpack === undefined) throw new Error("No backpack");
  backpack.contents[content] = (backpack.contents[content] ?? 0) + count;
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
