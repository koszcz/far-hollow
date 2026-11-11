import { describe, expect, it } from "vitest";
import type { Command } from "./api";
import { BACKPACK_WEIGHT_LIMIT_KG, backpackWeight, CONTENT_WEIGHT_KG } from "./backpack";
import type { Entity } from "./entities";
import { foundationDeckTop } from "./foundations";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import {
  DOOR_FRAME_LOG_COST, FOUNDATION_BUILD_SECONDS, LEAN_TO_BARK_COST, LEAN_TO_BUILD_SECONDS, LEAN_TO_STICK_COST, LOG_WALL_BUILD_SECONDS, LOG_WALL_LOG_COST,
  ROOF_BARK_COST, ROOF_LOG_COST, type QuarterTurns, type StructureKind } from "./structures";
import { edgePieceOn } from "./edge-pieces";
import { cabinRoofOn, isUnderRoof } from "./roofs";
import { readSave, writeSave } from "./save";
import { isWalkable } from "./walk-map";

describe("taking down a blueprint", () => {
  it("removes it at once and lays every debarked log delivered to it on the ground", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("foundation", square, 0));
    const blueprint = onlyBlueprint(game);
    deliverLog(game, blueprint);
    deliverLog(game, blueprint);
    const logsBefore = debarkedLogsOnGround(game);

    send(game, { type: "takeDown", pieceId: idOf(game, blueprint) });
    stepUntil(game, () => !game.entities.has(blueprint));

    expect(game.client.getView().action).toBeNull();
    expect(debarkedLogsOnGround(game)).toBe(logsBefore + 2);
  });

  it("puts the sticks and bark construction has already spent back in the backpack", () => {
    const game = createGame({ seed: 42 });
    const spot = openLeanToSpot(game);
    send(game, place("leanTo", spot, 0));
    const blueprint = onlyBlueprint(game);
    give(game, "stick", LEAN_TO_STICK_COST);
    give(game, "bark", 2);
    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    // Build until every stick and the two pieces of bark are spent and construction waits for more bark.
    stepUntil(game, () => game.entities.with("player", "buildTask").first === undefined);
    expect(onlyPlayer(game).backpack.contents).toMatchObject({ stick: 0, bark: 0 });

    send(game, { type: "takeDown", pieceId: idOf(game, blueprint) });
    stepUntil(game, () => !game.entities.has(blueprint));

    expect(onlyPlayer(game).backpack.contents).toMatchObject({ stick: LEAN_TO_STICK_COST, bark: 2 });
  });
});

describe("taking down a foundation placed over a stump", () => {
  it("leaves the stump gone for good", () => {
    const game = createGame({ seed: 42 });
    const tree = nearestTree(game);
    send(game, { type: "chopTree", treeId: idOf(game, tree) });
    stepUntil(game, () => tree.stump === true);
    const { x, z } = tree.position;
    send(game, place("foundation", { x, z }, 0));
    const stumpsBefore = game.entities.with("stump").size;
    const blueprint = onlyBlueprint(game);

    send(game, { type: "takeDown", pieceId: idOf(game, blueprint) });
    stepUntil(game, () => !game.entities.has(blueprint));
    send(game, { type: "skipTime", hours: 24 * 5 });

    expect(game.entities.with("stump").size).toBe(stumpsBefore);
    expect(game.entities.has(tree)).toBe(false);
    expect(game.entities.with("tree", "position").entities.some((other) => other.position.x === x && other.position.z === z)).toBe(false);
    expect(isWalkable(game.walkMap, { x, z })).toBe(true);
  });
});

describe("saving while taking a piece down", () => {
  it("keeps the work done so far", () => {
    const game = createGame({ seed: 42 });
    const leanTo = finishedLeanTo(game);
    send(game, { type: "takeDown", pieceId: idOf(game, leanTo) });
    stepUntil(game, () => game.client.getView().action !== null);
    runSeconds(game, 2);
    const progress = game.client.getView().action?.progress ?? 0;

    const loaded = readSave(structuredClone(writeSave(game)));
    if (!loaded.ok) throw new Error("The save did not load");

    expect(loaded.game.client.getView().action?.kind).toBe("takeDown");
    expect(loaded.game.client.getView().action?.progress).toBeCloseTo(progress, 5);
  });
});

