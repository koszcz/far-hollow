import { describe, expect, it } from "bun:test";
import { CHOP_SECONDS } from "./chopping";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { findPath, findPathWithin } from "./pathfinding";
import { finishReach } from "./test-steps";
import { chopSecondsForTreeSize, FEWEST_LOGS_PER_TREE, logsForTreeSize, MOST_LOGS_PER_TREE, treeSizeAt } from "./tree-size";
import type { GroundPoint } from "./ground-point";
import { nearestWalkableSpot } from "./walk-map";

describe("the backpack", () => {
  it("starts with an axe, a knife, a drawknife, a steel and flint, a bedroll, an empty pot, a saw blade, and a fishing line", () => {
    const game = createGame({ seed: 42 });
    expect(game.client.getView().backpack).toEqual({ axe: 1, knife: 1, drawknife: 1, steelAndFlint: 1, bedroll: 1, pot: 1, sawBlade: 1, fishingLine: 1 });
  });
});

describe("chopping a tree", () => {
  it("walks the player to the tree, then chops it for a while", () => {
    const game = createGame({ seed: 42 });
    const tree = nearestTreeToPlayer(game);

    game.client.send({ type: "chopTree", treeId: idOf(game, tree) });
    stepUntil(game, () => game.client.getView().action?.kind === "chop");

    const player = onlyPlayer(game);
    expect(Math.hypot(player.position.x - tree.position.x, player.position.z - tree.position.z)).toBeLessThan(2.5);
    expect(game.client.getView().action?.progress).toBeLessThan(0.1);
    // Halfway through the chop, the tree still stands and the progress shows it.
    runSeconds(game, chopSecondsOf(tree) / 2);
    expect(tree.tree).toBe(true);
    expect(game.client.getView().action?.progress).toBeCloseTo(0.5, 1);
  });

  it("chops from the side facing the player, though the open spot nearest the tree's centre is on the far side", () => {
    const game = createGame({ seed: 42 });
    const player = onlyPlayer(game);
    const start = { x: player.position.x, z: player.position.z };
    const tree = treesNearestPlayer(game)
      .slice(0, 12)
      .find((candidate) => {
        const nearestOpen = nearestWalkableSpot(game.walkMap, candidate.position);
        return nearestOpen !== undefined && towardStart(candidate.position, nearestOpen, start) < 0;
      });
    if (tree === undefined) throw new Error("No tree whose nearest open spot is on the far side");

    game.client.send({ type: "chopTree", treeId: idOf(game, tree) });
    stepUntil(game, () => game.client.getView().action?.kind === "chop");

    expect(towardStart(tree.position, player.position, start)).toBeGreaterThan(0);
  });

  it("walks no further than straight to the tree's centre would, for each of the 12 trees nearest the start", () => {
    const game = createGame({ seed: 42 });
    const player = onlyPlayer(game);
    for (const tree of treesNearestPlayer(game).slice(0, 12)) {
      const toCentre = pathLength(player.position, findPath(game.walkMap, player.position, tree.position));
      // 2 m is the walk the chop asks for: the tree's 1.2 m blocked circle, plus 1 m reach, less a 0.2 m margin.
      const toReach = pathLength(player.position, findPathWithin(game.walkMap, player.position, tree.position, 2));
      expect(toReach).toBeLessThanOrEqual(toCentre);
    }
  });

  it("fells the tree into a stump that still blocks walking, and gives logs", () => {
    const game = createGame({ seed: 42 });
    const tree = nearestTreeToPlayer(game);
    const treeCount = game.entities.with("tree").size;
    const spot = { x: tree.position.x, z: tree.position.z };

    fell(game, tree);

    expect(game.entities.with("tree").size).toBe(treeCount - 1);
    const stumps = game.entities.with("stump", "position").entities;
    expect(stumps).toHaveLength(1);
    expect(stumps[0]?.position).toMatchObject(spot);
    expect(game.client.getView().action).toBeNull();
    // The player walks around the stump, just as they did around the tree.
    game.client.send({ type: "walkTo", x: spot.x, z: spot.z });
    const player = onlyPlayer(game);
    stepUntil(game, () => player.walkPath === undefined);
    expect(Math.hypot(player.position.x - spot.x, player.position.z - spot.z)).toBeGreaterThan(1);
    // Every log lies on the ground. The player carries none of them.
    expect(game.client.getView().carrying).toBeNull();
    expect(game.entities.with("log", "position").size).toBe(logsOf(spot));
  });

  it("does nothing when asked to chop something that is not a standing tree", () => {
    const game = createGame({ seed: 42 });
    const tree = nearestTreeToPlayer(game);
    fell(game, tree);
    const player = onlyPlayer(game);

    game.client.send({ type: "chopTree", treeId: idOf(game, tree) });
    game.client.send({ type: "chopTree", treeId: idOf(game, player) });
    runSeconds(game, CHOP_SECONDS * 4);

    expect(game.entities.with("stump").size).toBe(1);
    expect(game.client.getView().action).toBeNull();
  });

  it("stops chopping when the player is sent to walk somewhere else", () => {
    const game = createGame({ seed: 42 });
    const tree = nearestTreeToPlayer(game);
    game.client.send({ type: "chopTree", treeId: idOf(game, tree) });
    stepUntil(game, () => game.client.getView().action !== null);

    const player = onlyPlayer(game);
    game.client.send({ type: "walkTo", x: player.position.x - 3, z: player.position.z });
    runSeconds(game, CHOP_SECONDS * 4);

    expect(tree.tree).toBe(true);
    expect(game.client.getView().action).toBeNull();
  });
});

