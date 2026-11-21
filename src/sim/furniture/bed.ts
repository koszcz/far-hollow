// The bed: furniture the player sleeps in. beds.ts walks the player to it, and game.ts puts them to sleep in it.
import type { FurnitureDefinition } from "../furniture";

/** How many planks a bed costs. Construction spends one at the start of each stage. */
export const BED_PLANK_COST = 8;
/** How long the player holds the build action to build a bed, in seconds. */
export const BED_BUILD_SECONDS = 12;
/** A bed is this wide, across its mattress, in metres. */
export const BED_WIDTH_METRES = 1;
/** A bed is this long, from head to foot, in metres. Its length runs along z when it faces the default way. */
export const BED_LENGTH_METRES = 2;

/**
 * A bed. Building it needs no tool. A finished bed stops the player walking on every walk-map cell it reaches over.
 * The player lies with their head at its head end, along -z when it faces the default way.
 */
export const BED: FurnitureDefinition<"bed"> = {
  kind: "bed",
  cost: [{ material: "plank", count: BED_PLANK_COST }],
  buildSeconds: BED_BUILD_SECONDS,
  size: { x: BED_WIDTH_METRES, z: BED_LENGTH_METRES },
  blocks: "cellsUnder",
  use: { name: "sleep", command: (id) => ({ type: "sleepInBed", bedId: id }) },
};
