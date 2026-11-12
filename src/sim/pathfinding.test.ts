import { describe, expect, it } from "bun:test";
import { findPath } from "./pathfinding";
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
