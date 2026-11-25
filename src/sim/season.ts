// The season and the day within it: a value object with pure functions (ADR 0009).
// The year is spring, summer, autumn, and winter, each SEASON_DAYS long, and then it starts again with spring, forever.
// The season comes from the day number and the day the year started on, `yearStartDay`. A new game's year starts on day 1.

/** The seasons of the year, in order. */
export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];

/** How many days each season lasts. */
export const SEASON_DAYS = 7;
/** How many days a year lasts. */
export const YEAR_DAYS = SEASON_DAYS * SEASONS.length;
/** A new game's year starts on day 1. */
export const NEW_GAME_YEAR_START_DAY = 1;

/** The season on one day, and which day of that season it is. */
export interface SeasonDay {
  readonly season: Season;
  /** Which day of the season it is, from 1 up to `seasonDays`. */
  readonly dayOfSeason: number;
  /** How many days the season lasts. */
  readonly seasonDays: number;
}

/** How many whole days have passed since the year started on `yearStartDay`, wrapped into one year, from 0 to YEAR_DAYS - 1. */
function dayOfYear(day: number, yearStartDay: number): number {
  const sinceStart = day - yearStartDay;
  return ((sinceStart % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS;
}

/** The season on this day, when the year started on `yearStartDay`. Days are counted from 1. */
export function seasonDayOf(day: number, yearStartDay: number): SeasonDay {
  const inYear = dayOfYear(day, yearStartDay);
  const season = SEASONS[Math.floor(inYear / SEASON_DAYS)] ?? "spring";
  return { season, dayOfSeason: (inYear % SEASON_DAYS) + 1, seasonDays: SEASON_DAYS };
}

/** The first day of the season that follows the one this day falls in, when the year started on `yearStartDay`. */
export function nextSeasonStartDay(day: number, yearStartDay: number): number {
  return day - seasonDayOf(day, yearStartDay).dayOfSeason + 1 + SEASON_DAYS;
}

/** The first day of this season in the first year, when the year started on `yearStartDay`. */
export function firstDayOfSeason(season: Season, yearStartDay: number = NEW_GAME_YEAR_START_DAY): number {
  return yearStartDay + SEASONS.indexOf(season) * SEASON_DAYS;
}

/** The season this text names, such as "winter", or undefined if it names none. */
export function parseSeason(text: string | null | undefined): Season | undefined {
  return SEASONS.find((season) => season === text);
}

/** When night starts and when morning arrives, as hours of the day. Night runs from its start, past midnight, until morning. */
export interface NightHours {
  /** Night starts at this hour of the day. */
  readonly nightStartHour: number;
  /** Morning arrives, and night ends, at this hour of the day. */
  readonly morningHour: number;
}

/** The night hours of each season. Summer nights are short and winter nights are long. */
const NIGHT_HOURS: Readonly<Record<Season, NightHours>> = {
  spring: Object.freeze({ nightStartHour: 20, morningHour: 6 }),
  summer: Object.freeze({ nightStartHour: 21, morningHour: 5 }),
  autumn: Object.freeze({ nightStartHour: 20, morningHour: 6 }),
  winter: Object.freeze({ nightStartHour: 17, morningHour: 8 }),
};

/** The night hours in this season. */
export function nightHoursOf(season: Season): NightHours {
  return NIGHT_HOURS[season];
}

/** Whether this hour of the day, with its fraction, falls in the night with these night hours. */
export function isNightHour(hourOfDay: number, nightHours: NightHours): boolean {
  return hourOfDay >= nightHours.nightStartHour || hourOfDay < nightHours.morningHour;
}
