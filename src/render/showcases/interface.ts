// Showcases for the on-screen icons and the HUD. The registry is src/render/showcases/index.ts.
import { CAMPFIRE_FUEL_LIMIT_MINUTES } from "../../sim/campfires";
import { NIGHT, type Showcase } from "./types";

export const INTERFACE_SHOWCASES: Readonly<Record<string, Showcase>> = {
  // The approved jug icons. src/ui/hud-showcase.tsx draws the HUD over each view.
  "jug-icons": {
    overlay: "hud",
    radius: 6,
    focus: { x: 0, y: 1, z: 0 },
    shots: [
      { label: "HUD: the unfired jug in the craft menu", yaw: 20, pitch: 35 },
      { label: "Jug icons, large and at hotbar size", yaw: -20, pitch: 35 },
      { label: "HUD: shaping an unfired jug", yaw: 40, pitch: 35 },
      { label: "HUD: unfired jugs and jugs at each fill level in the backpack", yaw: 20, pitch: 35, hour: 18 },
    ],
    build({ movePlayer }) {
      movePlayer(0, 0, 0);
    },
  },
  // The approved torch icons. src/ui/hud-showcase.tsx draws the HUD over each view.
  "torch-icons": {
    overlay: "hud",
    radius: 6,
    focus: { x: 0, y: 1, z: 0 },
    shots: [
      { label: "HUD: the torch in the craft menu", yaw: 20, pitch: 35 },
      { label: "Torch icons, large and at hotbar size", yaw: -20, pitch: 35 },
      { label: "HUD: a torch just lit, at night", yaw: 40, pitch: 35, hour: NIGHT },
      { label: "HUD: a torch nearly burnt out, with a log", yaw: 20, pitch: 35, hour: NIGHT },
    ],
    build({ movePlayer }) {
      movePlayer(0, 0, 0);
    },
  },
  "sled-icon": {
    overlay: "hud",
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
  // The approved furniture icons, such as the shelf and the bed, show among the build icons, so this showcase draws the same views as "build-icons".
  "furniture-icons": {
    overlay: "hud",
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
  // The approved floor and door icons show among the build icons too, so this showcase draws the same views as "build-icons".
  "floor-and-door-icons": {
    overlay: "hud",
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
  // The approved window and shutters icons show among the build icons, so this showcase draws the same views as "build-icons".
  "window-icons": {
    overlay: "hud",
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
  // The rain barrel icon shows among the build icons, so this showcase draws the same views as "build-icons",
  // except the first, which draws the rain barrel icon large beside other furniture icons.
  "rain-barrel-icon": {
    overlay: "hud",
    radius: 6,
    focus: { x: 0, y: 1, z: 0 },
    shots: [
      { label: "Rain barrel icon, large", yaw: 20, pitch: 35 },
      { label: "HUD: build menu, few materials", yaw: -20, pitch: 35 },
      { label: "HUD: build menu, evening", yaw: 40, pitch: 35, hour: 18 },
      { label: "HUD: build menu, paused", yaw: 20, pitch: 35 },
    ],
    build({ movePlayer }) {
      movePlayer(0, 0, 0);
    },
  },
  // The fireplace icon shows among the build icons, so this showcase draws the same views as "build-icons".
  "fireplace-icon": {
    overlay: "hud",
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
  // src/ui/hud-showcase.tsx draws the drawn queue icons large over the first view, and the HUD with a queue beside the clock over the others.
  "action-queue-icons": {
    overlay: "hud",
    radius: 6,
    focus: { x: 0, y: 1, z: 0 },
    shots: [
      { label: "Queue icons, large", yaw: 20, pitch: 35 },
      { label: "HUD: a full queue while chopping", yaw: -20, pitch: 35 },
      { label: "HUD: two actions, evening", yaw: 40, pitch: 35, hour: 18 },
      { label: "HUD: three actions, paused at night", yaw: 20, pitch: 35, hour: NIGHT },
    ],
    build({ movePlayer }) {
      movePlayer(0, 0, 0);
    },
  },
  // src/ui/hud-showcase.tsx draws every build icon large over the first view, and the HUD with the full build menu open over the others.
  "build-icons": {
    overlay: "hud",
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
    overlay: "hud",
    radius: 6,
    focus: { x: 0, y: 1, z: 0 },
    shots: [
      { label: "HUD: starting backpack", yaw: 20, pitch: 35 },
      { label: "HUD: materials, one and many", yaw: -20, pitch: 35 },
      { label: "HUD: food and a pot of river water", yaw: 40, pitch: 35 },
      { label: "HUD: a pot of clean water", yaw: 20, pitch: 35 },
    ],
    build({ movePlayer }) {
      movePlayer(0, 0, 0);
    },
  },
  // The HUD is drawn over these views by src/ui/hud-showcase.tsx, with the saw blade and the saw in the backpack and the craft menu.
  "crafting-icons": {
    overlay: "hud",
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
  // The HUD is drawn over these views by src/ui/hud-showcase.tsx, with the fishing line, the fishing rod, raw fish, and cooked fish
  // in the backpack, the craft menu, and fish cooking on a campfire.
  "fishing-icons": {
    overlay: "hud",
    radius: 6,
    focus: { x: 0, y: 1, z: 0 },
    shots: [
      { label: "HUD: fishing line and the craft menu", yaw: 20, pitch: 35 },
      { label: "HUD: crafting the fishing rod", yaw: -20, pitch: 35 },
      { label: "HUD: raw and cooked fish, and fish cooking", yaw: 40, pitch: 35 },
      { label: "Icons, large", yaw: 20, pitch: 35 },
    ],
    build({ movePlayer }) {
      movePlayer(0, 0, 0);
    },
  },
  // The approved "fish-trap-icons". The HUD is drawn over these views by src/ui/hud-showcase.tsx, with cord and a fish trap in the
  // backpack, and their recipes in the craft menu.
  "fish-trap-icons": {
    overlay: "hud",
    radius: 6,
    focus: { x: 0, y: 1, z: 0 },
    shots: [
      { label: "HUD: cord and fish trap in the craft menu", yaw: 20, pitch: 35 },
      { label: "HUD: cord and a fish trap in the backpack", yaw: -20, pitch: 35 },
      { label: "HUD: in the backpack, evening", yaw: 40, pitch: 35, hour: 18 },
      { label: "Icons, large", yaw: 20, pitch: 35 },
    ],
    build({ movePlayer }) {
      movePlayer(0, 0, 0);
    },
  },
  // The HUD is drawn over these views by src/ui/hud-showcase.tsx, one game state per view, in this order.
  hud: {
    overlay: "hud",
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
      place(-1.2, 0.6, { furniture: "chest", storage: { contents: {} }, facing: { turns: 0 } });
      movePlayer(0, 0, 0);
    },
  },
};
