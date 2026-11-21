import { describe, expect, it } from "bun:test";
import { SLED_KNOT_METRES, SLED_ROPE_SAG_METRES, sledBridlePoints, sledRopeKnot, sledRopePoints } from "./sled-rope";

const hand = { x: 0, y: 0.45, z: 0 };
const tips = { left: { x: -0.2, y: 0.23, z: -1 }, right: { x: 0.2, y: 0.23, z: -1 } };

describe("the rope to a dragged sled", () => {
  it("ties the V's knot in front of the runner tips, lifted toward the hand", () => {
    const knot = sledRopeKnot({ hand }, tips);

    expect(Math.hypot(knot.x, knot.y - 0.23, knot.z + 1)).toBeCloseTo(SLED_KNOT_METRES, 6);
    expect(knot.y).toBeGreaterThan(0.23);
    expect(knot.z).toBeGreaterThan(-1);
  });

  it("runs the V from one runner tip, through the knot, to the other", () => {
    const knot = sledRopeKnot({ hand }, tips);
    const points = sledBridlePoints(tips, knot, 21);

    expect(points).toHaveLength(21);
    expect(points[0]).toEqual(tips.left);
    expect(points[10]).toEqual(knot);
    expect(points.at(-1)).toEqual(tips.right);
  });

  it("runs from the knot to the hand, sagging a little", () => {
    const points = sledRopePoints({ hand: { x: 0, y: 1.4, z: 0 } }, { x: 0, y: 0.4, z: -2 }, 21);
    // The straight line from the hand to the knot drops 0.5 m for each metre back.
    const drops = points.map((point) => 1.4 - 0.5 * -point.z - point.y);

    expect(points.at(-1)).toEqual({ x: 0, y: 1.4, z: 0 });
    expect(Math.min(...drops)).toBeGreaterThanOrEqual(-1e-9);
    expect(Math.max(...drops)).toBeGreaterThan(0.01);
    expect(Math.max(...drops)).toBeLessThanOrEqual(SLED_ROPE_SAG_METRES + 1e-9);
  });
});