describe("where a felled tree falls", () => {
  it("falls straight away from the player when the ground there is clear", () => {
    const game = createGame({ seed: 42 });
    const tree = nearestTreeToPlayer(game);
    clearAround(game, tree);
    game.client.send({ type: "chopTree", treeId: idOf(game, tree) });
    stepUntil(game, () => game.client.getView().action?.kind === "chop");
    const standing = { ...onlyPlayer(game).position };
    stepUntil(game, () => tree.stump === true);

    const away = Math.atan2(tree.position.x - standing.x, tree.position.z - standing.z);
    expect(angleBetween(tree.fellHeading ?? Number.NaN, away)).toBeLessThan(0.01);
  });

  it("falls to one side when another tree stands in the way, so no log lies on a tree", () => {
    const game = createGame({ seed: 42 });
    const tree = nearestTreeToPlayer(game);
    clearAround(game, tree);
    game.client.send({ type: "chopTree", treeId: idOf(game, tree) });
    stepUntil(game, () => game.client.getView().action?.kind === "chop");
    const player = onlyPlayer(game);
    const away = Math.atan2(tree.position.x - player.position.x, tree.position.z - player.position.z);
    // A tree right where the trunk would land.
    const blockerAt = { x: tree.position.x + Math.sin(away) * 2.5, z: tree.position.z + Math.cos(away) * 2.5 };
    game.entities.add({ tree: true, position: { ...blockerAt, y: tree.position.y }, blocksWalking: { radius: 1.2 } });
    stepUntil(game, () => tree.stump === true);

    expect(angleBetween(tree.fellHeading ?? Number.NaN, away)).toBeGreaterThan(0.1);
    for (const log of game.entities.with("log", "position")) {
      expect(Math.hypot(log.position.x - blockerAt.x, log.position.z - blockerAt.z)).toBeGreaterThan(1);
    }
  });

  it("keeps every log off the other trees in a real stand of forest", () => {
    const game = createGame({ seed: 42 });
    const tree = nearestTreeToPlayer(game);
    fell(game, tree);

    const others = [...game.entities.with("tree", "position")];
    for (const log of game.entities.with("log", "position")) {
      const nearest = Math.min(...others.map((other) => Math.hypot(other.position.x - log.position.x, other.position.z - log.position.z)));
      expect(nearest).toBeGreaterThan(0.6);
    }
  });
});

