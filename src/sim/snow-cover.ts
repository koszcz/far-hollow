// How deep the snow cover lies: a value object with pure functions (ADR 0009).
// Snow cover follows the calendar, not the snowfall. It grows over the first SNOW_GROWS_DAYS of winter and melts over the
// first SNOW_MELTS_DAYS of spring. It is never saved, because the day on the clock decides it.
import type { SeasonDay } from "./season";

/** Snow cover reaches full depth by the end of this winter day. */
const SNOW_GROWS_DAYS = 3;
/** Snow cover has melted away by the end of this spring day. */
const SNOW_MELTS_DAYS = 2;
/** With full snow cover, the player walks outdoors at this fraction of their normal speed. */
const FULL_SNOW_WALKING_SPEED = 0.85;
const HOURS_PER_DAY = 24;

/** How deep the snow cover lies. */
export interface SnowCover {
  /** From 0 (no snow) to 1 (full snow cover). */
  readonly depth: number;
}

export const NO_SNOW_COVER: SnowCover = { depth: 0 };

/**
 * The snow cover at `hourOfDay`, with its fraction, on this day of a season.
 * `afterWinter` says whether a winter came before this day. Without one, such as in a new game's first spring, no snow melts.
 */
export function snowCoverOn(day: SeasonDay, hourOfDay: number, { afterWinter }: { afterWinter: boolean }): SnowCover {
  const daysIn = day.dayOfSeason - 1 + hourOfDay / HOURS_PER_DAY;
  if (day.season === "winter") return { depth: clampShare(daysIn / SNOW_GROWS_DAYS) };
  if (day.season === "spring" && afterWinter) return { depth: clampShare(1 - daysIn / SNOW_MELTS_DAYS) };
  return NO_SNOW_COVER;
}

/** How fast the player walks outdoors in this snow cover, as a fraction of their normal speed. Deeper snow slows them more. */
export function snowWalkingSpeed(cover: SnowCover): number {
  return 1 - (1 - FULL_SNOW_WALKING_SPEED) * cover.depth;
}

function clampShare(share: number): number {
  return Math.min(1, Math.max(0, share));
}
