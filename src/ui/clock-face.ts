// What the HUD clock shows besides the time: how much of the day has passed, for the ring round its icon, and the time of day as a word.
import { HOURS_PER_DAY, MORNING_HOUR, NIGHT_START_HOUR } from "../sim/api";

/** Afternoon starts at noon. */
const AFTERNOON_HOUR = 12;
/** Evening starts at this hour and lasts until night. */
const EVENING_HOUR = 17;

export type TimeOfDayWord = "morning" | "afternoon" | "evening" | "night";

/** The share of the day that has passed at this hour of the day, from 0 at midnight up to 1. The clock ring fills by it. */
export function dayShare(hourOfDay: number): number {
  return Math.min(1, Math.max(0, hourOfDay / HOURS_PER_DAY));
}

/** The time of day at this hour of the day. Night matches the game's night, from 20:00 until morning at 06:00. */
export function timeOfDayWord(hourOfDay: number): TimeOfDayWord {
  if (hourOfDay < MORNING_HOUR || hourOfDay >= NIGHT_START_HOUR) return "night";
  if (hourOfDay < AFTERNOON_HOUR) return "morning";
  if (hourOfDay < EVENING_HOUR) return "afternoon";
  return "evening";
}
