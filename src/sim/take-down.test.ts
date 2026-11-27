import { describe, expect, it } from "bun:test";
import { BACKPACK_WEIGHT_LIMIT_KG, CONTENT_WEIGHT_KG } from "./backpack";
import { createGame, STEPS_PER_SECOND } from "./game";
import { LEAN_TO_BARK_COST, LEAN_TO_BUILD_SECONDS, LEAN_TO_STICK_COST } from "./structure-camp";
import { LOG_WALL_LOG_COST } from "./structure-cabin-shell";
import { isUnderRoof } from "./roofs";
import { readSave, writeSave } from "./save";
import { isWalkable } from "./walk-map";
import {
  finishedPieceAt,
  walkTo,
  nearestTree,
  finishedLeanTo,
  fillBackpackUntilFree,
  openLeanToSpot,
  give,
  debarkedLogsOnGround,
  deliverLog,
  finishedFoundationAt,
  openSquareNearPlayer,
  place,
  onlyBlueprint,
  send,
  stepUntil,
  runSeconds,
  onlyPlayer,
  idOf,
} from "./take-down-test-helpers";

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
    stepUntil(game, () => game.entities.with("player", "buildTask").first === undefined && game.entities.with("player", "approach").first === undefined);
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

  it("lays the bark that does not fit on the ground, where the player can pick it up again", () => {
    const game = createGame({ seed: 42 });
    const leanTo = finishedLeanTo(game);
    // Room for all but two pieces of bark, and no sticks.
    fillBackpackUntilFree(game, BACKPACK_WEIGHT_LIMIT_KG - (LEAN_TO_BARK_COST - 2) * CONTENT_WEIGHT_KG.bark);

    send(game, { type: "takeDown", pieceId: idOf(game, leanTo) });
    stepUntil(game, () => !game.entities.has(leanTo));

    expect(onlyPlayer(game).backpack.contents.bark).toBe(LEAN_TO_BARK_COST - 2);
    const lyingBark = game.entities.with("bark", "position").entities;
    expect(lyingBark).toHaveLength(2);

    // With room again, a click on the bark puts it back in the backpack.
    onlyPlayer(game).backpack.contents.firewood = 0;
    for (const bark of [...lyingBark]) {
      send(game, { type: "pickUpBark", barkId: idOf(game, bark) });
      stepUntil(game, () => !game.entities.has(bark));
    }
    expect(onlyPlayer(game).backpack.contents.bark).toBe(LEAN_TO_BARK_COST);
  });

  it("keeps bark it cannot pick up on the ground, with a notice", () => {
    const game = createGame({ seed: 42 });
    const { position } = onlyPlayer(game);
    const bark = game.entities.add({ bark: true, position: { x: position.x + 1, y: position.y, z: position.z } });
    fillBackpackUntilFree(game, BACKPACK_WEIGHT_LIMIT_KG);

    send(game, { type: "pickUpBark", barkId: idOf(game, bark) });
    runSeconds(game, 2);

    expect(game.client.getView().notice?.kind).toBe("backpackFull");
    expect(game.entities.has(bark)).toBe(true);
  });
});

describe("where given-back materials land", () => {
  it("stays on the player's side of a wall, on ground they can walk on", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    finishedPieceAt(game, "logWall", square, 3);
    send(game, place("logWall", square, 1));
    const blueprint = onlyBlueprint(game);
    for (let i = 0; i < LOG_WALL_LOG_COST; i += 1) deliverLog(game, blueprint);
    // Stand inside, close to the finished wall on the +x edge.
    walkTo(game, { x: square.x + 0.3, z: square.z });

    send(game, { type: "takeDown", pieceId: idOf(game, blueprint) });
    stepUntil(game, () => !game.entities.has(blueprint));

    const logs = game.entities.with("debarkedLog", "position").entities;
    expect(logs).toHaveLength(LOG_WALL_LOG_COST);
    for (const { position } of logs) {
      expect(isWalkable(game.walkMap, position)).toBe(true);
      expect(position.x).toBeLessThan(square.x + 0.5);
    }
  });
});
