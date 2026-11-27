import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import type { Entity, Vec3 } from "./entities";
import { createGame, type Game } from "./game";
import { GROUND_CHANGE_MINUTES, isGroundChangeOver } from "./ground-change";
import { groundChangesOf } from "./ground-changes";
import type { GroundPoint } from "./ground-point";
import { createGroundMap, groundTypeWeightsAt, type GroundMap, type GroundTypeWeights } from "./ground-types";
import { createNeeds } from "./needs";
import { isRiverBank } from "./river-bank-work";
import { readSave, writeSave } from "./save";
import { GROUND_CHANGES_SAVE_VERSION } from "./save-versions";
import { finishReach } from "./test-steps";
import { isWalkable } from "./walk-map";

type Placed = Entity & { position: Vec3 };

describe("the ground where a sapling is dug up from a stump", () => {
  it("turns into the ground of a valley without that tree over 3 game days", () => {
    const { game, tree } = saplingOnStump();
    const spot = spotOf(tree);
    const withTree = game.groundMap();
    digUp(game, tree);
    // Digging takes a few game minutes, so the change has only just begun.
    expect(largestDifference(weightsAround(game.groundMap(), spot), weightsAround(withTree, spot))).toBeLessThan(0.001);

    passHours(game, 12);
    const partWay = weightsAround(game.groundMap(), spot);
    expect(largestDifference(partWay, weightsAround(withTree, spot))).toBeGreaterThan(0.1);
    expect(largestDifference(partWay, weightsAround(valleyWithout(game, spot), spot))).toBeGreaterThan(0);

    passHours(game, 60);
    expect(weightsAround(game.groundMap(), spot)).toEqual(weightsAround(valleyWithout(game, spot), spot));
  });

  it("records when the change started, and saves it", () => {
    const { game, tree } = saplingOnStump();
    digUp(game, tree);
    const [change] = groundChangesOf(game.entities);
    expect(change).toMatchObject({ x: tree.position.x, z: tree.position.z, toward: "clearing" });
    expect(change?.startedAtMinutes).toBeCloseTo(clockMinutes(game), 0);

    const loaded = reload(game);
    expect(groundChangesOf(loaded.entities)).toEqual(groundChangesOf(game.entities));
    expect(weightsAround(loaded.groundMap(), spotOf(tree))).toEqual(weightsAround(game.groundMap(), spotOf(tree)));
  });
});

describe("a felled tree growing back", () => {
  it("changes nothing: the stump and the sapling on it still count as a tree", () => {
    const { game, tree } = felledTree();
    const start = createGroundMap(game.valley);
    for (let day = 0; day < 7; day += 1) {
      passHours(game, 24);
      expect(weightsAround(game.groundMap(), spotOf(tree))).toEqual(weightsAround(start, spotOf(tree)));
    }
    expect(tree.tree).toBe(true);
    expect(groundChangesOf(game.entities)).toEqual([]);
  });
});

describe("a planted sapling", () => {
  it("changes nothing as a sapling or young tree, then spreads forest floor over 3 game days once it is a full tree", () => {
    const game = createGame({ seed: 42 });
    const spot = openSpot(game);
    plantAt(game, spot);
    walkAway(game, spot);
    const start = createGroundMap(game.valley);

    passHours(game, 5 * 24 - 1);
    expect(weightsAround(game.groundMap(), spot)).toEqual(weightsAround(start, spot));
    passHours(game, 2);
    expect(plantedAt(game, spot)?.tree).toBe(true);
    expect(groundChangesOf(game.entities)).toMatchObject([{ x: spot.x, z: spot.z, toward: "forestFloor" }]);

    passHours(game, 3 * 24);
    expect(weightsAround(game.groundMap(), spot)).toEqual(weightsAround(valleyWith(game, spot), spot));
  });

  it("keeps its forest floor when the full tree is felled and grows back", () => {
    const game = createGame({ seed: 42 });
    const spot = openSpot(game);
    plantAt(game, spot);
    walkAway(game, spot);
    passHours(game, 8 * 24);
    const tree = plantedAt(game, spot);
    if (tree === undefined) throw new Error("No tree");
    chop(game, tree);
    passHours(game, 7 * 24);
    expect(groundChangesOf(game.entities)).toHaveLength(1);
    expect(weightsAround(game.groundMap(), spot)).toEqual(weightsAround(valleyWith(game, spot), spot));
  });
});