describe("tree size", () => {
  it("gives more logs from a bigger tree, but takes longer to chop", () => {
    const small = treeOfSize(createGame({ seed: 42 }), (size) => logsForTreeSize(size) === FEWEST_LOGS_PER_TREE);
    const big = treeOfSize(createGame({ seed: 42 }), (size) => logsForTreeSize(size) === MOST_LOGS_PER_TREE);

    const smallSteps = fellCounting(small.game, small.tree);
    const bigSteps = fellCounting(big.game, big.tree);

    expect(small.game.entities.with("log").size).toBe(FEWEST_LOGS_PER_TREE);
    expect(big.game.entities.with("log").size).toBe(MOST_LOGS_PER_TREE);
    expect(chopSecondsOf(big.tree)).toBeGreaterThan(chopSecondsOf(small.tree) * 1.5);
    expect(bigSteps).toBeGreaterThan(smallSteps);
  });

  it("stays the same for every tree from one game to the next", () => {
    const first = [...createGame({ seed: 42 }).entities.with("tree", "position")].map((tree) => treeSizeAt(tree.position.x, tree.position.z));
    const second = [...createGame({ seed: 42 }).entities.with("tree", "position")].map((tree) => treeSizeAt(tree.position.x, tree.position.z));
    expect(second).toEqual(first);
    expect(new Set(first.map(logsForTreeSize)).size).toBe(3);
  });
});

describe("carrying a log", () => {
  it("drops the carried log at the player's feet", () => {
    const game = createGame({ seed: 42 });
    const tree = nearestTreeToPlayer(game);
    const logCount = logsOf(tree.position);
    fell(game, tree);
    shoulderNearestLog(game);
    const player = onlyPlayer(game);

    game.client.send({ type: "dropLog" });
    game.step();
    finishReach(game);

    expect(game.client.getView().carrying).toBeNull();
    const logs = [...game.entities.with("log", "position")];
    expect(logs).toHaveLength(logCount);
    const nearest = Math.min(...logs.map((log) => Math.hypot(log.position.x - player.position.x, log.position.z - player.position.z)));
    expect(nearest).toBeLessThan(1);
  });

  it("carries only one log at a time", () => {
    const game = createGame({ seed: 42 });
    const tree = nearestTreeToPlayer(game);
    const logCount = logsOf(tree.position);
    fell(game, tree);
    shoulderNearestLog(game);
    const onGround = game.entities.with("log", "position").first;
    if (onGround === undefined) throw new Error("No log on the ground");

    game.client.send({ type: "pickUpLog", logId: idOf(game, onGround) });
    runSeconds(game, 5);

    expect(game.client.getView().carrying).toBe("log");
    expect(game.entities.with("log", "position").size).toBe(logCount - 1);
    expect(onGround.log).toBeDefined();
  });

  it("walks to a log on the ground and shoulders it when the player's shoulder is free", () => {
    const game = createGame({ seed: 42 });
    const tree = nearestTreeToPlayer(game);
    const logCount = logsOf(tree.position);
    fell(game, tree);
    const player = onlyPlayer(game);
    const logs = [...game.entities.with("log", "position")];
    const distance = (log: (typeof logs)[number]) => Math.hypot(log.position.x - player.position.x, log.position.z - player.position.z);
    const farthest = logs.sort((a, b) => distance(b) - distance(a))[0];
    if (farthest === undefined) throw new Error("No log on the ground");

    game.client.send({ type: "pickUpLog", logId: idOf(game, farthest) });
    stepUntil(game, () => game.client.getView().carrying === "log", STEPS_PER_SECOND * 10);

    expect(Math.hypot(player.position.x - farthest.position.x, player.position.z - farthest.position.z)).toBeLessThan(2);
    expect(game.entities.with("log", "position").size).toBe(logCount - 1);
  });

  it("walks to a spot and lays the carried log there", () => {
    const game = createGame({ seed: 42 });
    fell(game, nearestTreeToPlayer(game));
    shoulderNearestLog(game);
    const player = onlyPlayer(game);
    const spot = { x: player.position.x + 4, z: player.position.z };
    const logsBefore = game.entities.with("log", "position").size;

    game.client.send({ type: "dropLogAt", ...spot });
    game.step();
    // The log stays on the shoulder until the player reaches the spot.
    expect(game.client.getView().carrying).toBe("log");
    stepUntil(game, () => game.client.getView().carrying === null, STEPS_PER_SECOND * 10);

    expect(game.entities.with("log", "position").size).toBe(logsBefore + 1);
    expect(Math.hypot(player.position.x - spot.x, player.position.z - spot.z)).toBeLessThan(2);
  });

  it("does nothing when the player drops a log they do not carry", () => {
    const game = createGame({ seed: 42 });
    game.client.send({ type: "dropLog" });
    game.step();
    finishReach(game);
    expect(game.entities.with("log").size).toBe(0);
  });
});

