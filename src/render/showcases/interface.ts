// Showcases for the on-screen icons and the HUD. The registry is src/render/showcases/index.ts.
import { CAMPFIRE_FUEL_LIMIT_MINUTES } from "../../sim/campfires";
import { NIGHT, type Showcase } from "./types";

export const INTERFACE_SHOWCASES: Readonly<Record<string, Showcase>> = {
  "sled-icon": {
    radius: 6,
    focus: { x: 0, y: 1, z: 0 },
    shots: [
      { label: "Build icons, large", yaw: 20, pitch: 35 },
      { label: "HUD: build menu, few materials", yaw: -20, pitch: 35 },
      { label: "HUD: build menu, evening", yaw: 40, pitch: 35, hour: 18 },
      { label: "HUD: build menu, paused", yaw: 20, pitch: 35 },
    ],
    build({ movePlayer }) {
      movePlayer(0, 0, 0);
    },
  },
  // src/ui/hud-showcase.tsx draws every build icon large over the first view, and the HUD with the full build menu open over the others.
  "build-icons": {
    radius: 6,
    focus: { x: 0, y: 1, z: 0 },
    shots: [
      { label: "Build icons, large", yaw: 20, pitch: 35 },
      { label: "HUD: build menu, few materials", yaw: -20, pitch: 35 },
      { label: "HUD: build menu, evening", yaw: 40, pitch: 35, hour: 18 },
      { label: "HUD: build menu, paused", yaw: 20, pitch: 35 },
    ],
    build({ movePlayer }) {
      movePlayer(0, 0, 0);
    },
  },
  // The HUD is drawn over these views by src/ui/hud-showcase.tsx, with every kind of backpack content between the four views.
  "backpack-icons": {
    radius: 6,
    focus: { x: 0, y: 1, z: 0 },
    shots: [
      { label: "HUD: starting backpack", yaw: 20, pitch: 35 },
      { label: "HUD: materials, one and many", yaw: -20, pitch: 35 },
      { label: "HUD: food and a pot of river water", yaw: 40, pitch: 35 },
      { label: "HUD: a pot of boiled water", yaw: 20, pitch: 35 },
    ],
    build({ movePlayer }) {
      movePlayer(0, 0, 0);
    },
  },
  // The HUD is drawn over these views by src/ui/hud-showcase.tsx, with the saw blade and the saw in the backpack and the craft menu.
  "crafting-icons": {
    radius: 6,
    focus: { x: 0, y: 1, z: 0 },
    shots: [
      { label: "HUD: saw blade and the craft menu", yaw: 20, pitch: 35 },
      { label: "HUD: crafting the saw", yaw: -20, pitch: 35 },
      { label: "HUD: the saw, made, with blades and planks", yaw: 40, pitch: 35 },
      { label: "Icons, large", yaw: 20, pitch: 35 },
    ],
    build({ movePlayer }) {
      movePlayer(0, 0, 0);
    },
  },
  // The HUD is drawn over these views by src/ui/hud-showcase.tsx, one game state per view, in this order.
  hud: {
    radius: 6,
    focus: { x: 0, y: 1, z: 0 },
    shots: [
      { label: "HUD: build menu and an open chest, day", yaw: 20, pitch: 35 },
      { label: "HUD: chopping, backpack full", yaw: -20, pitch: 35 },
      { label: "HUD: carrying a log at a campfire", yaw: 40, pitch: 35, hour: 18 },
      { label: "HUD: cold at night, paused, placing", yaw: 20, pitch: 35, hour: NIGHT },
    ],
    build({ place, movePlayer }) {
      for (const [x, z] of [
        [-6, -4],
        [0, -7],
        [6, -3],
        [-3, -9],
      ] as const)
        place(x, z, { tree: true });
      place(1.5, -1, { campfire: { lit: true, fuelMinutes: CAMPFIRE_FUEL_LIMIT_MINUTES } });
      place(-1.2, 0.6, { chest: { contents: {} }, facing: { turns: 0 } });
      movePlayer(0, 0, 0);
    },
  },
};
