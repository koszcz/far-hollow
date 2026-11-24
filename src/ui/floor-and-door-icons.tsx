// Build menu icons for the floor and the door: the approved "floor-and-door-icons" asset in asset-manifest.json. Built in code.
// They are drawn on the same 24 by 24 grid, in the same shaded style, as the approved build icons in build-icons.tsx.
import type { BackpackIconDrawing } from "./icon-drawing";

/** Plank wood, as in furniture-icons.tsx, with a paler shade for the boards in the light and a darker one for the seams. */
const PLANK = "#d9b07a";
const PLANK_LIGHT = "#ecc995";
const SEAM = "#a8763f";
/** The sawn front edge of the floor's planks, in shadow, and the dark joints between their ends. */
const PLANK_EDGE = "#b98a52";
const PLANK_END_SEAM = "#6e4a2a";
/** The debarked logs of the foundation deck under the floor, as in the foundation's build icon. */
const DECK = "#cfa66c";
const DECK_END = "#f3dcae";
/** The darker battens across the door's planks. */
const BATTEN = "#a87a45";
/** The peeled logs of the door frame round the door, in the door frame icon's colour. */
const FRAME = "#e3c38f";
/** The iron of the door's latch plate and ring pull. */
const IRON = "#4a4440";

/** A thin seam from (`top`, 5) at the back of the floor to (`bottom`, 16) at its front edge, as a sliver that widens toward the front. */
function floorSeam(top: number, bottom: number): string {
  return `M${top - 0.2} 5h.4L${bottom + 0.35} 16h-.7z`;
}

/**
 * Seen from the front and above: a deck of five boards laid front to back, narrowing as it goes back, with two boards
 * in a paler shade. The boards' sawn ends show along a thick front edge. Under it lies the foundation deck, with the pale
 * cut ends of its logs.
 */
export const FLOOR_DRAWING: BackpackIconDrawing = {
  colour: PLANK,
  parts: [
    { d: "M2.6 18.2h18.8v3.6H2.6z", as: "fill", colour: DECK },
    {
      d: "M3.4 20a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0zM8.2 20a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0zM12.8 20a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0zM17.6 20a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0z",
      as: "fill",
      colour: DECK_END,
    },
    { d: "M5 5h14l3 11H2z", as: "fill" },
    { d: "M7.8 5h2.8L10 16H6zM13.4 5h2.8L18 16h-4z", as: "fill", colour: PLANK_LIGHT },
    { d: [floorSeam(7.8, 6), floorSeam(10.6, 10), floorSeam(13.4, 14), floorSeam(16.2, 18)].join(""), as: "fill", colour: SEAM },
    { d: "M2 16h20v2.4H2z", as: "fill", colour: PLANK_EDGE },
    { d: "M5.8 16h.4v2.4h-.4zM9.8 16h.4v2.4h-.4zM13.8 16h.4v2.4h-.4zM17.8 16h.4v2.4h-.4z", as: "fill", colour: PLANK_END_SEAM },
    { d: "M3 15.5h18", as: "shine", colour: PLANK_LIGHT },
  ],
};

/**
 * Seen from the front: a door of three upright planks hung in a pale log door frame, with two battens across the planks,
 * and an iron latch plate with a ring pull hanging from it on the right. Cut lines mark the joints between the planks.
 */
export const DOOR_DRAWING: BackpackIconDrawing = {
  colour: PLANK,
  parts: [
    { d: "M3 22V4.5h18V22h-2.6V7.2H5.6V22z", as: "fill", colour: FRAME },
    { d: "M2.5 2.5h19v2.8h-19z", as: "fill", colour: FRAME },
    { d: "M5.6 22V7.2h12.8V22z", as: "fill" },
    { d: "M9.9 7.2V22M14.1 7.2V22", as: "cutLine" },
    { d: "M5.6 9.6h12.8v2H5.6zM5.6 17.4h12.8v2H5.6z", as: "fill", colour: BATTEN },
    { d: "M15.9 12.6h1.2v1.4h-1.2z", as: "fill", colour: IRON },
    { d: "M15.1 15a1.4 1.4 0 1 0 2.8 0 1.4 1.4 0 1 0-2.8 0zM15.9 15a.6.6 0 1 0 1.2 0 .6.6 0 1 0-1.2 0z", as: "fill", colour: IRON },
  ],
};
