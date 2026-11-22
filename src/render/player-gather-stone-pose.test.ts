import { describe, expect, it } from "bun:test";
import { GATHER_STONE_SECONDS } from "../sim/stone";
import { gatherStonePoseAt, holdsStoneAt } from "./player-gather-stone-pose";

describe("the gather-stone motion", () => {
  it("starts and ends each lift standing", () => {
    expect(gatherStonePoseAt(0)).toMatchObject({ hipsDrop: 0, reach: 0 });
    expect(gatherStonePoseAt(GATHER_STONE_SECONDS * 0.9999).reach).toBeCloseTo(0, 2);
  });

  it("squats with both hands low, hugs the stone at the belly, then heaves it over the shoulder into the backpack", () => {
    const low = gatherStonePoseAt(GATHER_STONE_SECONDS * 0.3);
    const hugged = gatherStonePoseAt(GATHER_STONE_SECONDS * 0.66);
    const stowed = gatherStonePoseAt(GATHER_STONE_SECONDS * 0.8).rightHand;

    expect(low.hipsDrop).toBeGreaterThan(0.15);
    expect(low.hands.height).toBeLessThan(0.2);
    expect(hugged.hands.height).toBeGreaterThan(0.45);
    expect(stowed?.height).toBeGreaterThan(0.9);
    expect(stowed?.forward).toBeLessThan(0);
    expect(holdsStoneAt(GATHER_STONE_SECONDS * 0.2)).toBe(false);
    expect(holdsStoneAt(GATHER_STONE_SECONDS * 0.5)).toBe(true);
    expect(holdsStoneAt(GATHER_STONE_SECONDS * 0.9)).toBe(false);
  });

  it("moves smoothly, with no jump between moments, even when one lift follows another", () => {
    type Pose = ReturnType<typeof gatherStonePoseAt>;
    const reachedHeight = (pose: Pose): number => pose.hands.height * pose.reach;
    const rightReachedHeight = (pose: Pose): number => (pose.rightHand ?? pose.hands).height * pose.reach;
    for (let seconds = 0.01; seconds < GATHER_STONE_SECONDS * 2; seconds += 0.01) {
      const before = gatherStonePoseAt(seconds - 0.01);
      const now = gatherStonePoseAt(seconds);
      expect(Math.abs(reachedHeight(now) - reachedHeight(before))).toBeLessThan(0.05);
      expect(Math.abs(rightReachedHeight(now) - rightReachedHeight(before))).toBeLessThan(0.05);
      expect(Math.abs(now.hipsDrop - before.hipsDrop)).toBeLessThan(0.02);
      expect(Math.abs(now.chestLean - before.chestLean)).toBeLessThan(0.05);
    }
  });
});
