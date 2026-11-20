import { describe, expect, it } from "bun:test";
import { ropeLoopAt } from "./sled-meshes";

describe("the loop at the front of a sled's rope", () => {
  // The tow rope's knot is 1.2 m in front of the sled's middle, and the loop beyond it is 0.12 m across.
  it("is at the front of a sled that faces the default way, along +x", () => {
    const loop = ropeLoopAt({ x: 5, y: 1, z: -3 }, 0);

    expect(loop.x).toBeCloseTo(6.32, 5);
    expect(loop.y).toBeGreaterThan(1);
    expect(loop.y).toBeLessThan(1.05);
    expect(loop.z).toBeCloseTo(-3, 5);
  });

  it("turns with a dragged sled's heading", () => {
    // Turned a quarter turn, the runners run along -z.
    const loop = ropeLoopAt({ x: 0, y: 0, z: 0 }, Math.PI / 2);

    expect(loop.x).toBeCloseTo(0, 5);
    expect(loop.z).toBeCloseTo(-1.32, 5);
  });
});
