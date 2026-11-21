import { describe, expect, it } from "bun:test";
import {
  SLED_KNOT_METRES,
  SLED_KNOT_SLACK_DROP_METRES,
  SLED_ROPE_SLACK_SAG_METRES,
  SLED_ROPE_TAUT_SAG_METRES,
  sledBridlePoints,
  sledRopeKnot,
  sledRopePoints,
  sledRopeSlack,
} from "./sled-rope";

const hand = { x: 0, y: 0.45, z: 0 };
const walking = { hand, walking: true };
const tips = { left: { x: -0.2, y: 0.23, z: -1 }, right: { x: 0.2, y: 0.23, z: -1 } };

/** How far each point hangs below the straight line from a hand at 1.4 m to a knot 2 m back at 0.4 m. */
const drops = (slack: number): number[] =>
  sledRopePoints({ hand: { x: 0, y: 1.4, z: 0 }, walking: slack === 0 }, { x: 0, y: 0.4, z: -2 }, 21, slack).map((point) => 1.4 - 0.5 * -point.z - point.y);

describe("the rope to a dragged sled", () => {
  it("ties the V's knot in front of the runner tips, lifted toward the hand while taut", () => {
    const knot = sledRopeKnot(walking, tips, 0);

    expect(Math.hypot(knot.x, knot.y - 0.23, knot.z + 1)).toBeCloseTo(SLED_KNOT_METRES, 6);
    expect(knot.y).toBeGreaterThan(0.23);
    expect(knot.z).toBeGreaterThan(-1);
  });

  it("lets the knot drop when slack, but not below the runner tips", () => {
    const taut = sledRopeKnot(walking, tips, 0);
    const slack = sledRopeKnot(walking, tips, 1);

    expect(slack.y).toBeLessThan(taut.y);
    expect(slack.y).toBeGreaterThanOrEqual(Math.max(0.23, taut.y - SLED_KNOT_SLACK_DROP_METRES) - 1e-9);
  });

  it("runs the V from one runner tip, through the knot, to the other", () => {
    const knot = sledRopeKnot(walking, tips, 0);
    const points = sledBridlePoints(tips, knot, 21, 0);

    expect(points).toHaveLength(21);
    expect(points[0]).toEqual(tips.left);
    expect(points[10]).toEqual(knot);
    expect(points.at(-1)).toEqual(tips.right);
  });

  it("runs from the knot to the hand, nearly straight while taut", () => {
    expect(Math.min(...drops(0))).toBeGreaterThanOrEqual(-1e-9);
    expect(Math.max(...drops(0))).toBeCloseTo(SLED_ROPE_TAUT_SAG_METRES, 6);
  });

  it("sags further when slack", () => {
    expect(Math.max(...drops(1))).toBeCloseTo(SLED_ROPE_SLACK_SAG_METRES, 6);
  });

  it("eases toward taut while walking and toward slack while standing", () => {
    const easing = sledRopeSlack(0, false, 1 / 60);

    expect(easing).toBeGreaterThan(0);
    expect(easing).toBeLessThan(0.5);
    expect(sledRopeSlack(1, true, 1 / 60)).toBeLessThan(1);
    expect(sledRopeSlack(0.5, false, 0)).toBe(0.5);
  });

  it("jumps straight to taut or slack the first time, or after a jump in time", () => {
    expect(sledRopeSlack(undefined, false, 0)).toBe(1);
    expect(sledRopeSlack(0, false, 2)).toBe(1);
    expect(sledRopeSlack(1, true, -1)).toBe(0);
  });
});
