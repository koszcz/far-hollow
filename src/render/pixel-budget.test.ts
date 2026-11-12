import { describe, expect, it } from "bun:test";
import { MAX_DRAWN_PIXELS, drawnPixelRatio } from "./pixel-budget";

describe("drawnPixelRatio", () => {
  it("draws every screen pixel when the canvas fits the budget", () => {
    expect(drawnPixelRatio(1280, 800, 1)).toBe(1);
    expect(drawnPixelRatio(1000, 700, 2)).toBe(2);
  });

  it("draws fewer pixels on a large Retina screen, keeping the total within the budget", () => {
    const ratio = drawnPixelRatio(1512, 982, 2);
    expect(ratio).toBeLessThan(2);
    expect(1512 * 982 * ratio * ratio).toBeLessThanOrEqual(MAX_DRAWN_PIXELS + 1);
  });

  it("draws fewer pixels on a large ultrawide screen, even at a pixel ratio of 1", () => {
    const ratio = drawnPixelRatio(3440, 1440, 1);
    expect(ratio).toBeLessThan(1);
    expect(3440 * 1440 * ratio * ratio).toBeLessThanOrEqual(MAX_DRAWN_PIXELS + 1);
  });

  it("returns the screen's pixel ratio for an empty canvas", () => {
    expect(drawnPixelRatio(0, 0, 2)).toBe(2);
  });
});
