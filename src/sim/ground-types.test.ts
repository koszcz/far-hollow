import { describe, expect, it } from "bun:test";
import { createGroundMap, groundMapNow, groundTypeAt, groundTypeWeightsAt } from "./ground-types";
import type { GroundChange } from "./ground-change";
import { generateValley, type River } from "./valley";
import { type GroundPoint } from "./ground-point";

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

describe("the ground now, after trees go or come for good", () => {
  const DAY = 24 * 60;
  const tree = { x: 100, z: 0 };
  const gone = (startedAtMinutes: number): GroundChange => ({ x: tree.x, z: tree.z, toward: "clearing", startedAtMinutes });
  const grown = (startedAtMinutes: number): GroundChange => ({ x: tree.x, z: tree.z, toward: "forestFloor", startedAtMinutes });

  it("turns forest floor into clearing over 3 game days where a tree went for good", () => {
    const start = mapWith([tree]);
    expect(groundTypeAt(groundMapNow(start, [gone(0)], 0), { x: 101, z: 0 })).toBe("forestFloor");
    expect(groundTypeAt(groundMapNow(start, [gone(0)], DAY), { x: 101, z: 0 })).toBe("forestFloor");
    const done = groundMapNow(start, [gone(0)], 3 * DAY);
    for (let x = 90; x <= 110; x += 0.5) expect(groundTypeWeightsAt(done, { x, z: 0 }).forestFloor).toBe(0);
  });

  it("changes a little at a time over the 3 days, with no jump when the change starts or ends", () => {
    const start = mapWith([tree]);
    const spot = { x: 103, z: 1 };
    const at = (minutes: number) => groundTypeWeightsAt(groundMapNow(start, [gone(0)], minutes), spot).forestFloor;
    expect(at(0)).toBe(groundTypeWeightsAt(start, spot).forestFloor);
    expect(at(10)).toBeCloseTo(at(0), 3);
    expect(at(3 * DAY - 10)).toBeCloseTo(0, 3);
    let previous = at(0);
    for (let minutes = 60; minutes <= 3 * DAY; minutes += 60) {
      const now = at(minutes);
      expect(previous - now).toBeLessThan(0.05);
      expect(now).toBeLessThanOrEqual(previous);
      previous = now;
    }
  });

  it("keeps the forest floor of the trees still standing nearby", () => {
    const neighbour = { x: 104, z: 0 };
    const done = groundMapNow(mapWith([tree, neighbour]), [gone(0)], 3 * DAY);
    expect(groundTypeAt(done, { x: 105, z: 0 })).toBe("forestFloor");
    expect(groundTypeAt(done, { x: 101, z: 0 })).toBe("forestFloor");
    expect(groundTypeAt(done, { x: 94, z: 0 })).toBe("clearing");
  });

  it("turns clearing into forest floor around a new full tree over 3 game days, as far as a starting tree reaches", () => {
    const open = mapWith([]);
    const spot = { x: 101, z: 0 };
    expect(groundTypeWeightsAt(groundMapNow(open, [grown(0)], 0), spot).forestFloor).toBe(0);
    expect(groundTypeAt(groundMapNow(open, [grown(0)], DAY / 2), spot)).toBe("clearing");
    const done = groundMapNow(open, [grown(0)], 3 * DAY);
    const starting = mapWith([tree]);
    for (let x = 90; x <= 110; x += 0.5) {
      expect(groundTypeWeightsAt(done, { x, z: 2 })).toEqual(groundTypeWeightsAt(starting, { x, z: 2 }));
    }
  });

  it("never changes the river bank", () => {
    const besideRiver = { x: 9, z: 0 };
    const start = mapWith([besideRiver]);
    const changes: GroundChange[] = [{ ...gone(0), x: besideRiver.x, z: besideRiver.z }];
    for (let x = 4; x <= 14; x += 0.25) {
      const before = groundTypeWeightsAt(start, { x, z: 0 });
      const isBank = groundTypeAt(start, { x, z: 0 }) === "riverBank";
      for (let minutes = 0; minutes <= 3 * DAY; minutes += DAY / 4) {
        const now = groundMapNow(start, changes, minutes);
        expect(groundTypeWeightsAt(now, { x, z: 0 }).riverBank).toBe(before.riverBank);
        expect(groundTypeAt(now, { x, z: 0 }) === "riverBank").toBe(isBank);
      }
    }
  });

  it("leaves the starting map as it was", () => {
    const start = mapWith([tree]);
    groundMapNow(start, [gone(0)], 3 * DAY);
    expect(groundTypeAt(start, { x: 101, z: 0 })).toBe("forestFloor");
  });
});
