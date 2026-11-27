// Showcases for daylight, rain, and snow. The registry is src/render/showcases/index.ts.
import { CAMPFIRE_FUEL_LIMIT_MINUTES } from "../../sim/campfires";
import { rainEntities } from "../../sim/entity-queries";
import { squareCabin } from "./cabin-stage";
import { NOON, NIGHT, type Showcase } from "./types";

/** How deep the snow cover lies in each shot of the snow cover showcase, by the shot's label. */
const SNOW_COVER_DEPTHS: Readonly<Record<string, number>> = {
  "no snow": 0,
  "winter day 2: two thirds deep": 2 / 3,
  "full snow cover": 1,
  "full snow cover, from above": 1,
};

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
  snowfall: {
    radius: 6,
    focus: { x: 0, y: 1.5, z: 0 },
    shots: [
      { label: "midday", yaw: 200, pitch: 10, hour: NOON, seconds: 0 },
      { label: "midday, from above", yaw: 40, pitch: 45, hour: NOON, seconds: 2 },
      { label: "dusk, by a campfire", yaw: 70, pitch: 10, hour: 16.5, seconds: 4 },
      { label: "night, by a campfire", yaw: 200, pitch: 10, hour: NIGHT, seconds: 6 },
    ],
    build({ place }) {
      place(0, 0, { rain: { falling: true, changeAtMinutes: Infinity, changes: 1 }, snow: { fallsAsSnow: true, cover: { depth: 1 } } });
      for (const [x, z] of [
        [-4, -3],
        [3, -5],
        [5, 1],
      ] as const)
        place(x, z, { tree: true });
      place(-1.5, 1, { campfire: { lit: true, fuelMinutes: CAMPFIRE_FUEL_LIMIT_MINUTES } });
    },
    // Snow falls all the time, so it plays live in the afternoon.
    play: {
      shot: { label: "snow falling", yaw: 200, pitch: 10, hour: 14 },
      pose: () => undefined,
    },
  },
  "snow-cover": {
    radius: 7,
    focus: { x: 0, y: 1.5, z: -2 },
    // The same trees and roofed cabin under deeper and deeper snow, then from above to show the tree tops and the roof.
    shots: [
      { label: "no snow", yaw: 25, pitch: 20, hour: NOON },
      { label: "winter day 2: two thirds deep", yaw: 25, pitch: 20, hour: NOON },
      { label: "full snow cover", yaw: 25, pitch: 20, hour: NOON },
      { label: "full snow cover, from above", yaw: 60, pitch: 50, hour: NOON },
    ],
    build(stage) {
      stage.place(0, 0, { rain: { falling: false, changeAtMinutes: Infinity, changes: 0 }, snow: { fallsAsSnow: true, cover: { depth: 0 } } });
      squareCabin(stage, { roofs: true });
      for (const [x, z] of [
        [-5, -5],
        [-1, -7],
        [4, -6],
        [5, -2],
      ] as const)
        stage.place(x, z, { tree: true });
      stage.movePlayer(2.5, 2, Math.PI);
    },
    pose({ store }, shot) {
      const weather = rainEntities(store).first;
      if (weather !== undefined) weather.snow = { fallsAsSnow: true, cover: { depth: SNOW_COVER_DEPTHS[shot.label] ?? 0 } };
    },
  },
};
