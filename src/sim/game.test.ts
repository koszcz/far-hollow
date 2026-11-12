import { describe, expect, it } from "bun:test";
import type { Vec3 } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { distanceToRiver, generateValley, terrainHeightAt, type GroundPoint } from "./valley";

describe("createGame", () => {
  it("lays out its valley from the seed it is given", () => {
    const game = createGame({ seed: 42 });
    expect(game.valley).toEqual(generateValley(42));
    expect(game.client.getView().seed).toBe(42);
  });

  it("adds one tree entity, standing on the ground, for each tree in the valley", () => {
    const game = createGame({ seed: 42 });
    const trees = game.entities.with("tree", "position").entities;
    expect(trees).toHaveLength(game.valley.trees.length);
    const expected = game.valley.trees.map((tree) => ({
      x: tree.x,
      y: terrainHeightAt(game.valley.terrain, tree.x, tree.z),
      z: tree.z,
    }));
    const byPlace = (a: { x: number; z: number }, b: { x: number; z: number }) => a.x - b.x || a.z - b.z;
    expect(trees.map((tree) => tree.position).sort(byPlace)).toEqual(expected.sort(byPlace));
    // Every entity is a tree, a stick, a berry bush, a mushroom patch, the player, or the valley's weather.
    const { sticks, berryBushes, mushrooms } = game.valley;
    expect(game.client.getView().entityCount).toBe(trees.length + sticks.length + berryBushes.length + mushrooms.length + 2);
  });
});

describe("the player", () => {
  it("starts near the river, standing on open ground", () => {
    for (const seed of [1, 2, 42]) {
      const game = createGame({ seed });
      const player = onlyPlayer(game);
      expect(distanceToWater(game, player.position)).toBeLessThan(20);
      // Halfway down the valley, far from its edges.
      expect(Math.abs(player.position.z)).toBeLessThan(game.valley.size / 4);
      expect(player.position.y).toBeCloseTo(terrainHeightAt(game.valley.terrain, player.position.x, player.position.z));
      expect(distanceToNearestTree(game, player.position)).toBeGreaterThan(TRUNK_CLEARANCE);
      expect(distanceToWater(game, player.position)).toBeGreaterThan(0);
    }
  });

  it("walks to a clicked spot without walking through trees", () => {
    const game = createGame({ seed: 42 });
    const player = onlyPlayer(game);
    const target = openSpotNear(game, { x: player.position.x - 60, z: player.position.z + 20 });

    game.client.send({ type: "walkTo", x: target.x, z: target.z });
    const walk = stepUntilStill(game);

    const end = walk.at(-1);
    expect(end?.x).toBeCloseTo(target.x, 3);
    expect(end?.z).toBeCloseTo(target.z, 3);
    expect(end?.y).toBeCloseTo(terrainHeightAt(game.valley.terrain, target.x, target.z), 3);
    for (const spot of walk) expect(distanceToNearestTree(game, spot)).toBeGreaterThan(TRUNK_CLEARANCE);
    // The player walks at a steady pace rather than jumping there.
    expect(walk.length).toBeGreaterThan(Math.hypot(target.x - (walk[0]?.x ?? 0), target.z - (walk[0]?.z ?? 0)) / 0.2);
  });

  it("walks to the nearest bank when the clicked spot is across the river", () => {
    const game = createGame({ seed: 42 });
    const { river } = game.valley;
    const middle = river.path[Math.floor(river.path.length / 2)] ?? { x: 0, z: 0 };
    const acrossTheRiver = { x: middle.x + river.width / 2 + 20, z: middle.z };

    game.client.send({ type: "walkTo", x: acrossTheRiver.x, z: acrossTheRiver.z });
    const walk = stepUntilStill(game);

    for (const spot of walk) expect(distanceToWater(game, spot)).toBeGreaterThan(0);
    const end = walk.at(-1) ?? middle;
    expect(end.x).toBeLessThan(middle.x);
    expect(distanceToWater(game, end)).toBeLessThan(3);
  });
});

/** Runs logic steps until the player stops moving, and returns where the player stood after each step. */
function stepUntilStill(game: Game): Vec3[] {
  const player = onlyPlayer(game);
  const walk: Vec3[] = [{ ...player.position }];
  for (let i = 0; i < 100_000; i += 1) {
    game.step();
    const last = walk.at(-1);
    const now = { ...player.position };
    if (last && i > 0 && now.x === last.x && now.z === last.z) return walk;
    walk.push(now);
  }
  throw new Error("The player never stopped walking");
}

/** A spot near the one given that is at least 2 m from any tree and not in the river. */
function openSpotNear(game: Game, near: GroundPoint): GroundPoint {
  for (let ring = 0; ring < 50; ring += 1) {
    for (let step = 0; step < 16; step += 1) {
      const angle = (step / 16) * Math.PI * 2;
      const spot = { x: near.x + ring * Math.cos(angle), z: near.z + ring * Math.sin(angle) };
      if (distanceToNearestTree(game, spot) > 2 && distanceToWater(game, spot) > 3) return spot;
    }
  }
  throw new Error("No open spot found");
}

/** Trunks are at most about 0.4 m wide, so the player's middle must stay at least this far from a tree's centre. */
const TRUNK_CLEARANCE = 0.4;

function onlyPlayer(game: Game) {
  const players = game.entities.with("player", "position").entities;
  expect(players).toHaveLength(1);
  const player = players[0];
  if (player === undefined) throw new Error("No player");
  return player;
}

function distanceToNearestTree(game: Game, spot: GroundPoint): number {
  let nearest = Infinity;
  for (const tree of game.valley.trees) nearest = Math.min(nearest, Math.hypot(tree.x - spot.x, tree.z - spot.z));
  return nearest;
}

/** How far a spot is from the water's edge. Negative inside the water. */
function distanceToWater(game: Game, spot: GroundPoint): number {
  return distanceToRiver(game.valley.river, spot) - game.valley.river.width / 2;
}
describe("the game clock", () => {
  function runRealSeconds(game: ReturnType<typeof createGame>, seconds: number): void {
    for (let i = 0; i < seconds * STEPS_PER_SECOND; i += 1) game.step();
  }

  it("starts on day 1 at 08:00", () => {
    const game = createGame({ seed: 1 });
    expect(game.client.getView().time).toMatchObject({ day: 1, hour: 8, minute: 0 });
  });

  it("moves one game hour for each real minute of logic steps", () => {
    const game = createGame({ seed: 1 });
    runRealSeconds(game, 60);
    expect(game.client.getView().time).toMatchObject({ day: 1, hour: 9, minute: 0 });
  });

  it("stands still while the game is paused", () => {
    const game = createGame({ seed: 1 });
    game.client.send({ type: "setPaused", paused: true });
    runRealSeconds(game, 60);
    expect(game.client.getView().time).toMatchObject({ day: 1, hour: 8, minute: 0 });
  });

  it("skips forward when the client sends a skip-time command", () => {
    const game = createGame({ seed: 1 });
    game.client.send({ type: "skipTime", hours: 13 });
    game.step();
    expect(game.client.getView().time).toMatchObject({ day: 1, hour: 21, minute: 0 });
  });
});
