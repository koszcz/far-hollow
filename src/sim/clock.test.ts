import { describe, expect, it } from "bun:test";
import { createClock, isNight, readClock } from "./clock";

const REAL_MINUTE_MS = 60_000;

describe("clock", () => {
  it("moves one game hour for each real minute", () => {
    const clock = createClock({ day: 1, hour: 8 });
    clock.advance(REAL_MINUTE_MS);
    expect(readClock(clock.minutes)).toMatchObject({ day: 1, hour: 9, minute: 0 });
  });

  it("starts the next day after 24 real minutes", () => {
    const clock = createClock({ day: 1, hour: 8 });
    clock.advance(24 * REAL_MINUTE_MS);
    expect(readClock(clock.minutes)).toMatchObject({ day: 2, hour: 8, minute: 0 });
  });

  it("stays on the hour after many small steps that do not divide evenly", () => {
    const clock = createClock({ day: 1, hour: 8 });
    for (let step = 0; step < 24 * 60 * 30; step += 1) clock.advance(1000 / 30);
    expect(readClock(clock.minutes)).toMatchObject({ day: 2, hour: 8, minute: 0 });
  });

  it("counts game minutes within the hour", () => {
    const clock = createClock({ day: 1, hour: 23 });
    clock.advance(30_500);
    const time = readClock(clock.minutes);
    expect(time).toMatchObject({ day: 1, hour: 23, minute: 30 });
    expect(time.hourOfDay).toBeCloseTo(23.5083, 4);
  });

  it("skips forward by whole game hours, across midnight", () => {
    const clock = createClock({ day: 1, hour: 22 });
    clock.skip(5);
    expect(readClock(clock.minutes)).toMatchObject({ day: 2, hour: 3, minute: 0 });
  });

  it("never skips backward", () => {
    const clock = createClock({ day: 1, hour: 22 });
    clock.skip(-5);
    clock.skip(Number.NaN);
    expect(readClock(clock.minutes)).toMatchObject({ day: 1, hour: 22, minute: 0 });
  });

  it("calls it night from 20:00 until morning arrives at 06:00", () => {
    expect(isNight(19.99)).toBe(false);
    expect(isNight(20)).toBe(true);
    expect(isNight(0)).toBe(true);
    expect(isNight(5.99)).toBe(true);
    expect(isNight(6)).toBe(false);
    expect(isNight(12)).toBe(false);
  });
});