describe("loading a save from before the ground followed the trees", () => {
  it("shows the ground matching the trees the save holds now, with no change in progress", () => {
    const { game, tree } = saplingOnStump();
    digUp(game, tree);
    const older = JSON.parse(JSON.stringify(writeSave(game))) as { version: number; entities: { components: Entity }[] };
    older.version = GROUND_CHANGES_SAVE_VERSION - 1;
    older.entities = older.entities.filter((entity) => entity.components.groundChange === undefined);

    const loaded = readSave(older);
    if (!loaded.ok) throw new Error("The save was rejected");
    const minutes = clockMinutes(loaded.game);
    expect(groundChangesOf(loaded.game.entities).every((change) => isGroundChangeOver(change, minutes))).toBe(true);
    expect(weightsAround(loaded.game.groundMap(), spotOf(tree))).toEqual(weightsAround(valleyWithout(game, spotOf(tree)), spotOf(tree)));
  });

  it("shows forest floor round a planted tree that is full grown", () => {
    const game = createGame({ seed: 42 });
    const spot = openSpot(game);
    plantAt(game, spot);
    walkAway(game, spot);
    passHours(game, 8 * 24);
    expect(plantedAt(game, spot)?.tree).toBe(true);

    const loaded = loadAsOlder(game);
    const minutes = clockMinutes(loaded);
    expect(groundChangesOf(loaded.entities)).toMatchObject([{ x: spot.x, z: spot.z, toward: "forestFloor" }]);
    expect(groundChangesOf(loaded.entities).every((change) => isGroundChangeOver(change, minutes))).toBe(true);
    expect(weightsAround(loaded.groundMap(), spot)).toEqual(weightsAround(valleyWith(game, spot), spot));
  });

  it("shows forest floor round the stump of a felled planted tree, while a sapling grows on it", () => {
    const game = createGame({ seed: 42 });
    const spot = openSpot(game);
    plantAt(game, spot);
    walkAway(game, spot);
    passHours(game, 8 * 24);
    const tree = plantedAt(game, spot);
    if (tree === undefined) throw new Error("No tree");
    chop(game, tree);
    for (let hour = 0; hour < 30 && tree.growth?.stage !== "sapling"; hour += 1) passHours(game, 1);
    expect(tree).toMatchObject({ stump: true, growth: { stage: "sapling" } });

    const loaded = loadAsOlder(game);
    expect(weightsAround(loaded.groundMap(), spot)).toEqual(weightsAround(valleyWith(game, spot), spot));
  });

  it("keeps the ground of a valley that has not changed", () => {
    const game = createGame({ seed: 42 });
    const older = JSON.parse(JSON.stringify(writeSave(game))) as { version: number };
    older.version = GROUND_CHANGES_SAVE_VERSION - 1;
    const loaded = readSave(older);
    if (!loaded.ok) throw new Error("The save was rejected");
    expect(groundChangesOf(loaded.game.entities)).toEqual([]);
  });
});

it("takes 3 game days for each change", () => {
  expect(GROUND_CHANGE_MINUTES).toBe(3 * 24 * 60);
});

/** The largest difference in forest floor between two lists of weights, spot by spot. */
function largestDifference(a: readonly GroundTypeWeights[], b: readonly GroundTypeWeights[]): number {
  return Math.max(...a.map((weights, index) => Math.abs(weights.forestFloor - (b[index]?.forestFloor ?? 0))));
}

/** The ground's weights on a half-metre grid round a spot, out past the reach of its tree's forest floor. */
function weightsAround(map: GroundMap, spot: GroundPoint): GroundTypeWeights[] {
  const weights: GroundTypeWeights[] = [];
  for (let dx = -10; dx <= 10; dx += 0.5) for (let dz = -10; dz <= 10; dz += 0.5) weights.push(groundTypeWeightsAt(map, { x: spot.x + dx, z: spot.z + dz }));
  return weights;
}

function valleyWithout(game: Game, spot: GroundPoint): GroundMap {
  return createGroundMap({ ...game.valley, trees: game.valley.trees.filter((tree) => tree.x !== spot.x || tree.z !== spot.z) });
}

function valleyWith(game: Game, spot: GroundPoint): GroundMap {
  return createGroundMap({ ...game.valley, trees: [...game.valley.trees, spot] });
}

function spotOf(entity: Placed): GroundPoint {
  return { x: entity.position.x, z: entity.position.z };
}

function clockMinutes(game: Game): number {
  return game.progress().clockMinutes;
}

/** A new game whose tree nearest the player has been felled and has grown a sapling, with the log gone. */
function saplingOnStump(): { game: Game; tree: Placed } {
  const felled = felledTree();
  for (let hour = 0; hour < 30 && felled.tree.growth?.stage !== "sapling"; hour += 1) passHours(felled.game, 1);
  return felled;
}

/** A new game whose tree nearest the player has just been felled, with the log gone. */
function felledTree(): { game: Game; tree: Placed } {
  const game = createGame({ seed: 42 });
  const tree = nearestStanding(game);
  chop(game, tree);
  return { game, tree };
}

