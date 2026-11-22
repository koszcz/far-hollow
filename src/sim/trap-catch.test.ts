import { describe, expect, it } from "bun:test";
import { catchWaitMinutes, firstCatch, passCatchTime, takeCatch, type CatchRange } from "./trap-catch";

const RANGE: CatchRange = { minMinutes: 360, maxMinutes: 720 };

describe("the wait for a catch", () => {
  it("is a whole number of minutes within the range, for many seeds and draws", () => {
    for (let seed = 0; seed < 50; seed += 1) {
      for (let draw = 0; draw < 5; draw += 1) {
        const wait = catchWaitMinutes(RANGE, seed, draw);
        expect(Number.isInteger(wait)).toBe(true);
        expect(wait).toBeGreaterThanOrEqual(360);
        expect(wait).toBeLessThanOrEqual(720);
      }
    }
  });

  it("is the same for the same seed and draw, and differs between draws", () => {
    expect(catchWaitMinutes(RANGE, 7, 0)).toBe(catchWaitMinutes(RANGE, 7, 0));
    const waits = new Set([0, 1, 2, 3, 4].map((draw) => catchWaitMinutes(RANGE, 7, draw)));
    expect(waits.size).toBeGreaterThan(1);
  });
});

describe("a trap's catch", () => {
  it("starts empty, waiting the first drawn time", () => {
    const start = firstCatch(RANGE, 7);
    expect(start.holding).toBe(false);
    expect(start.minutesToNext).toBe(catchWaitMinutes(RANGE, 7, 0));
  });

  it("holds one catch once its wait has passed, and draws the next wait", () => {
    const start = firstCatch(RANGE, 7);
    const almost = passCatchTime(start, start.minutesToNext - 1, RANGE, 7);
    expect(almost.holding).toBe(false);
    expect(almost.minutesToNext).toBe(1);

    const caught = passCatchTime(almost, 1, RANGE, 7);
    expect(caught.holding).toBe(true);
    expect(caught.minutesToNext).toBe(catchWaitMinutes(RANGE, 7, 1));
  });

  it("catches nothing more, and its next wait does not run, while it holds a catch", () => {
    const caught = passCatchTime(firstCatch(RANGE, 7), 10_000, RANGE, 7);
    const later = passCatchTime(caught, 10_000, RANGE, 7);
    expect(later).toEqual(caught);
  });

  it("waits again once the catch is taken", () => {
    const caught = passCatchTime(firstCatch(RANGE, 7), 10_000, RANGE, 7);
    const emptied = takeCatch(caught);
    expect(emptied.holding).toBe(false);
    expect(emptied.minutesToNext).toBe(caught.minutesToNext);
    expect(passCatchTime(emptied, emptied.minutesToNext, RANGE, 7).holding).toBe(true);
  });
});
