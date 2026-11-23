// How far rain has eased in, for the wind and for the rain's sound. A value object: see ADR 0009.
// Rain eases in when it starts and out when it stops, as the drawn rain does. The first frame takes the weather as it is.
import { easeToward } from "../sim/share";

/** How long rain takes to ease in when it starts, and out when it stops, in seconds. It matches the drawn rain. */
export const RAIN_EASE_SECONDS = 4;

/** How far rain has eased in at one moment. */
export interface EasedRain {
  /** From 0 (dry) to 1 (full rain). */
  readonly share: number;
  /** When, on a steady real-time clock, in seconds. */
  readonly atSeconds: number;
}

/**
 * The rain at `nowSeconds`, eased on from `rain` toward full rain while it rains, or toward dry while it does not.
 * With no `rain` yet, such as on the first frame of a loaded game, it takes the weather as it is.
 */
export function easeRain(rain: EasedRain | undefined, raining: boolean, nowSeconds: number): EasedRain {
  const target = raining ? 1 : 0;
  if (rain === undefined) return { share: target, atSeconds: nowSeconds };
  return { share: easeToward(rain.share, target, (nowSeconds - rain.atSeconds) / RAIN_EASE_SECONDS), atSeconds: nowSeconds };
}
