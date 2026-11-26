// The build menu icon for the drying rack, the draft "drying-rack-icon" asset in asset-manifest.json. Built in code.
// Added by food-keeping ticket 02. It is drawn from the rack's model in drying-rack-meshes.ts, seen from the front, on the same
// 24 by 24 grid and in the same shaded style as the approved furniture icons in furniture-icons.tsx.
// Two A-frame ends of sticks hold two rails. Berries and a mushroom hang from the rails on short lengths of cord.
import type { BackpackIconDrawing } from "./icon-drawing";

/** The sticks, as in the stick icon, a darker shade for the far legs, and the cord lashings and hanging strings. */
const STICK = "#c08a55";
const STICK_DARK = "#8f6438";
const CORD = "#e0c98f";
/** Food hanging on the rack: berries, and a mushroom's cap and stem. */
const BERRY = "#b3202e";
const CAP = "#c8643a";
const STEM = "#ead8b8";

/** A circle path, centred on (x, y) with radius r. */
function circle(x: number, y: number, r: number): string {
  return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}

/** Seen from the front: the two A-frame ends, the top and lower rails, and food hanging from the top rail. */
export const DRYING_RACK_DRAWING: BackpackIconDrawing = {
  colour: STICK,
  parts: [
    // The far leg of each A-frame end, in shadow.
    { d: "M4.5 4L6.5 21.5M19.5 4L17.5 21.5", as: "line", colour: STICK_DARK },
    // The near leg of each end, and the two rails across.
    { d: "M4.5 4L2.5 21.5M19.5 4L21.5 21.5", as: "line" },
    { d: "M2.5 4.5h19M3.5 14h17", as: "line" },
    // The cord lashings where the rails meet the ends.
    { d: "M4.5 4.5h.01M19.5 4.5h.01", as: "line", colour: CORD },
    // Thin strings down from the top rail to the food.
    { d: "M8 5.8v3M12 5.8v3.6M16 5.8v3", as: "shine", colour: CORD },
    // Two bunches of berries and a mushroom hanging between them.
    { d: `${circle(7.2, 10, 1.4)}${circle(8.8, 10.3, 1.4)}${circle(8, 11.7, 1.3)}`, as: "fill", colour: BERRY },
    { d: "M11.2 10.5h1.6v2.5h-1.6z", as: "fill", colour: STEM },
    { d: "M9.5 10.8a2.5 2.2 0 0 1 5 0z", as: "fill", colour: CAP },
    { d: `${circle(15.2, 10, 1.4)}${circle(16.8, 10.3, 1.4)}${circle(16, 11.7, 1.3)}`, as: "fill", colour: BERRY },
  ],
};