describe("taking down a finished lean-to", () => {
  it("is timed work, shorter than building it, that gives back every stick and piece of bark and frees its ground", () => {
    const game = createGame({ seed: 42 });
    const spot = openLeanToSpot(game);
    send(game, place("leanTo", spot, 0));
    const leanTo = onlyBlueprint(game);
    give(game, "stick", LEAN_TO_STICK_COST);
    give(game, "bark", LEAN_TO_BARK_COST);
    send(game, { type: "build", blueprintId: idOf(game, leanTo) });
    stepUntil(game, () => leanTo.blueprint === undefined);
    // Its back row blocks walking.
    const back = { x: spot.x - 0.5, z: spot.z - 0.5 };
    expect(isWalkable(game.walkMap, back)).toBe(false);

    send(game, { type: "takeDown", pieceId: idOf(game, leanTo) });
    stepUntil(game, () => game.client.getView().action !== null);
    expect(game.client.getView().action?.kind).toBe("takeDown");
    const started = game.client.getView().stepCount;
    stepUntil(game, () => !game.entities.has(leanTo));
    const seconds = (game.client.getView().stepCount - started) / STEPS_PER_SECOND;

    expect(seconds).toBeGreaterThan(1);
    expect(seconds).toBeLessThan(LEAN_TO_BUILD_SECONDS);
    expect(onlyPlayer(game).backpack.contents).toMatchObject({ stick: LEAN_TO_STICK_COST, bark: LEAN_TO_BARK_COST });
    expect(game.client.getView().action).toBeNull();
    expect(isWalkable(game.walkMap, back)).toBe(true);
    expect(isUnderRoof(game.entities, spot)).toBe(false);
  });

  it("stops when the player walks away, and leaves the lean-to standing", () => {
    const game = createGame({ seed: 42 });
    const spot = openLeanToSpot(game);
    send(game, place("leanTo", spot, 0));
    const leanTo = onlyBlueprint(game);
    give(game, "stick", LEAN_TO_STICK_COST);
    give(game, "bark", LEAN_TO_BARK_COST);
    send(game, { type: "build", blueprintId: idOf(game, leanTo) });
    stepUntil(game, () => leanTo.blueprint === undefined);

    send(game, { type: "takeDown", pieceId: idOf(game, leanTo) });
    stepUntil(game, () => game.client.getView().action !== null);
    send(game, { type: "walkTo", x: onlyPlayer(game).position.x + 3, z: onlyPlayer(game).position.z });
    runSeconds(game, LEAN_TO_BUILD_SECONDS);

    expect(game.entities.has(leanTo)).toBe(true);
    expect(leanTo.leanTo).toBe(true);
  });
});

describe("giving back materials when the backpack is full", () => {
  it("lays the sticks that do not fit on the ground", () => {
    const game = createGame({ seed: 42 });
    const leanTo = finishedLeanTo(game);
    // Room for all the bark and two sticks.
    fillBackpackUntilFree(game, BACKPACK_WEIGHT_LIMIT_KG - (LEAN_TO_BARK_COST * CONTENT_WEIGHT_KG.bark + 2 * CONTENT_WEIGHT_KG.stick));
    const sticksBefore = game.entities.with("stick").size;

    send(game, { type: "takeDown", pieceId: idOf(game, leanTo) });
    stepUntil(game, () => !game.entities.has(leanTo));

    expect(onlyPlayer(game).backpack.contents).toMatchObject({ stick: 2, bark: LEAN_TO_BARK_COST });
    expect(game.entities.with("stick").size).toBe(sticksBefore + LEAN_TO_STICK_COST - 2);
  });

  it("refuses, with a notice, when the bark would not fit", () => {
    const game = createGame({ seed: 42 });
    const leanTo = finishedLeanTo(game);
    fillBackpackUntilFree(game, BACKPACK_WEIGHT_LIMIT_KG - (LEAN_TO_BARK_COST - 1) * CONTENT_WEIGHT_KG.bark);

    send(game, { type: "takeDown", pieceId: idOf(game, leanTo) });
    expect(game.client.getView().notice).toBe("backpackFull");
    runSeconds(game, LEAN_TO_BUILD_SECONDS);

    expect(game.entities.has(leanTo)).toBe(true);
  });
});

