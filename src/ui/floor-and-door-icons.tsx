// Build menu icons for the floor and the door: the draft "floor-and-door-icons" asset in asset-manifest.json. Built in code.
// Added by floors-and-doors ticket 01, which draws the floor's icon. Ticket 02 adds the door's.
// They are drawn on the same 24 by 24 grid, in the same shaded style, as the approved build icons in build-icons.tsx.
import type { BackpackIconDrawing } from "./icon-drawing";

/** Plank wood, as in furniture-icons.tsx, with a paler shade for the boards in the light and a darker one for the seams. */
const PLANK = "#d9b07a";
const PLANK_LIGHT = "#ecc995";
const SEAM = "#a8763f";
/** The debarked logs of the foundation deck under the floor, as in the foundation's build icon. */
const DECK = "#cfa66c";
const DECK_END = "#f3dcae";

/**
 * Seen from the front and above: a square of planks laid side by side across a foundation deck, narrowing as it goes back.
 * The deck's logs show their pale cut ends along the front edge, under the planks.
 */
export const FLOOR_DRAWING: BackpackIconDrawing = {
  colour: PLANK,
  parts: [
    { d: "M2 16.5h20V21H2z", as: "fill", colour: DECK },
    { d: "M4.5 18.8h.01M9.5 18.8h.01M14.5 18.8h.01M19.5 18.8h.01", as: "line", colour: DECK_END },
    { d: "M5 4h14l3 12.5H2z", as: "fill" },
    { d: "M5 4h2.8L6 16.5H2zM13.4 4h2.8L18 16.5h-4z", as: "fill", colour: PLANK_LIGHT },
    { d: "M7.8 4L6 16.5M10.6 4L10 16.5M13.4 4L14 16.5M16.2 4L18 16.5", as: "cutLine", colour: SEAM },
    { d: "M2.5 16.3H21.5", as: "shine", colour: PLANK_LIGHT },
  ],
};
