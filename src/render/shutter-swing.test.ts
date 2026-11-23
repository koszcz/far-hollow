import { describe, expect, test } from "bun:test";
import { SHUTTER_OPEN_RADIANS, SHUTTER_SWING_SECONDS, shutterSwingRadians, shutterSwingSeconds } from "./shutter-swing";

describe("shutterSwingRadians", () => {
  test("a full swing open starts closed and ends open, folded back against the wall", () => {
    expect(shutterSwingRadians(0, true, 0)).toBe(0);
    expect(shutterSwingRadians(0, true, SHUTTER_SWING_SECONDS / 2)).toBeCloseTo(SHUTTER_OPEN_RADIANS / 2);
    expect(shutterSwingRadians(0, true, SHUTTER_SWING_SECONDS)).toBeCloseTo(SHUTTER_OPEN_RADIANS);
    expect(shutterSwingRadians(0, true, 5)).toBeCloseTo(SHUTTER_OPEN_RADIANS);
  });

  test("a full swing closed starts open and ends closed", () => {
    expect(shutterSwingRadians(SHUTTER_OPEN_RADIANS, false, 0)).toBe(SHUTTER_OPEN_RADIANS);
    expect(shutterSwingRadians(SHUTTER_OPEN_RADIANS, false, SHUTTER_SWING_SECONDS)).toBeCloseTo(0);
  });

  test("a shutter that turns back part way starts from where it stood, and takes a share of the time", () => {
    const halfway = SHUTTER_OPEN_RADIANS / 2;
    expect(shutterSwingRadians(halfway, false, 0)).toBeCloseTo(halfway);
    expect(shutterSwingSeconds(halfway, false)).toBeCloseTo(SHUTTER_SWING_SECONDS / 2);
    expect(shutterSwingRadians(halfway, false, SHUTTER_SWING_SECONDS / 2)).toBeCloseTo(0);
  });

  test("never jumps between frames", () => {
    let largest = 0;
    for (let t = 0.001; t <= 1; t += 0.001) largest = Math.max(largest, Math.abs(shutterSwingRadians(0, true, t) - shutterSwingRadians(0, true, t - 0.001)));
    expect(largest).toBeLessThan(0.02);
  });
});
