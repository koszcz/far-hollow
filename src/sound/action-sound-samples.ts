// Builds the code-made draft action sounds listed in asset-manifest.json from shaped noise and short tones, so the game
// downloads nothing for sound. Each work sound lasts exactly one beat of its motion, with its hits where the motion's
// hits are, so it loops in time with the player:
// - sound-chop: the axe bites into the trunk with a sharp crack over a low, woody thud, where the swing strikes.
// - sound-saw: a toothy rasp on the push and a stronger one on the pull, once per stroke.
// - sound-debark: a dry, crackling scrape while the drawknife pulls bark off the log.
// - sound-dig: a gritty crunch as the spade cuts the soil, then a soft fall of earth.
// - sound-build: two wooden knocks as the hands press a piece into place, the second one softer.
// The other two play once:
// - sound-place: a short, quiet click.
// - sound-footstep: one soft, low footstep, the same on every ground.
import { CHOP_STRIKE_SHARE } from "../render/player-mesh";
import { CROUCH_PRESSED_SHARE } from "../render/player-build-pose";
import { DEBARK_BITE_SHARE, DEBARK_PULLED_SHARE } from "../render/player-debark-pose";
import { createRandom, type Random } from "../sim/random";
import { FOOTSTEP_SECONDS, PLACE_SECONDS, WORK_RHYTHMS } from "./action-sounds";
import type { ActionSoundId } from "./sound-mix";

/** The loudest sample of each sound, so sounds never clip when they play together. */
const PEAK = 0.9;

/** How one sound is made: its length in seconds, and the sample at each moment. The maker is called once per sample, in order. */
interface SoundMaker {
  readonly seconds: number;
  readonly seed: number;
  make(random: Random, sampleRate: number): (seconds: number) => number;
}

const MAKERS: Readonly<Record<ActionSoundId, SoundMaker>> = {
  "sound-chop": { seconds: WORK_RHYTHMS.chop.beatSeconds, seed: 101, make: chopMaker },
  "sound-saw": { seconds: WORK_RHYTHMS.saw.beatSeconds, seed: 103, make: sawMaker },
  "sound-debark": { seconds: WORK_RHYTHMS.debark.beatSeconds, seed: 107, make: debarkMaker },
  "sound-dig": { seconds: WORK_RHYTHMS.digUp.beatSeconds, seed: 109, make: digMaker },
  "sound-build": { seconds: WORK_RHYTHMS.build.beatSeconds, seed: 113, make: buildMaker },
  "sound-place": { seconds: PLACE_SECONDS, seed: 127, make: placeMaker },
  "sound-footstep": { seconds: FOOTSTEP_SECONDS, seed: 131, make: footstepMaker },
};

/** The samples of one action sound at this sample rate, between -PEAK and PEAK. The same sound always gives the same samples. */
export function actionSound(sound: ActionSoundId, sampleRate: number): Float32Array<ArrayBuffer> {
  const maker = MAKERS[sound];
  const samples = new Float32Array(Math.round(maker.seconds * sampleRate));
  const next = maker.make(createRandom(maker.seed), sampleRate);
  for (let index = 0; index < samples.length; index += 1) samples[index] = next(index / sampleRate);
  let loudest = 0;
  for (const sample of samples) loudest = Math.max(loudest, Math.abs(sample));
  if (loudest > 0) for (let index = 0; index < samples.length; index += 1) samples[index] = ((samples[index] ?? 0) / loudest) * PEAK;
  return samples;
}

/** How much of the last sample a simple low-pass filter keeps, for a cut-off frequency in hertz. */
function smoothing(cutOffHertz: number, sampleRate: number): number {
  return Math.exp((-2 * Math.PI * cutOffHertz) / sampleRate);
}

/** A hit that starts at `at` seconds and dies away over about `decaySeconds`: 0 before it, 1 as it starts. */
function hit(seconds: number, at: number, decaySeconds: number): number {
  return seconds < at ? 0 : Math.exp(-(seconds - at) / decaySeconds);
}

/** A swell that rises and falls between `from` and `to` seconds, 1 at its middle and 0 outside it. */
function swell(seconds: number, from: number, to: number): number {
  if (seconds <= from || seconds >= to) return 0;
  return Math.sin(((seconds - from) / (to - from)) * Math.PI);
}

/** A low-pass filter over a stream of samples. */
function lowPass(cutOffHertz: number, sampleRate: number): (sample: number) => number {
  const keep = smoothing(cutOffHertz, sampleRate);
  let last = 0;
  return (sample) => {
    last = last * keep + sample * (1 - keep);
    return last;
  };
}

