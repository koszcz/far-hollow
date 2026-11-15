import { describe, expect, it } from "bun:test";
import { distanceToTarget, findPath, findPathWithin } from "./pathfinding";
import type { GroundPoint } from "./valley";
import { blockCircle, blockEdges, blockWhere, createWalkMap, isWalkable, unblockEdges, type WalkEdge } from "./walk-map";

describe("findPath", () => {
  it("walks straight to the target across open ground", () => {
    const map = createWalkMap({ size: 100 });
    const path = findPath(map, { x: -20, z: 0 }, { x: 20, z: 5 });
    expect(path).toEqual([{ x: 20, z: 5 }]);
  });

  it("walks around a row of trees that blocks the straight line", () => {
    const map = createWalkMap({ size: 100 });
    const trees = treeRow({ x: 0, fromZ: -30, toZ: 15 });
    for (const tree of trees) blockCircle(map, tree, TREE_RADIUS);
    const from = { x: -10, z: 0 };
    const to = { x: 10, z: 0 };

    const path = findPath(map, from, to);

    expect(path.at(-1)).toEqual(to);
    expect(closestApproach([from, ...path], trees)).toBeGreaterThan(TREE_RADIUS / 2);
  });

  it("walks to the nearest reachable spot when the target is walled in", () => {
    const map = createWalkMap({ size: 100 });
    const pen = { x: 20, z: 0 };
    const isWall = (spot: GroundPoint) => {
      const fromPen = Math.hypot(spot.x - pen.x, spot.z - pen.z);
      return fromPen >= 5 && fromPen <= 7;
    };
    blockWhere(map, { x: 10, z: -10 }, { x: 30, z: 10 }, isWall);

    const path = findPath(map, { x: -20, z: 0 }, pen);

    const end = path.at(-1);
    expect(end).toBeDefined();
    const endFromPen = Math.hypot((end?.x ?? 0) - pen.x, (end?.z ?? 0) - pen.z);
    expect(endFromPen).toBeGreaterThan(7);
    expect(endFromPen).toBeLessThan(8.5);
  });

  it("stops beside a tree when the target is the tree itself", () => {
    const map = createWalkMap({ size: 100 });
    const tree = { x: 10, z: 0 };
    blockCircle(map, tree, TREE_RADIUS);

    const path = findPath(map, { x: -10, z: 0 }, tree);

    const end = path.at(-1);
    const endFromTree = Math.hypot((end?.x ?? 0) - tree.x, (end?.z ?? 0) - tree.z);
    expect(endFromTree).toBeGreaterThan(TREE_RADIUS / 2);
    expect(endFromTree).toBeLessThan(TREE_RADIUS + 1.5);
  });

  it("stays put when no spot near the target can be reached and the player is already closest", () => {
    const map = createWalkMap({ size: 100 });
    // A wall across the whole map at x = 0 cuts the map in two.
    blockWhere(map, { x: -1, z: -50 }, { x: 1, z: 50 }, () => true);
    const from = { x: -2.5, z: 0.5 };

    const path = findPath(map, from, { x: 20, z: 0.5 });

    const end = path.at(-1) ?? from;
    expect(end.x).toBeLessThan(0);
    expect(Math.hypot(end.x - from.x, end.z - from.z)).toBeLessThan(1.5);
  });
});

