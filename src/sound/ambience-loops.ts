// Builds the code-made draft ambience sounds listed in asset-manifest.json. Each is a short loop made from shaped noise or
// simple tones, so the game downloads nothing for sound.
// - sound-river: a low, steady rush of flowing water with a soft babble on top that swells and falls slowly.
// - sound-forest: a high, airy rustle of leaves in waves, as gusts pass through the treetops. How loud it plays follows the wind.
// - sound-fire: a low, soft roar under quick, uneven crackles and pops.
// - sound-rain: a bright, steady hiss of rain with fine drops ticking all through it.
// - sound-rain-roof: a dull, muffled rush with soft, quick thuds of drops drumming on a roof overhead.
// - sound-birds: now and then a bird sings a short phrase of quick, rising and falling whistles, some near and some far.
// - sound-crickets: a few crickets chirp high, short trills over and over, each at its own pitch and pace.
// Each loop ends where it begins, so it repeats without a click.
import { createRandom, type Random } from "../sim/random";
import type { SoundId } from "./sound-mix";

/** How long most loops last before they repeat, in seconds. */
const LOOP_SECONDS = 6;
/** Birdsong repeats less often, so the ear does not catch the same phrase coming round. */
const BIRDS_LOOP_SECONDS = 12;
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
  "sound-rain": rainMaker,
  "sound-rain-roof": rainRoofMaker,
  "sound-birds": birdsMaker,
  "sound-crickets": cricketsMaker,
};

/** How long this sound's loop lasts before it repeats, in seconds. */
export function loopSeconds(sound: SoundId): number {
  return sound === "sound-birds" ? BIRDS_LOOP_SECONDS : LOOP_SECONDS;
}

