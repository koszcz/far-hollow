import { describe, expect, it } from "bun:test";
import { runnerTipsAt } from "./sled-body-shapes";

describe("the runner tips a dragged sled's rope leaves from", () => {
  // The sled is 1.8 m long. Each tow rope leaves its runner 4 cm in from the tip, above the ground.
  it("are at the front of a sled that faces the default way, along +x, one on each side", () => {
    const tips = runnerTipsAt({ x: 5, y: 1, z: -3 }, 0);

    expect(tips.left.x).toBeCloseTo(5.86, 5);
    expect(tips.right.x).toBeCloseTo(5.86, 5);
    expect(tips.left.y).toBeGreaterThan(1.1);
    expect(tips.left.z).toBeLessThan(-3);
    expect(tips.right.z).toBeGreaterThan(-3);
  });

  it("turn with a dragged sled's heading", () => {
    // Turned a quarter turn, the runners run along -z.
    const tips = runnerTipsAt({ x: 0, y: 0, z: 0 }, Math.PI / 2);

    expect(tips.left.z).toBeCloseTo(-0.86, 5);
    expect(tips.right.z).toBeCloseTo(-0.86, 5);
    expect(tips.left.x).toBeCloseTo(-tips.right.x, 5);
  });
});
