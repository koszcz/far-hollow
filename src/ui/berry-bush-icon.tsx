// The backpack icon for a dug-up berry bush, the draft "berry-bush-icon" asset in asset-manifest.json. Built in code.
// Added by garden ticket 01. BackpackIcon in backpack-icons.tsx draws it, in the same style as the approved "backpack-icons".
import type { BackpackIconDrawing } from "./icon-drawing";

/** The bush's leaves: a deep green, with a darker green for the back. */
const LEAF = "#4f8f3f";
const LEAF_DARK = "#3c7231";
/** The red berries on the leaves, and the ball of earth round the roots. */
const BERRY = "#d0384a";
const EARTH = "#6b4a32";

/** A small round bush of green leaves dotted with red berries, dug up with its roots in a ball of earth. */
export const BERRY_BUSH_DRAWING: BackpackIconDrawing = {
  colour: LEAF,
  parts: [
    { d: "M7 18.5c0-1.7 2.2-2.6 5-2.6s5 .9 5 2.6-2.2 2.8-5 2.8-5-1.1-5-2.8z", as: "fill", colour: EARTH },
    {
      d: "M4.5 13c0-3 2.2-5 4.5-5 .8-2.2 2.5-3.5 4.5-3.2 2.4.3 3.6 2.2 3.8 3.8 2 .4 2.9 2.2 2.4 4.2-.4 1.8-2.2 3.2-4.6 3.2H8.5c-2.4 0-4-1.3-4-3z",
      as: "fill",
      colour: LEAF_DARK,
    },
    {
      d: "M6.5 13.2c0-2.2 1.6-3.6 3.4-3.6.6-1.6 1.8-2.5 3.2-2.3 1.8.2 2.6 1.6 2.7 2.8 1.4.3 2.1 1.6 1.7 3-.3 1.3-1.6 2.2-3.3 2.2H9.4c-1.7 0-2.9-.9-2.9-2.1z",
      as: "fill",
    },
    {
      d: "M8.6 12.6a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0M12.6 9.8a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0M14.6 13.4a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0",
      as: "fill",
      colour: BERRY,
    },
    { d: "M9.2 10.6a2.4 2.4 0 0 1 1.6-1.4", as: "shine", colour: "#9cc77f" },
  ],
};
