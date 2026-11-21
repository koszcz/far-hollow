// The build menu icon for the fireplace, the draft "fireplace-icon" asset in asset-manifest.json. Built in code.
// Added by fireplace ticket 02. It is drawn on the same 24 by 24 grid, in the same shaded style, as the approved build icons in build-icons.tsx.
import type { BackpackIconDrawing } from "./icon-drawing";

/** Grey river stone, matching the stone backpack icon, and a darker grey for the chimney in shadow. */
const STONE = "#8f9498";
const STONE_DARK = "#7c8185";
const STONE_LIGHT = "#b9bec2";
/** The sooty inside of the hearth. */
const SOOT = "#3a3330";
/** A small fire in the hearth, in the campfire icon's colours. */
const FLAME = "#ff8a3c";
const FLAME_CORE = "#ffd25a";

/**
 * Seen from the front: a squat stone hearth with an arched opening and a small fire in it, under a stone mantel,
 * with a short chimney rising from the back. Cut lines mark the joints between the stones.
 */
export const FIREPLACE_DRAWING: BackpackIconDrawing = {
  colour: STONE,
  parts: [
    { d: "M9 2.5h6V10H9z", as: "fill", colour: STONE_DARK },
    { d: "M9 6h6", as: "cutLine" },
    { d: "M3 21.5V11h18v10.5z", as: "fill" },
    { d: "M2 9h20v2.6H2z", as: "fill", colour: STONE_LIGHT },
    { d: "M3 15.5h4M17 15.5h4M7 11.6v3.9M17 11.6v3.9M5 15.5v6M19 15.5v6", as: "cutLine" },
    { d: "M7.5 21.5V16.5a4.5 4.5 0 0 1 9 0v5z", as: "fill", colour: SOOT },
    { d: "M12 14.5c.7 1.8 2.6 2.6 2.6 4.6a2.6 2.6 0 0 1-5.2 0c0-1.2.8-2 1.4-2.6 0 1 .4 1.5.9 1.7.1-1.4 0-2.6.3-3.7z", as: "fill", colour: FLAME },
    { d: "M12 17.6c.3.8 1.2 1.1 1.2 2a1.2 1.2 0 0 1-2.4 0c0-.6.6-1.1 1.2-2z", as: "fill", colour: FLAME_CORE },
  ],
};
