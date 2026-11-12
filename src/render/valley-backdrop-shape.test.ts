import { describe, expect, it } from "bun:test";
import { generateValley } from "../sim/valley";
import { createFarLandGeometry, createRidgeGeometry, createValleyBackdrop } from "./valley-backdrop-shape";

const valley = generateValley(12345);
const half = valley.size / 2;
const backdrop = createValleyBackdrop(valley);

/** Every grid point along the valley's edge, with its height in the valley's terrain. */
function edgePoints(): { x: number; z: number; height: number }[] {
  const { pointsPerSide, spacing, heights } = valley.terrain;
  const last = pointsPerSide - 1;
  const points: { x: number; z: number; height: number }[] = [];
  for (let row = 0; row < pointsPerSide; row += 1) {
    for (let column = 0; column < pointsPerSide; column += 1) {
      if (row !== 0 && row !== last && column !== 0 && column !== last) continue;
      points.push({ x: -half + column * spacing, z: -half + row * spacing, height: heights[row * pointsPerSide + column] ?? NaN });
    }
  }
  return points;
}

describe("valley backdrop seam", () => {
  it("starts at the valley ground's height at every point along the valley's edge", () => {
    for (const point of edgePoints()) expect(backdrop.heightAt(point.x, point.z)).toBeCloseTo(point.height, 6);
  });

  it("has a ridge mesh whose inner edge sits on every grid point of the valley's edge, at its exact height", () => {
    const positions = createRidgeGeometry(valley, backdrop).getAttribute("position");
    const seam = new Map<string, number[]>();
    for (let index = 0; index < positions.count; index += 1) {
      const key = `${positions.getX(index).toFixed(3)},${positions.getZ(index).toFixed(3)}`;
      seam.set(key, [...(seam.get(key) ?? []), positions.getY(index)]);
    }
    for (const point of edgePoints()) {
      const heights = seam.get(`${point.x.toFixed(3)},${point.z.toFixed(3)}`);
      expect(heights).toBeDefined();
      for (const height of heights ?? []) expect(height).toBeCloseTo(point.height, 4);
    }
  });
});

describe("valley backdrop ridges", () => {
  it("rise to about 40 m above the valley floor on all four sides", () => {
    const crest = 60 + 150;
    // Middles of the west and east sides, and spots on the north and south sides away from the river.
    const riverEnds = [valley.river.path[0], valley.river.path[valley.river.path.length - 1]];
    const spots = [
      { x: -crest, z: 0 },
      { x: crest, z: 0 },
      { x: (riverEnds[0]?.x ?? 0) > 0 ? -100 : 100, z: -crest },
      { x: (riverEnds[1]?.x ?? 0) > 0 ? -100 : 100, z: crest },
    ];
    for (const spot of spots) {
      const height = backdrop.heightAt(spot.x, spot.z);
      expect(height).toBeGreaterThanOrEqual(37);
      expect(height).toBeLessThanOrEqual(43);
    }
  });

  it("open a gorge where the river runs out at each end, at about the riverbed's height", () => {
    for (const run of backdrop.riverRuns) {
      expect(run.length).toBeGreaterThan(1);
      for (const point of run) expect(backdrop.heightAt(point.x, point.z)).toBeLessThan(2);
    }
    // The river comes in at z = -150 and leaves at z = 150.
    expect(backdrop.riverRuns[0]?.at(-1)?.z).toBeCloseTo(-half);
    expect(backdrop.riverRuns[1]?.[0]?.z).toBeCloseTo(half);
  });

  it("face upward everywhere, so they are lit from above", () => {
    const normals = createRidgeGeometry(valley, backdrop).getAttribute("normal");
    for (let index = 0; index < normals.count; index += 1) expect(normals.getY(index)).toBeGreaterThan(0);
  });

  it("are covered in trees, none on the gorge floors", () => {
    expect(backdrop.trees.length).toBeGreaterThan(3000);
    for (const run of backdrop.riverRuns) {
      for (const point of run) {
        for (const tree of backdrop.trees) expect(Math.hypot(tree.x - point.x, tree.z - point.z)).toBeGreaterThan(8);
      }
    }
  });

  it("come out the same for the same seed", () => {
    const again = createValleyBackdrop(generateValley(12345));
    expect(again.trees).toEqual(backdrop.trees);
    expect(again.heightAt(-260, 40)).toBe(backdrop.heightAt(-260, 40));
    expect(again.heightAt(1300, -900)).toBe(backdrop.heightAt(1300, -900));
  });
});

describe("valley backdrop far land", () => {
  const farLand = createFarLandGeometry(valley, backdrop);
  const positions = farLand.getAttribute("position");

  it("faces upward everywhere", () => {
    const normals = farLand.getAttribute("normal");
    for (let index = 0; index < normals.count; index += 1) expect(normals.getY(index)).toBeGreaterThan(0);
  });

  it("holds mountains between 1 km and 3 km away, inside the camera's 4 km draw distance", () => {
    let highestNear = 0;
    let farthest = 0;
    for (let index = 0; index < positions.count; index += 1) {
      const distance = Math.hypot(positions.getX(index), positions.getZ(index));
      farthest = Math.max(farthest, distance);
      if (distance < 1000) highestNear = Math.max(highestNear, positions.getY(index));
    }
    expect(farthest).toBeLessThan(4000);
    // Within 1 km, the land stays low. Mountains start further out.
    expect(highestNear).toBeLessThan(120);
    const ring = (distance: number) =>
      Array.from({ length: 64 }, (_, step) => backdrop.heightAt(Math.cos(step / 10) * distance, Math.sin(step / 10) * distance));
    expect(Math.max(...ring(1400))).toBeGreaterThan(150);
    expect(Math.max(...ring(2700))).toBeGreaterThan(300);
  });

  it("stays under the ridge where the two overlap", () => {
    const half = valley.size / 2;
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const z = positions.getZ(index);
      const fromEdge = Math.hypot(x - Math.max(-half, Math.min(half, x)), z - Math.max(-half, Math.min(half, z)));
      if (fromEdge < 200) expect(positions.getY(index)).toBeLessThan(backdrop.heightAt(x, z));
    }
  });
});