function chop(game: Game, tree: Placed): void {
  game.client.send({ type: "chopTree", treeId: idOf(game, tree) });
  stepUntil(game, () => tree.stump === true);
  send(game, { type: "dropLog" });
  for (const log of [...game.entities.with("log")]) game.entities.remove(log);
}

function digUp(game: Game, tree: Entity): void {
  game.client.send({ type: "digUpSapling", saplingId: idOf(game, tree) });
  stepUntil(game, () => game.entities.id(tree) === undefined);
  for (let step = 0; step < 5; step += 1) game.step();
}

/** The nearest spot to the player where a sapling may be planted, more than 7 m from any tree and well clear of the river bank. */
function openSpot(game: Game): GroundPoint {
  giveSapling(game);
  const at = onlyPlayer(game).position;
  const trees = game.entities.with("tree", "position").entities;
  const around: GroundPoint[] = [];
  for (let dx = -100; dx <= 100; dx += 1) for (let dz = -100; dz <= 100; dz += 1) around.push({ x: Math.round(at.x) + dx, z: Math.round(at.z) + dz });
  around.sort((a, b) => Math.hypot(a.x - at.x, a.z - at.z) - Math.hypot(b.x - at.x, b.z - at.z));
  const found = around.find(
    (spot) =>
      trees.every((tree) => Math.hypot(tree.position.x - spot.x, tree.position.z - spot.z) > 7) &&
      [-4, 0, 4].every((dx) => [-4, 0, 4].every((dz) => !isRiverBank(game.valley, { x: spot.x + dx, z: spot.z + dz }))) &&
      game.client.refusal(plant(spot)) === null,
  );
  if (found === undefined) throw new Error("No open spot");
  return found;
}

function plant(spot: GroundPoint): Command {
  return { type: "plantSapling", x: spot.x, z: spot.z };
}

function giveSapling(game: Game): void {
  const backpack = onlyPlayer(game).backpack;
  if (backpack === undefined) throw new Error("No backpack");
  backpack.contents.sapling = 1;
}

function plantAt(game: Game, spot: GroundPoint): void {
  giveSapling(game);
  game.client.send(plant(spot));
  stepUntil(game, () => plantedAt(game, spot) !== undefined);
}

function plantedAt(game: Game, spot: GroundPoint): Placed | undefined {
  return game.entities
    .with("position")
    .entities.find((entity) => (entity.growth !== undefined || entity.tree === true) && entity.position.x === spot.x && entity.position.z === spot.z);
}

/** Walks the player to an open spot a few metres from `spot`, so a growing tree there is not held back. */
function walkAway(game: Game, spot: GroundPoint): void {
  const at = onlyPlayer(game).position;
  const around: GroundPoint[] = [];
  for (let dx = -8; dx <= 8; dx += 1) for (let dz = -8; dz <= 8; dz += 1) around.push({ x: Math.round(spot.x) + dx, z: Math.round(spot.z) + dz });
  const target = around
    .filter((other) => Math.hypot(other.x - spot.x, other.z - spot.z) > 4 && isWalkable(game.walkMap, other))
    .sort((a, b) => Math.hypot(a.x - at.x, a.z - at.z) - Math.hypot(b.x - at.x, b.z - at.z))[0];
  if (target === undefined) throw new Error("Nowhere to walk");
  send(game, { type: "walkTo", x: target.x, z: target.z });
  stepUntil(game, () => game.client.getView().action === null && onlyPlayer(game).walkPath === undefined);
}

function nearestStanding(game: Game): Placed {
  const player = onlyPlayer(game);
  const distance = (at: { x: number; z: number }) => Math.hypot(at.x - player.position.x, at.z - player.position.z);
  const trees = game.entities.with("tree", "position").entities;
  return trees.reduce((best, candidate) => (distance(candidate.position) < distance(best.position) ? candidate : best));
}

function reload(game: Game): Game {
  const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
  if (!loaded.ok) throw new Error("The save was rejected");
  return loaded.game;
}

/** Saves the game, turns the save into one from before ground changes were saved, and loads it. */
function loadAsOlder(game: Game): Game {
  const older = JSON.parse(JSON.stringify(writeSave(game))) as { version: number; entities: { components: Entity }[] };
  older.version = GROUND_CHANGES_SAVE_VERSION - 1;
  older.entities = older.entities.filter((entity) => entity.components.groundChange === undefined);
  const loaded = readSave(older);
  if (!loaded.ok) throw new Error("The save was rejected");
  return loaded.game;
}

/** Skips this many game hours, an hour at a time, with the player's needs filled before each hour. */
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
