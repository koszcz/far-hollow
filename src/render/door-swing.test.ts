import { describe, expect, test } from "bun:test";
import { DOOR_OPEN_RADIANS, DOOR_OVERSHOOT_RADIANS, doorSwingRadians, doorSwingSeconds, doorTravelSeconds, latchRingRadians } from "./door-swing";

/** The largest jump between two samples 1 ms apart, from 0 to `until` seconds. */
function largestJump(at: (seconds: number) => number, until: number): number {
  let largest = 0;
  for (let t = 0.001; t <= until; t += 0.001) largest = Math.max(largest, Math.abs(at(t) - at(t - 0.001)));
  return largest;
}

describe("doorSwingRadians", () => {
  test("a full swing open starts shut, coasts past open, and settles at open", () => {
    expect(doorSwingRadians(0, true, 0)).toBe(0);
    expect(doorSwingRadians(0, true, doorTravelSeconds(0, true))).toBeCloseTo(DOOR_OPEN_RADIANS + DOOR_OVERSHOOT_RADIANS);
    expect(doorSwingRadians(0, true, doorSwingSeconds(0, true))).toBeCloseTo(DOOR_OPEN_RADIANS);
  });

  test("a full swing shut starts open, bounces off the frame, and ends shut", () => {
    expect(doorSwingRadians(DOOR_OPEN_RADIANS, false, 0)).toBe(DOOR_OPEN_RADIANS);
    const travel = doorTravelSeconds(DOOR_OPEN_RADIANS, false);
    expect(doorSwingRadians(DOOR_OPEN_RADIANS, false, travel + 0.05)).toBeGreaterThan(0);
    expect(doorSwingRadians(DOOR_OPEN_RADIANS, false, doorSwingSeconds(DOOR_OPEN_RADIANS, false))).toBeCloseTo(0);
  });

  test("never jumps between frames, open or shut", () => {
    expect(largestJump((t) => doorSwingRadians(0, true, t), 1)).toBeLessThan(0.01);
    expect(largestJump((t) => doorSwingRadians(DOOR_OPEN_RADIANS, false, t), 1)).toBeLessThan(0.01);
  });

  test("a door that turns back part way starts from where it stood", () => {
    const halfway = doorSwingRadians(0, true, 0.1);
    expect(doorSwingRadians(halfway, false, 0)).toBe(halfway);
  });
});

describe("latchRingRadians", () => {
  test("lifts off the face after a shove open and after a slam shut, and comes to rest", () => {
    expect(latchRingRadians(0, true, 0)).toBe(0);
    expect(latchRingRadians(0, true, 0.1)).toBeGreaterThan(0);
    const slam = doorTravelSeconds(DOOR_OPEN_RADIANS, false);
    expect(latchRingRadians(DOOR_OPEN_RADIANS, false, slam)).toBe(0);
    expect(latchRingRadians(DOOR_OPEN_RADIANS, false, slam + 0.05)).toBeGreaterThan(0);
    expect(latchRingRadians(0, true, 2)).toBeCloseTo(0, 3);
  });

  test("never jumps between frames, and carries its lift smoothly into a new swing", () => {
    expect(largestJump((t) => latchRingRadians(0, true, t), 1)).toBeLessThan(0.02);
    expect(largestJump((t) => latchRingRadians(DOOR_OPEN_RADIANS, false, t), 1)).toBeLessThan(0.02);
    const lifted = latchRingRadians(0, true, 0.1);
    expect(latchRingRadians(0.5, false, 0, lifted)).toBe(lifted);
  });
});
