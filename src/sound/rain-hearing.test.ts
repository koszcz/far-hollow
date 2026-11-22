import { describe, expect, it } from "bun:test";
import { easeRainHearing, rainHearingNow, rainLoudness, type RainHearing } from "./rain-hearing";

/** Eases the hearing for `seconds`, one 60th of a second at a time, as frames do. */
function easeFor(hearing: RainHearing, raining: boolean, underRoof: boolean, seconds: number): RainHearing {
  let eased = hearing;
  for (let frame = 0; frame < seconds * 60; frame += 1) eased = easeRainHearing(eased, raining, underRoof, 1 / 60);
  return eased;
}

const DRY_IN_THE_OPEN = rainHearingNow(false, false);
const RAIN_IN_THE_OPEN = rainHearingNow(true, false);
const RAIN_UNDER_A_ROOF = rainHearingNow(true, true);

describe("rain loudness as rain starts and stops", () => {
  it("is silent while dry, in the open or under a roof", () => {
    expect(rainLoudness(DRY_IN_THE_OPEN)).toEqual({ open: 0, roof: 0 });
    expect(rainLoudness(rainHearingNow(false, true))).toEqual({ open: 0, roof: 0 });
  });

  it("eases in over a few seconds when rain starts", () => {
    const full = rainLoudness(RAIN_IN_THE_OPEN).open;
    const soon = rainLoudness(easeFor(DRY_IN_THE_OPEN, true, false, 1)).open;
    const later = rainLoudness(easeFor(DRY_IN_THE_OPEN, true, false, 3)).open;
    expect(soon).toBeGreaterThan(0);
    expect(later).toBeGreaterThan(soon);
    expect(full).toBeGreaterThan(later);
    expect(rainLoudness(easeFor(DRY_IN_THE_OPEN, true, false, 5)).open).toBeCloseTo(full);
  });

  it("eases out over a few seconds when rain stops", () => {
    const soon = rainLoudness(easeFor(RAIN_IN_THE_OPEN, false, false, 1)).open;
    expect(soon).toBeGreaterThan(0);
    expect(soon).toBeLessThan(rainLoudness(RAIN_IN_THE_OPEN).open);
    expect(rainLoudness(easeFor(RAIN_IN_THE_OPEN, false, false, 5)).open).toBe(0);
  });

  it("plays at full loudness at once in a game loaded in the rain", () => {
    expect(rainLoudness(RAIN_IN_THE_OPEN).open).toBeGreaterThan(0.3);
    expect(rainLoudness(RAIN_IN_THE_OPEN).open).toBeLessThanOrEqual(1);
  });
});

describe("rain or rain on a roof", () => {
  it("is plain rain in the open", () => {
    const heard = rainLoudness(RAIN_IN_THE_OPEN);
    expect(heard.open).toBeGreaterThan(0);
    expect(heard.roof).toBe(0);
  });

  it("is only the muffled drumming under a roof", () => {
    const heard = rainLoudness(RAIN_UNDER_A_ROOF);
    expect(heard.open).toBe(0);
    expect(heard.roof).toBeGreaterThan(0);
  });

  it("crossfades within a second or two when the player walks under a roof", () => {
    const halfway = rainLoudness(easeFor(RAIN_IN_THE_OPEN, true, true, 0.3));
    expect(halfway.open).toBeGreaterThan(0);
    expect(halfway.roof).toBeGreaterThan(0);
    expect(rainLoudness(easeFor(RAIN_IN_THE_OPEN, true, true, 2))).toEqual(rainLoudness(RAIN_UNDER_A_ROOF));
  });

  it("crossfades back when the player walks out into the rain", () => {
    const halfway = rainLoudness(easeFor(RAIN_UNDER_A_ROOF, true, false, 0.3));
    expect(halfway.open).toBeGreaterThan(0);
    expect(halfway.roof).toBeGreaterThan(0);
    expect(rainLoudness(easeFor(RAIN_UNDER_A_ROOF, true, false, 2))).toEqual(rainLoudness(RAIN_IN_THE_OPEN));
  });

  it("follows the rain's easing under a roof too", () => {
    const soon = rainLoudness(easeFor(rainHearingNow(false, true), true, true, 1)).roof;
    expect(soon).toBeGreaterThan(0);
    expect(soon).toBeLessThan(rainLoudness(RAIN_UNDER_A_ROOF).roof);
  });
});
