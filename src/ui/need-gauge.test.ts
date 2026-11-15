import { describe, expect, it } from "bun:test";
import { LOW_NEED, lowNeedsHint, needPulses, needRingShare } from "./need-gauge";

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

describe("the low needs hint", () => {
  const full = { hunger: 1, thirst: 1, warmth: 1, fatigue: 1 };

  it("shows nothing while every need is high enough not to slow the player", () => {
    expect(lowNeedsHint(full)).toBeNull();
    expect(lowNeedsHint({ ...full, hunger: 0.3 })).toBeNull();
  });

  it("says a low need slows the player and how to fill it", () => {
    expect(lowNeedsHint({ ...full, hunger: 0.29 })).toBe("Hungry: you move and work more slowly. Eat.");
  });

  it("lists every low need in the order the gauges show them", () => {
    expect(lowNeedsHint({ hunger: 0.2, thirst: 1, warmth: 0.1, fatigue: 0.2 })).toBe(
      "Cold, hungry and tired: you move and work more slowly. Warm up by a fire, eat and rest.",
    );
  });

  it("warns that an empty need leads to a collapse", () => {
    expect(lowNeedsHint({ ...full, thirst: 0 })).toBe("Thirsty: you move and work more slowly. Drink. If a need stays empty for an hour, you collapse.");
  });
});
