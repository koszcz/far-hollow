// Showcases for the camp: firewood, the player and their gear, the campfire, shelters, piles, pots, and bark. The registry is src/render/showcases/index.ts.
import * as THREE from "three";
import { CAMPFIRE_FUEL_LIMIT_MINUTES } from "../../sim/campfires";
import { type Entity } from "../../sim/entities";
import { LEAN_TO_BARK_COST, LEAN_TO_BUILD_SECONDS, LEAN_TO_STICK_COST } from "../../sim/structures";
import { type PotLook, type PotMesh } from "../pot-shape";
import { createFirewoodGeometry, FIREWOOD_COLOUR } from "../firewood-shape";
import { FOUR_ANGLES, NIGHT, BUILD_PLAY_REST_SECONDS, type Showcase } from "./types";

/** How many stages a lean-to takes to build: one for each stick and each piece of bark. */
const LEAN_TO_STAGES = LEAN_TO_STICK_COST + LEAN_TO_BARK_COST;
/** How far a lean-to's build has gone once its two posts and ridge pole are up. */
const LEAN_TO_FRAME_UP = 3 / LEAN_TO_STAGES;
/** The pots standing on the ground in the "pot" showcase, with how each one looks. */
const showcasePots: { pot: PotMesh; look: PotLook }[] = [];

/** Shows each standing pot in the "pot" showcase as it should look `seconds` into its steam loop. */
function showPots(seconds: number): void {
  for (const { pot, look } of showcasePots) pot.show(look, seconds);
}

