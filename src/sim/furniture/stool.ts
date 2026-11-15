// The stool: small furniture the player sits on to rest. stools.ts sits the player on it and stands them up again.
import type { FurnitureDefinition } from "../furniture";

/** How many planks a stool costs: one for its legs and one for its seat. Construction spends one at the start of each stage. */
export const STOOL_PLANK_COST = 2;
/** How long the player holds the build action to build a stool, in seconds. */
export const STOOL_BUILD_SECONDS = 4;
/** A stool's seat is this wide and this deep, in metres. Its legs splay out to the seat's edges. */
export const STOOL_SIZE_METRES = 0.4;

/** A stool. Building it needs no tool. The player sits facing the way it faces, +z when it faces the default way. */
export const STOOL: FurnitureDefinition<"stool"> = {
  kind: "stool",
  cost: [{ material: "plank", count: STOOL_PLANK_COST }],
  buildSeconds: STOOL_BUILD_SECONDS,
  size: { x: STOOL_SIZE_METRES, z: STOOL_SIZE_METRES },
  blocks: { radius: 0.71 },
};
