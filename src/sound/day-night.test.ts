import { describe, expect, it } from "bun:test";
import { daylightAt } from "../render/daylight";
import { dayNightMix, easeHeardDaylight } from "./day-night";

describe("the day and night crossfade", () => {
  it("plays only birds at full daylight", () => {
    const mix = dayNightMix(1);
    expect(mix.birds).toBeGreaterThan(0);
    expect(mix.crickets).toBe(0);
  });

  it("plays only crickets at night", () => {
    const mix = dayNightMix(0);
    expect(mix.birds).toBe(0);
    expect(mix.crickets).toBeGreaterThan(0);
  });

  it("plays both, part loud, at dawn and dusk", () => {
    const dawn = dayNightMix(daylightAt(7));
    expect(dawn.birds).toBeGreaterThan(0);
    expect(dawn.crickets).toBeGreaterThan(0);
    expect(dawn.birds).toBeLessThan(dayNightMix(1).birds);
    expect(dawn.crickets).toBeLessThan(dayNightMix(0).crickets);
  });

  it("follows the daylight's clock: birds grow through dawn and fade through dusk", () => {
    const birdsAt = (hour: number): number => dayNightMix(daylightAt(hour)).birds;
    const cricketsAt = (hour: number): number => dayNightMix(daylightAt(hour)).crickets;
    expect(birdsAt(6.5)).toBeLessThan(birdsAt(7.5));
    expect(birdsAt(12)).toBe(dayNightMix(1).birds);
    expect(cricketsAt(18.5)).toBeLessThan(cricketsAt(19.5));
    expect(cricketsAt(23)).toBe(dayNightMix(0).crickets);
    expect(birdsAt(2)).toBe(0);
  });

  it("keeps both within the full loudness", () => {
    for (let daylight = 0; daylight <= 1; daylight += 0.1) {
      const mix = dayNightMix(daylight);
      expect(mix.birds).toBeLessThanOrEqual(1);
      expect(mix.crickets).toBeLessThanOrEqual(1);
    }
  });
});

describe("the heard daylight", () => {
  it("keeps up with the daylight as the clock runs", () => {
    // The clock runs one game minute a second, so daylight changes by at most 1/120 in a second at dawn.
    expect(easeHeardDaylight(0.5, 0.5 + 1 / 120, 1)).toBeCloseTo(0.5 + 1 / 120);
  });

  it("crossfades quickly, not at once, when skipped time moves the clock from night to day", () => {
    const afterAFrame = easeHeardDaylight(0, 1, 1 / 60);
    expect(afterAFrame).toBeGreaterThan(0);
    expect(afterAFrame).toBeLessThan(0.5);
    let heard = 0;
    for (let frame = 0; frame < 120; frame += 1) heard = easeHeardDaylight(heard, 1, 1 / 60);
    expect(heard).toBe(1);
  });

  it("crossfades quickly from day to night too", () => {
    let heard = 1;
    for (let frame = 0; frame < 120; frame += 1) heard = easeHeardDaylight(heard, 0, 1 / 60);
    expect(heard).toBe(0);
  });
});
