import { describe, expect, it } from "vitest";
import { daylightAt } from "./daylight";

describe("daylightAt", () => {
  it("is full daylight in the middle of the day", () => {
    expect(daylightAt(12)).toBe(1);
  });

  it("is fully dark all night, from 20:00 until morning at 06:00", () => {
    for (const hour of [20, 22, 0, 3, 5.99]) expect(daylightAt(hour)).toBe(0);
  });

  it("grows through the dawn and fades through the dusk", () => {
    expect(daylightAt(7)).toBeGreaterThan(0);
    expect(daylightAt(7)).toBeLessThan(1);
    expect(daylightAt(19)).toBeGreaterThan(0);
    expect(daylightAt(19)).toBeLessThan(1);
  });

  it("changes smoothly, never jumping more than 2% in one game minute", () => {
    let previous = daylightAt(0);
    for (let minute = 1; minute <= 24 * 60; minute += 1) {
      const current = daylightAt((minute / 60) % 24);
      expect(Math.abs(current - previous)).toBeLessThan(0.02);
      previous = current;
    }
  });
});
