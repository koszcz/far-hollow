import { describe, expect, it } from "bun:test";
import { craftMotionOf, createHandCraftMotion, HAND_CRAFT_CYCLE_SECONDS, HAND_CRAFT_ENTER_SECONDS, handCraftPoseAt } from "./player-hand-craft-pose";

describe("the hand-craft animation", () => {
  it("saws at the sawhorse and works by hand for every other recipe", () => {
    expect(craftMotionOf("planks")).toBe("saw");
    expect(craftMotionOf("saw")).toBe("hand");
    expect(craftMotionOf("fishingRod")).toBe("hand");
  });

  it("keeps both hands at waist height, in front of the body, close together", () => {
    for (let seconds = HAND_CRAFT_ENTER_SECONDS; seconds < 10; seconds += 0.05) {
      const { hands, rightHand, reach } = handCraftPoseAt(seconds);
      expect(reach).toBe(1);
      for (const hand of [hands, rightHand ?? hands]) {
        expect(hand.height).toBeGreaterThan(0.6);
        expect(hand.height).toBeLessThan(0.9);
        expect(hand.forward).toBeGreaterThan(0.2);
        expect(hand.forward).toBeLessThan(0.5);
        expect(hand.spread).toBeLessThan(0.15);
      }
    }
  });

  it("works slowly: one cycle takes at least a second and a half", () => {
    expect(HAND_CRAFT_CYCLE_SECONDS).toBeGreaterThanOrEqual(1.5);
  });

  it("loops and moves without a jump", () => {
    const step = 0.01;
    const values = (seconds: number): number[] => {
      const { hands, rightHand, chestLean, headTilt } = handCraftPoseAt(seconds);
      const right = rightHand ?? hands;
      return [hands.forward, hands.height, hands.spread, right.forward, right.height, right.spread, chestLean, headTilt];
    };
    for (let seconds = step; seconds < 10; seconds += step) {
      const before = values(seconds - step);
      values(seconds).forEach((value, index) => {
        expect(Number.isFinite(value)).toBe(true);
        expect(Math.abs(value - (before[index] ?? value))).toBeLessThan(0.02);
      });
    }
  });

  it("lifts the hands from standing when crafting starts", () => {
    expect(handCraftPoseAt(0).reach).toBe(0);
    expect(handCraftPoseAt(HAND_CRAFT_ENTER_SECONDS).reach).toBe(1);
  });

  it("stands the player straight back up the moment crafting stops", () => {
    const motion = createHandCraftMotion();
    motion.update(10, 100);
    motion.update(13, 103);

    expect(motion.update(undefined, 103.1)).toEqual({ kind: "stopped", leaving: undefined });
    expect(motion.pose()).toBeUndefined();
  });
});
