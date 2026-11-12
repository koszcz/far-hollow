import { describe, expect, it } from "bun:test";
import { generateValley, startSpotBeside, terrainHeightAt, type GroundPoint } from "./valley";

/** Shortest distance from a point to a path made of straight segments. Written here so the test does not trust the code under test. */
function distanceToPath(point: GroundPoint, path: readonly GroundPoint[]): number {
  let best = Infinity;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    if (a === undefined || b === undefined) continue;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lengthSquared = dx * dx + dz * dz;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSquared));
    best = Math.min(best, Math.hypot(point.x - (a.x + t * dx), point.z - (a.z + t * dz)));
  }
  return best;
}

describe("generateValley", () => {
  it("makes the same valley every time from the same seed", () => {
    expect(generateValley(1234)).toEqual(generateValley(1234));
  });

  it("is a square 300 m on each side", () => {
    expect(generateValley(1234).size).toBe(300);
  });

  it("packs trees into dense groves, with open clearings between them", () => {
    for (const seed of [1, 2, 1234]) {
      const { trees, size } = generateValley(seed);
      // Count trees in 15 m squares. Groves hold many trees, clearings hold none.
      const square = 15;
      const perSide = Math.ceil(size / square);
      const counts = new Array<number>(perSide * perSide).fill(0);
      for (const tree of trees) {
        const column = Math.min(perSide - 1, Math.floor((tree.x + size / 2) / square));
        const row = Math.min(perSide - 1, Math.floor((tree.z + size / 2) / square));
        counts[row * perSide + column] = (counts[row * perSide + column] ?? 0) + 1;
      }
      const empty = counts.filter((count) => count === 0).length;
      const busiest = Math.max(...counts);
      // A 15 m square in a grove, with trees about 4 to 5 m apart, holds 9 or more.
      expect(busiest).toBeGreaterThanOrEqual(9);
      expect(empty / counts.length).toBeGreaterThan(0.1);
    }
  });

  it("leaves open ground where the player starts", () => {
    for (const seed of [1, 2, 3, 1234]) {
      const { trees, river } = generateValley(seed);
      const start = startSpotBeside(river);
      for (const tree of trees) expect(Math.hypot(tree.x - start.x, tree.z - start.z)).toBeGreaterThanOrEqual(16);
    }
  });

  it("holds thousands of trees, all inside the valley", () => {
    const valley = generateValley(1234);
    const half = valley.size / 2;
    expect(valley.trees.length).toBeGreaterThanOrEqual(2000);
    for (const tree of valley.trees) {
      expect(Math.abs(tree.x)).toBeLessThanOrEqual(half);
      expect(Math.abs(tree.z)).toBeLessThanOrEqual(half);
    }
  });

  it("makes different valleys from different seeds", () => {
    const first = generateValley(1);
    const second = generateValley(2);
    expect(first.trees).not.toEqual(second.trees);
    expect(first.river).not.toEqual(second.river);
    expect(first.terrain.heights).not.toEqual(second.terrain.heights);
  });

  it("has one river that runs from one edge of the valley to the opposite edge", () => {
    for (const seed of [1, 2, 3, 1234]) {
      const { river, size } = generateValley(seed);
      const half = size / 2;
      const start = river.path[0];
      const end = river.path.at(-1);
      expect(start?.z).toBe(-half);
      expect(end?.z).toBe(half);
      for (const point of river.path) expect(Math.abs(point.x)).toBeLessThan(half);
      expect(river.width).toBeGreaterThan(0);
    }
  });

  it("sets the riverbed lower than the ground on both banks", () => {
    for (const seed of [1, 2, 3, 1234]) {
      const { river, terrain } = generateValley(seed);
      for (const point of river.path.slice(1, -1)) {
        const bed = terrainHeightAt(terrain, point.x, point.z);
        const bankDistance = river.width / 2 + 12;
        expect(terrainHeightAt(terrain, point.x - bankDistance, point.z)).toBeGreaterThan(bed);
        expect(terrainHeightAt(terrain, point.x + bankDistance, point.z)).toBeGreaterThan(bed);
      }
    }
  });

  it("keeps trees out of the river", () => {
    for (const seed of [1, 2, 3, 1234]) {
      const { river, trees } = generateValley(seed);
      for (const tree of trees) {
        expect(distanceToPath(tree, river.path)).toBeGreaterThan(river.width / 2);
      }
    }
  });

  it("scatters sticks on the forest floor, laid out by the seed", () => {
    expect(generateValley(1234).sticks).toEqual(generateValley(1234).sticks);
    expect(generateValley(1).sticks).not.toEqual(generateValley(2).sticks);
    const { sticks, size } = generateValley(1234);
    expect(sticks.length).toBeGreaterThanOrEqual(500);
    for (const stick of sticks) {
      expect(Math.abs(stick.x)).toBeLessThanOrEqual(size / 2);
      expect(Math.abs(stick.z)).toBeLessThanOrEqual(size / 2);
    }
  });

  it("keeps sticks out of the river and clear of tree trunks", () => {
    for (const seed of [1, 2, 3, 1234]) {
      const { river, trees, sticks } = generateValley(seed);
      for (const stick of sticks) {
        expect(distanceToPath(stick, river.path)).toBeGreaterThan(river.width / 2);
      }
      // Spot-check a sample, because checking every stick against every tree is slow.
      for (const stick of sticks.slice(0, 50)) {
        const nearestTree = Math.min(...trees.map((tree) => Math.hypot(tree.x - stick.x, tree.z - stick.z)));
        expect(nearestTree).toBeGreaterThanOrEqual(1.5);
      }
    }
  });
});
