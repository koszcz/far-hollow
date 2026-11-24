// The jug icons, the approved "jug-icons" asset in asset-manifest.json. Built in code. Added by clay ticket 02.
// The unfired jug is the backpack icon and the craft menu icon. The empty jug, added by clay ticket 03, is the same shape in
// fired clay. BackpackIcon in backpack-icons.tsx draws them, in the same style as the approved "backpack-icons", on the same
// 24 by 24 grid. Clay ticket 04 added the icons for a jug with water in it: one pale blue wave on the belly for each drink.
import type { JugContent } from "../sim/api";
import type { BackpackIconDrawing, IconPart } from "./icon-drawing";

/** The dark inside of the jug, seen through the opening in its lip. */
const JUG_OPENING = "#2a1c12";

/**
 * A round-bellied jug with a short neck, a lip with a dark opening in its top, and a loop handle on its right side.
 * The handle springs from the neck and joins the belly. `light` is the colour of the glint on the belly.
 */
function jugParts(light: string): readonly IconPart[] {
  return [
    { d: "M13.4 7.6c3.2-.2 5.2 1.3 5.2 3.8 0 .9-.3 1.7-.8 2.4", as: "line" },
    { d: "M10.2 5.6h3.6v3.7c2.9.9 4.8 3.4 4.8 6.4 0 3.8-2.9 6.2-6.6 6.2s-6.6-2.4-6.6-6.2c0-3 1.9-5.5 4.8-6.4z", as: "fill" },
    { d: "M9.4 3.8h5.2a.9.9 0 0 1 0 1.8H9.4a.9.9 0 0 1 0-1.8z", as: "fill" },
    { d: "M10.4 4.7a1.6.5 0 1 0 3.2 0 1.6.5 0 1 0-3.2 0z", as: "fill", colour: JUG_OPENING },
    { d: "M7.6 15c.2-1.9 1.3-3.4 2.8-4.2", as: "shine", colour: light },
  ];
}

/** Unfired clay: the same warm grey-brown as the clay icon, a little paler because it has dried. */
const UNFIRED_CLAY = "#a88a70";
const UNFIRED_CLAY_LIGHT = "#cdb197";

/** The unfired jug. */
export const UNFIRED_JUG_DRAWING: BackpackIconDrawing = { colour: UNFIRED_CLAY, parts: jugParts(UNFIRED_CLAY_LIGHT) };

/** Fired clay: warm orange-brown terracotta, the same as the jug in the world. */
const FIRED_CLAY = "#b0603c";
const FIRED_CLAY_LIGHT = "#d98c62";

/** The empty jug: the unfired jug's shape in fired clay. */
export const JUG_DRAWING: BackpackIconDrawing = { colour: FIRED_CLAY, parts: jugParts(FIRED_CLAY_LIGHT) };

/** Clean water: the same pale blue as the pot of clean water's wave. */
const CLEAN_WATER = "#bfe3f5";

/** One thin wave across the jug's belly for each drink, from the bottom up, spaced so each one shows on its own. */
const DRINK_WAVES = ["M8.4 19.2c1.2-.9 2.4.9 3.6 0s2.4.9 3.6 0", "M7.2 16.6c1.6-1 3.2 1 4.8 0s3.2 1 4.8 0", "M7.6 14c1.5-1 2.9 1 4.4 0s2.9 1 4.4 0"] as const;

/** The jug with `drinks` waves of clean water on its belly. */
function jugWithDrinks(drinks: number): BackpackIconDrawing {
  return {
    colour: FIRED_CLAY,
    parts: [...JUG_DRAWING.parts, ...DRINK_WAVES.slice(0, drinks).map((d) => ({ d, as: "shine" as const, colour: CLEAN_WATER }))],
  };
}

/** The backpack icon for each jug fill level. */
export const JUG_DRAWINGS: Readonly<Record<JugContent, BackpackIconDrawing>> = {
  jug: JUG_DRAWING,
  jugWith1Drink: jugWithDrinks(1),
  jugWith2Drinks: jugWithDrinks(2),
  jugWith3Drinks: jugWithDrinks(3),
};
