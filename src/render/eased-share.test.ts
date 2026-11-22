import { describe, expect, it } from "bun:test";
import { createEasedShare } from "./eased-share";

describe("an eased share", () => {
  it("starts at its first target, so a game loaded in the rain does not fade", () => {
    expect(createEasedShare({ riseSeconds: 10, fallSeconds: 2 }).toward(0, 5)).toBe(0);
    expect(createEasedShare({ riseSeconds: 10, fallSeconds: 2 }).toward(1, 5)).toBe(1);
  });

  it("falls and rises at their own rates", () => {
    const share = createEasedShare({ riseSeconds: 10, fallSeconds: 2 });
    share.toward(1, 0);
    expect(share.toward(0, 1)).toBeCloseTo(0.5);
    expect(share.toward(0, 5)).toBe(0);
    expect(share.toward(1, 5)).toBeCloseTo(0.5);
    expect(share.toward(1, 50)).toBe(1);
  });
});