describe("what holds up what", () => {
  it("keeps a foundation while a log wall or door frame stands on its edge, and lets it come down once the wall is gone", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const foundation = finishedFoundationAt(game, square);
    const wall = finishedPieceAt(game, "doorFrame", square, 0);

    send(game, { type: "takeDown", pieceId: idOf(game, foundation) });
    expect(game.client.getView().notice).toBe("holdsUpPiece");
    runSeconds(game, FOUNDATION_BUILD_SECONDS);
    expect(game.entities.has(foundation)).toBe(true);

    send(game, { type: "takeDown", pieceId: idOf(game, wall) });
    stepUntil(game, () => !game.entities.has(wall));
    send(game, { type: "takeDown", pieceId: idOf(game, foundation) });
    stepUntil(game, () => !game.entities.has(foundation));
  });

  it("keeps a foundation while a wall blueprint is placed on its edge", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const foundation = finishedFoundationAt(game, square);
    send(game, place("logWall", square, 1));

    send(game, { type: "takeDown", pieceId: idOf(game, foundation) });
    runSeconds(game, FOUNDATION_BUILD_SECONDS);

    expect(game.entities.has(foundation)).toBe(true);
  });

  it("keeps a foundation while a campfire stands on its square", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const foundation = finishedFoundationAt(game, square);
    game.entities.add({ campfire: { lit: false, fuelMinutes: 0 }, position: { ...foundation.position, x: square.x + 0.2 } });

    send(game, { type: "takeDown", pieceId: idOf(game, foundation) });
    runSeconds(game, FOUNDATION_BUILD_SECONDS);

    expect(game.entities.has(foundation)).toBe(true);
  });

  it("keeps a wall while a roof rests on it, and lets it come down once the roof is gone", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    const wall = finishedPieceAt(game, "logWall", square, 2);
    send(game, place("roof", square, 0));
    const roof = onlyBlueprint(game);

    // Even a roof that is still a blueprint rests on the wall.
    send(game, { type: "takeDown", pieceId: idOf(game, wall) });
    expect(game.client.getView().notice).toBe("holdsUpPiece");
    runSeconds(game, LOG_WALL_BUILD_SECONDS);
    expect(game.entities.has(wall)).toBe(true);

    send(game, { type: "takeDown", pieceId: idOf(game, roof) });
    stepUntil(game, () => !game.entities.has(roof));
    send(game, { type: "takeDown", pieceId: idOf(game, wall) });
    stepUntil(game, () => !game.entities.has(wall));
  });

  it("lets a roof come down, giving back its debarked logs and bark", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    finishedPieceAt(game, "logWall", square, 2);
    const roof = finishedRoofAt(game, square);
    const logsBefore = debarkedLogsOnGround(game);

    send(game, { type: "takeDown", pieceId: idOf(game, roof) });
    stepUntil(game, () => !game.entities.has(roof));

    expect(debarkedLogsOnGround(game)).toBe(logsBefore + ROOF_LOG_COST);
    expect(onlyPlayer(game).backpack.contents.bark).toBe(ROOF_BARK_COST);
    expect(cabinRoofOn(game.entities, square)).toBeUndefined();
  });

  it("frees the edge a log wall blocked", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    finishedFoundationAt(game, { x: square.x, z: square.z + 1 });
    const wall = finishedPieceAt(game, "logWall", square, 0);
    expect(edgePieceOn(game.entities, square, 0)).toBe("logWall");

    send(game, { type: "takeDown", pieceId: idOf(game, wall) });
    stepUntil(game, () => !game.entities.has(wall));

    expect(edgePieceOn(game.entities, square, 0)).toBeUndefined();
    walkTo(game, square);
    walkTo(game, { x: square.x, z: square.z + 1 });
    expect(onlyPlayer(game).position.z).toBeCloseTo(square.z + 1, 0);
  });
});

/** Places a wall or door frame blueprint and builds it through to the end, delivering every debarked log it needs. */
function finishedPieceAt(game: Game, structure: "logWall" | "doorFrame", square: { x: number; z: number }, turns: QuarterTurns): Entity {
  send(game, place(structure, square, turns));
  const blueprint = game.entities.with("blueprint", "position").entities.at(-1);
  if (blueprint?.blueprint.piece !== structure) throw new Error("The blueprint was not placed");
  const cost = structure === "logWall" ? LOG_WALL_LOG_COST : DOOR_FRAME_LOG_COST;
  for (let i = 0; i < cost; i += 1) deliverLog(game, blueprint);
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  const built: Entity = blueprint;
  stepUntil(game, () => built.blueprint === undefined);
  return blueprint;
}

/** Places a roof blueprint over a square and builds it through to the end. */
function finishedRoofAt(game: Game, square: { x: number; z: number }): Entity {
  send(game, place("roof", square, 0));
  const blueprint = game.entities.with("blueprint", "position").entities.at(-1);
  if (blueprint?.blueprint.piece !== "roof") throw new Error("The blueprint was not placed");
  for (let i = 0; i < ROOF_LOG_COST; i += 1) deliverLog(game, blueprint);
  give(game, "bark", ROOF_BARK_COST);
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  const built: Entity = blueprint;
  stepUntil(game, () => built.blueprint === undefined);
  return blueprint;
}

