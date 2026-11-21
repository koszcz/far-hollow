import { describe, expect, it } from "bun:test";
import { GATHER_STONE_SECONDS } from "../sim/stone";
import { gatherStonePoseAt, holdsStoneAt } from "./player-gather-stone-pose";

describe("the gather-stone motion", () => {
  it("starts from standing", () => {
    expect(gatherStonePoseAt(0)).toMatchObject({ hipsDrop: 0, reach: 0 });
  });

  it("crouches with both hands low at the water's edge, then lifts the stone to the chest as it goes in the backpack", () => {
    const low = gatherStonePoseAt(GATHER_STONE_SECONDS * 0.4);
    const lifted = gatherStonePoseAt(GATHER_STONE_SECONDS * 0.95);

    expect(low.hipsDrop).toBeGreaterThan(0.15);
    expect(low.hands.height).toBeLessThan(0.15);
    expect(lifted.hands.height).toBeGreaterThan(0.6);
    expect(holdsStoneAt(GATHER_STONE_SECONDS * 0.4)).toBe(false);
    expect(holdsStoneAt(GATHER_STONE_SECONDS * 0.95)).toBe(true);
  });

  it("moves smoothly, with no jump between moments, even when one lift follows another", () => {
    for (let seconds = 0.01; seconds < GATHER_STONE_SECONDS * 2; seconds += 0.01) {
      const before = gatherStonePoseAt(seconds - 0.01);
      const now = gatherStonePoseAt(seconds);
      expect(Math.abs(now.hands.height - before.hands.height)).toBeLessThan(0.05);
      expect(Math.abs(now.hipsDrop - before.hipsDrop)).toBeLessThan(0.02);
    }
  });
});
