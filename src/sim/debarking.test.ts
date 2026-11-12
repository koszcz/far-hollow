import { describe, expect, it } from "bun:test";
import { addToBackpack } from "./backpack";
import { BARK_PER_LOG, DEBARK_SECONDS } from "./debarking";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";

describe("debarking a log", () => {
  it("walks the player to a log on the ground, then works at it for a while", () => {
    const game = gameWithLogsOnGround();
    const log = farthestLogOnGround(game);

    game.client.send({ type: "debarkLog", logId: idOf(game, log) });
    stepUntil(game, () => game.client.getView().action?.kind === "debark");

    const player = onlyPlayer(game);
    expect(Math.hypot(player.position.x - log.position.x, player.position.z - log.position.z)).toBeLessThan(2);
    runSeconds(game, DEBARK_SECONDS / 2);
    expect(log.log).toBeDefined();
    expect(game.client.getView().action?.progress).toBeCloseTo(0.5, 1);
  });

  it("turns the log into one debarked log and puts its bark in the backpack", () => {
    const game = gameWithLogsOnGround();
    const log = farthestLogOnGround(game);
    const logsBefore = game.entities.with("log").size;
    const spot = { x: log.position.x, z: log.position.z };

    debark(game, log);

    expect(game.entities.with("log").size).toBe(logsBefore - 1);
    const debarked = game.entities.with("debarkedLog", "position").entities;
    expect(debarked).toHaveLength(1);
    expect(debarked[0]?.position).toMatchObject(spot);
    expect(game.client.getView().backpack.bark).toBe(BARK_PER_LOG);
    expect(game.client.getView().action).toBeNull();
  });

  it("drains fatigue like other timed work", () => {
    const resting = gameWithLogsOnGround();
    const working = gameWithLogsOnGround();
    const log = farthestLogOnGround(working);
    working.client.send({ type: "debarkLog", logId: idOf(working, log) });
    stepUntil(working, () => working.client.getView().action?.kind === "debark");
    const restingStart = resting.client.getView().needs.fatigue;
    const workingStart = working.client.getView().needs.fatigue;

    runSeconds(resting, DEBARK_SECONDS * 0.9);
    runSeconds(working, DEBARK_SECONDS * 0.9);

    const restingDrop = restingStart - resting.client.getView().needs.fatigue;
    const workingDrop = workingStart - working.client.getView().needs.fatigue;
    expect(workingDrop).toBeGreaterThan(restingDrop);
  });

  it("does nothing without a drawknife", () => {
    const game = gameWithLogsOnGround();
    delete onlyPlayer(game).backpack?.contents.drawknife;
    const log = farthestLogOnGround(game);

    game.client.send({ type: "debarkLog", logId: idOf(game, log) });
    runSeconds(game, DEBARK_SECONDS * 4);

    expect(log.log).toBeDefined();
    expect(game.entities.with("debarkedLog").size).toBe(0);
  });

  it("does nothing to something that is not a log on the ground", () => {
    const game = gameWithLogsOnGround();
    const stump = game.entities.with("stump").first;
    if (stump === undefined) throw new Error("No stump");

    game.client.send({ type: "debarkLog", logId: idOf(game, stump) });
    runSeconds(game, DEBARK_SECONDS * 2);

    expect(game.entities.with("debarkedLog").size).toBe(0);
    expect(game.client.getView().action).toBeNull();
  });

  it("refuses, and says the backpack is full, when the bark would not fit", () => {
    const game = gameWithLogsOnGround();
    const backpack = onlyPlayer(game).backpack;
    if (backpack === undefined) throw new Error("No backpack");
    while (addToBackpack(backpack, "bark", 1));
    const log = farthestLogOnGround(game);

    game.client.send({ type: "debarkLog", logId: idOf(game, log) });
    game.step();
    expect(game.client.getView().notice?.kind).toBe("backpackFull");
    runSeconds(game, DEBARK_SECONDS * 4);

    expect(log.log).toBeDefined();
    expect(game.entities.with("debarkedLog").size).toBe(0);
  });

  it("stops when the player is sent to walk somewhere else", () => {
    const game = gameWithLogsOnGround();
    const log = farthestLogOnGround(game);
    game.client.send({ type: "debarkLog", logId: idOf(game, log) });
    stepUntil(game, () => game.client.getView().action !== null);

    const player = onlyPlayer(game);
    game.client.send({ type: "walkTo", x: player.position.x - 3, z: player.position.z });
    runSeconds(game, DEBARK_SECONDS * 2);

    expect(log.log).toBeDefined();
    expect(game.client.getView().action).toBeNull();
  });
});

