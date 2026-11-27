// Showcases for piles and things that lie on the ground: food, fish, stone, clay, cord, fish traps, saplings, and berry bushes. The registry is src/render/showcases/index.ts.
import { type Entity } from "../../sim/entities";
import { type Showcase } from "./types";

export const CAMP_PILE_SHOWCASES: Readonly<Record<string, Showcase>> = {
  // Back row: one of each long thing and food, and a pot of clean water. Middle row: many of each. Then the tools and a pot.
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
  // "dried-food-piles": one and several of dried berries and dried mushrooms, beside fresh berries and mushrooms for comparison,
  // and a knife for size.
  "dried-food-piles": {
    radius: 1.4,
    focus: { x: 0, y: 0.03, z: 0.1 },
    shots: [
      { label: "dried and fresh food, one and many", yaw: 0, pitch: 45 },
      { label: "close up of the dried food, from low", yaw: 20, pitch: 25, radius: 0.6, focus: { x: -0.45, y: 0.02, z: 0.1 } },
    ],
    build({ place }) {
      place(-0.75, -0.2, { pile: { content: "driedBerries", count: 1 } });
      place(-0.25, -0.2, { pile: { content: "driedMushroom", count: 1 } });
      place(0.25, -0.2, { pile: { content: "berries", count: 1 } });
      place(0.75, -0.2, { pile: { content: "mushroom", count: 1 } });
      place(-0.75, 0.15, { pile: { content: "driedBerries", count: 8 } });
      place(-0.25, 0.15, { pile: { content: "driedMushroom", count: 5 } });
      place(0.25, 0.15, { pile: { content: "berries", count: 8 } });
      place(0.75, 0.15, { pile: { content: "mushroom", count: 5 } });
      place(0, 0.55, { pile: { content: "knife", count: 1 } });
    },
  },
  // "smoked-fish-pile": one and several smoked fish, beside raw and cooked fish for comparison, and a knife for size.
  "smoked-fish-pile": {
    radius: 1.4,
    focus: { x: 0, y: 0.03, z: 0.1 },
    shots: [
      { label: "smoked, raw, and cooked fish, one and many", yaw: 0, pitch: 45 },
      { label: "close up of a smoked fish, from low", yaw: 20, pitch: 25, radius: 0.6, focus: { x: -0.5, y: 0.02, z: -0.2 } },
    ],
    build({ place }) {
      place(-0.5, -0.2, { pile: { content: "smokedFish", count: 1 } });
      place(0, -0.2, { pile: { content: "rawFish", count: 1 } });
      place(0.5, -0.2, { pile: { content: "cookedFish", count: 1 } });
      place(-0.5, 0.35, { pile: { content: "smokedFish", count: 5 } });
      place(0, 0.35, { pile: { content: "rawFish", count: 5 } });
      place(0.5, 0.35, { pile: { content: "cookedFish", count: 5 } });
      place(0, 0.8, { pile: { content: "knife", count: 1 } });
    },
  },
  // "fishing-piles": one and several of the fishing line, the fishing rod, raw fish, and cooked fish, with a knife for size.
  // The small things sit in a row of single piles in front, with their larger piles behind. The rods lie off to one side.
  "fishing-piles": {
    radius: 1.5,
    focus: { x: 0.3, y: 0.05, z: 0 },
    shots: [
      { label: "all fishing piles", yaw: 0, pitch: 45 },
      { label: "fishing lines, one and many, beside a knife", yaw: 0, pitch: 55, radius: 0.35, focus: { x: -0.95, y: 0, z: -0.3 } },
      { label: "raw and cooked fish, one and many", yaw: 0, pitch: 50, radius: 0.55, focus: { x: -0.15, y: 0, z: -0.3 } },
      { label: "fishing rods, one and many", yaw: 0, pitch: 45, radius: 1.1, focus: { x: 1.3, y: 0, z: 0 } },
    ],
    build({ place }) {
      place(-1, -0.6, { pile: { content: "fishingLine", count: 1 } });
      place(-0.85, -0.6, { pile: { content: "knife", count: 1 } });
      place(-0.95, -0.1, { pile: { content: "fishingLine", count: 5 } });
      place(-0.35, -0.6, { pile: { content: "rawFish", count: 1 } });
      place(-0.35, 0, { pile: { content: "rawFish", count: 5 } });
      place(0.05, -0.6, { pile: { content: "cookedFish", count: 1 } });
      place(0.1, 0, { pile: { content: "cookedFish", count: 4 } });
      place(0.9, -0.3, { pile: { content: "fishingRod", count: 1 } });
      place(1.7, 0.3, { pile: { content: "fishingRod", count: 4 } });
    },
  },
  // The approved "stone": piles of 1, 4, and 12 stones beside a knife for size. The first three views show the stones close up.
  // src/ui/hud-showcase.tsx draws the HUD over the last view only, with stone in the backpack and the pile's tooltip.
  // The "gather-stone-animation" showcase shows the stone in the player's hands.
  stone: {
    overlay: "hud",
    radius: 2.2,
    focus: { x: 0, y: 0.2, z: 0 },
    shots: [
      { label: "one stone beside a knife", yaw: 20, pitch: 35, radius: 0.55, focus: { x: -1.1, y: 0.04, z: 0.07 } },
      { label: "a pile of 4 stones", yaw: -30, pitch: 30, radius: 0.8, focus: { x: 0, y: 0.04, z: 0 } },
      { label: "a pile of 12 stones", yaw: 40, pitch: 45, radius: 1.2, focus: { x: 1.3, y: 0.04, z: 0 } },
      { label: "HUD: beside a pile of 12 stones", yaw: 0, pitch: 40, radius: 1.4, focus: { x: 1.3, y: 0.1, z: 0 } },
    ],
    build({ place, movePlayer }) {
      place(-1.2, 0, { pile: { content: "stone", count: 1 } });
      place(-0.95, 0.15, { pile: { content: "knife", count: 1 } });
      place(0, 0, { pile: { content: "stone", count: 4 } });
      place(1.3, 0, { pile: { content: "stone", count: 12 } });
      movePlayer(0, -1.5, 0);
    },
  },
  // The approved "clay": lumps of clay lying in piles of 1, 4, and 12 beside a knife for size, and the backpack icon.
  // src/ui/hud-showcase.tsx draws the HUD over the last view only, with clay in the backpack, digging under way, and the pile's tooltip.
  clay: {
    overlay: "hud",
    radius: 2.2,
    focus: { x: 0, y: 0.2, z: 0 },
    shots: [
      { label: "one clay beside a knife", yaw: 20, pitch: 35, radius: 0.55, focus: { x: -1.1, y: 0.04, z: 0.07 } },
      { label: "a pile of 4 clay", yaw: -30, pitch: 30, radius: 0.8, focus: { x: 0, y: 0.04, z: 0 } },
      { label: "a pile of 12 clay", yaw: 40, pitch: 45, radius: 1.2, focus: { x: 1.3, y: 0.04, z: 0 } },
      { label: "HUD: beside a pile of 12 clay", yaw: 0, pitch: 40, radius: 1.4, focus: { x: 1.3, y: 0.1, z: 0 } },
    ],
    build({ place, movePlayer }) {
      place(-1.2, 0, { pile: { content: "clay", count: 1 } });
      place(-0.95, 0.15, { pile: { content: "knife", count: 1 } });
      place(0, 0, { pile: { content: "clay", count: 4 } });
      place(1.3, 0, { pile: { content: "clay", count: 12 } });
      movePlayer(0, -1.5, 0);
    },
  },
  // The approved "fish-trap": set fish traps, one empty and one holding a raw fish. In the game a set trap sits half in the
  // river's water. The showcase stands on flat ground, so it shows the trap sunk into the ground the same way.
  "fish-trap": {
    radius: 2.2,
    focus: { x: 0, y: 0.1, z: 0 },
    shots: [
      { label: "an empty fish trap", yaw: 30, pitch: 30, radius: 1.1, focus: { x: -0.7, y: 0.05, z: 0 } },
      { label: "a fish trap holding a fish", yaw: -30, pitch: 40, radius: 1.1, focus: { x: 0.7, y: 0.05, z: 0 } },
      { label: "both from the side", yaw: 90, pitch: 15, radius: 1.8 },
      { label: "both from above", yaw: 0, pitch: 70, radius: 2 },
    ],
    build({ place, movePlayer }) {
      place(-0.7, 0, { fishTrap: { holding: false, minutesToNext: 400, draws: 1 } });
      place(0.7, 0, { fishTrap: { holding: true, minutesToNext: 400, draws: 2 } });
      movePlayer(0, -2.5, 0);
    },
  },
  // The approved "fish-trap-piles": cord and fish traps lying in piles beside a knife for size.
  "fish-trap-piles": {
    radius: 2.2,
    focus: { x: 0, y: 0.1, z: 0 },
    shots: [
      { label: "one cord beside a knife", yaw: 20, pitch: 40, radius: 0.4, focus: { x: -1.1, y: 0.02, z: 0.07 } },
      { label: "a pile of 6 cords", yaw: -30, pitch: 35, radius: 0.7, focus: { x: -0.2, y: 0.04, z: 0 } },
      { label: "one fish trap", yaw: -140, pitch: 35, radius: 1.1, focus: { x: 1, y: 0.1, z: -0.8 } },
      { label: "a pile of 3 fish traps", yaw: 30, pitch: 45, radius: 1.4, focus: { x: 1, y: 0.1, z: 1 } },
    ],
    build({ place, movePlayer }) {
      place(-1.2, 0, { pile: { content: "cord", count: 1 } });
      place(-0.95, 0.15, { pile: { content: "knife", count: 1 } });
      place(-0.2, 0, { pile: { content: "cord", count: 6 } });
      place(1, -0.8, { pile: { content: "fishTrap", count: 1 } });
      place(1, 1, { pile: { content: "fishTrap", count: 3 } });
      movePlayer(0, -2, 0);
    },
  },
  // The approved "sapling-icon": dug-up saplings lying in piles of 1 and 3 beside a knife for size, and the backpack icon.
  // src/ui/hud-showcase.tsx draws the HUD over the last view only, with saplings in the backpack, digging up under way, and the pile's tooltip.
  "sapling-icon": {
    overlay: "hud",
    radius: 2.2,
    focus: { x: 0, y: 0.2, z: 0 },
    shots: [
      { label: "one sapling beside a knife", yaw: 20, pitch: 35, radius: 1, focus: { x: -1.1, y: 0.05, z: 0.07 } },
      { label: "a pile of 3 saplings", yaw: -30, pitch: 30, radius: 1.3, focus: { x: 0.4, y: 0.05, z: 0 } },
      { label: "both piles from above", yaw: 40, pitch: 60, radius: 2.2, focus: { x: -0.3, y: 0.05, z: 0 } },
      { label: "HUD: beside a pile of 3 saplings", yaw: 0, pitch: 40, radius: 1.6, focus: { x: 0.4, y: 0.1, z: 0 } },
    ],
    build({ place, movePlayer }) {
      place(-1.2, 0, { pile: { content: "sapling", count: 1 } });
      place(-0.9, 0.35, { pile: { content: "knife", count: 1 } });
      place(0.4, 0, { pile: { content: "sapling", count: 3 } });
      movePlayer(0, -1.5, 0);
    },
  },
  // The approved "berry-bush-icon": dug-up berry bushes lying in piles of 1 and 3 beside a knife for size, and the backpack icon.
  // src/ui/hud-showcase.tsx draws the HUD over the last view only, with berry bushes in the backpack, digging up under way, and the pile's tooltip.
  "berry-bush-icon": {
    overlay: "hud",
    radius: 2.2,
    focus: { x: 0, y: 0.2, z: 0 },
    shots: [
      { label: "one berry bush beside a knife", yaw: 20, pitch: 35, radius: 1.1, focus: { x: -1.1, y: 0.15, z: 0.07 } },
      { label: "a pile of 3 berry bushes", yaw: -30, pitch: 30, radius: 1.6, focus: { x: 0.4, y: 0.15, z: 0 } },
      { label: "both piles from above", yaw: 40, pitch: 60, radius: 2.4, focus: { x: -0.3, y: 0.1, z: 0 } },
      { label: "HUD: beside a pile of 3 berry bushes", yaw: 0, pitch: 40, radius: 1.8, focus: { x: 0.4, y: 0.15, z: 0 } },
    ],
    build({ place, movePlayer }) {
      place(-1.2, 0, { pile: { content: "berryBush", count: 1 } });
      place(-0.8, 0.4, { pile: { content: "knife", count: 1 } });
      place(0.4, 0, { pile: { content: "berryBush", count: 3 } });
      movePlayer(0, -1.5, 0);
    },
  },
};
