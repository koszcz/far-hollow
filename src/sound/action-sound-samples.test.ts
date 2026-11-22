import { describe, expect, it } from "bun:test";
import { CHOP_STRIKE_SHARE } from "../render/player-mesh";
import { actionSound } from "./action-sound-samples";
import { FOOTSTEP_SECONDS, PLACE_SECONDS, WORK_RHYTHMS } from "./action-sounds";
import type { ActionSoundId } from "./sound-mix";

const SAMPLE_RATE = 8000;

/** How long each sound lasts: a work sound one beat of its motion, so it loops in time, and a footstep or click its own length. */
const LENGTHS: Readonly<Record<ActionSoundId, number>> = {
  "sound-chop": WORK_RHYTHMS.chop.beatSeconds,
  "sound-saw": WORK_RHYTHMS.saw.beatSeconds,
  "sound-debark": WORK_RHYTHMS.debark.beatSeconds,
  "sound-dig": WORK_RHYTHMS.digUp.beatSeconds,
  "sound-build": WORK_RHYTHMS.build.beatSeconds,
  "sound-footstep": FOOTSTEP_SECONDS,
  "sound-place": PLACE_SECONDS,
};

function loudestAt(samples: Float32Array, from: number, to: number): number {
  let loudest = 0;
  for (let index = Math.round(from); index < Math.round(to); index += 1) loudest = Math.max(loudest, Math.abs(samples[index] ?? 0));
  return loudest;
}

describe("the action sounds", () => {
  for (const [sound, seconds] of Object.entries(LENGTHS) as [ActionSoundId, number][]) {
    it(`${sound} lasts ${seconds.toFixed(2)} s, never clips, and is never silent`, () => {
      const samples = actionSound(sound, SAMPLE_RATE);
      expect(samples.length).toBe(Math.round(seconds * SAMPLE_RATE));
      expect(loudestAt(samples, 0, samples.length)).toBeCloseTo(0.9);
      expect(samples.some((sample) => Number.isNaN(sample))).toBe(false);
    });
  }

  it("strikes the chop at the moment the axe meets the trunk", () => {
    const samples = actionSound("sound-chop", SAMPLE_RATE);
    const strike = CHOP_STRIKE_SHARE * samples.length;
    expect(loudestAt(samples, 0, strike - 0.02 * SAMPLE_RATE)).toBeLessThan(0.05);
    expect(loudestAt(samples, strike, strike + 0.05 * SAMPLE_RATE)).toBeGreaterThan(0.5);
  });

  it("gives the same sound each time", () => {
    expect(actionSound("sound-saw", SAMPLE_RATE)).toEqual(actionSound("sound-saw", SAMPLE_RATE));
  });
});
