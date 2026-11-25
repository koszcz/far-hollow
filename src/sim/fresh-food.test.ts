import { describe, expect, it } from "bun:test";
import { freshnessOf, isFreshFood, KEEPS_FOR_MINUTES, matchCounts, spoiledBy, takeOldest, withSpoilTimes } from "./fresh-food";

const HOUR = 60;
const DAY = 24 * HOUR;

describe("keeping times", () => {
  it("keeps raw fish 1 day, cooked fish and berries 2 days, and mushrooms 3 days", () => {
    expect(KEEPS_FOR_MINUTES).toEqual({ rawFish: DAY, cookedFish: 2 * DAY, berries: 2 * DAY, mushroom: 3 * DAY });
  });

  it("counts only berries, mushrooms, raw fish, and cooked fish as fresh food", () => {
    expect(["berries", "mushroom", "rawFish", "cookedFish"].every((food) => isFreshFood(food as "berries"))).toBe(true);
    expect(isFreshFood("stick")).toBe(false);
    expect(isFreshFood("potOfBoiledWater")).toBe(false);
  });
});

describe("matching spoil times to counts", () => {
  it("gives food it does not know about yet its full keeping time from now", () => {
    expect(matchCounts(undefined, { berries: 2, stick: 4 }, 100)).toEqual({ berries: [100 + 2 * DAY, 100 + 2 * DAY] });
  });

  it("drops the oldest when the count goes down, such as after eating", () => {
    expect(matchCounts({ berries: [10, 20, 30] }, { berries: 1 }, 100)).toEqual({ berries: [30] });
    expect(matchCounts({ berries: [10] }, {}, 100)).toEqual({});
  });

  it("returns the same spoil times when they already match", () => {
    const times = { mushroom: [5, 6] };
    expect(matchCounts(times, { mushroom: 2 }, 100)).toBe(times);
  });
});

describe("moving food", () => {
  it("takes the oldest first", () => {
    expect(takeOldest({ rawFish: [10, 20, 30] }, "rawFish", 2)).toEqual({ left: { rawFish: [30] }, taken: [10, 20] });
  });

  it("keeps spoil times in order when food joins", () => {
    expect(withSpoilTimes({ rawFish: [10, 30] }, "rawFish", [20, 5])).toEqual({ rawFish: [5, 10, 20, 30] });
  });
});

describe("spoiling", () => {
  it("takes out every food whose time has come, and says how many of each kind", () => {
    expect(spoiledBy({ berries: [10, 20, 30], rawFish: [15] }, 20)).toEqual({ left: { berries: [30] }, spoiled: { berries: 2, rawFish: 1 } });
  });

  it("changes nothing before a food's time", () => {
    const times = { berries: [10] };
    expect(spoiledBy(times, 9.9)).toEqual({ left: times, spoiled: {} });
  });
});

describe("freshness", () => {
  it("says how long the oldest has left, and that as a share of its keeping time", () => {
    expect(freshnessOf({ berries: [DAY, 2 * DAY] }, "berries", 0)).toEqual({ minutesLeft: DAY, share: 0.5 });
    expect(freshnessOf({}, "berries", 0)).toBeUndefined();
  });
});