/** Chops a tree all the way down. */
function fell(game: Game, tree: Entity): void {
  game.client.send({ type: "chopTree", treeId: idOf(game, tree) });
  stepUntil(game, () => tree.stump === true);
}

/** Sends the player to pick up the felled log nearest them, and waits until it is on their shoulder. */
function shoulderNearestLog(game: Game): void {
  const player = onlyPlayer(game);
  const logs = [...game.entities.with("log", "position")];
  const distance = (log: (typeof logs)[number]) => Math.hypot(log.position.x - player.position.x, log.position.z - player.position.z);
  const nearest = logs.sort((a, b) => distance(a) - distance(b))[0];
  if (nearest === undefined) throw new Error("No log on the ground");
  game.client.send({ type: "pickUpLog", logId: idOf(game, nearest) });
  stepUntil(game, () => game.client.getView().carrying === "log", STEPS_PER_SECOND * 10);
}

/** Removes every other tree within 8 metres of this one, so its trunk can fall any way. */
function clearAround(game: Game, tree: Entity & { position: { x: number; z: number } }): void {
  for (const other of [...game.entities.with("tree", "position")]) {
    if (other === tree) continue;
    if (Math.hypot(other.position.x - tree.position.x, other.position.z - tree.position.z) < 8) game.entities.remove(other);
  }
}

/** The smallest turn between two headings, in radians. */
function angleBetween(a: number, b: number): number {
  const turn = Math.abs(a - b) % (Math.PI * 2);
  return Math.min(turn, Math.PI * 2 - turn);
}

/** How many logs the tree at this spot gives. */
function logsOf(at: { x: number; z: number }): number {
  return logsForTreeSize(treeSizeAt(at.x, at.z));
}

/** How long the player chops at this tree, in seconds. */
function chopSecondsOf(tree: { position: { x: number; z: number } }): number {
  return chopSecondsForTreeSize(treeSizeAt(tree.position.x, tree.position.z));
}

/** Finds the tree nearest the player whose size passes `accept`. */
function treeOfSize(game: Game, accept: (size: number) => boolean) {
  const player = onlyPlayer(game);
  const trees = [...game.entities.with("tree", "position")].filter((tree) => accept(treeSizeAt(tree.position.x, tree.position.z)));
  const distance = (tree: (typeof trees)[number]) => Math.hypot(tree.position.x - player.position.x, tree.position.z - player.position.z);
  const tree = trees.sort((a, b) => distance(a) - distance(b))[0];
  if (tree === undefined) throw new Error("No tree of that size");
  return { game, tree };
}

/** Chops a tree all the way down, and returns how many logic steps the chopping itself took, not counting the walk there. */
function fellCounting(game: Game, tree: Entity): number {
  game.client.send({ type: "chopTree", treeId: idOf(game, tree) });
  stepUntil(game, () => game.client.getView().action?.kind === "chop");
  return stepUntil(game, () => tree.stump === true);
}

/** Runs logic steps until `done` says yes, and returns how many it took. */
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

function nearestTreeToPlayer(game: Game) {
  const nearest = treesNearestPlayer(game)[0];
  if (nearest === undefined) throw new Error("No trees");
  return nearest;
}

/** Every standing tree, nearest to the player first. */
function treesNearestPlayer(game: Game) {
  const player = onlyPlayer(game);
  const trees = [...game.entities.with("tree", "position")];
  const distance = (tree: (typeof trees)[number]) => Math.hypot(tree.position.x - player.position.x, tree.position.z - player.position.z);
  return trees.sort((a, b) => distance(a) - distance(b));
}

/** Above 0 when `spot` lies on the side of `centre` that faces `start`, and below 0 on the far side. */
function towardStart(centre: GroundPoint, spot: GroundPoint, start: GroundPoint): number {
  return (spot.x - centre.x) * (start.x - centre.x) + (spot.z - centre.z) * (start.z - centre.z);
}

/** How far the player walks from `from` along a path. */
function pathLength(from: GroundPoint, path: readonly GroundPoint[]): number {
  let total = 0;
  let at = from;
  for (const spot of path) {
    total += Math.hypot(spot.x - at.x, spot.z - at.z);
    at = spot;
  }
  return total;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
