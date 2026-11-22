// The day and night crossfade: birdsong by day, crickets at night. It follows the daylight, so it shares the sky's clock.
// See docs/adr/0009. Birdsong does not depend on the visible birds.
import { easeToward, equalPowerCrossfade } from "../sim/share";

/** How loud the birds sing in full daylight, before the Volume. */
const BIRDS_LOUDNESS = 0.35;
/** How loud the crickets chirp at full night, before the Volume. */
const CRICKETS_LOUDNESS = 0.3;
/**
 * How long the heard daylight takes to swing from night to day, in seconds. The clock changes far more slowly than this
 * in play, so it keeps up. When sleep or skipped time moves the clock on at once, it crossfades over this time.
 */
const QUICK_CROSSFADE_SECONDS = 1.5;

/** How loud the birds and the crickets play, before the Volume, from 0 to 1. */
export interface DayNightMix {
  readonly birds: number;
  readonly crickets: number;
}

/** The birds and crickets at this daylight, from 0 (night) to 1 (full day). They crossfade with equal power. */
export function dayNightMix(daylight: number): DayNightMix {
  const { from: night, to: day } = equalPowerCrossfade(daylight);
  return { birds: BIRDS_LOUDNESS * day, crickets: CRICKETS_LOUDNESS * night };
}

/** Moves the heard daylight from `heard` toward the sky's `daylight` over `elapsedSeconds`, by at most a quick crossfade's pace. */
export function easeHeardDaylight(heard: number, daylight: number, elapsedSeconds: number): number {
  return easeToward(heard, daylight, elapsedSeconds / QUICK_CROSSFADE_SECONDS);
}
