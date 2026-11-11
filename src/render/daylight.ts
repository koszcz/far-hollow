import { MORNING_HOUR, NIGHT_START_HOUR } from "../sim/clock";

/** Dawn runs from morning until this many hours later. Dusk ends at nightfall and starts this many hours before it. */
const TWILIGHT_HOURS = 2;

/**
 * How much daylight there is at this hour of the day, from 0 (night) to 1 (full day).
 * Daylight grows through the dawn after morning arrives and fades through the dusk before night starts.
 */
export function daylightAt(hourOfDay: number): number {
  const dawn = smoothStep((hourOfDay - MORNING_HOUR) / TWILIGHT_HOURS);
  const dusk = smoothStep((NIGHT_START_HOUR - hourOfDay) / TWILIGHT_HOURS);
  return Math.min(dawn, dusk);
}

/** Eases from 0 to 1 as t goes from 0 to 1, with no sudden start or stop. */
function smoothStep(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
}
