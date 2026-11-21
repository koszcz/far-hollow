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
/** The darker battens across the door's planks. */
const BATTEN = "#a87a45";
/** The peeled logs of the door frame round the door, in the door frame icon's colour. */
const FRAME = "#e3c38f";
/** The iron of the door's latch. */
const IRON = "#4a4440";

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

/**
 * Seen from the front: a door of three upright planks hung in a pale log door frame, with two battens across the planks
 * and a small dark latch on the right. Cut lines mark the joints between the planks.
 */
export const DOOR_DRAWING: BackpackIconDrawing = {
  colour: PLANK,
  parts: [
    { d: "M3 22V4.5h18V22h-2.6V7.2H5.6V22z", as: "fill", colour: FRAME },
    { d: "M2.5 2.5h19v2.8h-19z", as: "fill", colour: FRAME },
    { d: "M5.6 22V7.2h12.8V22z", as: "fill" },
    { d: "M9.9 7.2V22M14.1 7.2V22", as: "cutLine" },
    { d: "M5.6 9.6h12.8v2H5.6zM5.6 17.4h12.8v2H5.6z", as: "fill", colour: BATTEN },
    { d: "M15.6 13.6h1.6v2.2h-1.6z", as: "fill", colour: IRON },
  ],
};
