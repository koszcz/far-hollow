// Showcases for sound: the ambience loops, and the Volume slider and sound button. The registry is
// src/render/showcases/index.ts. A sound cannot show in a picture, so each view shows where the sound comes from, and
// src/ui/sound-showcase.tsx adds buttons over the page that play each loop, so the owner can listen to it.
import { CAMPFIRE_FUEL_LIMIT_MINUTES } from "../../sim/campfires";
import { FUEL_LIMIT_MINUTES } from "../../sim/fire";
import { FOUR_ANGLES, NIGHT, NOON, STAGE_FROM_RIVER_METRES, type Showcase, type Stage } from "./types";

/** Rain that falls for good. */
const ENDLESS_RAIN = { falling: true, changeAtMinutes: Infinity, changes: 1 };

/** A few trees around the stage's middle, where the birds and crickets would be. */
function placeTrees(place: Stage["place"]): void {
  for (const [x, z] of [
    [-5, -2],
    [-1, -4],
    [3, -3],
    [5, 1],
    [-3, 3],
  ] as const)
    place(x, z, { tree: true });
}

export const SOUND_SHOWCASES: Readonly<Record<string, Showcase>> = {
  "sound-river": {
    radius: 16,
    focus: { x: -STAGE_FROM_RIVER_METRES, y: 0, z: 0 },
    shots: FOUR_ANGLES.map((shot) => ({ ...shot, pitch: shot.pitch + 15 })),
    build({ movePlayer }) {
      movePlayer(-STAGE_FROM_RIVER_METRES + 8, 0, -Math.PI / 2);
    },
  },
  "sound-forest": {
    radius: 9,
    focus: { x: 0, y: 3, z: 0 },
    shots: FOUR_ANGLES,
    build({ place, movePlayer }) {
      placeTrees(place);
      movePlayer(0, 0, 0);
    },
  },
  // The rain falls on the player in the open.
  "sound-rain": {
    radius: 6,
    focus: { x: 0, y: 1.5, z: 0 },
    shots: [
      { label: "in the open, midday", yaw: 200, pitch: 10, hour: NOON },
      { label: "from above", yaw: 40, pitch: 45, hour: NOON },
      { label: "dusk", yaw: 70, pitch: 10, hour: 19 },
      { label: "night", yaw: 200, pitch: 10, hour: NIGHT },
    ],
    build({ place, movePlayer }) {
      place(0, 0, { rain: ENDLESS_RAIN });
      movePlayer(0, 0, 0);
    },
  },
  // The player shelters under a lean-to in the rain, so they hear the drumming on its roof.
  "sound-rain-roof": {
    radius: 4,
    focus: { x: 0, y: 0.8, z: 0 },
    shots: FOUR_ANGLES,
    build({ place, movePlayer }) {
      place(0, 0, { rain: ENDLESS_RAIN });
      place(0, 0, { blueprint: { structure: "leanTo", progress: 1, materialsSpent: 0, delivered: {} }, facing: { turns: 0 } });
      movePlayer(0, 0.3, Math.PI);
    },
  },
  // Birds sing in the trees by day.
  "sound-birds": {
    radius: 9,
    focus: { x: 0, y: 3, z: 0 },
    shots: FOUR_ANGLES.map((shot) => ({ ...shot, hour: NOON })),
    build({ place, movePlayer }) {
      placeTrees(place);
      movePlayer(0, 0, 0);
    },
  },
  // Crickets chirp at night.
  "sound-crickets": {
    radius: 9,
    focus: { x: 0, y: 1, z: 0 },
    shots: FOUR_ANGLES.map((shot) => ({ ...shot, hour: NIGHT })),
    build({ place, movePlayer }) {
      placeTrees(place);
      movePlayer(0, 0, 0);
    },
  },
  // Left to right: a full campfire crackles loudest, a low one more quietly, and the unlit campfire, fireplace, and torch are silent.
  "sound-fire": {
    radius: 7,
    focus: { x: 0, y: 0.5, z: 0 },
    shots: [
      { label: "lit fires and silent ones, midday", yaw: 0, pitch: 20, hour: NOON },
      { label: "from above", yaw: 40, pitch: 60, hour: NOON },
      { label: "at night", yaw: 0, pitch: 20, hour: NIGHT },
      { label: "at night, from the side", yaw: 90, pitch: 20, hour: NIGHT },
    ],
    build({ place, movePlayer }) {
      place(-3, 0, { campfire: { lit: true, fuelMinutes: CAMPFIRE_FUEL_LIMIT_MINUTES } });
      place(-1, 0, { campfire: { lit: true, fuelMinutes: 5 } });
      place(1, 0, { campfire: { lit: false, fuelMinutes: CAMPFIRE_FUEL_LIMIT_MINUTES } });
      place(3, 0, { fireplace: { lit: true, fuelMinutes: FUEL_LIMIT_MINUTES.fireplace }, facing: { turns: 0 } });
      place(4.5, 1, { plantedTorch: { minutesLeft: 120 } });
      movePlayer(0, 2.5, Math.PI);
    },
  },
  // src/ui/sound-showcase.tsx draws the start screen's Volume slider and the open sound button over the views.
  "sound-button": {
    radius: 6,
    focus: { x: 0, y: 1, z: 0 },
    shots: [
      { label: "Start screen: Volume slider", yaw: 20, pitch: 35 },
      { label: "HUD: sound button", yaw: -20, pitch: 35 },
      { label: "HUD: Volume open", yaw: 40, pitch: 35, hour: 18 },
      { label: "HUD: muted", yaw: 20, pitch: 35 },
    ],
    build({ movePlayer }) {
      movePlayer(0, 0, 0);
    },
  },
};
