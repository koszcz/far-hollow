// The rain barrel: furniture that catches rain as clean water. rain-barrels.ts fills it in the rain, and lets the player
// drink from it or fill the pot from it.
import type { FurnitureDefinition } from "../furniture";

/** How many planks a rain barrel costs. Construction spends one at the start of each stage. */
export const RAIN_BARREL_PLANK_COST = 6;
/** How long the player holds the build action to build a rain barrel, in seconds. */
export const RAIN_BARREL_BUILD_SECONDS = 10;
/** A rain barrel is this wide across, in metres. */
export const RAIN_BARREL_WIDTH_METRES = 0.6;
/** The most drinks of clean water a rain barrel holds. */
export const RAIN_BARREL_DRINK_LIMIT = 6;
/** A rain barrel gains 1 drink for every this many game minutes that rain falls on it. */
export const RAIN_BARREL_MINUTES_PER_DRINK = 120;

/**
 * A rain barrel. Building it needs the axe. A finished barrel starts empty and blocks walking.
 * "Drink" is its main use. It also fills the empty pot.
 */
export const RAIN_BARREL: FurnitureDefinition<"rainBarrel"> = {
  kind: "rainBarrel",
  cost: [{ material: "plank", count: RAIN_BARREL_PLANK_COST }],
  tool: "axe",
  buildSeconds: RAIN_BARREL_BUILD_SECONDS,
  size: { x: RAIN_BARREL_WIDTH_METRES, z: RAIN_BARREL_WIDTH_METRES },
  blocks: { radius: 0.71 },
  reachHeight: "waist",
  finishedParts: () => ({ rainBarrel: { held: 0, progress: 0 } }),
  use: { name: "drink", command: (id) => ({ type: "drinkFromRainBarrel", barrelId: id }) },
  moreUses: [{ name: "fillPot", command: (id) => ({ type: "fillPotFromRainBarrel", barrelId: id }) }],
};
