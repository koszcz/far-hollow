import { describe, expect, it } from "bun:test";
import { SLED_ROPE_SAG_METRES, sledRopePoints } from "./sled-rope";

const hand = { x: 0.2, y: 0.8, z: 0.25 };
const shoulder = { x: 0.2, y: 0.9, z: -0.05 };
const back = { x: 0.2, y: 0.6, z: -0.35 };
const loop = { x: 0.1, y: 0.02, z: -0.9 };

describe("the rope to a dragged sled", () => {
  it("runs from the player's hand, over the shoulder and down the back, to the sled's rope loop", () => {
    const points = sledRopePoints({ hand, shoulder, back }, loop, 21);

    expect(points).toHaveLength(21);
    expect(points[0]).toEqual(hand);
    expect(points).toContainEqual(shoulder);
    expect(points).toContainEqual(back);
    expect(points.at(-1)).toEqual(loop);
    const indexOf = (spot: typeof hand) => points.findIndex((point) => point.x === spot.x && point.y === spot.y && point.z === spot.z);
    expect(indexOf(shoulder)).toBeLessThan(indexOf(back));
  });

  it("sags a little between the player's back and the sled", () => {
    const hold = { hand: { x: 0, y: 0.8, z: 0.3 }, shoulder: { x: 0, y: 0.9, z: 0.1 }, back: { x: 0, y: 1.4, z: 0 } };
    const points = sledRopePoints(hold, { x: 0, y: 0.4, z: -2 }, 21);
    const behind = points.filter((point) => point.z <= 0);
    // The straight line from the back to the loop drops 0.5 m for each metre back.
    const drops = behind.map((point) => 1.4 - 0.5 * -point.z - point.y);

    expect(Math.min(...drops)).toBeGreaterThanOrEqual(-1e-9);
    expect(Math.max(...drops)).toBeGreaterThan(0.01);
    expect(Math.max(...drops)).toBeLessThanOrEqual(SLED_ROPE_SAG_METRES + 1e-9);
    expect(SLED_ROPE_SAG_METRES).toBeLessThan(0.1);
  });
});
