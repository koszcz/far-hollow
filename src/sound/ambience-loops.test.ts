import { describe, expect, it } from "bun:test";
import { ambienceLoop, loopSeconds } from "./ambience-loops";
import { SOUND_IDS } from "./sound-mix";

const SAMPLE_RATE = 8000;

describe("the ambience loops", () => {
  for (const sound of SOUND_IDS) {
    it(`${sound} is a loop that never clips and is never silent`, () => {
      const loop = ambienceLoop(sound, SAMPLE_RATE);
      expect(loop.length).toBe(Math.round(loopSeconds(sound) * SAMPLE_RATE));
      expect(loopSeconds(sound)).toBeGreaterThanOrEqual(6);
      const loudest = loop.reduce((most, sample) => Math.max(most, Math.abs(sample)), 0);
      expect(loudest).toBeCloseTo(0.9);
      expect(loop.some((sample) => Number.isNaN(sample))).toBe(false);
    });
  }

  it("gives the same loop each time", () => {
    expect(ambienceLoop("sound-fire", SAMPLE_RATE)).toEqual(ambienceLoop("sound-fire", SAMPLE_RATE));
  });
});
