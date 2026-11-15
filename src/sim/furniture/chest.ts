// The chest: the first piece of furniture. It holds small materials, tools, and food, grouped by kind like the backpack.
// chests.ts opens it and moves things in and out.
import type { FurnitureDefinition } from "../furniture";

/** How many planks a chest costs. Construction spends one at the start of each stage. */
export const CHEST_PLANK_COST = 4;
/** How long the player holds the build action to build a chest, in seconds. */
export const CHEST_BUILD_SECONDS = 8;
/** A chest is this wide, along its front, in metres. */
export const CHEST_WIDTH_METRES = 0.9;
/** A chest is this deep, from front to back, in metres. */
export const CHEST_DEPTH_METRES = 0.55;
/** The most a chest can hold, in kilograms. */
export const CHEST_WEIGHT_LIMIT_KG = 60;

/** A chest. Building it needs the axe. Its front faces +z when it faces the default way. */
export const CHEST: FurnitureDefinition<"chest"> = {
  kind: "chest",
  cost: [{ material: "plank", count: CHEST_PLANK_COST }],
  tool: "axe",
  buildSeconds: CHEST_BUILD_SECONDS,
  size: { x: CHEST_WIDTH_METRES, z: CHEST_DEPTH_METRES },
  blocks: { radius: 0.71 },
  storage: { weightLimitKg: CHEST_WEIGHT_LIMIT_KG, fullNotice: "chestFull" },
  reachHeight: "waist",
};
