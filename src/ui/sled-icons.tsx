// Icons for the sled, the draft "sled-icon" asset in asset-manifest.json. Built in code. Added by sled ticket 01.
// The build menu shows the sled icon over the sled's cost, and the log icon for the logs it costs.
// They are drawn on the same 24 by 24 grid, in the same shaded style, as the approved build icons in build-icons.tsx.
import type { BackpackIconDrawing } from "./icon-drawing";

/** The bark of a log, a darker shade of it, and a log's pale cut end, as the log model shows them. */
const BARK = "#7a5532";
const BARK_DARK = "#5f4127";
const CUT_END = "#c9a46a";
/** The colour of a stick, matching the stick backpack icon. */
const STICK = "#c08a55";

/** A circle path, centred on (x, y) with radius r. */
function circle(x: number, y: number, r: number): string {
  return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}

/** Seen from the side and a little above: two log runners, the far one higher up, with four sticks laid across them. */
export const SLED_DRAWING: BackpackIconDrawing = {
  colour: BARK,
  parts: [
    { d: "M4 11.5h17a2 2 0 0 1 0 4H4z", as: "fill", colour: BARK_DARK },
    { d: "M7 9.5L4 20M11.5 9.5L8.5 20M16 9.5L13 20M20.5 9.5L17.5 20", as: "line", colour: STICK },
    { d: "M2.5 16h17a2.5 2.5 0 0 1 0 5h-17z", as: "fill" },
    { d: "M6 17.6h12", as: "shine", colour: BARK_DARK },
    { d: circle(2.5, 18.5, 2.5), as: "fill", colour: CUT_END },
  ],
};

/** A log on its side with its bark on: dark bark along it, and a pale cut end with one growth ring. */
export const LOG_DRAWING: BackpackIconDrawing = {
  colour: BARK,
  parts: [
    { d: "M6 7.5h12a4.5 4.5 0 0 1 0 9H6z", as: "fill" },
    { d: "M10 10.5h7M9 13.5h5", as: "line", colour: BARK_DARK },
    { d: circle(6, 12, 4.5), as: "fill", colour: CUT_END },
    { d: circle(6, 12, 2), as: "line", colour: BARK_DARK },
  ],
};