function chopMaker(random: Random, sampleRate: number): (seconds: number) => number {
  const strike = CHOP_STRIKE_SHARE * WORK_RHYTHMS.chop.beatSeconds;
  const body = lowPass(900, sampleRate);
  return (seconds) => {
    const white = random() * 2 - 1;
    const crack = white * hit(seconds, strike, 0.012);
    const thud = Math.sin((seconds - strike) * 2 * Math.PI * 170) * hit(seconds, strike, 0.07);
    const knock = body(white) * hit(seconds, strike, 0.05) * 3;
    return crack * 0.8 + thud + knock;
  };
}

function sawMaker(random: Random, sampleRate: number): (seconds: number) => number {
  const stroke = WORK_RHYTHMS.saw.beatSeconds;
  const low = lowPass(900, sampleRate);
  const high = lowPass(3500, sampleRate);
  return (seconds) => {
    const white = random() * 2 - 1;
    const band = high(white) - low(white);
    // Each tooth catches the wood in turn, so the rasp buzzes.
    const teeth = 0.55 + 0.45 * Math.abs(Math.sin(seconds * 2 * Math.PI * 38));
    const push = swell(seconds, 0.04 * stroke, 0.48 * stroke) * 0.65;
    const pull = swell(seconds, 0.52 * stroke, 0.96 * stroke);
    return band * teeth * (push + pull);
  };
}

function debarkMaker(random: Random, sampleRate: number): (seconds: number) => number {
  const stroke = WORK_RHYTHMS.debark.beatSeconds;
  const from = DEBARK_BITE_SHARE * stroke;
  const to = DEBARK_PULLED_SHARE * stroke;
  const low = lowPass(400, sampleRate);
  const high = lowPass(2500, sampleRate);
  let crackle = 0;
  const crackleDecay = Math.exp(-1 / (0.006 * sampleRate));
  return (seconds) => {
    const white = random() * 2 - 1;
    const scrape = high(white) - low(white);
    // Strips of bark snap now and then as they tear free.
    if (random() < 40 / sampleRate) crackle = Math.max(crackle, 0.5 + random() * 0.8);
    crackle *= crackleDecay;
    const pulling = swell(seconds, from, to);
    return (scrape * (0.7 + crackle) + white * crackle * 0.4) * pulling;
  };
}

function digMaker(random: Random, sampleRate: number): (seconds: number) => number {
  const stroke = WORK_RHYTHMS.digUp.beatSeconds;
  const soil = lowPass(1200, sampleRate);
  const fall = lowPass(500, sampleRate);
  return (seconds) => {
    const white = random() * 2 - 1;
    // Grit makes the cut crunch unevenly.
    const grit = random() < 0.3 ? 1 : 0.4;
    const cut = soil(white) * grit * (hit(seconds, 0.02 * stroke, 0.06) + swell(seconds, 0.02 * stroke, 0.2 * stroke) * 0.5);
    const earth = fall(white) * swell(seconds, 0.4 * stroke, 0.65 * stroke) * 0.6;
    return cut * 3 + earth * 3;
  };
}

function buildMaker(random: Random, sampleRate: number): (seconds: number) => number {
  const cycle = WORK_RHYTHMS.build.beatSeconds;
  const first = CROUCH_PRESSED_SHARE * cycle;
  const second = first + 0.16;
  const body = lowPass(1500, sampleRate);
  return (seconds) => {
    const white = random() * 2 - 1;
    const knockAt = (at: number, loud: number): number =>
      (Math.sin((seconds - at) * 2 * Math.PI * 240) + Math.sin((seconds - at) * 2 * Math.PI * 610) * 0.4) * hit(seconds, at, 0.045) * loud;
    const tap = body(white) * (hit(seconds, first, 0.01) + hit(seconds, second, 0.01) * 0.6) * 2;
    return knockAt(first, 1) + knockAt(second, 0.55) + tap;
  };
}

function placeMaker(random: Random): (seconds: number) => number {
  return (seconds) => {
    const white = random() * 2 - 1;
    return (Math.sin(seconds * 2 * Math.PI * 1400) * 0.7 + white * 0.3) * hit(seconds, 0, 0.012) * swell(seconds, -PLACE_SECONDS, PLACE_SECONDS);
  };
}

function footstepMaker(random: Random, sampleRate: number): (seconds: number) => number {
  const soft = lowPass(350, sampleRate);
  const scuff = lowPass(1800, sampleRate);
  return (seconds) => {
    const white = random() * 2 - 1;
    const fade = swell(seconds, -FOOTSTEP_SECONDS, FOOTSTEP_SECONDS);
    return (soft(white) * 4 * hit(seconds, 0, 0.04) + scuff(white) * 0.5 * hit(seconds, 0.02, 0.06)) * fade;
  };
}
