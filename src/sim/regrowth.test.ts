import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import { MINUTES_PER_DAY } from "./clock";
import type { Entity } from "./entities";
import { createGame, type Game } from "./game";
import { createNeeds } from "./needs";
import { readSave, REGROWTH_SAVE_VERSION, SAVE_VERSION, writeSave } from "./save";
import { finishReach } from "./test-steps";
import { grow, isBareStump, isSapling, isYoungTree, justFelled, STAGE_MINUTES, startOfStage } from "./tree-growth";
import { logsForTreeSize, treeSizeAt } from "./tree-size";
import { isWalkable } from "./walk-map";

describe("a tree's growth", () => {
  it("starts as a stump with a game day to go before the sapling shows", () => {
    expect(justFelled()).toEqual({ stage: "stump", minutesLeft: MINUTES_PER_DAY });
  });

  it("lasts 1 day as a stump, 2 as a sapling, and 3 as a young tree, 6 days in all", () => {
    expect(STAGE_MINUTES).toEqual({ stump: MINUTES_PER_DAY, sapling: 2 * MINUTES_PER_DAY, youngTree: 3 * MINUTES_PER_DAY });
  });

  it("counts down within a stage", () => {
    expect(grow(justFelled(), 60)).toEqual({ stage: "stump", minutesLeft: MINUTES_PER_DAY - 60 });
  });

  it("moves to the next stage when its time runs out, carrying over the extra time", () => {
    expect(grow(justFelled(), MINUTES_PER_DAY)).toEqual(startOfStage("sapling"));
    expect(grow(startOfStage("sapling"), 2 * MINUTES_PER_DAY + 30)).toEqual({ stage: "youngTree", minutesLeft: 3 * MINUTES_PER_DAY - 30 });
  });

  it("passes several stages in one long stretch, and is full grown after 6 days", () => {
    expect(grow(justFelled(), 3 * MINUTES_PER_DAY)).toEqual(startOfStage("youngTree"));
    expect(grow(justFelled(), 6 * MINUTES_PER_DAY - 1)).toEqual({ stage: "youngTree", minutesLeft: 1 });
    expect(grow(justFelled(), 6 * MINUTES_PER_DAY)).toBe("grown");
  });

  it("names each stage, and a full tree, which has no growth, as none of them", () => {
    expect([isBareStump, isSapling, isYoungTree].map((is) => is(justFelled()))).toEqual([true, false, false]);
    expect([isBareStump, isSapling, isYoungTree].map((is) => is(startOfStage("sapling")))).toEqual([false, true, false]);
    expect([isBareStump, isSapling, isYoungTree].map((is) => is(startOfStage("youngTree")))).toEqual([false, false, true]);
    expect([isBareStump, isSapling, isYoungTree].map((is) => is(undefined))).toEqual([false, false, false]);
  });
});

describe("a felled tree growing back", () => {
  it("stays a bare stump for a game day, then grows a sapling from the stump", () => {
    const { game, tree } = felledTree();
    expect(tree.growth?.stage).toBe("stump");

    passHours(game, 23);
    expect(tree.growth?.stage).toBe("stump");
    passHours(game, 1);
    expect(tree.growth?.stage).toBe("sapling");
    expect(tree.stump).toBe(true);
  });

  it("becomes a young tree 2 game days after the sapling shows, and the stump goes then", () => {
    const { game, tree } = felledTree();
    passHours(game, 24 + 47);
    expect(tree.growth?.stage).toBe("sapling");
    expect(tree.stump).toBe(true);

    passHours(game, 1);
    expect(tree.growth?.stage).toBe("youngTree");
    expect(tree.stump).toBeUndefined();
    expect(tree.fellHeading).toBeUndefined();
    expect(tree.tree).toBeUndefined();
  });

  it("becomes a full tree 3 game days after it became a young tree", () => {
    const { game, tree } = felledTree();
    passHours(game, 24 + 48 + 71);
    expect(tree.growth?.stage).toBe("youngTree");

    passHours(game, 1);
    expect(tree.tree).toBe(true);
    expect(tree.growth).toBeUndefined();
  });

  it("regrows into a tree of the same size, which gives the same number of logs when felled again", () => {
    const { game, tree } = felledTree();
    const spot = { x: tree.position.x, z: tree.position.z };
    passHours(game, 6 * 24);
    expect(tree.position).toMatchObject(spot);

    const logsBefore = game.entities.with("log").size;
    fell(game, tree);

    expect(game.entities.with("log").size - logsBefore).toBe(logsForTreeSize(treeSizeAt(spot.x, spot.z)));
    expect(tree.growth?.stage).toBe("stump");
  });

  it("blocks walking as a stump, as a sapling on the stump, and as a young tree", () => {
    const { game, tree } = felledTree();
    const blocked = () => !isWalkable(game.walkMap, tree.position);
    expect(blocked()).toBe(true);
    passHours(game, 30);
    expect(tree.growth?.stage).toBe("sapling");
    expect(blocked()).toBe(true);
    passHours(game, 48);
    expect(tree.growth?.stage).toBe("youngTree");
    expect(blocked()).toBe(true);
  });

  it("grows while the player sleeps", () => {
    const { game, tree } = felledTree();
    const before = tree.growth?.minutesLeft ?? 0;
    const clockBefore = game.progress().clockMinutes;
    const { x, y, z } = game.client.getView().playerPosition;
    game.entities.add({ campfire: { lit: true, fuelMinutes: 48 * 60 }, position: { x: x + 2, y, z } });
    send(game, { type: "skipTime", hours: 22 - game.client.getView().time.hour });
    send(game, { type: "layBedroll" });
    const bedrollId = game.client.getView().nearby.find((thing) => thing.kind === "bedroll")?.view.id;
    if (bedrollId === undefined) throw new Error("No bedroll was laid");
    const clockAtBedtime = game.progress().clockMinutes;

    send(game, { type: "sleep", bedrollId });

    const slept = game.progress().clockMinutes - clockAtBedtime;
    expect(slept).toBeGreaterThan(6 * 60);
    // Felled in the morning, the stump is still a day from its sapling when the player wakes.
    const passed = game.progress().clockMinutes - clockBefore;
    expect(tree.growth?.stage).toBe("stump");
    expect(tree.growth?.minutesLeft).toBeCloseTo(before - passed, 3);
  });
});

