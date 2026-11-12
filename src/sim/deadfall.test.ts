import { describe, expect, it } from "bun:test";
import { layDeadfall } from "./deadfall";
import { createRandom } from "./random";

describe("layDeadfall", () => {
  const tree = { x: 10, z: -5 };

  it("lays the asked number of sticks in the 1.5 to 4 m ring around the tree", () => {
    const random = createRandom(9);
    for (let i = 0; i < 50; i += 1) {
      const sticks = layDeadfall(random, tree, 5, () => true);
      expect(sticks).toHaveLength(5);
      for (const stick of sticks ?? []) {
        const fromTree = Math.hypot(stick.x - tree.x, stick.z - tree.z);
        expect(fromTree).toBeGreaterThanOrEqual(1.5);
        expect(fromTree).toBeLessThanOrEqual(4);
      }
    }
  });

  it("gives up when there is no open spot, so the caller can try another tree", () => {
    expect(layDeadfall(createRandom(9), tree, 4, () => false)).toBeUndefined();
  });

  it("lays sticks only on open spots", () => {
    const eastOnly = (spot: { x: number }) => spot.x > tree.x;
    const random = createRandom(3);
    let laid = 0;
    for (let i = 0; i < 50; i += 1) {
      const sticks = layDeadfall(random, tree, 3, eastOnly);
      if (sticks === undefined) continue;
      laid += 1;
      for (const stick of sticks) expect(stick.x).toBeGreaterThan(tree.x);
    }
    expect(laid).toBeGreaterThan(0);
  });
});