export const CAMP_SHOWCASES: Readonly<Record<string, Showcase>> = {
  firewood: {
    radius: 0.9,
    focus: { x: 0, y: 0.12, z: 0 },
    shots: FOUR_ANGLES,
    // One piece alone, a small pile, and the log it is split from, for size and colour.
    build({ place, addProp }) {
      const geometry = createFirewoodGeometry();
      const material = new THREE.MeshStandardMaterial({ color: FIREWOOD_COLOUR, flatShading: true, vertexColors: true });
      addProp(geometry, material, -0.45, 0.25, 0, 0.5);
      // Two pieces side by side, bark to bark, with a third resting in the groove between them.
      addProp(geometry, material, 0.31, 0.1, 0, 0);
      addProp(geometry, material, 0.47, 0.1, 0, Math.PI);
      addProp(geometry, material, 0.39, 0.12, 0.07, 0.04);
      place(0, -0.75, { log: { heading: Math.PI / 2 } });
    },
  },
  player: { radius: 1.1, focus: { x: 0, y: 0.9, z: 0 }, shots: FOUR_ANGLES, build() {} },
  // Close up and with empty hands, so nothing covers the backpack. The "logs" showcase shows the axe hanging on it.
  backpack: {
    radius: 0.85,
    focus: { x: 0, y: 0.85, z: 0 },
    shots: [
      { label: "front", yaw: 0, pitch: 12 },
      { label: "back", yaw: 180, pitch: 15 },
      { label: "back three-quarter", yaw: 215, pitch: 25 },
      { label: "side", yaw: 90, pitch: 12 },
    ],
    build() {},
  },
  campfire: {
    radius: 1.3,
    focus: { x: 0, y: 0.3, z: 0 },
    shots: FOUR_ANGLES,
    build({ place }) {
      place(0, 0, { campfire: { lit: false, fuelMinutes: 0 } });
    },
  },
  "lean-to": {
    radius: 3.2,
    focus: { x: 0, y: 0.7, z: 0 },
    // Key stages of the build, then the finished lean-to from behind. The player stands beside it for scale.
    shots: [
      { label: "posts and ridge pole", yaw: 30, pitch: 20, seconds: LEAN_TO_FRAME_UP },
      { label: "frame built", yaw: 30, pitch: 20, seconds: LEAN_TO_STICK_COST / LEAN_TO_STAGES },
      { label: "half the bark on", yaw: 30, pitch: 20, seconds: (LEAN_TO_STICK_COST + LEAN_TO_BARK_COST / 2) / LEAN_TO_STAGES },
      { label: "built, from behind", yaw: 200, pitch: 25, seconds: 1 },
    ],
    build({ place, movePlayer }) {
      place(0, 0, { blueprint: { structure: "leanTo", progress: 0, materialsSpent: 0, delivered: {} }, facing: { turns: 0 } });
      movePlayer(-2.6, 1.2, Math.PI / 2);
    },
    pose({ store }, shot) {
      for (const entity of store.with("blueprint")) entity.blueprint.progress = shot.seconds ?? 0;
    },
    // The whole build plays at game speed, rests built, then starts again from an empty blueprint.
    play: {
      shot: { label: "building, then a rest", yaw: 30, pitch: 20 },
      pose({ store }, seconds) {
        const cycle = seconds % (LEAN_TO_BUILD_SECONDS + BUILD_PLAY_REST_SECONDS);
        for (const entity of store.with("blueprint")) entity.blueprint.progress = Math.min(1, cycle / LEAN_TO_BUILD_SECONDS);
        return undefined;
      },
    },
  },
  // From left to right: a blueprint, an empty woodpile, one half full of mixed wood, and a full one. The player stands behind for size.
  // One view shows all four. The others come close to the full one, the half-full one, and the empty one.
  woodpile: {
    radius: 2.6,
    focus: { x: 0, y: 0.4, z: 0 },
    shots: [
      { label: "all four: blueprint, empty, half full, full", yaw: 0, pitch: 14 },
      { label: "full, front three-quarter", yaw: 35, pitch: 18, radius: 1.4, focus: { x: 2.4, y: 0.5, z: 0 } },
      { label: "half full, back three-quarter", yaw: 215, pitch: 22, radius: 1.4, focus: { x: 0.8, y: 0.35, z: 0 } },
      { label: "blueprint and empty, from above", yaw: -20, pitch: 50, radius: 1.5, focus: { x: -1.6, y: 0.2, z: 0 } },
    ],
    build({ place, movePlayer }) {
      place(-2.4, 0, { blueprint: { structure: "woodpile", progress: 0, materialsSpent: 0, delivered: {} }, facing: { turns: 0 } });
      place(-0.8, 0, { woodpile: { log: 0, debarkedLog: 0, firewood: 0 } });
      place(0.8, 0, { woodpile: { log: 3, debarkedLog: 3, firewood: 4 } });
      place(2.4, 0, { woodpile: { log: 4, debarkedLog: 4, firewood: 12 } });
      movePlayer(0, -1.4, 0);
    },
  },
  bedroll: {
    radius: 1.3,
    focus: { x: 0, y: 0.1, z: 0 },
    shots: FOUR_ANGLES,
    build({ place }) {
      place(0, 0, { bedroll: true });
    },
  },
  "rolled-bedroll": {
    radius: 0.6,
    focus: { x: 0, y: 0.1, z: 0 },
    shots: FOUR_ANGLES,
    build({ place }) {
      place(0, 0, { pile: { content: "bedroll", count: 1 } });
    },
  },
  "steel-and-flint": {
    radius: 0.12,
    focus: { x: 0, y: 0.008, z: 0 },
    shots: FOUR_ANGLES.map((shot) => ({ ...shot, radius: 0.16 })),
    build({ place }) {
      place(0, 0, { pile: { content: "steelAndFlint", count: 1 } });
    },
  },
  // Back row: one of each long thing and food, and a pot of boiled water. Middle row: many of each. Then the tools and a pot.
  // Front row: the crafting draft shapes: a saw blade, a saw, one plank, and several planks.
  // One view shows them all. The others come close to the wood and bark, the tools and crafting things, and the food.
  pile: {
    radius: 3.2,
    focus: { x: 0, y: 0.1, z: 1 },
    shots: [
      { label: "all piles", yaw: 0, pitch: 35, radius: 3.8 },
      { label: "firewood and bark, one and many", yaw: 25, pitch: 30, radius: 1.1, focus: { x: -1.35, y: 0.1, z: -0.1 } },
      { label: "tools, saw blade, saw, and planks", yaw: 0, pitch: 55, radius: 1.3, focus: { x: 0, y: 0, z: 2.3 } },
      { label: "berries and mushrooms, one and many", yaw: -20, pitch: 40, radius: 0.85, focus: { x: 0.45, y: 0.05, z: 0.1 } },
    ],
    build({ place }) {
      const row = (z: number, piles: readonly NonNullable<Entity["pile"]>[], spacing = 0.9): void => {
        piles.forEach((pile, index) => place((index - (piles.length - 1) / 2) * spacing, z, { pile }));
      };
      row(-0.8, [
        { content: "firewood", count: 1 },
        { content: "bark", count: 1 },
        { content: "berries", count: 1 },
        { content: "mushroom", count: 1 },
        { content: "potOfBoiledWater", count: 1 },
      ]);
      row(0.6, [
        { content: "firewood", count: 12 },
        { content: "bark", count: 12 },
        { content: "berries", count: 8 },
        { content: "mushroom", count: 5 },
        { content: "bark", count: 4 },
      ]);
      row(
        1.8,
        [
          { content: "axe", count: 1 },
          { content: "knife", count: 1 },
          { content: "drawknife", count: 1 },
          { content: "steelAndFlint", count: 2 },
          { content: "pot", count: 1 },
        ],
        0.45,
      );
      row(
        2.8,
        [
          { content: "sawBlade", count: 1 },
          { content: "saw", count: 1 },
          { content: "plank", count: 1 },
          { content: "plank", count: 6 },
        ],
        0.5,
      );
    },
  },
  "fire-effect": {
    radius: 2,
    focus: { x: 0, y: 0.5, z: 0 },
    shots: [
      { label: "day", yaw: 0, pitch: 15 },
      { label: "day, from above", yaw: 40, pitch: 55 },
      { label: "night", yaw: 0, pitch: 15, hour: NIGHT },
      { label: "night, warmth pool", yaw: 40, pitch: 55, radius: 7, hour: NIGHT },
    ],
    build({ place }) {
      place(0, 0, { campfire: { lit: true, fuelMinutes: CAMPFIRE_FUEL_LIMIT_MINUTES } });
    },
    // The flames, sparks, and smoke move all the time, so the fire burns live at dusk, when both light and glow show.
    play: {
      shot: { label: "burning at dusk", yaw: 20, pitch: 14, radius: 2.4, focus: { y: 0.8 }, hour: 20 },
      pose: () => undefined,
    },
  },
  pot: {
    radius: 0.5,
    focus: { x: 0, y: 0.15, z: 0 },
    shots: [
      { label: "empty", yaw: 20, pitch: 35, focus: { x: -0.5 } },
      { label: "full of water", yaw: 20, pitch: 35, focus: { x: 0 } },
      { label: "steaming", yaw: 20, pitch: 20, focus: { x: 0.5, y: 0.3 }, seconds: 1 },
      { label: "on a lit campfire", yaw: 20, pitch: 15, radius: 1, focus: { x: 0, y: 0.8, z: -2 }, seconds: 1 },
    ],
    build({ place, placePot }) {
      showcasePots.length = 0;
      showcasePots.push({ pot: placePot(-0.5, 0), look: "empty" }, { pot: placePot(0, 0), look: "full" }, { pot: placePot(0.5, 0), look: "steaming" });
      place(0, -2, { campfire: { lit: true, fuelMinutes: CAMPFIRE_FUEL_LIMIT_MINUTES }, potOnFire: { water: "river", minutesBoiling: 0 } });
    },
    pose(_stage, shot) {
      showPots(shot.seconds ?? 0);
    },
    // The steam rises in a loop, so it plays live on the campfire at dusk.
    play: {
      shot: { label: "steaming on a lit campfire", yaw: 20, pitch: 12, radius: 1, focus: { x: 0, y: 0.85, z: -2 }, hour: 19 },
      pose(_stage, seconds) {
        showPots(seconds);
        return undefined;
      },
    },
  },
  // The HUD is drawn over these views by src/ui/hud-showcase.tsx, with bark in the backpack and on offer as fuel.
  // Pieces of bark lie on the ground beside the player, as taking down a building piece leaves them when the backpack is full.
  bark: {
    radius: 6,
    focus: { x: 0, y: 1, z: 0 },
    shots: [
      { label: "HUD: bark in the backpack", yaw: 20, pitch: 35 },
      { label: "HUD: debarking a log", yaw: -20, pitch: 35 },
      { label: "HUD: bark at a campfire", yaw: 40, pitch: 35, hour: 18 },
      { label: "HUD: carrying a debarked log", yaw: 20, pitch: 35 },
    ],
    build({ place, movePlayer }) {
      place(1.5, -1, { campfire: { lit: true, fuelMinutes: CAMPFIRE_FUEL_LIMIT_MINUTES } });
      place(-1.5, 0.5, { log: { heading: 0.4 } });
      for (const [x, z] of [
        [2.6, 0.3],
        [3, 0.7],
        [2.4, 0.9],
      ] as const)
        place(x, z, { bark: true });
      movePlayer(0, 0, 0);
    },
  },
  // src/ui/hud-showcase.tsx draws the sled and log icons large, among every build icon, over the first view,
  // and the HUD with the full build menu open over the others.
};