describe("chopping a growing tree", () => {
  it("does not chop a stump or a sapling", () => {
    const { game, tree } = felledTree();
    for (const hours of [0, 30]) {
      passHours(game, hours);
      send(game, { type: "chopTree", treeId: idOf(game, tree) });
      for (let step = 0; step < 30; step += 1) game.step();
      expect(game.client.getView().action).toBeNull();
      // A sapling is offered so its menu can say why, but never as a tree to chop.
      expect(game.client.nearestInReach()?.kind).not.toBe("tree");
    }
  });

  it("refuses to chop a young tree, saying it is too young", () => {
    const { game, tree } = felledTree();
    passHours(game, 3 * 24);
    expect(tree.growth?.stage).toBe("youngTree");
    const treeId = idOf(game, tree);

    expect(game.client.refusal({ type: "chopTree", treeId })).toEqual({ kind: "tooYoungToChop" });
    expect(game.client.describeThing(treeId)).toEqual({ kind: "tree" });
    send(game, { type: "chopTree", treeId });
    for (let step = 0; step < 30; step += 1) game.step();
    expect(game.client.getView().action).toBeNull();
    expect(tree.growth?.stage).toBe("youngTree");
  });

  it("offers a young tree in reach of E, so its menu can say why it cannot be chopped", () => {
    const { game, tree } = felledTree();
    // Clear away the logs, so the young tree is the nearest thing.
    for (const log of [...game.entities.with("log")]) game.entities.remove(log);
    passHours(game, 3 * 24);

    expect(game.client.nearestInReach()).toEqual({ kind: "youngTree", id: idOf(game, tree) });
  });
});

describe("saving growing trees", () => {
  it("saves each growing tree's stage and time left, and carries on growing after loading", () => {
    const { game, tree } = felledTree();
    passHours(game, 30);
    const treeId = idOf(game, tree);
    const saved = writeSave(game);
    expect(saved.version).toBe(SAVE_VERSION);
    expect(saved.entities.find((entity) => entity.id === treeId)?.components.growth).toEqual(tree.growth);

    const loaded = readSave(JSON.parse(JSON.stringify(saved)));
    if (!loaded.ok) throw new Error("The save was rejected");
    const loadedTree = loaded.game.entities.entity(treeId);
    expect(loadedTree?.growth).toEqual(tree.growth);
    expect(loadedTree?.stump).toBe(true);

    passHours(loaded.game, 48);
    expect(loadedTree?.growth?.stage).toBe("youngTree");
  });

  it("rejects a save whose growing tree is at a stage that does not exist", () => {
    const { game, tree } = felledTree();
    const saved = JSON.parse(JSON.stringify(writeSave(game))) as ReturnType<typeof writeSave>;
    const entry = saved.entities.find((entity) => entity.id === idOf(game, tree));
    if (entry === undefined) throw new Error("The stump was not saved");
    entry.components.growth = { stage: "seedling", minutesLeft: 10 } as never;
    expect(readSave(saved).ok).toBe(false);
  });

  it("starts each stump in an older save growing as if just felled", () => {
    const { game, tree } = felledTree();
    passHours(game, 10);
    const treeId = idOf(game, tree);
    const older = JSON.parse(JSON.stringify({ ...writeSave(game), version: REGROWTH_SAVE_VERSION - 1 })) as ReturnType<typeof writeSave>;
    for (const entity of older.entities) delete entity.components.growth;

    const loaded = readSave(older);
    if (!loaded.ok) throw new Error("The older save was rejected");

    const stump = loaded.game.entities.entity(treeId);
    expect(stump?.stump).toBe(true);
    expect(stump?.growth).toEqual(justFelled());
  });
});

/** A new game whose tree nearest the player has just been felled. */
function felledTree(): { game: Game; tree: Entity & { position: { x: number; y: number; z: number } } } {
  const game = createGame({ seed: 42 });
  const player = onlyPlayer(game);
  const distance = (at: { x: number; z: number }) => Math.hypot(at.x - player.position.x, at.z - player.position.z);
  const trees = game.entities.with("tree", "position").entities;
  const tree = trees.reduce((best, candidate) => (distance(candidate.position) < distance(best.position) ? candidate : best));
  fell(game, tree);
  return { game, tree };
}

/** Chops a tree all the way down. */
function fell(game: Game, tree: Entity): void {
  game.client.send({ type: "chopTree", treeId: idOf(game, tree) });
  stepUntil(game, () => tree.stump === true);
}

/**
 * Skips this many game hours, an hour at a time. The player's needs are filled before each hour,
 * so a long skip does not end in a collapse.
 */
function passHours(game: Game, hours: number): void {
  const player = onlyPlayer(game);
  for (let hour = 0; hour < hours; hour += 1) {
    Object.assign(player.needs ?? {}, createNeeds());
    game.client.send({ type: "skipTime", hours: 1 });
    game.step();
  }
}

function stepUntil(game: Game, done: () => boolean): void {
  for (let steps = 0; !done(); steps += 1) {
    if (steps > 100_000) throw new Error("Gave up waiting");
    game.step();
  }
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
  finishReach(game);
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
