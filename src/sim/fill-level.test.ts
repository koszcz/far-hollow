import { describe, expect, it } from "bun:test";
import { EMPTY_FILL, fillBy, isEmptyFill, isFillProgress, takeOne, type FillLevel } from "./fill-level";

describe("a fill level", () => {
  it("starts empty, with no progress toward the first whole one", () => {
    expect(EMPTY_FILL).toEqual({ held: 0, progress: 0 });
    expect(isEmptyFill(EMPTY_FILL)).toBe(true);
  });

  it("gains one whole for each whole share it fills by, and keeps the part left over", () => {
    expect(fillBy(EMPTY_FILL, 2.5, 6)).toEqual({ held: 2, progress: 0.5 });
  });

  it("carries progress over from one filling to the next", () => {
    const first = fillBy(EMPTY_FILL, 0.75, 6);
    expect(first).toEqual({ held: 0, progress: 0.75 });
    expect(fillBy(first, 0.5, 6)).toEqual({ held: 1, progress: 0.25 });
  });

  it("counts many small fillings that add up to one whole as one whole", () => {
    let level: FillLevel = EMPTY_FILL;
    for (let i = 0; i < 3600; i += 1) level = fillBy(level, 1 / 3600, 6);
    expect(level.held).toBe(1);
    expect(level.progress).toBeCloseTo(0, 6);
  });

  it("stops at its limit, and builds up no progress while full", () => {
    const full = fillBy(EMPTY_FILL, 10, 6);
    expect(full).toEqual({ held: 6, progress: 0 });
    expect(fillBy(full, 0.9, 6)).toEqual({ held: 6, progress: 0 });
  });

  it("takes out one whole and keeps its progress, and never goes below empty", () => {
    expect(takeOne({ held: 3, progress: 0.4 })).toEqual({ held: 2, progress: 0.4 });
    expect(takeOne(EMPTY_FILL)).toEqual(EMPTY_FILL);
  });

  it("counts as progress only a number from 0 up to but not including 1", () => {
    expect(isFillProgress(0)).toBe(true);
    expect(isFillProgress(0.99)).toBe(true);
    expect(isFillProgress(1)).toBe(false);
    expect(isFillProgress(-0.1)).toBe(false);
    expect(isFillProgress(Number.NaN)).toBe(false);
    expect(isFillProgress("0.5")).toBe(false);
  });

  it("leaves the level it was given alone", () => {
    const before: FillLevel = { held: 1, progress: 0.5 };
    fillBy(before, 1, 6);
    takeOne(before);
    expect(before).toEqual({ held: 1, progress: 0.5 });
  });
});
