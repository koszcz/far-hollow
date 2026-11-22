import { describe, expect, it } from "bun:test";
import { RAIN_BARREL_HEIGHT_METRES, waterSurfaceHeight } from "./rain-barrel-meshes";

describe("the rain barrel's water surface", () => {
  it("shows no water in an empty barrel", () => {
    expect(waterSurfaceHeight(0)).toBeUndefined();
  });

  it("rises with each drink the barrel holds, and stays below the rim when full", () => {
    const heights = [1, 2, 3, 4, 5, 6].map((drinks) => waterSurfaceHeight(drinks) ?? 0);
    for (let i = 1; i < heights.length; i += 1) expect(heights[i] ?? 0).toBeGreaterThan(heights[i - 1] ?? 0);
    expect(heights[0]).toBeGreaterThan(0);
    expect(heights[5]).toBeLessThan(RAIN_BARREL_HEIGHT_METRES);
    expect(waterSurfaceHeight(9)).toBe(waterSurfaceHeight(6));
  });
});
