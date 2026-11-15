import { describe, expect, it } from "bun:test";
import { dayShare, timeOfDayWord } from "./clock-face";

describe("the HUD clock", () => {
  it("names the time of day", () => {
    expect([0, 5.99, 6, 11.99, 12, 16.99, 17, 19.99, 20, 23.99].map(timeOfDayWord)).toEqual([
      "night",
      "night",
      "morning",
      "morning",
      "afternoon",
      "afternoon",
      "evening",
      "evening",
      "night",
      "night",
    ]);
  });

  it("fills its ring with the share of the day that has passed", () => {
    expect(dayShare(0)).toBe(0);
    expect(dayShare(6)).toBe(0.25);
    expect(dayShare(12)).toBe(0.5);
    expect(dayShare(18)).toBe(0.75);
    expect(dayShare(8.15)).toBeCloseTo(0.34, 2);
  });

  it("keeps the ring between empty and full", () => {
    expect(dayShare(-1)).toBe(0);
    expect(dayShare(25)).toBe(1);
  });
});
