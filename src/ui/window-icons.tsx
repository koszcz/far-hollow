// Build menu icons for the window and the shutters: the draft "window-icons" asset in asset-manifest.json. Built in code.
// They are drawn on the same 24 by 24 grid, in the same shaded style, as the approved build icons in build-icons.tsx.
import type { BackpackIconDrawing } from "./icon-drawing";

/** Debarked log wood, as in the log wall's build icon, with a darker shade for every other course. */
const DEBARKED = "#e3c38f";
const DEBARKED_SHADE = "#cfa66c";
/** The dark opening of the window, seen into the room. */
const OPENING = "#3d3328";
/** Plank wood, as in furniture-icons.tsx, with a darker shade for the seams and battens. */
const PLANK = "#d9b07a";
const SEAM = "#a8763f";
/** The iron of the shutters' hinges. */
const IRON = "#4a4440";

/**
 * Seen from the front: four courses of debarked logs, with a square opening cut through the middle two.
 * The logs either side of the opening stop at its edges.
 */
export const WINDOW_DRAWING: BackpackIconDrawing = {
  colour: DEBARKED,
  parts: [
    { d: "M2 3h20v4.2H2z", as: "fill" },
    { d: "M2 7.4h20v4.2H2z", as: "fill", colour: DEBARKED_SHADE },
    { d: "M2 11.8h20V16H2z", as: "fill" },
    { d: "M2 16.2h20v4.6H2z", as: "fill", colour: DEBARKED_SHADE },
    { d: "M8 7.4h8V16H8z", as: "fill", colour: OPENING },
    { d: "M2 7.3h6M16 7.3h6M2 11.7h6M16 11.7h6M2 16.1h20", as: "cutLine", colour: DEBARKED_SHADE },
    { d: "M3 4.5h18M3 13.2h4M17 13.2h4", as: "shine", colour: DEBARKED },
  ],
};

/** Seen from the front: two closed plank shutters side by side, each with a batten across it and an iron hinge strap on its outer edge. */
export const SHUTTERS_DRAWING: BackpackIconDrawing = {
  colour: PLANK,
  parts: [
    { d: "M3 4h8.8v16H3zM12.2 4H21v16h-8.8z", as: "fill" },
    { d: "M7.4 4v16M16.6 4v16M12 4v16", as: "cutLine", colour: SEAM },
    { d: "M3 10.8h8.8v2.4H3zM12.2 10.8H21v2.4h-8.8z", as: "fill", colour: SEAM },
    { d: "M3 6.5h4v1.2H3zM3 16.3h4v1.2H3zM17 6.5h4v1.2h-4zM17 16.3h4v1.2h-4z", as: "fill", colour: IRON },
  ],
};
