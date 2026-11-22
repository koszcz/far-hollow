// The wind: a breeze that blows harder in the rain. It is only for looks and sound. Game logic never sees it, and it is
// never saved. The forest's rustle follows it.
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

/** Moves the rain's share from `share` toward 1 while it rains, or toward 0 while dry, over `elapsedSeconds`. */
export function easeRainShare(share: number, raining: boolean, elapsedSeconds: number): number {
  return easeToward(share, raining ? 1 : 0, elapsedSeconds / RAIN_EASE_SECONDS);
}
