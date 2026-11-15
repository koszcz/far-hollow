import { describe, expect, it } from "bun:test";
import type { Command, StructureKind } from "./api";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { BEDS_SAVE_VERSION, readSave, SAVE_VERSION, SHELVES_SAVE_VERSION, writeSave } from "./save";
import { BED_BUILD_SECONDS, BED_PLANK_COST } from "./furniture/bed";
import { isWalkable } from "./walk-map";
import { piecesOf } from "./test-steps";

describe("the bed in the build menu", () => {
  it("lists the bed as furniture, with its cost of 8 planks and no tool", () => {
    const game = createGame({ seed: 42 });

    expect(BED_PLANK_COST).toBe(8);
    expect(game.client.getView().buildMenu).toContainEqual({
      structure: "bed",
      cost: [{ material: "plank", count: 8 }],
      placement: "anywhere",
    });
  });
});

describe("placing a bed", () => {
  it("goes exactly where the mouse points, off the building grid, facing the way the player turned it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const at = { x: square.x + 0.13, z: square.z - 0.27 };

    const check = game.client.checkPlacement("bed", at, 1);
    expect(check.allowed).toBe(true);
    expect(check.spot).toMatchObject({ x: at.x, z: at.z });

    send(game, place("bed", at.x, at.z, 1));
    const blueprint = onlyBlueprint(game);
    expect(blueprint.blueprint).toMatchObject({ structure: "bed", progress: 0, materialsSpent: 0, delivered: {} });
    expect(blueprint.position).toMatchObject({ x: at.x, z: at.z });
    expect(blueprint.facing).toEqual({ turns: 1 });
  });

  it("covers 1 m by 2 m, along z when facing the default way and along x when turned a quarter", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("bed", square.x, square.z, 0));
    // A spot 1.5 m along z overlaps the first bed. The same spot along x is clear of it.
    expect(game.client.checkPlacement("bed", { x: square.x, z: square.z + 1.5 }, 0).allowed).toBe(false);
    expect(game.client.checkPlacement("bed", { x: square.x + 1.5, z: square.z }, 0).allowed).toBe(true);
    // Turned a quarter, a bed 1.2 m along x reaches back over the first one.
    expect(game.client.checkPlacement("bed", { x: square.x + 1.2, z: square.z }, 1).allowed).toBe(false);
  });
});

describe("where a bed cannot go", () => {
  it("refuses a spot over a standing tree", () => {
    const game = createGame({ seed: 42 });
    const tree = game.entities.with("tree", "position").first;
    if (tree === undefined) throw new Error("No tree");

    expect(game.client.checkPlacement("bed", { x: tree.position.x + 0.3, z: tree.position.z }, 0).allowed).toBe(false);
  });

  it("refuses to overlap a structure, such as a foundation blueprint or a campfire", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("foundation", square.x, square.z, 0));
    send(game, place("campfire", square.x + 3, square.z, 0));

    expect(game.client.checkPlacement("bed", { x: square.x + 0.6, z: square.z }, 0).allowed).toBe(false);
    expect(game.client.checkPlacement("bed", { x: square.x + 3, z: square.z + 0.6 }, 0).allowed).toBe(false);
  });

  it("refuses to overlap other furniture, finished or as a blueprint, and stops furniture going over it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("chest", square.x, square.z, 0));
    expect(game.client.checkPlacement("bed", { x: square.x + 0.3, z: square.z + 0.5 }, 0).allowed).toBe(false);

    send(game, place("bed", square.x + 2, square.z, 0));
    buildFully(game, blueprintOf(game, "bed"));
    expect(piecesOf(game.entities, "bed").length).toBe(1);
    for (const structure of ["bed", "chest", "sled"] as const) {
      expect(game.client.checkPlacement(structure, { x: square.x + 2.2, z: square.z + 0.5 }, 0).allowed).toBe(false);
    }
    for (const structure of ["foundation", "campfire", "woodpile"] as const) {
      expect(game.client.checkPlacement(structure, { x: square.x + 2, z: square.z }, 0).allowed).toBe(false);
    }
  });
});

