import { describe, expect, it } from "bun:test";
import { clampShare, easeToward, equalPowerCrossfade, smoothStep } from "./share";

describe("a share", () => {
  it("clamps to 0 and 1", () => {
    expect(clampShare(-0.5)).toBe(0);
    expect(clampShare(0.4)).toBe(0.4);
    expect(clampShare(1.7)).toBe(1);
  });

  it("eases toward a target by at most one step, and never past it", () => {
    expect(easeToward(0.2, 1, 0.3)).toBeCloseTo(0.5);
    expect(easeToward(0.8, 0, 0.3)).toBeCloseTo(0.5);
    expect(easeToward(0.9, 1, 0.3)).toBe(1);
    expect(easeToward(0.1, 0, 0.3)).toBe(0);
    expect(easeToward(0.4, 0.4, 0.3)).toBe(0.4);
  });

  it("eases in and out smoothly, with no sudden start or stop", () => {
    expect(smoothStep(0)).toBe(0);
    expect(smoothStep(0.5)).toBe(0.5);
    expect(smoothStep(1)).toBe(1);
    expect(smoothStep(0.1)).toBeCloseTo(0.028);
    expect(smoothStep(2)).toBe(1);
  });
});

describe("an equal-power crossfade", () => {
  it("plays only the first sound at 0 and only the second at 1, exactly", () => {
    expect(equalPowerCrossfade(0)).toEqual({ from: 1, to: 0 });
    expect(equalPowerCrossfade(1)).toEqual({ from: 0, to: 1 });
  });

  it("keeps the total power even halfway, so the sound never dips", () => {
    const half = equalPowerCrossfade(0.5);
    expect(half.from).toBeCloseTo(Math.SQRT1_2);
    expect(half.to).toBeCloseTo(Math.SQRT1_2);
    for (let share = 0; share <= 1; share += 0.1) {
      const { from, to } = equalPowerCrossfade(share);
      expect(from * from + to * to).toBeCloseTo(1);
    }
  });

  it("clamps a share outside 0 to 1", () => {
    expect(equalPowerCrossfade(-1)).toEqual({ from: 1, to: 0 });
    expect(equalPowerCrossfade(3)).toEqual({ from: 0, to: 1 });
  });
});