/** The samples of one loop at this sample rate, between -PEAK and PEAK. The same sound always gives the same loop. */
export function ambienceLoop(sound: SoundId, sampleRate: number): Float32Array<ArrayBuffer> {
  const length = Math.round(loopSeconds(sound) * sampleRate);
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

const SEEDS: Readonly<Record<SoundId, number>> = {
  "sound-river": 11,
  "sound-forest": 23,
  "sound-fire": 37,
  "sound-rain": 41,
  "sound-rain-roof": 53,
  "sound-birds": 67,
  "sound-crickets": 79,
};

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

function rainMaker(random: Random, sampleRate: number): (seconds: number) => number {
  const hissHighKeep = smoothing(7000, sampleRate);
  const hissLowKeep = smoothing(500, sampleRate);
  /** Drops per second that tick loudly enough to hear one by one. */
  const dropsPerSecond = 90;
  const dropDecay = Math.exp(-1 / (0.0015 * sampleRate));
  let hissHigh = 0;
  let hissLow = 0;
  let drop = 0;
  return (seconds) => {
    const white = random() * 2 - 1;
    hissHigh = hissHigh * hissHighKeep + white * (1 - hissHighKeep);
    hissLow = hissLow * hissLowKeep + white * (1 - hissLowKeep);
    if (random() < dropsPerSecond / sampleRate) drop = Math.max(drop, 0.3 + random() * 0.7);
    drop *= dropDecay;
    const swell = 0.85 + 0.1 * loopWave(seconds, 2) + 0.05 * loopWave(seconds, 5, 0.4);
    return (hissHigh - hissLow) * swell * 1.2 + (white - hissHigh) * drop * 0.6;
  };
}

function rainRoofMaker(random: Random, sampleRate: number): (seconds: number) => number {
  const rushKeep = smoothing(450, sampleRate);
  const thudKeep = smoothing(220, sampleRate);
  /** Drops per second that land loudly enough on the roof to drum. */
  const thudsPerSecond = 45;
  const thudDecay = Math.exp(-1 / (0.012 * sampleRate));
  let rush = 0;
  let thudTone = 0;
  let thud = 0;
  return (seconds) => {
    const white = random() * 2 - 1;
    rush = rush * rushKeep + white * (1 - rushKeep);
    thudTone = thudTone * thudKeep + white * (1 - thudKeep);
    if (random() < thudsPerSecond / sampleRate) thud = Math.max(thud, 0.4 + random() * 0.6);
    thud *= thudDecay;
    const swell = 0.85 + 0.1 * loopWave(seconds, 3, 0.9) + 0.05 * loopWave(seconds, 7);
    return rush * 2.5 * swell + thudTone * thud * 9;
  };
}

/** One whistle of a bird's phrase: when it starts, how long it lasts, the pitch it slides between, and how loud it is. */
interface BirdNote {
  readonly start: number;
  readonly seconds: number;
  readonly fromHertz: number;
  readonly toHertz: number;
  readonly loudness: number;
}

/** The phrases birds sing through one birdsong loop, as single notes in the order they start. */
function birdNotes(random: Random): BirdNote[] {
  const notes: BirdNote[] = [];
  /** Each phrase starts at least this long before the loop ends, so the seam stays quiet. */
  const lastStart = BIRDS_LOOP_SECONDS - 1.5;
  for (let phrase = random() * 0.8; phrase < lastStart; phrase += 0.9 + random() * 1.6) {
    // Each bird has its own pitch and loudness. Far birds are quieter.
    const pitch = 2200 + random() * 2600;
    const loudness = 0.25 + random() * 0.75;
    const count = 2 + Math.floor(random() * 5);
    const rising = random() < 0.5;
    let start = phrase;
    for (let note = 0; note < count; note += 1) {
      const seconds = 0.05 + random() * 0.12;
      const slide = (0.15 + random() * 0.35) * pitch;
      const low = pitch * (0.9 + random() * 0.2);
      notes.push({ start, seconds, fromHertz: rising ? low : low + slide, toHertz: rising ? low + slide : low, loudness });
      start += seconds + 0.03 + random() * 0.08;
    }
  }
  return notes.sort((a, b) => a.start - b.start);
}

function birdsMaker(random: Random): (seconds: number) => number {
  const notes = birdNotes(random);
  let next = 0;
  let sounding: BirdNote[] = [];
  return (seconds) => {
    for (let note = notes[next]; note !== undefined && note.start <= seconds; note = notes[next]) {
      sounding.push(note);
      next += 1;
    }
    sounding = sounding.filter((note) => seconds < note.start + note.seconds);
    let sample = 0;
    for (const note of sounding) {
      const t = seconds - note.start;
      // The pitch slides straight from one to the other, so the wave's phase grows with the square of time.
      const phase = 2 * Math.PI * (note.fromHertz * t + ((note.toHertz - note.fromHertz) * t * t) / (2 * note.seconds));
      const envelope = Math.sin((Math.PI * t) / note.seconds) ** 2;
      sample += Math.sin(phase + 0.4 * Math.sin(2 * Math.PI * 35 * t)) * envelope * note.loudness;
    }
    return sample;
  };
}

/** One cricket: its pitch, how often it chirps, how many pulses make each chirp, when it starts, and how loud it is. */
interface Cricket {
  readonly hertz: number;
  readonly chirpEvery: number;
  readonly pulses: number;
  readonly offset: number;
  readonly loudness: number;
}

/** Each pulse of a cricket's chirp lasts this long, in seconds. */
const CRICKET_PULSE_SECONDS = 0.018;
/** From one pulse's start to the next, in seconds. */
const CRICKET_PULSE_EVERY = 0.04;

function cricketsMaker(random: Random): (seconds: number) => number {
  const crickets: Cricket[] = Array.from({ length: 4 }, () => ({
    hertz: 4200 + random() * 900,
    chirpEvery: 0.35 + random() * 0.4,
    pulses: 3 + Math.floor(random() * 3),
    offset: random(),
    loudness: 0.35 + random() * 0.65,
  }));
  return (seconds) => {
    let sample = 0;
    for (const cricket of crickets) {
      const inChirp = (seconds + cricket.offset) % cricket.chirpEvery;
      const pulse = Math.floor(inChirp / CRICKET_PULSE_EVERY);
      if (pulse >= cricket.pulses) continue;
      const inPulse = inChirp - pulse * CRICKET_PULSE_EVERY;
      if (inPulse >= CRICKET_PULSE_SECONDS) continue;
      const envelope = Math.sin((Math.PI * inPulse) / CRICKET_PULSE_SECONDS);
      sample += Math.sin(2 * Math.PI * cricket.hertz * seconds) * envelope * cricket.loudness;
    }
    return sample;
  };
}
