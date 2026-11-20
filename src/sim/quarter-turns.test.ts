import { describe, expect, it } from "bun:test";
import { areAtRightAngles, areOpposite, nearestQuarterTurns, quarterTurnsToRadians, turnOffset, turnQuarters, wrapQuarterTurns } from "./quarter-turns";

describe("turnQuarters", () => {
  it("turns one step clockwise", () => {
    expect(turnQuarters(0, 1)).toBe(1);
    expect(turnQuarters(2, 1)).toBe(3);
  });

  it("wraps past 3 back to 0", () => {
    expect(turnQuarters(3, 1)).toBe(0);
    expect(turnQuarters(2, 3)).toBe(1);
  });

  it("turns back for a negative number of steps", () => {
    expect(turnQuarters(0, -1)).toBe(3);
    expect(turnQuarters(1, -6)).toBe(3);
  });
});

describe("wrapQuarterTurns", () => {
  it("keeps 0 to 3 as they are", () => {
    expect([0, 1, 2, 3].map(wrapQuarterTurns)).toEqual([0, 1, 2, 3]);
  });

  it("wraps numbers above 3", () => {
    expect(wrapQuarterTurns(4)).toBe(0);
    expect(wrapQuarterTurns(7)).toBe(3);
    expect(wrapQuarterTurns(9)).toBe(1);
  });

  it("wraps negative numbers", () => {
    expect(wrapQuarterTurns(-1)).toBe(3);
    expect(wrapQuarterTurns(-4)).toBe(0);
    expect(wrapQuarterTurns(-6)).toBe(2);
  });

  it("never gives negative zero", () => {
    expect(Object.is(wrapQuarterTurns(-4), 0)).toBe(true);
  });
});

describe("areOpposite", () => {
  it("is true for turns a half turn apart", () => {
    expect(areOpposite(0, 2)).toBe(true);
    expect(areOpposite(3, 1)).toBe(true);
  });

  it("is false for the same turn or a quarter turn apart", () => {
    expect(areOpposite(1, 1)).toBe(false);
    expect(areOpposite(0, 1)).toBe(false);
    expect(areOpposite(0, 3)).toBe(false);
  });
});

describe("areAtRightAngles", () => {
  it("is true for turns a quarter turn apart either way", () => {
    expect(areAtRightAngles(0, 1)).toBe(true);
    expect(areAtRightAngles(0, 3)).toBe(true);
    expect(areAtRightAngles(2, 1)).toBe(true);
  });

  it("is false for the same or opposite turns", () => {
    expect(areAtRightAngles(2, 2)).toBe(false);
    expect(areAtRightAngles(0, 2)).toBe(false);
  });
});

describe("quarterTurnsToRadians", () => {
  it("turns clockwise seen from above, which is negative about the vertical axis", () => {
    expect(quarterTurnsToRadians(0)).toBeCloseTo(0);
    expect(quarterTurnsToRadians(1)).toBeCloseTo(-1.5708, 4);
    expect(quarterTurnsToRadians(2)).toBeCloseTo(-3.1416, 4);
    expect(quarterTurnsToRadians(3)).toBeCloseTo(-4.7124, 4);
  });
});

describe("nearestQuarterTurns", () => {
  it("gives back the turn a facing's radians came from", () => {
    for (const turns of [0, 1, 2, 3] as const) expect(nearestQuarterTurns(quarterTurnsToRadians(turns))).toBe(turns);
  });

  it("rounds a heading to the nearest quarter turn", () => {
    expect(nearestQuarterTurns(-1.4)).toBe(1);
    expect(nearestQuarterTurns(0.3)).toBe(0);
    expect(nearestQuarterTurns(1.7)).toBe(3);
  });

  it("gives a half turn for headings either side of a half turn", () => {
    expect(nearestQuarterTurns(Math.PI)).toBe(2);
    expect(nearestQuarterTurns(-Math.PI)).toBe(2);
    expect(nearestQuarterTurns(3.1)).toBe(2);
    expect(nearestQuarterTurns(-3.1)).toBe(2);
  });
});

describe("turnOffset", () => {
  it("leaves an offset as it is for no turn", () => {
    expect(turnOffset({ x: 1, z: 2 }, 0)).toEqual({ x: 1, z: 2 });
  });

  it("turns +z to -x, -z, then +x, one quarter turn at a time", () => {
    expect(turnOffset({ x: 0, z: 1 }, 1)).toEqual({ x: -1, z: 0 });
    expect(turnOffset({ x: 0, z: 1 }, 2)).toEqual({ x: -0, z: -1 });
    expect(turnOffset({ x: 0, z: 1 }, 3)).toEqual({ x: 1, z: -0 });
  });

  it("turns the same way the renderer turns a shape", () => {
    // three.js turns (x, z) by an angle about y to (x cos angle + z sin angle, -x sin angle + z cos angle).
    const offset = { x: 0.4, z: 1.5 };
    for (const turns of [0, 1, 2, 3] as const) {
      const angle = quarterTurnsToRadians(turns);
      const turned = turnOffset(offset, turns);
      expect(turned.x).toBeCloseTo(offset.x * Math.cos(angle) + offset.z * Math.sin(angle));
      expect(turned.z).toBeCloseTo(-offset.x * Math.sin(angle) + offset.z * Math.cos(angle));
    }
  });
});
