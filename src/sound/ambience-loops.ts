// Builds the code-made draft sounds "sound-river", "sound-forest", and "sound-fire" listed in asset-manifest.json.
// Each is a short loop made from shaped noise, so the game downloads nothing for sound.
// - sound-river: a low, steady rush of flowing water with a soft babble on top that swells and falls slowly.
// - sound-forest: a high, airy rustle of leaves in waves, as gusts pass through the treetops. How loud it plays follows the wind.
// - sound-fire: a low, soft roar under quick, uneven crackles and pops.
// Each loop ends where it begins, so it repeats without a click.
import { createRandom, type Random } from "../sim/random";
import type { SoundId } from "./sound-mix";

/** How long each loop lasts before it repeats, in seconds. */
const LOOP_SECONDS = 6;
/** The end of each loop blends into its start over this many seconds, so the repeat is smooth. */
const SEAM_SECONDS = 0.5;
/** The loudest sample of each loop, so loops never clip when they play together. */
const PEAK = 0.9;

/** How each loop is made, one sample at a time. Each maker is called once per sample, in order. */
type SampleMaker = (random: Random, sampleRate: number) => (seconds: number) => number;

const MAKERS: Readonly<Record<SoundId, SampleMaker>> = {
  "sound-river": riverMaker,
  "sound-forest": forestMaker,
  "sound-fire": fireMaker,
};

/** The samples of one loop at this sample rate, between -PEAK and PEAK. The same sound always gives the same loop. */
export function ambienceLoop(sound: SoundId, sampleRate: number): Float32Array<ArrayBuffer> {
  const length = Math.round(LOOP_SECONDS * sampleRate);
  const seam = Math.round(SEAM_SECONDS * sampleRate);
  const next = MAKERS[sound](createRandom(SEEDS[sound]), sampleRate);
  // Makes the seam's worth of samples past the end, then fades them into the start.
  const made = new Float32Array(length + seam);
  for (let index = 0; index < made.length; index += 1) made[index] = next(index / sampleRate);
  const loop = made.slice(0, length);
  for (let index = 0; index < seam; index += 1) {
    const share = index / seam;
    loop[index] = (made[index] ?? 0) * share + (made[length + index] ?? 0) * (1 - share);
  }
  let loudest = 0;
  for (const sample of loop) loudest = Math.max(loudest, Math.abs(sample));
  if (loudest > 0) for (let index = 0; index < loop.length; index += 1) loop[index] = ((loop[index] ?? 0) / loudest) * PEAK;
  return loop;
}

const SEEDS: Readonly<Record<SoundId, number>> = { "sound-river": 11, "sound-forest": 23, "sound-fire": 37 };

/** A slow wave that repeats a whole number of times in each loop, so it lines up at the seam. Runs from -1 to 1. */
function loopWave(seconds: number, timesPerLoop: number, phase = 0): number {
  return Math.sin((seconds / LOOP_SECONDS) * timesPerLoop * Math.PI * 2 + phase);
}

/** How much of the last sample a simple low-pass filter keeps, for a cut-off frequency in hertz. */
function smoothing(cutOffHertz: number, sampleRate: number): number {
  return Math.exp((-2 * Math.PI * cutOffHertz) / sampleRate);
}

function riverMaker(random: Random, sampleRate: number): (seconds: number) => number {
  const rushKeep = smoothing(400, sampleRate);
  const babbleLowKeep = smoothing(1800, sampleRate);
  const babbleHighKeep = smoothing(500, sampleRate);
  let rush = 0;
  let babbleLow = 0;
  let babbleHigh = 0;
  return (seconds) => {
    const white = random() * 2 - 1;
    rush = rush * rushKeep + white * (1 - rushKeep);
    babbleLow = babbleLow * babbleLowKeep + white * (1 - babbleLowKeep);
    babbleHigh = babbleHigh * babbleHighKeep + white * (1 - babbleHighKeep);
    // The babble is the band between the two filters. It swells and falls slowly, on two waves.
    const babble = (babbleLow - babbleHigh) * (0.6 + 0.25 * loopWave(seconds, 3) + 0.15 * loopWave(seconds, 7, 1.1));
    return rush * 2.2 + babble * 1.4;
  };
}

function forestMaker(random: Random, sampleRate: number): (seconds: number) => number {
  const airKeep = smoothing(5000, sampleRate);
  const lowKeep = smoothing(1200, sampleRate);
  const flutterKeep = smoothing(14, sampleRate);
  let air = 0;
  let low = 0;
  let flutter = 0;
  return (seconds) => {
    const white = random() * 2 - 1;
    air = air * airKeep + white * (1 - airKeep);
    low = low * lowKeep + white * (1 - lowKeep);
    // Leaves flutter quickly within each gust.
    flutter = flutter * flutterKeep + (random() * 2 - 1) * (1 - flutterKeep);
    const gust = 0.55 + 0.3 * loopWave(seconds, 2) + 0.15 * loopWave(seconds, 5, 0.7);
    return (air - low) * gust * (0.75 + flutter * 6);
  };
}

function fireMaker(random: Random, sampleRate: number): (seconds: number) => number {
  const roarKeep = smoothing(250, sampleRate);
  const crackleKeep = smoothing(600, sampleRate);
  /** Crackles per second, on average. */
  const cracklesPerSecond = 14;
  /** How fast a crackle dies away, per sample. */
  const crackleDecay = Math.exp(-1 / (0.004 * sampleRate));
  let roar = 0;
  let crackleLow = 0;
  let crackle = 0;
  return (seconds) => {
    const white = random() * 2 - 1;
    roar = roar * roarKeep + white * (1 - roarKeep);
    crackleLow = crackleLow * crackleKeep + white * (1 - crackleKeep);
    // A new crackle starts now and then, with its own loudness. Some are loud pops.
    if (random() < cracklesPerSecond / sampleRate) crackle = Math.max(crackle, 0.2 + random() * (random() < 0.15 ? 1 : 0.5));
    crackle *= crackleDecay;
    const flicker = 0.8 + 0.2 * loopWave(seconds, 4, 2.3);
    return roar * 1.6 * flicker + (white - crackleLow) * crackle;
  };
}
