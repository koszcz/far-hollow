import { describe, expect, it } from "bun:test";
import { nightHoursOf } from "../sim/season";
import { daylightAt } from "./daylight";

const SPRING = nightHoursOf("spring");

describe("daylightAt", () => {
  it("is full daylight in the middle of the day", () => {
    expect(daylightAt(12, SPRING)).toBe(1);
  });

  it("is fully dark all night, from 20:00 until morning at 06:00", () => {
    for (const hour of [20, 22, 0, 3, 5.99]) expect(daylightAt(hour, SPRING)).toBe(0);
  });

  it("grows through the dawn and fades through the dusk", () => {
    expect(daylightAt(7, SPRING)).toBeGreaterThan(0);
    expect(daylightAt(7, SPRING)).toBeLessThan(1);
    expect(daylightAt(19, SPRING)).toBeGreaterThan(0);
    expect(daylightAt(19, SPRING)).toBeLessThan(1);
  });

  it("follows the season's night hours: dark from 17:00 until 8:00 in winter, light from 5:00 until 21:00 in summer", () => {
    const winter = nightHoursOf("winter");
    for (const hour of [17, 22, 0, 7.99]) expect(daylightAt(hour, winter)).toBe(0);
    expect(daylightAt(9, winter)).toBeGreaterThan(0);
    expect(daylightAt(9, winter)).toBeLessThan(1);
    expect(daylightAt(12, winter)).toBe(1);
    expect(daylightAt(16, winter)).toBeLessThan(1);
    const summer = nightHoursOf("summer");
    expect(daylightAt(5.5, summer)).toBeGreaterThan(0);
    expect(daylightAt(20.5, summer)).toBeGreaterThan(0);
    expect(daylightAt(21, summer)).toBe(0);
  });

  it("changes smoothly, never jumping more than 2% in one game minute", () => {
    let previous = daylightAt(0, SPRING);
    for (let minute = 1; minute <= 24 * 60; minute += 1) {
      const current = daylightAt((minute / 60) % 24, SPRING);
      expect(Math.abs(current - previous)).toBeLessThan(0.02);
      previous = current;
    }
  });
});
