import { describe, expect, it } from "bun:test";
import { easeRainShare, RAIN_EASE_SECONDS, windAt, windDirection, windStrength } from "./wind";

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

describe("the wind's direction", () => {
  it("is the same for the same seed and game hour", () => {
    expect(windDirection(7, 30.5)).toEqual(windDirection(7, 30.5));
  });

  it("differs between seeds", () => {
    const one = windDirection(7, 30);
    const other = windDirection(8, 30);
    expect(Math.hypot(one.x - other.x, one.z - other.z)).toBeGreaterThan(0.01);
  });

  it("is a direction on the ground, one unit long", () => {
    for (const hour of [0, 5.5, 13, 100]) {
      const { x, z } = windDirection(3, hour);
      expect(Math.hypot(x, z)).toBeCloseTo(1);
    }
  });

  it("drifts slowly over game hours", () => {
    const turnBetween = (from: number, to: number): number => {
      const a = windDirection(11, from);
      const b = windDirection(11, to);
      return Math.acos(Math.min(1, a.x * b.x + a.z * b.z));
    };
    // It barely moves in a game minute.
    for (let hour = 0; hour < 48; hour += 0.5) expect(turnBetween(hour, hour + 1 / 60)).toBeLessThan(0.01);
    // It turns well round at some point over three game days.
    let most = 0;
    for (let hour = 0; hour < 72; hour += 1) most = Math.max(most, turnBetween(0, hour));
    expect(most).toBeGreaterThan(0.5);
  });
});

describe("the wind at a moment", () => {
  it("does not follow the time of day", () => {
    const wind = (gameHours: number) => windAt({ seed: 5, nowSeconds: 120, gameHours, rainShare: 0 });
    expect(wind(3).strength).toBe(wind(15).strength);
  });

  it("is the same for the same seed and moment", () => {
    const moment = { seed: 5, nowSeconds: 77, gameHours: 9, rainShare: 0.3 };
    expect(windAt(moment)).toEqual(windAt({ ...moment }));
  });

  it("blows harder in full rain than when dry", () => {
    const moment = { seed: 5, nowSeconds: 77, gameHours: 9 };
    expect(windAt({ ...moment, rainShare: 1 }).strength).toBeGreaterThan(windAt({ ...moment, rainShare: 0 }).strength);
  });
});