function walkTo(game: Game, to: { x: number; z: number }): void {
  send(game, { type: "walkTo", ...to });
  stepUntil(game, () => game.entities.with("player", "walkPath").first === undefined);
}

/** The standing tree nearest the player. */
function nearestTree(game: Game) {
  const { position } = onlyPlayer(game);
  const trees = game.entities.with("tree", "position").entities;
  const distance = (tree: (typeof trees)[number]) => Math.hypot(tree.position.x - position.x, tree.position.z - position.z);
  const nearest = [...trees].sort((a, b) => distance(a) - distance(b))[0];
  if (nearest === undefined) throw new Error("No trees");
  return nearest;
}

/** Builds a lean-to near the player. */
function finishedLeanTo(game: Game): Entity {
  const spot = openLeanToSpot(game);
  send(game, place("leanTo", spot, 0));
  const leanTo = onlyBlueprint(game);
  give(game, "stick", LEAN_TO_STICK_COST);
  give(game, "bark", LEAN_TO_BARK_COST);
  send(game, { type: "build", blueprintId: idOf(game, leanTo) });
  stepUntil(game, () => leanTo.blueprint === undefined);
  return leanTo;
}

/** Packs firewood, then spare knives, into the backpack until its contents weigh as close to `kilograms` as they can without going over. */
function fillBackpackUntilFree(game: Game, kilograms: number): void {
  const backpack = onlyPlayer(game).backpack;
  while (backpackWeight(backpack) + CONTENT_WEIGHT_KG.firewood <= kilograms + 1e-9) backpack.contents.firewood = (backpack.contents.firewood ?? 0) + 1;
  while (backpackWeight(backpack) + CONTENT_WEIGHT_KG.knife <= kilograms + 1e-9) backpack.contents.knife = (backpack.contents.knife ?? 0) + 1;
}

/** A spot near the player where a lean-to blueprint is allowed facing any way, with room to walk round it. */
function openLeanToSpot(game: Game): { x: number; z: number } {
  const player = onlyPlayer(game);
  for (let distance = 4; distance < 40; distance += 1) {
    for (const [dx, dz] of [[1, 0], [0, 1], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      const spot = { x: Math.round(player.position.x + dx * distance), z: Math.round(player.position.z + dz * distance) };
      const turns = [0, 1, 2, 3] as const;
      const roomy = [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]].every(([ax = 0, az = 0]) =>
        turns.every((turn) => game.client.checkPlacement("leanTo", { x: spot.x + ax, z: spot.z + az }, turn).allowed),
      );
      if (roomy) return spot;
    }
  }
  throw new Error("No open spot");
}

function give(game: Game, content: "stick" | "bark", count: number): void {
  const contents = onlyPlayer(game).backpack.contents;
  contents[content] = (contents[content] ?? 0) + count;
}

/** How many debarked logs lie on the ground. */
function debarkedLogsOnGround(game: Game): number {
  return game.entities.with("debarkedLog").size;
}

/** Puts a debarked log on the player's shoulder and carries it to a blueprint. */
function deliverLog(game: Game, blueprint: Entity): void {
  game.entities.addComponent(onlyPlayer(game), "carrying", "debarkedLog");
  send(game, { type: "deliverToBlueprint", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => game.client.getView().carrying === null);
}

/** Puts a finished foundation on a square, as if the player had built it. */
function finishedFoundationAt(game: Game, square: { x: number; z: number }) {
  const position = { x: square.x, y: foundationDeckTop(game.valley.terrain, square), z: square.z };
  return game.entities.add({ foundation: true, facing: { turns: 0 }, position });
}

/** The middle of a building-grid square a few metres from the player, with open ground two squares all round it. */
function openSquareNearPlayer(game: Game, from = 4): { x: number; z: number } {
  const player = onlyPlayer(game);
  for (let distance = from; distance < 30; distance += 1) {
    for (const [dx, dz] of [[1, 0], [0, 1], [0, -1], [-1, 0], [1, 1], [1, -1]] as const) {
      const square = { x: Math.floor(player.position.x + dx * distance) + 0.5, z: Math.floor(player.position.z + dz * distance) + 0.5 };
      const reach = [-2, -1, 0, 1, 2];
      const open = reach.every((ax) => reach.every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      if (open && game.client.checkPlacement("foundation", square, 0).allowed) return square;
    }
  }
  throw new Error("No open square");
}

function place(structure: StructureKind, at: { x: number; z: number }, turns: QuarterTurns): Command {
  return { type: "placeBlueprint", structure, turns, x: at.x, z: at.z };
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
  const player = game.entities.with("player", "position", "backpack", "needs").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
