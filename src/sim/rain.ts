// When rain falls in the valley. The seed decides it: the same seed always gives the same spells of rain.
import { MINUTES_PER_HOUR, nextMorning } from "./clock";
import { createRandom } from "./random";

/** A spell of rain lasts from 1 to 5 game hours. */
const RAIN_MIN_MINUTES = 1 * MINUTES_PER_HOUR;
const RAIN_MAX_MINUTES = 5 * MINUTES_PER_HOUR;
/** A dry spell between two rains lasts from 8 to 36 game hours. */
const DRY_MIN_MINUTES = 8 * MINUTES_PER_HOUR;
const DRY_MAX_MINUTES = 36 * MINUTES_PER_HOUR;
/** Mixes the number of changes into the seed, so each spell gets its own random length. */
const SPELL_SEED_STEP = 0x9e3779b9;

/** Whether it is raining, and until when. It is plain data, so it can be saved. */
export interface Rain {
  /** Whether rain is falling now. */
  falling: boolean;
  /** Game minutes since the start of day 1 when rain next starts or stops. */
  changeAtMinutes: number;
  /** How many times rain has started or stopped so far. It picks the length of the next spell. */
  changes: number;
}

/**
 * Starts the weather dry at this moment, in game minutes since the start of day 1.
 * The first rain never falls before the next morning, so a new player gets a dry first day and night.
 */
export function createRain(seed: number, nowMinutes: number): Rain {
  return { falling: false, changeAtMinutes: nextMorning(nowMinutes) + spellMinutes(seed, 0, false), changes: 0 };
}

/** Moves the rain on to this moment, starting and stopping it as many times as the time passed calls for. */
export function passRainTime(rain: Rain, seed: number, nowMinutes: number): void {
  while (nowMinutes >= rain.changeAtMinutes) {
    rain.falling = !rain.falling;
    rain.changes += 1;
    rain.changeAtMinutes += spellMinutes(seed, rain.changes, rain.falling);
  }
}

/** How long a spell of rain, or of dry weather, lasts, in whole game minutes. */
function spellMinutes(seed: number, changes: number, falling: boolean): number {
  const random = createRandom(scramble(seed + Math.imul(changes + 1, SPELL_SEED_STEP)));
  const [min, max] = falling ? [RAIN_MIN_MINUTES, RAIN_MAX_MINUTES] : [DRY_MIN_MINUTES, DRY_MAX_MINUTES];
  return Math.round(min + random() * (max - min));
}

/**
 * Stirs the bits of a number, so seeds next to each other give unrelated spells.
 * Without it, the first random number from neighbouring seeds can come out nearly the same.
 * This is the final mixing step of the MurmurHash3 hash.
 */
function scramble(value: number): number {
  let mixed = value >>> 0;
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x85ebca6b);
  mixed = Math.imul(mixed ^ (mixed >>> 13), 0xc2b2ae35);
  return (mixed ^ (mixed >>> 16)) >>> 0;
}
