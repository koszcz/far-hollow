import { describe, expect, it } from "bun:test";
import { FISH_CAST_SECONDS, FISH_ENTER_SECONDS, FISH_REEL_SECONDS, fishPoseAt } from "./player-fish-pose";

describe("the fishing animation", () => {
  it("gives a whole, finite pose at every moment of a cast", () => {
    for (let seconds = 0; seconds < 20; seconds += 0.05) {
      const pose = fishPoseAt(seconds, 20 - seconds, seconds);
      const { body } = pose;
      const hands = [body.hands, body.rightHand ?? body.hands].flatMap(({ forward, height, spread }) => [forward, height, spread]);
      for (const value of [pose.rodLift, pose.lineOut, body.hipsDrop, body.hipsBack, body.hipsLean, body.chestLean, body.headTilt, body.reach, ...hands]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it("flows from the reel into the next cast without a jump", () => {
    const reeled = fishPoseAt(20, 0);
    const cast = fishPoseAt(0, 20);

    expect(cast.rodLift).toBeCloseTo(reeled.rodLift, 5);
    expect(cast.body.hands).toEqual(reeled.body.hands);
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
