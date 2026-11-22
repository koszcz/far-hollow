// The jug icons, the draft "jug-icons" asset in asset-manifest.json. Built in code. Added by clay ticket 02.
// The unfired jug is the backpack icon and the craft menu icon. The empty jug, added by clay ticket 03, is the same shape in
// fired clay. BackpackIcon in backpack-icons.tsx draws them, in the same style as the approved "backpack-icons", on the same
// 24 by 24 grid. Clay ticket 04 adds the icons for a jug with water in it.
import type { BackpackIconDrawing } from "./icon-drawing";

/** Unfired clay: the same warm grey-brown as the clay icon, a little paler because it has dried. */
const UNFIRED_CLAY = "#a88a70";
const UNFIRED_CLAY_DARK = "#6f5644";
const UNFIRED_CLAY_LIGHT = "#cdb197";

/** A round-bellied jug with a narrow neck, a lip, and a loop handle on its right side, with a dark opening at the top. */
export const UNFIRED_JUG_DRAWING: BackpackIconDrawing = {
  colour: UNFIRED_CLAY,
  parts: [
    { d: "M15.5 10c3 .2 4 2.4 3.6 4.6-.3 1.6-1.4 2.6-2.8 3", as: "line" },
    { d: "M9.5 4h5v1.4l-.6.4v2.4c2.8 1 4.6 3.6 4.6 6.6 0 3.8-2.9 6.2-6.5 6.2s-6.5-2.4-6.5-6.2c0-3 1.8-5.6 4.6-6.6V5.8l-.6-.4z", as: "fill" },
    { d: "M10.2 4.6h3.6", as: "cutLine", colour: UNFIRED_CLAY_DARK },
    { d: "M7.8 14.5c.2-1.8 1.2-3.2 2.6-4", as: "shine", colour: UNFIRED_CLAY_LIGHT },
  ],
};

/** Fired clay: warm orange-brown terracotta, the same as the jug in the world. */
const FIRED_CLAY = "#b0603c";
const FIRED_CLAY_DARK = "#6e3520";
const FIRED_CLAY_LIGHT = "#d98c62";

/** The empty jug: the unfired jug's shape in fired clay. */
export const JUG_DRAWING: BackpackIconDrawing = {
  colour: FIRED_CLAY,
  parts: [
    { d: "M15.5 10c3 .2 4 2.4 3.6 4.6-.3 1.6-1.4 2.6-2.8 3", as: "line" },
    { d: "M9.5 4h5v1.4l-.6.4v2.4c2.8 1 4.6 3.6 4.6 6.6 0 3.8-2.9 6.2-6.5 6.2s-6.5-2.4-6.5-6.2c0-3 1.8-5.6 4.6-6.6V5.8l-.6-.4z", as: "fill" },
    { d: "M10.2 4.6h3.6", as: "cutLine", colour: FIRED_CLAY_DARK },
    { d: "M7.8 14.5c.2-1.8 1.2-3.2 2.6-4", as: "shine", colour: FIRED_CLAY_LIGHT },
  ],
};
