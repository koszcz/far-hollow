// The valley's clock. Game logic owns it. Rendering and the UI only read it.

/** One game hour passes in one real minute, so a day lasts 24 real minutes. */
export const REAL_MS_PER_GAME_MINUTE = 1000;
export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY;
/** readClock rounds to a millionth of a game minute. */
const ROUNDING_STEPS_PER_MINUTE = 1_000_000;

export interface ClockStart {
  /** The first day is day 1. */
  day: number;
  /** Hour of that day, from 0 to 23. */
  hour: number;
}

/** A moment on the clock, split into parts people read. */
export interface TimeOfDay {
  /** Which day it is. The first day is day 1. */
  readonly day: number;
  /** Whole hour of the day, from 0 to 23. */
  readonly hour: number;
  /** Whole minute of the hour, from 0 to 59. */
  readonly minute: number;
  /** Hour of the day with its fraction, from 0 up to 24. Use it for smooth changes such as light. */
  readonly hourOfDay: number;
}

export interface Clock {
  /** Game minutes since midnight at the start of day 1. */
  readonly minutes: number;
  /** Moves the clock on by real time that passed in the game. */
  advance(realMs: number): void;
  /** Jumps the clock forward by game hours. A negative or broken amount does nothing. */
  skip(hours: number): void;
}

export function createClock(start: ClockStart): Clock {
  let minutes = (start.day - 1) * MINUTES_PER_DAY + start.hour * MINUTES_PER_HOUR;
  return {
    get minutes() {
      return minutes;
    },
    advance(realMs) {
      minutes += realMs / REAL_MS_PER_GAME_MINUTE;
    },
    skip(hours) {
      // Time only moves forward. Ignore a negative or broken amount.
      if (!(hours > 0) || !Number.isFinite(hours)) return;
      minutes += hours * MINUTES_PER_HOUR;
    },
  };
}

/** Splits game minutes since the start of day 1 into day, hour, and minute. */
export function readClock(rawMinutes: number): TimeOfDay {
  // Logic steps add fractions that do not divide evenly, such as 1/30 of a second.
  // Rounding away the tiny error they build up keeps the clock from reading 07:59 at 08:00.
  const minutes = Math.round(rawMinutes * ROUNDING_STEPS_PER_MINUTE) / ROUNDING_STEPS_PER_MINUTE;
  const day = Math.floor(minutes / MINUTES_PER_DAY) + 1;
  const minuteOfDay = minutes - (day - 1) * MINUTES_PER_DAY;
  const hour = Math.floor(minuteOfDay / MINUTES_PER_HOUR);
  const minute = Math.floor(minuteOfDay - hour * MINUTES_PER_HOUR);
  return { day, hour, minute, hourOfDay: minuteOfDay / MINUTES_PER_HOUR };
}

/** Night starts at this hour of the day. */
export const NIGHT_START_HOUR = 20;
/** Morning arrives, and night ends, at this hour of the day. */
export const MORNING_HOUR = 6;

/** Whether this hour of the day, with its fraction, falls in the night. */
export function isNight(hourOfDay: number): boolean {
  return hourOfDay >= NIGHT_START_HOUR || hourOfDay < MORNING_HOUR;
}