describe("building a bed", () => {
  it("takes its 8 planks over several trips, needs no tool, and shows its stages as it goes", () => {
    const game = createGame({ seed: 42 });
    const blueprint = bedBlueprintNearPlayer(game);
    const id = idOf(game, blueprint);
    const backpack = onlyPlayer(game).backpack.contents;
    delete backpack.axe;
    delete backpack.knife;
    delete backpack.drawknife;
    delete backpack.saw;
    expect(game.client.describeBlueprint(id)?.deliveries).toEqual([{ material: "plank", has: 0, needs: BED_PLANK_COST }]);

    // The first trip brings 5 planks. The bed takes them all, builds 5 of its 8 stages, and stops.
    backpack.plank = 5;
    send(game, { type: "build", blueprintId: id });
    runSeconds(game, BED_BUILD_SECONDS + 5);
    expect(backpack.plank ?? 0).toBe(0);
    expect(blueprint.blueprint).toMatchObject({ materialsSpent: 5, delivered: { plank: 5 } });
    expect(blueprint.blueprint?.progress).toBeCloseTo(5 / BED_PLANK_COST, 5);
    expect(game.client.getView().action).toBeNull();

    // The second trip brings the rest, and more. It takes only what it still needs.
    backpack.plank = 6;
    send(game, { type: "build", blueprintId: id });
    runSeconds(game, BED_BUILD_SECONDS + 5);
    expect(blueprint.blueprint).toBeUndefined();
    expect(blueprint.furniture).toBe("bed");
    expect(backpack.plank).toBe(3);
  });

  it("spends no planks in the playground", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const blueprint = bedBlueprintNearPlayer(game);
    onlyPlayer(game).backpack.contents.plank = 3;

    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    runSeconds(game, BED_BUILD_SECONDS + 5);

    expect(blueprint.furniture).toBe("bed");
    expect(onlyPlayer(game).backpack.contents.plank).toBe(3);
  });
});

describe("a finished bed", () => {
  it("blocks walking on the ground it covers, and not much past it", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("bed", square.x, square.z, 1));
    buildFully(game, blueprintOf(game, "bed"));

    // Turned a quarter, it runs 2 m along x and 1 m along z.
    for (const [dx, dz] of [
      [0, 0],
      [0.9, 0.4],
      [-0.9, -0.4],
      [0.9, -0.4],
      [-0.9, 0.4],
    ] as const) {
      expect(isWalkable(game.walkMap, { x: square.x + dx, z: square.z + dz })).toBe(false);
    }
    expect(isWalkable(game.walkMap, { x: square.x, z: square.z + 1.2 })).toBe(true);
    expect(isWalkable(game.walkMap, { x: square.x + 1.7, z: square.z })).toBe(true);
  });
});

