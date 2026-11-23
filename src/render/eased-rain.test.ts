import { describe, expect, it } from "bun:test";
import { easeRain, RAIN_EASE_SECONDS } from "./eased-rain";

describe("the eased rain", () => {
  it("takes the weather as it is on the first frame, so a game loaded in the rain does not ease it in", () => {
    expect(easeRain(undefined, true, 50)).toEqual({ share: 1, atSeconds: 50 });
    expect(easeRain(undefined, false, 50)).toEqual({ share: 0, atSeconds: 50 });
  });

  it("takes RAIN_EASE_SECONDS to ease in when rain starts", () => {
    const dry = easeRain(undefined, false, 10);
    expect(easeRain(dry, true, 10 + RAIN_EASE_SECONDS / 2).share).toBeCloseTo(0.5);
    expect(easeRain(dry, true, 10 + RAIN_EASE_SECONDS).share).toBe(1);
  });

  it("takes RAIN_EASE_SECONDS to ease out when rain stops", () => {
    const wet = easeRain(undefined, true, 0);
    expect(easeRain(wet, false, RAIN_EASE_SECONDS / 4).share).toBeCloseTo(0.75);
    expect(easeRain(wet, false, RAIN_EASE_SECONDS * 2).share).toBe(0);
  });

  it("eases from where it was at the last frame", () => {
    let rain = easeRain(undefined, false, 0);
    for (let frame = 1; frame <= 60; frame += 1) rain = easeRain(rain, true, frame / 60);
    expect(rain.share).toBeCloseTo(1 / RAIN_EASE_SECONDS);
    expect(rain.atSeconds).toBe(1);
  });
});
