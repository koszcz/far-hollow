import { describe, expect, it } from "bun:test";
import { burnDown, burnShare, freshBurnTime } from "./burn-time";

describe("a torch's burn time", () => {
  it("starts at 3 game hours, the whole of its burning time", () => {
    expect(freshBurnTime()).toEqual({ minutesLeft: 180 });
    expect(burnShare(freshBurnTime())).toBe(1);
  });

  it("burns down by the minutes that pass, and its share of the whole time falls with it", () => {
    const burnt = burnDown({ minutesLeft: 180 }, 45);

    expect(burnt).toEqual({ minutesLeft: 135 });
    expect(burnShare({ minutesLeft: 135 })).toBe(0.75);
  });

  it("is gone once no minutes are left", () => {
    expect(burnDown({ minutesLeft: 10 }, 10)).toBeUndefined();
    expect(burnDown({ minutesLeft: 10 }, 25)).toBeUndefined();
  });

  it("gives a share from 0 to 1, even for minutes outside the whole burning time", () => {
    expect(burnShare({ minutesLeft: -5 })).toBe(0);
    expect(burnShare({ minutesLeft: 400 })).toBe(1);
  });
});
