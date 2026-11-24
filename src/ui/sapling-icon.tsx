// The backpack icon for a sapling, the approved "sapling-icon" asset in asset-manifest.json. Built in code.
// Added by regrowth ticket 02. BackpackIcon in backpack-icons.tsx draws it, in the same style as the approved "backpack-icons".
import type { BackpackIconDrawing } from "./icon-drawing";

/** The sapling's needles or leaves: a fresh mid green, with a darker green for the lower tier. */
const LEAF = "#5f9a45";
const LEAF_DARK = "#4a7d37";
/** The thin stem and the ball of earth around the roots. */
const STEM = "#7a5434";
const EARTH = "#6b4a32";

/** A small young pine dug up with its roots in a ball of earth: two tiers of green over a thin stem. */
export const SAPLING_DRAWING: BackpackIconDrawing = {
  colour: LEAF,
  parts: [
    { d: "M12 16.5V11", as: "line", colour: STEM },
    { d: "M7 18c0-1.8 2.2-2.8 5-2.8s5 1 5 2.8-2.2 3-5 3-5-1.2-5-3z", as: "fill", colour: EARTH },
    { d: "M6.5 13.5 12 7.5l5.5 6z", as: "fill", colour: LEAF_DARK },
    { d: "M8 9.5 12 3l4 6.5z", as: "fill" },
    { d: "M10.5 7.5 12 5", as: "shine", colour: "#9cc77f" },
  ],
};
