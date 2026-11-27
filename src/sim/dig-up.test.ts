import { describe, expect, it } from "bun:test";
import type { Command } from "./api-commands";
import { CONTENT_WEIGHT_KG } from "./backpack";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { createNeeds } from "./needs";
import { readSave, writeSave } from "./save";
import { DIG_UP_SECONDS } from "./digging-up";
import { finishReach } from "./test-steps";
import { isWalkable } from "./walk-map";

describe("digging up a sapling", () => {
  it("takes a few seconds, needs no tool, and puts the sapling in the backpack", () => {
    const { game, tree } = saplingOnStump();
    const player = onlyPlayer(game);
    delete player.backpack?.contents.axe;
    const treeId = idOf(game, tree);
    expect(game.client.refusal({ type: "digUpSapling", saplingId: treeId })).toBeNull();

    game.client.send({ type: "digUpSapling", saplingId: treeId });
    game.step();
    expect(game.client.getView().action?.kind).toBe("digUp");
    for (let step = 0; step < DIG_UP_SECONDS * STEPS_PER_SECOND - 5; step += 1) game.step();
    expect(game.client.getView().backpack.sapling).toBeUndefined();

    stepUntil(game, () => game.client.getView().backpack.sapling === 1);
    expect(DIG_UP_SECONDS).toBeGreaterThanOrEqual(2);
    expect(DIG_UP_SECONDS).toBeLessThanOrEqual(6);
    expect(game.client.getView().action).toBeNull();
  });

  it("removes the stump for good, so the ground is free to walk on and build on", () => {
    const { game, tree } = saplingOnStump();
    const spot = { x: tree.position.x, z: tree.position.z };
    expect(isWalkable(game.walkMap, spot)).toBe(false);
    expect(game.client.checkPlacement("chest", spot, 0).allowed).toBe(false);

    const treeId = idOf(game, tree);

    digUp(game, tree);

    expect(game.entities.entity(treeId)).toBeUndefined();
    expect(isWalkable(game.walkMap, spot)).toBe(true);
    // Nothing grows back there.
    passHours(game, 7 * 24);
    expect(game.entities.with("position").entities.some((entity) => entity.position.x === spot.x && entity.position.z === spot.z)).toBe(false);
    expect(game.client.checkPlacement("chest", spot, 0).allowed).toBe(true);
  });

  it("weighs 1 kg, and saplings stack", () => {
    expect(CONTENT_WEIGHT_KG.sapling).toBe(1);
    const first = saplingOnStump();
    digUp(first.game, first.tree);
    const second = nearestGrowingTree(first.game);
    passHours(first.game, 30, second);
    digUp(first.game, second);

    expect(first.game.client.getView().backpack.sapling).toBe(2);
  });

  it("does not dig up a sapling when the backpack has no room for it", () => {
    const { game, tree } = saplingOnStump();
    const backpack = onlyPlayer(game).backpack;
    if (backpack === undefined) throw new Error("No backpack");
    backpack.contents = { stone: 10 };

    expect(game.client.refusal({ type: "digUpSapling", saplingId: idOf(game, tree) })).toEqual({ kind: "backpackFull" });
  });
});

