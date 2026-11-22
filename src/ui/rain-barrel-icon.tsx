// The build menu icon for the rain barrel, the draft "rain-barrel-icon" asset in asset-manifest.json. Built in code.
// Added by rain barrel ticket 01. It is drawn from the barrel's model in rain-barrel-meshes.ts, seen from the front and a
// little above, on the same 24 by 24 grid and in the same shaded style as the approved furniture icons in furniture-icons.tsx.
import type { BackpackIconDrawing } from "./icon-drawing";

/** Plank wood, as in furniture-icons.tsx: the plank shade for the staves, a darker shade inside, and a pale glint. */
const PLANK = "#d9b07a";
const PLANK_DARK = "#8f6438";
const SEAM = "#a8763f";
const GLINT = "#f6e2bc";
/** The dark wood of the hoops, as in rain-barrel-meshes.ts. */
const HOOP = "#4a3b2a";
/** The water inside, as in rain-barrel-meshes.ts, and the light on its surface. */
const WATER = "#4f7f9c";
const WATER_SHINE = "#9cc3da";

/**
 * Seen from the front and a little above: the open top as an ellipse, dark inside with water near the rim,
 * the staves below it with seams between them, and two dark hoops round them.
 */
export const RAIN_BARREL_DRAWING: BackpackIconDrawing = {
  colour: PLANK,
  parts: [
    // The staves: straight sides with a rounded bottom edge.
    { d: "M4.5 6.5h15v13a7.5 2.5 0 0 1-15 0z", as: "fill" },
    { d: "M8.2 8.5v13M12 8.8v13.2M15.8 8.5v13", as: "shine", colour: SEAM },
    // The two hoops.
    { d: "M4.5 10.2a7.5 2.5 0 0 0 15 0v1.4a7.5 2.5 0 0 1-15 0z", as: "fill", colour: HOOP },
    { d: "M4.5 16.6a7.5 2.5 0 0 0 15 0V18a7.5 2.5 0 0 1-15 0z", as: "fill", colour: HOOP },
    // The open top: the rim, the dark inside, and the water.
    { d: "M4.5 6.5a7.5 2.5 0 1 0 15 0a7.5 2.5 0 1 0-15 0z", as: "fill", colour: PLANK_DARK },
    { d: "M5.8 6.9a6.2 1.9 0 1 0 12.4 0a6.2 1.9 0 1 0-12.4 0z", as: "fill", colour: WATER },
    { d: "M8.5 6.6h4.5", as: "shine", colour: WATER_SHINE },
    { d: "M5 9.2a7.5 2.5 0 0 0 3.5 1.9", as: "shine", colour: GLINT },
  ],
};