describe("sleeping in a bed", () => {
  it("by day restores fatigue twice as fast as a bedroll, in 2 hours from half", () => {
    const game = createGame({ seed: 42 });
    const bed = finishedBedNearPlayer(game);
    onlyPlayer(game).needs.fatigue.level = 0.5;
    const before = game.client.getView().time;

    send(game, { type: "sleepInBed", bedId: idOf(game, bed) });
    stepUntil(game, () => game.client.getView().lastSleep !== null);

    // A bedroll in the open restores 1/8 of fatigue an hour, so half takes 4 hours there.
    const view = game.client.getView();
    expect(view.needs.fatigue).toBeCloseTo(1, 3);
    expect(minutesOfDay(view.time) - minutesOfDay(before)).toBeCloseTo(120, -1);
  });

  it("under a roof restores fatigue three times as fast as a bedroll in the open", () => {
    const game = createGame({ seed: 42 });
    const bed = finishedBedNearPlayer(game);
    // A cabin roof over the bed and the ground round it.
    const { x, z } = bed.position;
    game.entities.add({ cabinRoof: true, roof: { min: { x: x - 3, z: z - 3 }, max: { x: x + 3, z: z + 3 } } });
    onlyPlayer(game).needs.fatigue.level = 0.5;
    const before = game.client.getView().time;

    send(game, { type: "sleepInBed", bedId: idOf(game, bed) });
    stepUntil(game, () => game.client.getView().lastSleep !== null);

    const view = game.client.getView();
    expect(view.needs.fatigue).toBeCloseTo(1, 3);
    expect(minutesOfDay(view.time) - minutesOfDay(before)).toBeCloseTo(80, -1);
  });

  it("at night sleeps until morning, as on a bedroll", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const bed = finishedBedNearPlayer(game);
    send(game, { type: "placeBlueprint", structure: "campfire", turns: 0, x: bed.position.x + 2, z: bed.position.z });
    send(game, { type: "skipTime", hours: 14 }); // 22:00.

    send(game, { type: "sleepInBed", bedId: idOf(game, bed) });
    stepUntil(game, () => game.client.getView().lastSleep !== null);

    expect(game.client.getView().time).toMatchObject({ day: 2, hour: 6, minute: 0 });
  });

  it("in the evening sleeps on until morning rather than waking in the night", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const bed = finishedBedNearPlayer(game);
    send(game, { type: "placeBlueprint", structure: "campfire", turns: 0, x: bed.position.x + 2, z: bed.position.z });
    send(game, { type: "skipTime", hours: 10 }); // 18:00, before night falls.
    onlyPlayer(game).needs.fatigue.level = 0.2;

    send(game, { type: "sleepInBed", bedId: idOf(game, bed) });
    stepUntil(game, () => game.client.getView().lastSleep !== null);

    // Restoring fatigue alone would take about 3 hours and wake the player at 21:00, in the night.
    expect(game.client.getView().time).toMatchObject({ day: 2, hour: 6, minute: 0 });
  });

  it("walks the player to the bed first, and reports the sleep with where the bed stands and which way it faces", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game, 8);
    send(game, place("bed", square.x, square.z, 3));
    const bed = blueprintOf(game, "bed");
    buildFully(game, bed);
    walkTo(game, { x: square.x + 6, z: square.z });
    expect(game.client.getView().lastSleep).toBeNull();

    send(game, { type: "sleepInBed", bedId: idOf(game, bed) });
    stepUntil(game, () => game.client.getView().lastSleep !== null);

    expect(game.client.getView().lastSleep).toEqual({ count: 1, at: { x: square.x, z: square.z }, bed: { turns: 3 } });
  });

  it("makes the spot where the bed stands the respawn point, and taking the bed down leaves it there", () => {
    const game = createGame({ seed: 42 });
    const bed = finishedBedNearPlayer(game);
    const bedAt = { x: bed.position.x, z: bed.position.z };

    send(game, { type: "sleepInBed", bedId: idOf(game, bed) });
    stepUntil(game, () => game.client.getView().lastSleep !== null);
    expect(onlyPlayer(game).respawnPoint).toEqual(bedAt);

    send(game, { type: "takeDown", pieceId: idOf(game, bed) });
    stepUntil(game, () => piecesOf(game.entities, "bed").length === 0);
    expect(onlyPlayer(game).respawnPoint).toEqual(bedAt);
  });

  it("wakes the player beside the bed after a collapse, not inside it", () => {
    const game = createGame({ seed: 42 });
    const bed = finishedBedNearPlayer(game);
    send(game, { type: "sleepInBed", bedId: idOf(game, bed) });
    stepUntil(game, () => game.client.getView().lastSleep !== null);
    walkTo(game, { x: bed.position.x + 12, z: bed.position.z });

    // A night with no fire is too cold to get through.
    send(game, { type: "skipTime", hours: 30 });

    const view = game.client.getView();
    expect(view.notice?.kind).toBe("collapsed");
    expect(Math.hypot(view.playerPosition.x - bed.position.x, view.playerPosition.z - bed.position.z)).toBeLessThan(2);
    expect(isWalkable(game.walkMap, view.playerPosition)).toBe(true);
  });

  it("is what E reaches, beside the player", () => {
    const game = createGame({ seed: 42 });
    const bed = finishedBedNearPlayer(game);

    expect(game.client.nearestInReach()).toEqual({ kind: "bed", id: idOf(game, bed) });
  });
});

