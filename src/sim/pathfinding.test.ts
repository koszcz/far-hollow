import { describe, expect, it } from "vitest";
import { findPath } from "./pathfinding";
import type { GroundPoint } from "./valley";
import { blockCircle, blockWhere, createWalkMap } from "./walk-map";

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
