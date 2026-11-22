import { describe, expect, it } from "bun:test";
import { ambienceLoop } from "./ambience-loops";

const SAMPLE_RATE = 8000;

describe("the ambience loops", () => {
  for (const sound of ["sound-river", "sound-forest", "sound-fire"] as const) {
    it(`${sound} is a 6-second loop that never clips and is never silent`, () => {
      const loop = ambienceLoop(sound, SAMPLE_RATE);
      expect(loop.length).toBe(6 * SAMPLE_RATE);
      const loudest = loop.reduce((most, sample) => Math.max(most, Math.abs(sample)), 0);
      expect(loudest).toBeCloseTo(0.9);
      expect(loop.some((sample) => Number.isNaN(sample))).toBe(false);
    });
  }

  it("gives the same loop each time", () => {
    expect(ambienceLoop("sound-fire", SAMPLE_RATE)).toEqual(ambienceLoop("sound-fire", SAMPLE_RATE));
  });
});