describe("findPathWithin", () => {
  const REACH = 2;

  it("stops on the near side of a tree in open ground", () => {
    const map = createWalkMap({ size: 100 });
    const tree = { x: 10.3, z: 0.7 };
    blockCircle(map, tree, TREE_RADIUS);
    const from = { x: -10, z: 0.5 };

    const path = findPathWithin(map, from, tree, REACH);

    const end = path.at(-1) ?? from;
    expect(distanceBetween(end, tree)).toBeLessThanOrEqual(REACH + 1e-9);
    expect(end.x).toBeLessThan(tree.x);
    // A straight walk to the circle's edge.
    expect(path).toHaveLength(1);
    expect(distanceBetween(from, end)).toBeCloseTo(distanceBetween(from, tree) - REACH, 6);
  });

  it("walks round to the nearest side it can reach when the near side is blocked", () => {
    const map = createWalkMap({ size: 100 });
    const tree = { x: 10.5, z: 0.5 };
    blockCircle(map, tree, TREE_RADIUS);
    // A thick screen covers the tree's west side, the side facing the player.
    blockWhere(map, { x: 4, z: -5 }, { x: 9, z: 6 }, (spot) => spot.x < tree.x - 1);
    const from = { x: -10, z: 0.5 };

    const path = findPathWithin(map, from, tree, REACH);

    const end = path.at(-1) ?? from;
    expect(isWalkable(map, end)).toBe(true);
    expect(distanceBetween(end, tree)).toBeLessThanOrEqual(REACH);
    // The player stops round the north or south side, not on the far east side.
    expect(end.x).toBeGreaterThan(tree.x - 1.5);
    expect(end.x).toBeLessThan(tree.x + 0.5);
    expect(Math.abs(end.z - tree.z)).toBeGreaterThan(TREE_RADIUS);
  });

  it("stays put when the player already stands within the distance", () => {
    const map = createWalkMap({ size: 100 });
    const tree = { x: 10.5, z: 0.5 };
    blockCircle(map, tree, TREE_RADIUS);

    expect(findPathWithin(map, { x: 8.7, z: 0.5 }, tree, REACH)).toEqual([]);
  });

  it("walks to the reachable spot nearest the target when nothing within the distance can be reached", () => {
    const map = createWalkMap({ size: 100 });
    const pen = { x: 20, z: 0 };
    blockWhere(map, { x: 10, z: -10 }, { x: 30, z: 10 }, (spot) => {
      const fromPen = Math.hypot(spot.x - pen.x, spot.z - pen.z);
      return fromPen > 4 && fromPen < 6;
    });
    const from = { x: -10, z: 0 };

    const path = findPathWithin(map, from, pen, REACH);

    expect(path).toEqual(findPath(map, from, pen));
    const end = path.at(-1) ?? from;
    expect(distanceBetween(end, pen)).toBeGreaterThan(6);
    expect(distanceBetween(end, pen)).toBeLessThan(7.5);
  });

  describe("to a rectangle, such as a sled's footprint", () => {
    const sled = { min: { x: 9.1, z: -0.4 }, max: { x: 10.9, z: 0.4 } };
    const STAND = 0.9;

    it("measures the distance to the rectangle's edge, and walks straight there on open ground", () => {
      const map = createWalkMap({ size: 100 });
      const from = { x: 10, z: -10 };

      const path = findPathWithin(map, from, sled, STAND);

      expect(path).toHaveLength(1);
      expect(path[0]?.x).toBeCloseTo(10, 6);
      expect(path[0]?.z).toBeCloseTo(-0.4 - STAND, 6);
      expect(distanceToTarget(sled, path[0] ?? from)).toBeCloseTo(STAND, 6);
    });

    it("stays put when the player already stands within the distance of the edge, though further from the middle", () => {
      const map = createWalkMap({ size: 100 });

      expect(findPathWithin(map, { x: 11.5, z: 0.5 }, sled, STAND)).toEqual([]);
    });

    it("walks the short way round a tree between the player and the rectangle, and stops within the distance of its edge", () => {
      const map = createWalkMap({ size: 100 });
      const tree = { x: 10, z: -2.5 };
      blockCircle(map, tree, TREE_RADIUS);
      const from = { x: 10, z: -10 };

      const path = findPathWithin(map, from, sled, STAND);

      const end = path.at(-1) ?? from;
      expect(distanceToTarget(sled, end)).toBeLessThanOrEqual(STAND);
      expect(closestApproach([from, ...path], [tree])).toBeGreaterThan(TREE_RADIUS - 0.75);
      // The player stops on the side they came from, beside the sled's corner, rather than walking on to its middle.
      expect(end.z).toBeLessThan(0);
      expect(pathLength(from, path)).toBeLessThan(pathLength(from, findPath(map, from, { x: 10, z: -0.4 - STAND })));
    });
  });
});

describe("findPath from a spot something now blocks", () => {
  it("steps out to the nearest open square, then walks on, such as after a campfire is placed where the player stands", () => {
    const map = createWalkMap({ size: 100 });
    // The player stands in the middle of a 3 by 3 block of blocked squares.
    blockWhere(map, { x: -1.5, z: -1.5 }, { x: 1.5, z: 1.5 }, () => true);
    const from = { x: 0.5, z: 0.5 };
    const to = { x: 10.5, z: 0.5 };

    const path = findPath(map, from, to);

    expect(path.at(-1)).toEqual(to);
    expect(isWalkable(map, path[0] ?? from)).toBe(true);
  });
});

