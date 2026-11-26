// The wood box: furniture inside a room that holds firewood and nothing else. wood-boxes.ts lets the player put firewood in
// and take it out, and gives a fire in the same room its firewood before the backpack.
import type { FurnitureDefinition } from "../furniture";

/** How many planks a wood box costs. Construction spends one at the start of each stage. */
export const WOOD_BOX_PLANK_COST = 4;
/** How long the player holds the build action to build a wood box, in seconds. */
export const WOOD_BOX_BUILD_SECONDS = 8;
/** A wood box is this wide, along x when it faces the default way, in metres. Firewood lies across it, front to back. */
export const WOOD_BOX_WIDTH_METRES = 0.75;
/** A wood box is this deep, along z when it faces the default way, in metres: a little more than a piece of firewood is long. */
export const WOOD_BOX_DEPTH_METRES = 0.6;
/** The most firewood a wood box holds. */
export const WOOD_BOX_FIREWOOD_LIMIT = 20;
/** The player walks to a spot this far from a wood box's middle to use it, in metres. */
export const WOOD_BOX_STAND_METRES = 1;
/** The player can use a wood box from this far from its middle, in metres. */
export const WOOD_BOX_REACH_METRES = 2;

/**
 * A wood box. Building it needs no tool. It goes only inside a room. A finished box starts empty and blocks walking.
 * "Put in firewood" is its main use. It also takes in all the firewood that fits, and gives firewood back to the backpack.
 */
export const WOOD_BOX: FurnitureDefinition<"woodBox"> = {
  kind: "woodBox",
  cost: [{ material: "plank", count: WOOD_BOX_PLANK_COST }],
  buildSeconds: WOOD_BOX_BUILD_SECONDS,
  size: { x: WOOD_BOX_WIDTH_METRES, z: WOOD_BOX_DEPTH_METRES },
  blocks: { radius: 0.71 },
  needsRoom: true,
  reachHeight: "waist",
  finishedParts: () => ({ woodBox: { firewood: 0 } }),
  use: { name: "putInFirewood", command: (id) => ({ type: "putInWoodBox", woodBoxId: id, all: false }) },
  moreUses: [
    { name: "putInAllFirewood", command: (id) => ({ type: "putInWoodBox", woodBoxId: id, all: true }) },
    { name: "takeFirewood", command: (id) => ({ type: "takeFromWoodBox", woodBoxId: id }) },
  ],
};
