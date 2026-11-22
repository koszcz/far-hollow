// The build menu icon for the fireplace, the approved "fireplace-icon" asset in asset-manifest.json. Built in code.
// Added by fireplace ticket 02. It is drawn on the same 24 by 24 grid, in the same shaded style, as the approved build icons in build-icons.tsx.
import type { BackpackIconDrawing, IconPart } from "./icon-drawing";

/** Grey river stone, matching the stone backpack icon, with a darker grey for the chimney and a pale grey for the dressed stones. */
const STONE = "#8f9498";
const STONE_WARM = "#989590";
const STONE_DARK = "#7c8185";
const STONE_LIGHT = "#b9bec2";
/** The mortar between the stones. It shows as thin dark joints. */
const MORTAR = "#55595c";
/** The sooty inside of the hearth, and the embers glowing at its back. */
const SOOT = "#3a3330";
const EMBER_GLOW = "#8a3f1c";
/** A small fire on a log, in the campfire icon's colours. */
const LOG = "#c08a55";
const FLAME = "#ff8a3c";
const FLAME_CORE = "#ffd25a";

/**
 * One stone: a rectangle with rounded corners, from (left, top) to (right, bottom).
 * Each stone is its own filled part, so the icon's shading gives every stone its own light and shadow.
 */
function stone(left: number, top: number, right: number, bottom: number, colour: string): IconPart {
  const r = 0.6;
  const w = right - left - 2 * r;
  const h = bottom - top - 2 * r;
  return {
    d: `M${left + r} ${top}h${w}a${r} ${r} 0 0 1 ${r} ${r}v${h}a${r} ${r} 0 0 1 -${r} ${r}h-${w}a${r} ${r} 0 0 1 -${r} -${r}v-${h}a${r} ${r} 0 0 1 ${r} -${r}z`,
    as: "fill",
    colour,
  };
}

/** An arch standing on the hearth floor at y 21.5, centred at x 12, with its round top centred at y 17.6. */
function arch(radius: number): string {
  return `M${12 - radius} 21.5V17.6a${radius} ${radius} 0 0 1 ${2 * radius} 0V21.5z`;
}

/**
 * Seen from the front: a squat fire box of stones laid in staggered courses, under a pale stone mantel.
 * A ring of dressed stone frames the arched opening. A small fire burns on a log inside, with embers glowing behind it.
 * A short chimney of darker stones, with a cap stone, rises from the back.
 */
export const FIREPLACE_DRAWING: BackpackIconDrawing = {
  colour: STONE,
  parts: [
    // The chimney: mortar behind two courses of stones, under a cap stone.
    { d: "M8.6 3.6h6.8v5.8H8.6z", as: "fill", colour: MORTAR },
    stone(8.6, 4.4, 11.8, 6.6, STONE_DARK),
    stone(12.3, 4.4, 15.4, 6.6, STONE_DARK),
    stone(8.6, 7.1, 10.4, 9.4, STONE_DARK),
    stone(10.9, 7.1, 15.4, 9.4, STONE_DARK),
    stone(7.6, 2.2, 16.4, 4.2, STONE_LIGHT),
    // The fire box: mortar behind three staggered courses of stones.
    { d: "M3 11.6h18v9.9H3z", as: "fill", colour: MORTAR },
    stone(3, 12.2, 6.8, 15, STONE),
    stone(7.3, 12.2, 11.6, 15, STONE_WARM),
    stone(12.1, 12.2, 16.7, 15, STONE),
    stone(17.2, 12.2, 21, 15, STONE_WARM),
    stone(3, 15.5, 5.4, 18.2, STONE_WARM),
    stone(5.9, 15.5, 18.1, 18.2, STONE),
    stone(18.6, 15.5, 21, 18.2, STONE),
    stone(3, 18.7, 6.6, 21.5, STONE),
    stone(7.1, 18.7, 16.9, 21.5, STONE_WARM),
    stone(17.4, 18.7, 21, 21.5, STONE_WARM),
    // The mantel, a long pale slab with light along its top edge.
    stone(2, 9, 22, 11.8, STONE_LIGHT),
    { d: "M3.4 9.9h17.2", as: "shine" },
    // The arched opening, framed by a ring of dressed stone with a mortar joint on each side.
    { d: arch(5.3), as: "fill", colour: MORTAR },
    { d: arch(4.8), as: "fill", colour: STONE_LIGHT },
    { d: arch(4.3), as: "fill", colour: MORTAR },
    { d: arch(4), as: "fill", colour: SOOT },
    { d: "M8.6 21.5c0-2.6 1.5-4.2 3.4-4.2s3.4 1.6 3.4 4.2z", as: "fill", colour: EMBER_GLOW },
    // The fire: the campfire icon's flame at half size, burning on a log.
    {
      d: "M12 14c.5 1.25 2.25 2 2.25 3.75a2.25 2.25 0 0 1-4.5 0c0-1 .6-1.6 1.05-2 0 .8.35 1.2.75 1.35C11.5 16.25 11.55 15.25 12 14z",
      as: "fill",
      colour: FLAME,
    },
    { d: "M12 16.75c.25.65 1.05.95 1.05 1.75a1.05 1.05 0 0 1-2.1 0c0-.55.5-.95 1.05-1.75z", as: "fill", colour: FLAME_CORE },
    { d: "M8.9 19.7h6.2a.85.85 0 0 1 0 1.7H8.9a.85.85 0 0 1 0-1.7z", as: "fill", colour: LOG },
  ],
};
