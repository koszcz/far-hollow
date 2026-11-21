// The backpack icon for stone, part of the draft "stone" asset in asset-manifest.json. Built in code.
// Added by fireplace ticket 01. BackpackIcon in backpack-icons.tsx draws it, in the same style as the approved "backpack-icons".
import type { BackpackIconDrawing } from "./icon-drawing";

/** A wet river stone: mid grey with a little blue, and a paler top where the light catches it. */
const STONE = "#8f9498";
const STONE_LIGHT = "#b9bec2";

/** Two rounded river stones, a big one lying in front of a smaller one, with a glint on the big one. */
export const STONE_DRAWING: BackpackIconDrawing = {
  colour: STONE,
  parts: [
    { d: "M12 6.5c3.5-1 7 .5 8 3s-1 4.5-4 4.5-6-1-6.5-3.5 0-3.4 2.5-4z", as: "fill", colour: "#7c8185" },
    { d: "M3 15.5c0-3.5 3.5-5.5 8-5.5s8.5 2 8.5 5.5-3.5 5-8.5 5-8-1.5-8-5z", as: "fill" },
    { d: "M6 13.5c1.5-1.5 4-2 6.5-1.8", as: "shine", colour: STONE_LIGHT },
  ],
};
