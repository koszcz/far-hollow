// Build menu icons for the window and the shutters: the approved "window-icons" asset in asset-manifest.json. Built in code.
// They are drawn on the same 24 by 24 grid, in the same shaded style, as the approved build icons in build-icons.tsx.
import type { BackpackIconDrawing } from "./icon-drawing";

/** Debarked log wood, as in the log wall's build icon, with a darker shade for every other course. */
const DEBARKED = "#e3c38f";
const DEBARKED_SHADE = "#cfa66c";
/** The dark opening of the window, seen into the room. */
const OPENING = "#3d3328";
/** Plank wood, as in furniture-icons.tsx, with a darker shade for the seams and battens. */
const PLANK = "#d9b07a";
const PLANK_LIGHT = "#ecc995";
const SEAM = "#a8763f";
/** The iron of the shutters' hinge straps, and the paler heads of their pins. */
const IRON = "#4a4440";
const PIN = "#8a8079";

/**
 * Seen from the front: four courses of debarked logs, with a square opening cut through the middle two.
 * A thin plank frame lines the opening, and a plank sill juts out under it.
 */
export const WINDOW_DRAWING: BackpackIconDrawing = {
  colour: DEBARKED,
  parts: [
    { d: "M2 3h20v4.2H2z", as: "fill" },
    { d: "M2 7.4h20v4.2H2z", as: "fill", colour: DEBARKED_SHADE },
    { d: "M2 11.8h20V16H2z", as: "fill" },
    { d: "M2 16.2h20v4.6H2z", as: "fill", colour: DEBARKED_SHADE },
    { d: "M2 7.3h6M16 7.3h6M2 11.7h6M16 11.7h6M2 16.1h20", as: "cutLine" },
    { d: "M3 4.5h18M3 13.2h4M17 13.2h4", as: "shine", colour: DEBARKED },
    { d: "M7.8 7h8.4v9.2H7.8z", as: "fill", colour: PLANK },
    { d: "M8.8 8h6.4v8.2H8.8z", as: "fill", colour: OPENING },
    { d: "M6.6 16h10.8v1.8H6.6z", as: "fill", colour: PLANK },
    { d: "M7.2 16.5h9.6", as: "shine", colour: PLANK_LIGHT },
  ],
};

/**
 * Seen from the front: two closed plank shutters side by side in a pale log surround, which shows in the thin gap between them.
 * Each leaf is two boards, with a batten across it and two iron hinge straps on its outer edge, each held by a pin.
 */
export const SHUTTERS_DRAWING: BackpackIconDrawing = {
  colour: PLANK,
  parts: [
    { d: "M2.4 3h19.2v18H2.4z", as: "fill", colour: DEBARKED },
    { d: "M3.2 3.8h8.4v16.4H3.2zM12.4 3.8h8.4v16.4h-8.4z", as: "fill" },
    { d: "M7.2 3.8h.4v16.4h-.4zM16.4 3.8h.4v16.4h-.4z", as: "fill", colour: SEAM },
    { d: "M3.2 10.8h8.4v2.4H3.2zM12.4 10.8h8.4v2.4h-8.4z", as: "fill", colour: SEAM },
    { d: "M3.2 6.4h4.4v1.3H3.2zM3.2 16.3h4.4v1.3H3.2zM16.4 6.4h4.4v1.3h-4.4zM16.4 16.3h4.4v1.3h-4.4z", as: "fill", colour: IRON },
    {
      d: "M4 7.05a.45.45 0 1 0 .9 0 .45.45 0 1 0-.9 0zM4 16.95a.45.45 0 1 0 .9 0 .45.45 0 1 0-.9 0zM19.1 7.05a.45.45 0 1 0 .9 0 .45.45 0 1 0-.9 0zM19.1 16.95a.45.45 0 1 0 .9 0 .45.45 0 1 0-.9 0z",
      as: "fill",
      colour: PIN,
    },
    { d: "M4 4.8v4.6M13.2 4.8v4.6", as: "shine", colour: PLANK_LIGHT },
  ],
};
