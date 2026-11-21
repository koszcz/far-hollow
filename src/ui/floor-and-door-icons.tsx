// The build menu icons for the floor and the door, the draft "floor-and-door-icons" asset in asset-manifest.json. Built in code.
// The door icon was added by floors-and-doors ticket 02. Each is drawn on the same 24 by 24 grid, in the same shaded style,
// as the approved build icons in build-icons.tsx.
import type { BackpackIconDrawing } from "./icon-drawing";

/** Sawn plank wood, matching the plank backpack icon, and a darker brown for the battens across the planks. */
const PLANK = "#c79a5e";
const BATTEN = "#a87a45";
/** The peeled logs of the door frame round the door, in the door frame icon's colour. */
const FRAME = "#e3c38f";
/** The iron of the latch. */
const IRON = "#4a4440";

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
