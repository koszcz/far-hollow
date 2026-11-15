// The table: furniture the player eats beside. tables.ts says whether the player eats within reach of one.
import type { FurnitureDefinition } from "../furniture";

/** How many planks a table costs. Construction spends one at the start of each stage. */
export const TABLE_PLANK_COST = 6;
/** How long the player holds the build action to build a table, in seconds. */
export const TABLE_BUILD_SECONDS = 10;
/** A table is this wide, along its long side, in metres. Its length runs along x when it faces the default way. */
export const TABLE_WIDTH_METRES = 1.2;
/** A table is this deep, across its top, in metres. */
export const TABLE_DEPTH_METRES = 0.8;

/** A table. Building it needs no tool. A finished table stops the player walking on every walk-map cell it reaches over. */
export const TABLE: FurnitureDefinition<"table"> = {
  kind: "table",
  cost: [{ material: "plank", count: TABLE_PLANK_COST }],
  buildSeconds: TABLE_BUILD_SECONDS,
  size: { x: TABLE_WIDTH_METRES, z: TABLE_DEPTH_METRES },
  blocks: "cellsUnder",
};
