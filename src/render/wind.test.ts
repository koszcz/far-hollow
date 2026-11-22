import { describe, expect, it } from "bun:test";
import { easeRainShare, RAIN_EASE_SECONDS, windStrength } from "./wind";

/** The wind's strength once a second for ten minutes. */
function strengths(rainShare: number): number[] {
  return Array.from({ length: 600 }, (_, second) => windStrength(second, rainShare));
}

describe("the wind", () => {
  it("stays between calm (0) and a gale (1)", () => {
    for (const strength of [...strengths(0), ...strengths(1)]) {
      expect(strength).toBeGreaterThanOrEqual(0);
      expect(strength).toBeLessThanOrEqual(1);
    }
  });

  it("is a gentle breeze with slow gusts when dry", () => {
    const dry = strengths(0);
    expect(Math.max(...dry)).toBeLessThan(0.5);
    expect(Math.min(...dry)).toBeGreaterThan(0);
    expect(Math.max(...dry) - Math.min(...dry)).toBeGreaterThan(0.1);
  });

  it("blows harder in the rain than ever in dry weather", () => {
    expect(Math.min(...strengths(1))).toBeGreaterThan(Math.max(...strengths(0)));
  });

  it("is in between while rain eases in", () => {
    expect(windStrength(100, 0.5)).toBeGreaterThan(windStrength(100, 0));
    expect(windStrength(100, 0.5)).toBeLessThan(windStrength(100, 1));
  });
});

describe("easing the rain in and out", () => {
  it("takes RAIN_EASE_SECONDS to go from dry to full rain, and back", () => {
    expect(easeRainShare(0, true, RAIN_EASE_SECONDS / 2)).toBeCloseTo(0.5);
    expect(easeRainShare(0, true, RAIN_EASE_SECONDS)).toBe(1);
    expect(easeRainShare(1, false, RAIN_EASE_SECONDS / 4)).toBeCloseTo(0.75);
    expect(easeRainShare(0.2, false, RAIN_EASE_SECONDS)).toBe(0);
  });
});
