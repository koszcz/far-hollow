// The wind: a breeze that blows harder in the rain. It is only for looks and sound. Game logic never sees it, and it is
// never saved. The forest's rustle follows it, and wind-sway.ts sways the plants and treetops with it.
// It blows the same way across the whole valley. Its direction drifts slowly over game hours, from the valley's seed.
import { createRandom, scramble } from "../sim/random";
import { clampShare, easeToward } from "../sim/share";

/** How hard the breeze blows on average in dry weather, from 0 (calm) to 1 (a gale). */
const BREEZE = 0.25;
/** How far slow gusts take the wind above and below its average. */
const GUST = 0.12;
/** The gusts come from two slow waves, with these periods in seconds. */
const GUST_PERIOD_SECONDS = { slow: 61, quick: 23 };
/** How much harder the wind blows in full rain. */
const RAIN_EXTRA = 0.45;

/** How long rain takes to ease in when it starts, and out when it stops, for the wind, in seconds. It matches the drawn rain. */
export const RAIN_EASE_SECONDS = 4;

/**
 * How hard the wind blows at `nowSeconds`, from 0 (calm) to 1 (a gale). `rainShare` runs from 0 (dry) to 1 (full rain),
 * and eases between them with easeRainShare.
 */
export function windStrength(nowSeconds: number, rainShare: number): number {
  const slow = Math.sin((nowSeconds / GUST_PERIOD_SECONDS.slow) * Math.PI * 2);
  const quick = Math.sin((nowSeconds / GUST_PERIOD_SECONDS.quick) * Math.PI * 2 + 1.3);
  const gust = slow * 0.6 + quick * 0.4;
  return clampShare(BREEZE + GUST * gust + RAIN_EXTRA * rainShare);
}

/** The wind's direction turns by up to this much either way of its seeded heading, in radians. */
const DIRECTION_SWING_RADIANS = 1.4;
/** The direction drifts as the sum of three slow waves, with these periods in game hours. */
const DIRECTION_PERIOD_HOURS = [29, 13, 7] as const;
/** How much of the swing each wave carries. They add up to 1. */
const DIRECTION_WAVE_SHARES = [0.55, 0.3, 0.15] as const;

/** Which way the wind blows on the ground: a direction one unit long. x runs east, z runs south, as in the valley. */
export interface WindDirection {
  readonly x: number;
  readonly z: number;
}

/** The wind at one moment, the same across the whole valley. */
export interface Wind {
  /** How hard it blows, from 0 (calm) to 1 (a gale). */
  readonly strength: number;
  readonly direction: WindDirection;
}

/**
 * Which way the wind blows `gameHours` after midnight at the start of day 1, in the valley made from `seed`.
 * It drifts slowly over game hours. The same seed and hour always give the same direction.
 */
export function windDirection(seed: number, gameHours: number): WindDirection {
  const random = createRandom(scramble(seed ^ 0x77696e64));
  const heading = random() * Math.PI * 2;
  let swing = 0;
  DIRECTION_PERIOD_HOURS.forEach((period, index) => {
    const phase = random() * Math.PI * 2;
    swing += (DIRECTION_WAVE_SHARES[index] ?? 0) * Math.sin((gameHours / period) * Math.PI * 2 + phase);
  });
  const angle = heading + DIRECTION_SWING_RADIANS * swing;
  return { x: Math.cos(angle), z: Math.sin(angle) };
}

/**
 * The wind at a moment. `nowSeconds` is a steady real-time clock, for the gusts. `gameHours` counts game hours since
 * midnight at the start of day 1, for the direction. `rainShare` runs from 0 (dry) to 1 (full rain), eased with easeRainShare.
 */
export function windAt(moment: { readonly seed: number; readonly nowSeconds: number; readonly gameHours: number; readonly rainShare: number }): Wind {
  return { strength: windStrength(moment.nowSeconds, moment.rainShare), direction: windDirection(moment.seed, moment.gameHours) };
}

/** Moves the rain's share from `share` toward 1 while it rains, or toward 0 while dry, over `elapsedSeconds`. */
export function easeRainShare(share: number, raining: boolean, elapsedSeconds: number): number {
  return easeToward(share, raining ? 1 : 0, elapsedSeconds / RAIN_EASE_SECONDS);
}
