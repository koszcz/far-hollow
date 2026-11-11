// All player-facing text lives here, so the game can be translated later.
export const strings = {
  gameTitle: "Far Hollow",
  pause: "Pause",
  resume: "Resume",
  paused: "Paused",
  debugFps: "FPS",
  debugEntities: "Entities",
  debugSeed: "Seed",
  debugTime: "Time",
  debugDayAndTime: (day: number, clock: string) => `Day ${day}, ${clock}`,
  debugSkipHours: (hours: number) => `Skip ${hours} h`,
} as const;
