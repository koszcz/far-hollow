// The shelf: standing furniture that holds small materials, tools, and food, like a chest, but less of them.
// It opens in the same panel as a chest. chests.ts opens it and moves things on and off.
import type { FurnitureDefinition } from "../furniture";

/** How many planks a shelf costs. Construction spends one at the start of each stage. */
export const SHELF_PLANK_COST = 4;
/** How long the player holds the build action to build a shelf, in seconds. */
export const SHELF_BUILD_SECONDS = 8;
/** A shelf is this wide, along its front, in metres. */
export const SHELF_WIDTH_METRES = 0.9;
/** A shelf is this deep, from front to back, in metres. */
export const SHELF_DEPTH_METRES = 0.4;
/** The most a shelf can hold, in kilograms. */
export const SHELF_WEIGHT_LIMIT_KG = 30;

/** A shelf. Building it needs no tool. Its front faces +z when it faces the default way. */
export const SHELF: FurnitureDefinition<"shelf"> = {
  kind: "shelf",
  cost: [{ material: "plank", count: SHELF_PLANK_COST }],
  buildSeconds: SHELF_BUILD_SECONDS,
  size: { x: SHELF_WIDTH_METRES, z: SHELF_DEPTH_METRES },
  blocks: { radius: 0.71 },
  storage: { weightLimitKg: SHELF_WEIGHT_LIMIT_KG, fullNotice: "shelfFull" },
  reachHeight: "waist",
};
