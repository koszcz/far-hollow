import { describe, expect, it } from "bun:test";
import { NO_SNOW_COVER, snowCoverOn, snowWalkingSpeed } from "./snow-cover";
import type { Season } from "./season";

/** The snow cover at this hour of this day of a season. */
function depthOn(season: Season, dayOfSeason: number, hourOfDay: number, afterWinter = true): number {
  return snowCoverOn({ season, dayOfSeason, seasonDays: 7 }, hourOfDay, { afterWinter }).depth;
}

describe("the snow cover depth by day", () => {
  it("lies nowhere in summer or autumn, or after the first two days of spring", () => {
    expect(depthOn("summer", 4, 12)).toBe(0);
    expect(depthOn("autumn", 7, 23)).toBe(0);
    expect(depthOn("spring", 3, 0)).toBe(0);
    expect(depthOn("spring", 7, 12)).toBe(0);
  });

  it("grows from none at the start of winter day 1 to full by the end of winter day 3", () => {
    expect(depthOn("winter", 1, 0)).toBe(0);
    expect(depthOn("winter", 1, 12)).toBeCloseTo(1 / 6, 5);
    expect(depthOn("winter", 2, 0)).toBeCloseTo(1 / 3, 5);
    expect(depthOn("winter", 3, 0)).toBeCloseTo(2 / 3, 5);
    expect(depthOn("winter", 3, 24)).toBe(1);
    expect(depthOn("winter", 4, 0)).toBe(1);
    expect(depthOn("winter", 7, 23.9)).toBe(1);
  });

  it("melts over spring days 1 and 2", () => {
    expect(depthOn("spring", 1, 0)).toBe(1);
    expect(depthOn("spring", 1, 12)).toBeCloseTo(0.75, 5);
    expect(depthOn("spring", 2, 0)).toBeCloseTo(0.5, 5);
    expect(depthOn("spring", 2, 24)).toBe(0);
  });

  it("lies nowhere in a spring that no winter came before, such as a new game's first", () => {
    expect(depthOn("spring", 1, 0, false)).toBe(0);
    expect(depthOn("spring", 2, 0, false)).toBe(0);
  });
});

describe("walking in snow", () => {
  it("slows walking to 0.85 at full cover, less in shallower cover, and not at all with none", () => {
    expect(snowWalkingSpeed({ depth: 1 })).toBeCloseTo(0.85, 5);
    expect(snowWalkingSpeed({ depth: 0.5 })).toBeCloseTo(0.925, 5);
    expect(snowWalkingSpeed(NO_SNOW_COVER)).toBe(1);
  });
});