describe("findPath with walls on the lines between squares", () => {
  it("walks around a wall, though the squares either side stay walkable", () => {
    const map = createWalkMap({ size: 100 });
    // A wall along x = 1, from z = -10 to z = 10.
    const wall = wallAlongX1(-10, 10);
    blockEdges(map, wall);
    const from = { x: -3.5, z: 0.5 };
    const to = { x: 5.5, z: 0.5 };

    const path = findPath(map, from, to);

    expect(isWalkable(map, { x: 0.5, z: 0.5 })).toBe(true);
    expect(isWalkable(map, { x: 1.5, z: 0.5 })).toBe(true);
    expect(path.at(-1)).toEqual(to);
    for (const crossing of crossingsOfX1([from, ...path])) expect(Math.abs(crossing)).toBeGreaterThanOrEqual(10);
  });

  it("walks straight through once the wall is taken away", () => {
    const map = createWalkMap({ size: 100 });
    const wall = wallAlongX1(-10, 10);
    blockEdges(map, wall);
    unblockEdges(map, wall);

    expect(findPath(map, { x: -3.5, z: 0.5 }, { x: 5.5, z: 0.5 })).toEqual([{ x: 5.5, z: 0.5 }]);
  });

  it("cannot get into a square walled in on all four sides, not even across a corner", () => {
    const map = createWalkMap({ size: 100 });
    const inside = { x: 10.5, z: 10.5 };
    blockEdges(map, edgesAround(inside));
    const from = { x: 0.5, z: 0.5 };

    const path = findPath(map, from, inside);

    const end = path.at(-1) ?? from;
    expect(Math.floor(end.x) === 10 && Math.floor(end.z) === 10).toBe(false);
    expect(Math.hypot(end.x - inside.x, end.z - inside.z)).toBeLessThan(1.5);
  });

  it("walks in through the one side left open, and back out again", () => {
    const map = createWalkMap({ size: 100 });
    const inside = { x: 10.5, z: 10.5 };
    // Every side but the one facing +z.
    blockEdges(
      map,
      edgesAround(inside).filter((edge) => edge.to.z <= inside.z),
    );
    const outside = { x: 0.5, z: 0.5 };

    const path = findPath(map, outside, inside);

    expect(path.at(-1)).toEqual(inside);
    // The way in comes through the open side.
    expect(path.some((spot) => spot.z > inside.z + 0.4)).toBe(true);
    expect(findPath(map, inside, outside).at(-1)).toEqual(outside);
  });
});

/** The edges of a wall along the line x = 1, from z = `fromZ` to z = `toZ`. */
function wallAlongX1(fromZ: number, toZ: number): WalkEdge[] {
  const edges: WalkEdge[] = [];
  for (let z = fromZ + 0.5; z < toZ; z += 1) edges.push({ from: { x: 0.5, z }, to: { x: 1.5, z } });
  return edges;
}

/** The four edges around the 1 m square with this middle. */
function edgesAround(middle: GroundPoint): WalkEdge[] {
  return [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].map(([dx = 0, dz = 0]) => ({ from: middle, to: { x: middle.x + dx, z: middle.z + dz } }));
}

/** The z of each spot where a walk along a path crosses the line x = 1. */
function crossingsOfX1(path: readonly GroundPoint[]): number[] {
  const crossings: number[] = [];
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    if (a === undefined || b === undefined || (a.x - 1) * (b.x - 1) > 0 || a.x === b.x) continue;
    crossings.push(a.z + ((b.z - a.z) * (1 - a.x)) / (b.x - a.x));
  }
  return crossings;
}

const TREE_RADIUS = 1.5;

function distanceBetween(a: GroundPoint, b: GroundPoint): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** How far the player walks along a path from `from`. */
function pathLength(from: GroundPoint, path: readonly GroundPoint[]): number {
  let length = 0;
  let at = from;
  for (const spot of path) {
    length += distanceBetween(at, spot);
    at = spot;
  }
  return length;
}

/** Trees 3 m apart along a line of constant x. */
function treeRow({ x, fromZ, toZ }: { x: number; fromZ: number; toZ: number }): GroundPoint[] {
  const trees: GroundPoint[] = [];
  for (let z = fromZ; z <= toZ; z += 3) trees.push({ x, z });
  return trees;
}

/** The closest the walk along a path comes to any of the given spots, checked every 5 cm. */
function closestApproach(path: readonly GroundPoint[], spots: readonly GroundPoint[]): number {
  let closest = Infinity;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    if (a === undefined || b === undefined) continue;
    const samples = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.05);
    for (let s = 0; s <= samples; s += 1) {
      const x = a.x + ((b.x - a.x) * s) / samples;
      const z = a.z + ((b.z - a.z) * s) / samples;
      for (const spot of spots) closest = Math.min(closest, Math.hypot(spot.x - x, spot.z - z));
    }
  }
  return closest;
}
