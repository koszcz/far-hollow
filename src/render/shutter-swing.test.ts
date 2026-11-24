import { describe, expect, test } from "bun:test";
import {
  SHUTTER_KNOCK_RADIANS,
  SHUTTER_KNOCK_SECONDS,
  SHUTTER_LAG_SECONDS,
  SHUTTER_OPEN_RADIANS,
  SHUTTER_SWING_SECONDS,
  SHUTTER_TAP_RADIANS,
  SHUTTER_TAP_SECONDS,
  shutterSwingRadians,
  shutterSwingSeconds,
} from "./shutter-swing";

const SETTLED = SHUTTER_LAG_SECONDS + SHUTTER_SWING_SECONDS + SHUTTER_KNOCK_SECONDS + 0.01;

/** The largest change in a leaf's turn between two frames 1 ms apart, over the first `seconds`. */
function largestStep(from: number, open: boolean, trailing: boolean, seconds = 1.2): number {
  let largest = 0;
  for (let t = 0.001; t <= seconds; t += 0.001) {
    largest = Math.max(largest, Math.abs(shutterSwingRadians(from, open, t, trailing) - shutterSwingRadians(from, open, t - 0.001, trailing)));
  }
  return largest;
}

describe("shutterSwingRadians", () => {
  test("a full swing open starts closed, reaches the wall, knocks back off it, and rests open", () => {
    expect(shutterSwingRadians(0, true, 0)).toBe(0);
    expect(shutterSwingRadians(0, true, SHUTTER_SWING_SECONDS)).toBeCloseTo(SHUTTER_OPEN_RADIANS);
    const knocked = shutterSwingRadians(0, true, SHUTTER_SWING_SECONDS + SHUTTER_KNOCK_SECONDS * 0.3);
    expect(knocked).toBeLessThan(SHUTTER_OPEN_RADIANS);
    expect(knocked).toBeGreaterThan(SHUTTER_OPEN_RADIANS - SHUTTER_KNOCK_RADIANS - 1e-9);
    expect(shutterSwingRadians(0, true, SETTLED)).toBeCloseTo(SHUTTER_OPEN_RADIANS);
  });

  test("a push is quick at first and still moving when it reaches the wall", () => {
    expect(shutterSwingRadians(0, true, SHUTTER_SWING_SECONDS / 2)).toBeGreaterThan(SHUTTER_OPEN_RADIANS / 2);
    expect(shutterSwingRadians(0, true, SHUTTER_SWING_SECONDS - 0.01)).toBeLessThan(SHUTTER_OPEN_RADIANS - 0.01);
  });

  test("a full swing closed slows into the middle, taps back a little, and rests closed", () => {
    expect(shutterSwingRadians(SHUTTER_OPEN_RADIANS, false, 0)).toBe(SHUTTER_OPEN_RADIANS);
    expect(shutterSwingRadians(SHUTTER_OPEN_RADIANS, false, SHUTTER_SWING_SECONDS)).toBeCloseTo(0);
    const tapped = shutterSwingRadians(SHUTTER_OPEN_RADIANS, false, SHUTTER_SWING_SECONDS + SHUTTER_TAP_SECONDS * 0.3);
    expect(tapped).toBeGreaterThan(0);
    expect(tapped).toBeLessThanOrEqual(SHUTTER_TAP_RADIANS + 1e-9);
    expect(shutterSwingRadians(SHUTTER_OPEN_RADIANS, false, SETTLED)).toBeCloseTo(0);
  });

  test("the second leaf trails the first", () => {
    expect(shutterSwingRadians(0, true, SHUTTER_LAG_SECONDS, true)).toBe(0);
    expect(shutterSwingRadians(0, true, 0.3, true)).toBeLessThan(shutterSwingRadians(0, true, 0.3));
    expect(shutterSwingRadians(0, true, SHUTTER_SWING_SECONDS + SHUTTER_LAG_SECONDS, true)).toBeCloseTo(SHUTTER_OPEN_RADIANS);
  });

  test("a leaf that turns back part way starts from where it stood, and takes a share of the time", () => {
    const halfway = SHUTTER_OPEN_RADIANS / 2;
    expect(shutterSwingRadians(halfway, false, 0)).toBeCloseTo(halfway);
    expect(shutterSwingSeconds(halfway, false)).toBeCloseTo(SHUTTER_SWING_SECONDS / 2);
    expect(shutterSwingRadians(halfway, false, SHUTTER_SWING_SECONDS / 2)).toBeCloseTo(0);
    expect(shutterSwingRadians(halfway, true, 0, true)).toBeCloseTo(halfway);
  });

  test("never jumps between frames, through every swing and bounce", () => {
    for (const trailing of [false, true]) {
      expect(largestStep(0, true, trailing)).toBeLessThan(0.02);
      expect(largestStep(SHUTTER_OPEN_RADIANS, false, trailing)).toBeLessThan(0.02);
      expect(largestStep(SHUTTER_OPEN_RADIANS / 3, true, trailing)).toBeLessThan(0.02);
    }
  });
});
