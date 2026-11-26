// The backpack icon for smoked fish, the draft "smoked-fish-icon" asset in asset-manifest.json. Built in code.
// Added by food-keeping ticket 03. BackpackIcon in backpack-icons.tsx draws it, in the same style as the approved "backpack-icons".
// It is the trout of the approved "fishing-icons" asset, smoked a deep amber brown, with a golden belly, darker smoke lines
// along its side, and a loop of twine through its tail, where it hung on the rack. So the player tells it from cooked fish.
import type { BackpackIconDrawing } from "./icon-drawing";

/** A smoked trout: deep amber-brown skin, a dull gold belly, and darker lines where the smoke settled. */
const SMOKED_BACK = "#6b3f1c";
const SMOKED_BELLY = "#c48a3e";
const SMOKED_LINE = "#3a2210";
/** A smoked eye, small and dark. */
const SMOKED_EYE = "#2a1a0e";
/** The twine the fish hung from. */
const TWINE = "#eadbb0";

/** A whole smoked trout lying on its side, head to the left, with a loop of twine through its forked tail. */
export const SMOKED_FISH_DRAWING: BackpackIconDrawing = {
  colour: SMOKED_BACK,
  parts: [
    { d: "M2.5 12c3-4.5 9-5.5 14-2.5L21.5 6v12l-5-3.5c-5 3-11 2-14-2.5z", as: "fill" },
    { d: "M4.5 13.5c3.5 2.5 8 2.6 11.5.6", as: "line", colour: SMOKED_BELLY },
    { d: "M8.5 10.6q3.5-1 7 0M9 12.4q3-.6 6 0", as: "line", colour: SMOKED_LINE },
    { d: "M5.4 10.5a.9 .9 0 1 0 1.8 0a.9 .9 0 1 0-1.8 0", as: "fill", colour: SMOKED_EYE },
    { d: "M19.6 8.6c-.4-2.6 2.8-3 2.3-.6", as: "shine", colour: TWINE },
  ],
};
