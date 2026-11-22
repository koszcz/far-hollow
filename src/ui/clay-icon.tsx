// The backpack icon for clay, part of the draft "clay" asset in asset-manifest.json. Built in code.
// Added by clay ticket 01. BackpackIcon in backpack-icons.tsx draws it, in the same style as the approved "backpack-icons".
import type { BackpackIconDrawing } from "./icon-drawing";

/** Wet river clay: a warm grey-brown, darker in the dent, with a pale sheen where it was smoothed. */
const CLAY = "#9a7b62";
const CLAY_DARK = "#6f5644";
const CLAY_LIGHT = "#c2a58c";

/** A rounded lump of clay, with a thumb dent on top and a sheen where it was smoothed by hand. */
export const CLAY_DRAWING: BackpackIconDrawing = {
  colour: CLAY,
  parts: [
    { d: "M3.5 16c0-4.5 3.8-8 8.5-8s8.5 3.5 8.5 8c0 3-3.8 4.5-8.5 4.5s-8.5-1.5-8.5-4.5z", as: "fill" },
    { d: "M9.5 11.5c1.2-.9 3.5-.9 4.5.2", as: "cutLine", colour: CLAY_DARK },
    { d: "M6 15c.6-1.6 1.8-2.6 3.2-3", as: "shine", colour: CLAY_LIGHT },
  ],
};
