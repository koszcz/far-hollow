export const timeText = {
  /** The HUD clock in the top left corner, such as "Spring · day 3 of 7 · 14:20". */
  clock: (season: string, dayOfSeason: number, seasonDays: number, hour: number, minute: number) =>
    `${season} · day ${dayOfSeason} of ${seasonDays} · ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  /** Each season's name, as the HUD clock and the debug overlay show it. */
  seasons: {
    spring: "Spring",
    summer: "Summer",
    autumn: "Autumn",
    winter: "Winter",
  },
  /** The banner when a season starts. It says in one line what changes. */
  seasonStarted: {
    spring: "Spring. The snow melts and the river thaws.",
    summer: "Summer.",
    autumn: "Autumn. The nights grow colder.",
    winter: "Winter has come. The nights are long and cold, and the river is frozen.",
  },
  /** The time of day the HUD clock names after the time, in secondary text. */
  timeOfDay: {
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
    night: "night",
  },
} as const;