describe("carrying a debarked log", () => {
  it("can be picked up, carried one at a time, and dropped, like a log", () => {
    const game = gameWithLogsOnGround();
    game.client.send({ type: "dropLog" });
    game.step();
    const log = farthestLogOnGround(game);
    debark(game, log);
    const debarked = game.entities.with("debarkedLog", "position").first;
    if (debarked === undefined) throw new Error("No debarked log");

    game.client.send({ type: "pickUpLog", logId: idOf(game, debarked) });
    stepUntil(game, () => game.client.getView().carrying !== null, STEPS_PER_SECOND * 20);
    expect(game.client.getView().carrying).toBe("debarkedLog");
    expect(game.entities.with("debarkedLog").size).toBe(0);

    // The shoulder is full, so another log stays on the ground.
    const other = farthestLogOnGround(game);
    game.client.send({ type: "pickUpLog", logId: idOf(game, other) });
    runSeconds(game, 20);
    expect(game.client.getView().carrying).toBe("debarkedLog");
    expect(other.log).toBeDefined();

    game.client.send({ type: "dropLog" });
    game.step();
    expect(game.client.getView().carrying).toBeNull();
    expect(game.entities.with("debarkedLog", "position").size).toBe(1);
  });

  it("cannot be split into firewood", () => {
    const game = gameWithLogsOnGround();
    game.client.send({ type: "dropLog" });
    game.step();
    const log = farthestLogOnGround(game);
    debark(game, log);
    const debarked = game.entities.with("debarkedLog", "position").first;
    if (debarked === undefined) throw new Error("No debarked log");
    game.client.send({ type: "pickUpLog", logId: idOf(game, debarked) });
    stepUntil(game, () => game.client.getView().carrying !== null, STEPS_PER_SECOND * 20);

    game.client.send({ type: "splitLog" });
    runSeconds(game, 10);

    expect(game.client.getView().carrying).toBe("debarkedLog");
    expect(game.client.getView().backpack.firewood).toBeUndefined();
  });
});

/** A new game where the player has felled the nearest tree. They carry one log, and the rest lie on the ground. */
function gameWithLogsOnGround(): Game {
  const game = createGame({ seed: 42 });
  const player = onlyPlayer(game);
  const trees = [...game.entities.with("tree", "position")];
  const distance = (tree: (typeof trees)[number]) => Math.hypot(tree.position.x - player.position.x, tree.position.z - player.position.z);
  const tree = trees.sort((a, b) => distance(a) - distance(b))[0];
  if (tree === undefined) throw new Error("No trees");
  game.client.send({ type: "chopTree", treeId: idOf(game, tree) });
  stepUntil(game, () => tree.stump === true);
  return game;
}

function debark(game: Game, log: Entity): void {
  game.client.send({ type: "debarkLog", logId: idOf(game, log) });
  stepUntil(game, () => log.log === undefined);
}

function farthestLogOnGround(game: Game) {
  const player = onlyPlayer(game);
  const logs = [...game.entities.with("log", "position")];
  const distance = (log: (typeof logs)[number]) => Math.hypot(log.position.x - player.position.x, log.position.z - player.position.z);
  const farthest = logs.sort((a, b) => distance(b) - distance(a))[0];
  if (farthest === undefined) throw new Error("No log on the ground");
  return farthest;
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
