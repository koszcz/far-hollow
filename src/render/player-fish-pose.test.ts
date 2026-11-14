import { describe, expect, it } from "bun:test";
import { FISH_CAST_SECONDS, FISH_ENTER_SECONDS, FISH_REEL_SECONDS, fishPoseAt } from "./player-fish-pose";

describe("the fishing animation", () => {
  it("gives a whole, finite pose at every moment of a cast", () => {
    for (let seconds = 0; seconds < 20; seconds += 0.05) {
      const pose = fishPoseAt(seconds, 20 - seconds, seconds);
      const { body } = pose;
      const hands = [body.hands, body.rightHand ?? body.hands].flatMap(({ forward, height, spread }) => [forward, height, spread]);
      const gear = [pose.rodLift, pose.rodLean, pose.rodBend, pose.lineOut, pose.lineHang, pose.lineTrail, pose.lineArc, pose.lineSag];
      for (const value of [
        ...gear,
        pose.lineInHand,
        pose.floatUp,
        pose.floatDip,
        pose.fishThrash,
        pose.fishSwing,
        body.hipsDrop,
        body.hipsBack,
        body.hipsLean,
        body.chestLean,
        body.headTilt,
        body.reach,
        ...hands,
      ]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it("flows from the reel into the next cast without a jump", () => {
    const reeled = fishPoseAt(20, 0);
    const cast = fishPoseAt(0, 20);

    expect(cast.rodLift).toBeCloseTo(reeled.rodLift, 5);
    expect(cast.rodBend).toBeCloseTo(reeled.rodBend, 5);
    expect(cast.lineInHand).toBeCloseTo(reeled.lineInHand, 5);
    expect(cast.lineHang).toBeCloseTo(reeled.lineHang, 5);
    expect(cast.body.hands).toEqual(reeled.body.hands);
  });

  it("moves without a jump between any two moments of a cast and a reel", () => {
    const wait = 20;
    const step = 0.002;
    const values = (seconds: number): number[] => {
      const pose = fishPoseAt(seconds, wait - seconds);
      const { hands, rightHand } = pose.body;
      return [
        pose.rodLift,
        pose.rodLean,
        pose.rodBend,
        pose.lineOut,
        pose.lineTrail,
        pose.lineArc,
        pose.lineSag,
        pose.lineInHand,
        pose.floatUp,
        pose.floatDip * (1 - pose.floatUp),
        pose.body.chestLean,
        pose.body.hipsBack,
        hands.forward,
        hands.height,
        hands.spread,
        rightHand?.forward ?? 0,
        rightHand?.height ?? 0,
      ];
    };
    for (let seconds = step; seconds < wait; seconds += step) {
      const before = values(seconds - step);
      values(seconds).forEach((value, index) => {
        expect(Math.abs(value - (before[index] ?? value))).toBeLessThan(0.06);
      });
    }
  });

  it("hooks the fish, lifts it out, and catches it in the left hand", () => {
    expect(fishPoseAt(20, FISH_REEL_SECONDS * 0.95).fishShown).toBe(false);
    expect(fishPoseAt(20, 0).lineInHand).toBe(1);
    expect(fishPoseAt(20, 0).lineOut).toBe(0);
  });

  it("casts the line out, then reels it in with a fish on it", () => {
    expect(fishPoseAt(0, 20).lineOut).toBe(0);
    expect(fishPoseAt(FISH_CAST_SECONDS + 1, 10).lineOut).toBe(1);
    expect(fishPoseAt(FISH_CAST_SECONDS + 1, 10).fishShown).toBe(false);
    expect(fishPoseAt(20, FISH_REEL_SECONDS * 0.2).fishShown).toBe(true);
  });

  it("lifts the rod from standing when fishing starts", () => {
    expect(fishPoseAt(FISH_CAST_SECONDS + 1, 10, 0).body.reach).toBe(0);
    expect(fishPoseAt(FISH_CAST_SECONDS + 1, 10, FISH_ENTER_SECONDS).body.reach).toBe(1);
  });
});
