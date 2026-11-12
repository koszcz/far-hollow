import { describe, expect, it } from "bun:test";
import { createGroundMap, groundTypeAt, groundTypeWeightsAt } from "./ground-types";
import { generateValley, type GroundPoint, type River } from "./valley";

/** A straight river along x = 0, 8 m wide, so its water ends 4 m from its middle. */
const straightRiver: River = {
  path: [
    { x: 0, z: -500 },
    { x: 0, z: 500 },
  ],
  width: 8,
};

function mapWith(trees: readonly GroundPoint[]) {
  return createGroundMap({ size: 1000, river: straightRiver, trees });
}

describe("groundTypeAt", () => {
  it("is forest floor a metre from a tree", () => {
    const map = mapWith([{ x: 100, z: 0 }]);
    expect(groundTypeAt(map, { x: 101, z: 0 })).toBe("forestFloor");
  });

  it("is a clearing in the open, far from trees and the river", () => {
    const map = mapWith([{ x: 100, z: 0 }]);
    expect(groundTypeAt(map, { x: 200, z: 50 })).toBe("clearing");
  });

  it("is river bank on the slope just beyond the water", () => {
    const map = mapWith([]);
    expect(groundTypeAt(map, { x: 7, z: 0 })).toBe("riverBank");
    expect(groundTypeAt(map, { x: -7, z: 120 })).toBe("riverBank");
  });

  it("is river bank beside the water even with a tree close by", () => {
    const map = mapWith([{ x: 9, z: 0 }]);
    expect(groundTypeAt(map, { x: 7, z: 0 })).toBe("riverBank");
  });

  it("is a clearing well up the slope, away from the river bank", () => {
    const map = mapWith([]);
    expect(groundTypeAt(map, { x: 30, z: 0 })).toBe("clearing");
  });

  it("gives the same ground for the same seed", () => {
    const spots = Array.from({ length: 400 }, (_, i) => ({ x: (i % 20) * 37 - 370, z: Math.floor(i / 20) * 37 - 370 }));
    const first = createGroundMap(generateValley(99));
    const second = createGroundMap(generateValley(99));
    expect(spots.map((spot) => groundTypeAt(first, spot))).toEqual(spots.map((spot) => groundTypeAt(second, spot)));
  });

  it("finds all three ground types in a generated valley", () => {
    const map = createGroundMap(generateValley(99));
    const found = new Set<string>();
    for (let x = -480; x <= 480; x += 2) {
      for (let z = -480; z <= 480; z += 40) found.add(groundTypeAt(map, { x, z }));
    }
    expect([...found].sort()).toEqual(["clearing", "forestFloor", "riverBank"]);
  });
});

describe("groundTypeWeightsAt", () => {
  it("adds up to 1 everywhere", () => {
    const map = mapWith([{ x: 10, z: 0 }]);
    for (let x = -20; x <= 30; x += 0.5) {
      const weights = groundTypeWeightsAt(map, { x, z: 1 });
      expect(weights.forestFloor + weights.clearing + weights.riverBank).toBeCloseTo(1, 6);
    }
  });

  it("blends forest floor into clearing without a hard edge", () => {
    const map = mapWith([{ x: 100, z: 0 }]);
    let previous = groundTypeWeightsAt(map, { x: 100, z: 0 }).forestFloor;
    expect(previous).toBe(1);
    let sawBlend = false;
    for (let x = 100.25; x <= 112; x += 0.25) {
      const forestFloor = groundTypeWeightsAt(map, { x, z: 0 }).forestFloor;
      expect(previous - forestFloor).toBeLessThan(0.15);
      if (forestFloor > 0.2 && forestFloor < 0.8) sawBlend = true;
      previous = forestFloor;
    }
    expect(previous).toBe(0);
    expect(sawBlend).toBe(true);
  });

  it("blends river bank into clearing without a hard edge", () => {
    const map = mapWith([]);
    let previous = groundTypeWeightsAt(map, { x: 4, z: 0 }).riverBank;
    expect(previous).toBe(1);
    for (let x = 4.25; x <= 20; x += 0.25) {
      const riverBank = groundTypeWeightsAt(map, { x, z: 0 }).riverBank;
      expect(previous - riverBank).toBeLessThan(0.15);
      previous = riverBank;
    }
    expect(previous).toBe(0);
  });
});