describe("refusing to dig up", () => {
  it("refuses a bare stump, saying no sapling grows on it yet", () => {
    const { game, tree } = felledTree();
    const saplingId = idOf(game, tree);

    expect(game.client.refusal({ type: "digUpSapling", saplingId })).toEqual({ kind: "noSaplingYet" });
    send(game, { type: "digUpSapling", saplingId });
    for (let step = 0; step < 10 * STEPS_PER_SECOND; step += 1) game.step();
    expect(tree.stump).toBe(true);
    expect(game.client.getView().backpack.sapling).toBeUndefined();
  });

  it("refuses a young tree or a full tree, saying it is too big to dig up", () => {
    const { game, tree } = felledTree();
    passHours(game, 3 * 24);
    expect(tree.growth?.stage).toBe("youngTree");
    expect(game.client.refusal({ type: "digUpSapling", saplingId: idOf(game, tree) })).toEqual({ kind: "tooBigToDigUp" });

    const standing = game.entities.with("tree").first;
    if (standing === undefined) throw new Error("No standing tree");
    expect(game.client.refusal({ type: "digUpSapling", saplingId: idOf(game, standing) })).toEqual({ kind: "tooBigToDigUp" });
  });

  it("offers a sapling in reach of E, but not a bare stump", () => {
    const { game, tree } = felledTree();
    clearLogs(game);
    expect(game.client.nearestInReach()?.id).not.toBe(idOf(game, tree));

    passHours(game, 30);
    expect(game.client.nearestInReach()).toEqual({ kind: "sapling", id: idOf(game, tree) });
    expect(game.client.describeThing(idOf(game, tree))).toEqual({ kind: "sapling" });
  });
});

describe("saving saplings", () => {
  it("saves saplings in the backpack", () => {
    const { game, tree } = saplingOnStump();
    digUp(game, tree);

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save was rejected");
    expect(loaded.game.client.getView().backpack.sapling).toBe(1);
  });

  it("saves digging up under way", () => {
    const { game, tree } = saplingOnStump();
    game.client.send({ type: "digUpSapling", saplingId: idOf(game, tree) });
    for (let step = 0; step < STEPS_PER_SECOND; step += 1) game.step();

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save was rejected");
    expect(loaded.game.client.getView().action?.kind).toBe("digUp");
  });
});

type Placed = Entity & { position: { x: number; y: number; z: number } };

/** A new game whose tree nearest the player has been felled and has grown a sapling on its stump. */
function saplingOnStump(): { game: Game; tree: Placed } {
  const felled = felledTree();
  passHours(felled.game, 30, felled.tree);
  clearLogs(felled.game);
  expect(felled.tree.growth?.stage).toBe("sapling");
  return felled;
}

/** A new game whose tree nearest the player has just been felled, with the log dropped. */
function felledTree(): { game: Game; tree: Placed } {
  const game = createGame({ seed: 42 });
  const tree = nearestStanding(game);
  game.client.send({ type: "chopTree", treeId: idOf(game, tree) });
  stepUntil(game, () => tree.stump === true);
  send(game, { type: "dropLog" });
  return { game, tree };
}

/** Fells the standing tree nearest the player, and returns it as a stump. */
function nearestGrowingTree(game: Game): Placed {
  const tree = nearestStanding(game);
  game.client.send({ type: "chopTree", treeId: idOf(game, tree) });
  stepUntil(game, () => tree.stump === true);
  send(game, { type: "dropLog" });
  clearLogs(game);
  return tree;
}

function nearestStanding(game: Game): Placed {
  const player = onlyPlayer(game);
  const distance = (at: { x: number; z: number }) => Math.hypot(at.x - player.position.x, at.z - player.position.z);
  const trees = game.entities.with("tree", "position").entities;
  return trees.reduce((best, candidate) => (distance(candidate.position) < distance(best.position) ? candidate : best));
}

function digUp(game: Game, tree: Entity): void {
  game.client.send({ type: "digUpSapling", saplingId: idOf(game, tree) });
  stepUntil(game, () => game.entities.id(tree) === undefined);
  for (let step = 0; step < 5; step += 1) game.step();
}

function clearLogs(game: Game): void {
  for (const log of [...game.entities.with("log")]) game.entities.remove(log);
}

/**
 * Skips this many game hours, an hour at a time, with the player's needs filled before each hour.
 * With `until`, it stops early once that tree has grown a sapling.
 */
function passHours(game: Game, hours: number, until?: Entity): void {
  const player = onlyPlayer(game);
  for (let hour = 0; hour < hours; hour += 1) {
    if (until?.growth?.stage === "sapling") return;
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
