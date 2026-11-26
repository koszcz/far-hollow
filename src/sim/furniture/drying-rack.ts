// The drying rack: furniture the player hangs berries and mushrooms on to dry, so they keep for good.
// drying-racks.ts hangs food on it, dries it, and takes it off. The food on it and how it dries live in rack-food.ts.
import type { FurnitureDefinition } from "../furniture";

/** How many sticks a drying rack costs: two A-frame ends and the rails between them. */
export const DRYING_RACK_STICK_COST = 6;
/** How many cords a drying rack costs, to lash its sticks together. */
export const DRYING_RACK_CORD_COST = 2;
/** How long the player holds the build action to build a drying rack, in seconds. */
export const DRYING_RACK_BUILD_SECONDS = 6;
/** A drying rack is this wide, along its rails, in metres. */
export const DRYING_RACK_WIDTH_METRES = 1;
/** A drying rack is this deep, across its A-frame ends, in metres. */
export const DRYING_RACK_DEPTH_METRES = 0.5;
/** The player walks to a spot this far from a rack's middle to use it, in metres. */
export const DRYING_RACK_STAND_METRES = 0.9;
/** The player can use a rack from this far from its middle, in metres. */
export const DRYING_RACK_REACH_METRES = 2;

/**
 * A drying rack. Building it needs no tool. It stands indoors or outdoors, and a finished rack starts with no food on it.
 * Its actions depend on what hangs on it, so the action menu builds them itself, and the definition gives it no use.
 */
export const DRYING_RACK: FurnitureDefinition<"dryingRack"> = {
  kind: "dryingRack",
  cost: [
    { material: "stick", count: DRYING_RACK_STICK_COST },
    { material: "cord", count: DRYING_RACK_CORD_COST },
  ],
  buildSeconds: DRYING_RACK_BUILD_SECONDS,
  size: { x: DRYING_RACK_WIDTH_METRES, z: DRYING_RACK_DEPTH_METRES },
  blocks: { radius: 0.71 },
  reachHeight: "waist",
  finishedParts: () => ({ dryingRack: [] }),
};
