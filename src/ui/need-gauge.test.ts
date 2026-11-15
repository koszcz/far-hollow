import { describe, expect, it } from "bun:test";
import { LOW_NEED, needPulses, needRingShare } from "./need-gauge";

describe("a need gauge", () => {
  it("fills its ring with the need's level", () => {
    expect(needRingShare(0)).toBe(0);
    expect(needRingShare(0.25)).toBe(0.25);
    expect(needRingShare(0.6)).toBe(0.6);
    expect(needRingShare(1)).toBe(1);
  });

  it("keeps the ring between empty and full", () => {
    expect(needRingShare(-0.2)).toBe(0);
    expect(needRingShare(1.3)).toBe(1);
  });

  it("pulses when the need is low, at the same level as the old bars", () => {
    expect(LOW_NEED).toBe(0.25);
    expect(needPulses(0)).toBe(true);
    expect(needPulses(0.25)).toBe(true);
    expect(needPulses(0.26)).toBe(false);
    expect(needPulses(1)).toBe(false);
  });
});
