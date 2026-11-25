// The build menu icon for the chimney, the draft "chimney-icon" asset in asset-manifest.json. Built in code.
// Added by chimney ticket 01. It is drawn on the same 24 by 24 grid, in the same shaded style, as the approved build icons in build-icons.tsx.
import type { BackpackIconDrawing, IconPart } from "./icon-drawing";

/** Grey river stone, matching the fireplace icon, with a pale grey for the cap stone. */
const STONE = "#8f9498";
const STONE_WARM = "#989590";
const STONE_LIGHT = "#b9bec2";
/** The mortar between the stones. It shows as thin dark joints. */
const MORTAR = "#55595c";
/** The weathered grey planks of the roof the chimney rises through. */
const ROOF = "#86807a";
const ROOF_DARK = "#6f6a64";
/** A puff of smoke from the top. */
const SMOKE = "#c9c6c2";

/** One stone: a rectangle with rounded corners, from (left, top) to (right, bottom). Each stone gets its own light and shadow. */
function stone(left: number, top: number, right: number, bottom: number, colour: string): IconPart {
  const r = 0.5;
  const w = right - left - 2 * r;
  const h = bottom - top - 2 * r;
  return {
    d: `M${left + r} ${top}h${w}a${r} ${r} 0 0 1 ${r} ${r}v${h}a${r} ${r} 0 0 1 -${r} ${r}h-${w}a${r} ${r} 0 0 1 -${r} -${r}v-${h}a${r} ${r} 0 0 1 ${r} -${r}z`,
    as: "fill",
    colour,
  };
}

/**
 * Seen from the front: a tall stone chimney of staggered courses under a pale cap stone, rising through a sloped plank roof.
 * A puff of smoke drifts up from the top.
 */
export const CHIMNEY_DRAWING: BackpackIconDrawing = {
  colour: STONE,
  parts: [
    // Smoke rising from the top.
    { d: "M13.2 3.4a1.6 1.6 0 1 1 3.2 0a1.3 1.3 0 1 1 2.4 1a1.4 1.4 0 0 1-1.4 1.4h-3a1.2 1.2 0 0 1-1.2-2.4z", as: "fill", colour: SMOKE },
    // The chimney: mortar behind five staggered courses of stones.
    { d: "M8.4 7.4h7.2v14.1H8.4z", as: "fill", colour: MORTAR },
    stone(8.4, 7.6, 11.6, 10.3, STONE),
    stone(12.1, 7.6, 15.6, 10.3, STONE_WARM),
    stone(8.4, 10.8, 10, 13.5, STONE_WARM),
    stone(10.5, 10.8, 15.6, 13.5, STONE),
    stone(8.4, 14, 12.6, 16.7, STONE),
    stone(13.1, 14, 15.6, 16.7, STONE_WARM),
    stone(8.4, 17.2, 10.6, 19.9, STONE_WARM),
    stone(11.1, 17.2, 15.6, 19.9, STONE),
    // The cap stone, a pale slab wider than the chimney, with light along its top edge.
    stone(7.4, 5.8, 16.6, 7.8, STONE_LIGHT),
    { d: "M8.4 6.5h7.2", as: "shine" },
    // The roof the chimney passes through: plank rows sloping down to the right, in front of its foot.
    { d: "M2 15.5L22 19.5V22.5L2 18.5z", as: "fill", colour: ROOF },
    { d: "M2 18.5L22 22.5V23L2 19z", as: "fill", colour: ROOF_DARK },
    { d: "M4 16.4L20 19.6", as: "shine" },
  ],
};