describe("saving beds", () => {
  it("raises the save version for beds, and loads a save from before then", () => {
    const game = createGame({ seed: 42 });
    expect(BEDS_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    expect(BEDS_SAVE_VERSION).toBeGreaterThan(SHELVES_SAVE_VERSION);
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number };
    save.version = BEDS_SAVE_VERSION - 1;

    expect(readSave(save).ok).toBe(true);
  });

  it("keeps beds and bed blueprints, with which way they face and the planks a blueprint has had", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("bed", square.x, square.z, 1));
    buildFully(game, blueprintOf(game, "bed"));
    send(game, place("bed", square.x, square.z + 2, 2));
    blueprintOf(game, "bed").blueprint = { structure: "bed", progress: 0.25, materialsSpent: 2, delivered: { plank: 3 } };

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    const beds = piecesOf(loaded.game.entities, "bed");
    expect(beds.map(({ position, facing }) => ({ x: position.x, z: position.z, facing }))).toEqual([{ x: square.x, z: square.z, facing: { turns: 1 } }]);
    expect(isWalkable(loaded.game.walkMap, { x: square.x, z: square.z })).toBe(false);
    const blueprint = blueprintOf(loaded.game, "bed");
    expect(blueprint.blueprint).toEqual({ structure: "bed", progress: 0.25, materialsSpent: 2, delivered: { plank: 3 } });
    expect(blueprint.facing).toEqual({ turns: 2 });
  });
});

describe("a bed on a foundation", () => {
  it("holds the foundation up, so the foundation cannot be taken down under it", () => {
    // In the playground, so the foundations need no debarked logs.
    const game = createGame({ seed: 42, freeBuilding: true });
    const square = openSquareNearPlayer(game);
    send(game, place("foundation", square.x, square.z, 0));
    const foundation = blueprintOf(game, "foundation");
    buildFully(game, foundation);
    send(game, place("foundation", square.x, square.z + 1, 0));
    buildFully(game, blueprintOf(game, "foundation"));
    // Across both decks, so it stands on both.
    send(game, place("bed", square.x, square.z + 0.5, 0));
    buildFully(game, blueprintOf(game, "bed"));

    send(game, { type: "takeDown", pieceId: idOf(game, foundation) });
    expect(game.client.getView().notice?.kind).toBe("holdsUpPiece");
  });
});

describe("taking down a bed", () => {
  it("gives back every plank of a finished bed, in the backpack or in a pile beside it, and lets the player walk there again", () => {
    const game = createGame({ seed: 42 });
    const blueprint = bedBlueprintNearPlayer(game);
    buildFully(game, blueprint);
    const backpack = onlyPlayer(game).backpack.contents;
    backpack.plank = 0;

    send(game, { type: "takeDown", pieceId: idOf(game, blueprint) });
    stepUntil(game, () => piecesOf(game.entities, "bed").length === 0);

    // The backpack holds the tools too, so the planks that do not fit drop in a pile.
    const piled = game.entities.with("pile").entities.reduce((sum, { pile }) => sum + (pile.content === "plank" ? pile.count : 0), 0);
    expect((backpack.plank ?? 0) + piled).toBe(BED_PLANK_COST);
    expect(isWalkable(game.walkMap, blueprint.position)).toBe(true);
  });

  it("gives back the planks a bed blueprint has had so far", () => {
    const game = createGame({ seed: 42 });
    const blueprint = bedBlueprintNearPlayer(game);
    const backpack = onlyPlayer(game).backpack.contents;
    backpack.plank = 3;
    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    runSeconds(game, BED_BUILD_SECONDS + 5);
    expect(backpack.plank ?? 0).toBe(0);

    send(game, { type: "takeDown", pieceId: idOf(game, blueprint) });
    stepUntil(game, () => game.entities.with("blueprint").size === 0);

    expect(backpack.plank).toBe(3);
  });
});

/** Places a bed blueprint on open ground near the player, facing the default way. */
function bedBlueprintNearPlayer(game: Game) {
  const square = openSquareNearPlayer(game);
  send(game, place("bed", square.x + 0.1, square.z + 0.2, 0));
  return onlyBlueprint(game);
}

/** Builds a bed on open ground 2 m from the player, facing the default way, so the player stands beside it. */
function finishedBedNearPlayer(game: Game) {
  const square = openSquareNearPlayer(game, 2);
  send(game, place("bed", square.x, square.z, 0));
  const bed = blueprintOf(game, "bed");
  buildFully(game, bed);
  return bed;
}

/** How many game minutes into the game a time of day is. */
function minutesOfDay(time: { day: number; hour: number; minute: number }): number {
  return (time.day * 24 + time.hour) * 60 + time.minute;
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
  // The backpack may not hold them all at once, so the player keeps building until the blueprint has them all.
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

function onlyBlueprint(game: Game): Entity & { position: NonNullable<Entity["position"]> } {
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("No blueprint");
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
