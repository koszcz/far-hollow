// Showcases for daylight and rain. The registry is src/render/showcases/index.ts.
import { CAMPFIRE_FUEL_LIMIT_MINUTES } from "../../sim/campfires";
import { NOON, NIGHT, type Showcase } from "./types";

export const WEATHER_SHOWCASES: Readonly<Record<string, Showcase>> = {
  "sky-lighting": {
    radius: 9,
    focus: { x: 0, y: 2, z: 0 },
    shots: [
      { label: "dawn, 07:00", yaw: 250, pitch: 8, hour: 7 },
      { label: "midday, 12:00", yaw: 200, pitch: 20, hour: NOON },
      { label: "dusk, 19:00", yaw: 70, pitch: 8, hour: 19 },
      { label: "night, 23:00", yaw: 200, pitch: 8, hour: 23 },
    ],
    build({ place }) {
      for (const [x, z] of [
        [-5, -3],
        [0, -6],
        [5, -2],
        [-3, 4],
      ] as const)
        place(x, z, { tree: true });
      place(2, 1, { log: { heading: 0.6 } });
      place(-2, 1.5, { campfire: { lit: true, fuelMinutes: CAMPFIRE_FUEL_LIMIT_MINUTES } });
    },
  },
  rain: {
    radius: 6,
    focus: { x: 0, y: 1.5, z: 0 },
    shots: [
      { label: "midday", yaw: 200, pitch: 10, hour: NOON, seconds: 0 },
      { label: "midday, from above", yaw: 40, pitch: 45, hour: NOON, seconds: 0.4 },
      { label: "dusk, by a campfire", yaw: 70, pitch: 10, hour: 19, seconds: 0.8 },
      { label: "night, by a campfire", yaw: 200, pitch: 10, hour: NIGHT, seconds: 1.2 },
    ],
    build({ place }) {
      place(0, 0, { rain: { falling: true, changeAtMinutes: Infinity, changes: 1 } });
      for (const [x, z] of [
        [-4, -3],
        [3, -5],
        [5, 1],
      ] as const)
        place(x, z, { tree: true });
      place(-1.5, 1, { campfire: { lit: true, fuelMinutes: CAMPFIRE_FUEL_LIMIT_MINUTES } });
    },
    // Rain falls all the time, so it plays live in the afternoon.
    play: {
      shot: { label: "rain falling", yaw: 200, pitch: 10, hour: 15 },
      pose: () => undefined,
    },
  },
};
