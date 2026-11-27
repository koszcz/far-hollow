export const debugText = {
  debugFps: "FPS",
  debugEntities: "Entities",
  debugSeed: "Seed",
  debugTime: "Time",
  debugDayAndTime: (day: number, clock: string) => `Day ${day}, ${clock}`,
  debugSkipHours: (hours: number) => `Skip ${hours} h`,
  debugSeason: "Season",
  /** The season and the day within it, such as "Winter, day 3 of 7". */
  debugSeasonDay: (season: string, dayOfSeason: number, seasonDays: number) => `${season}, day ${dayOfSeason} of ${seasonDays}`,
  debugSkipToSeason: "Skip to next season",
  debugRain: "Rain",
  debugRainFalling: "Falling",
  debugRainDry: "Dry",
  debugRainSnowing: "Snowing",
  debugSkipToRainChange: (falling: boolean) => (falling ? "Skip to rain or snow stopping" : "Skip to rain or snow starting"),
  debugRooms: "Rooms",
  debugRoom: (squares: number, heated: boolean, snug: boolean) =>
    `${squares} ${squares === 1 ? "square" : "squares"}, ${heated ? "heated" : "not heated"}, ${snug ? "snug" : "not snug"}`,
} as const;
