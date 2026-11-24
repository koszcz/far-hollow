import { describe, expect, it } from "bun:test";
import { flightLegPose, flightPose, GROUND_REST_POSE, groundPose, LANDING_POSE, LANDING_SECONDS, type BirdPose } from "./bird-motion";

/** The largest change in any pose value between two moments `step` seconds apart, over `seconds`. */
function largestJump(poseAt: (seconds: number) => BirdPose, seconds: number, step = 1 / 4000): number {
  let largest = 0;
  let before = poseAt(0);
  for (let t = step; t <= seconds; t += step) {
    const now = poseAt(t);
    for (const key of Object.keys(now) as (keyof BirdPose)[]) largest = Math.max(largest, Math.abs(now[key] - before[key]));
    before = now;
  }
  return largest;
}

function expectPose(actual: BirdPose, expected: BirdPose): void {
  for (const key of Object.keys(expected) as (keyof BirdPose)[]) expect(actual[key]).toBeCloseTo(expected[key], 9);
}

describe("bird motion", () => {
  it("beats the wings without a jump between two frames close together, in steady flight and in bursts", () => {
    expect(largestJump((t) => flightPose(t, 8, 0.3, false), 4)).toBeLessThan(0.02);
    expect(largestJump((t) => flightPose(t, 8, 0.3, true), 4)).toBeLessThan(0.02);
  });

  it("pecks, looks around, and hops without a jump between two frames close together", () => {
    expect(largestJump((t) => groundPose(t, 1.1, 0.4), 10)).toBeLessThan(0.02);
  });

  it("starts on the ground from the landing pose and settles into standing", () => {
    expectPose(groundPose(0, 1.5, 0), LANDING_POSE);
    expectPose(groundPose(1.4, 1.5, 0), GROUND_REST_POSE);
  });

  it("takes off from the pose on the ground and touches down in the landing pose", () => {
    const flying = flightPose(0, 6, 0.5, false);
    expectPose(flightLegPose(flying, 0, GROUND_REST_POSE, undefined), GROUND_REST_POSE);
    expectPose(flightLegPose(flying, 1, undefined, 0), LANDING_POSE);
    expectPose(flightLegPose(flying, 1, undefined, LANDING_SECONDS), flying);
  });

  it("tucks the legs in flight and keeps them down on the ground", () => {
    expect(flightPose(1.3, 6, 0, true).legsDown).toBe(0);
    expect(groundPose(3, 1.5, 0.2).legsDown).toBe(1);
  });
});
