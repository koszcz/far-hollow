// Coloured icons for the things in the backpack, the draft "backpack-icons" asset in asset-manifest.json. Built in code.
// Added by hud-icons ticket 01; awaiting owner approval.
// Each icon is drawn on a 24 by 24 grid in one colour, so shape and colour together tell the items apart.
import type { BackpackContent } from "../sim/api";

/**
 * One part of an icon. `fill` is a filled shape and `line` is a thick stroke, both in the icon's colour.
 * `cut` and `cutLine` draw in the chip's background colour, to carve detail out of a filled shape.
 */
interface IconPart {
  d: string;
  as: "fill" | "line" | "cut" | "cutLine";
}

interface BackpackIconDrawing {
  colour: string;
  parts: readonly IconPart[];
}

/** The background of a backpack chip. Cut parts use it, so it must match `.hud-backpack li` in style.css. */
const CHIP_BACKGROUND = "#3d2b1e";

/** A circle path, centred on (x, y) with radius r. */
function circle(x: number, y: number, r: number): string {
  return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}

/** The pot body, rim, and side handles, shared by the three pot icons. */
const POT: readonly IconPart[] = [
  { d: "M5 10h14v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z", as: "fill" },
  { d: "M3 10h18M5 13H3M19 13h2", as: "line" },
];

const DRAWINGS: Readonly<Record<BackpackContent, BackpackIconDrawing>> = {
  /** A wide axe head on a diagonal handle. */
  axe: {
    colour: "#d9a066",
    parts: [
      { d: "M11 4h5c3 0 4.5 3 4.5 5.5S19 13 17 13l-2.5-2.5H11z", as: "fill" },
      { d: "M13 9L4 20", as: "line" },
    ],
  },
  /** A blade with a curved back, and a short handle. */
  knife: {
    colour: "#c9d3db",
    parts: [
      { d: "M9.5 14.5L20 3.5c1.5 4.5-.5 9-7.5 13.5z", as: "fill" },
      { d: "M3 19.5l5-5 2 2-5 5z", as: "fill" },
    ],
  },
  /** A long curved blade with a handle at each end. */
  drawknife: {
    colour: "#9fc0d8",
    parts: [
      { d: "M5 11h14c-1 4-4 5.5-7 5.5S6 15 5 11z", as: "fill" },
      { d: "M5 11L2.5 5.5M19 11l2.5-5.5", as: "line" },
    ],
  },
  /** A loop of steel with sparks flying up. */
  fireStriker: {
    colour: "#f0a040",
    parts: [
      { d: "M7 12h10a4 4 0 0 1 0 8H7a4 4 0 0 1 0-8zm1 2.5a1.5 1.5 0 0 0 0 3h8a1.5 1.5 0 0 0 0-3z", as: "fill" },
      { d: "M12 3v4.5M6.5 5l2 3M17.5 5l-2 3", as: "line" },
    ],
  },
  /** A rolled bedroll seen from the side, with its rolled end and a strap. */
  bedroll: {
    colour: "#86b06f",
    parts: [
      { d: "M8 6h8a6 6 0 0 1 0 12H8a6 6 0 0 1 0-12z", as: "fill" },
      { d: "M8 9.5a2.5 2.5 0 1 1 0 5M14 6v12", as: "cutLine" },
    ],
  },
  /** A stick with two side twigs. */
  stick: {
    colour: "#c08a55",
    parts: [{ d: "M4 20L20 4M12 12l5.5.5M8.5 15.5L7 11", as: "line" }],
  },
  /** Three split pieces stacked in a pile. */
  firewood: {
    colour: "#d4935a",
    parts: [
      { d: "M2.5 20.5l5-8.5 5 8.5z", as: "fill" },
      { d: "M11.5 20.5l5-8.5 5 8.5z", as: "fill" },
      { d: "M7 11.5L12 3l5 8.5z", as: "fill" },
    ],
  },
  /** A peeled strip of bark with its end rolled into a curl. */
  bark: {
    colour: "#a8794c",
    parts: [
      { d: "M3 7.5c4-1.5 8-1.5 12-1v8c-4-.5-8-.5-12 1z", as: "fill" },
      { d: "M15 6.5a4 4 0 1 1 0 8", as: "line" },
    ],
  },
  /** Three berries on a stem. */
  berries: {
    colour: "#e05565",
    parts: [
      { d: circle(8, 15, 3.6), as: "fill" },
      { d: circle(15.5, 15.5, 3.6), as: "fill" },
      { d: circle(12, 9.5, 3.4), as: "fill" },
      { d: "M12 6c0-1.5 1-3 3-3.5", as: "line" },
    ],
  },
  /** A spotted cap on a short stem. */
  mushroom: {
    colour: "#e8c9a0",
    parts: [
      { d: "M3 12a9 8 0 0 1 18 0z", as: "fill" },
      { d: "M9.5 12h5v6.5a2.5 2.5 0 0 1-5 0z", as: "fill" },
      { d: circle(8, 8.5, 1), as: "cut" },
      { d: circle(14.5, 7, 1.2), as: "cut" },
    ],
  },
  /** An empty pot. */
  pot: { colour: "#9aa6b0", parts: POT },
  /** A blue pot with a wave across it. */
  potOfRiverWater: { colour: "#6fa8c7", parts: [...POT, { d: "M8 15c1.3-1 2.7 1 4 0s2.7 1 4 0", as: "cutLine" }] },
  /** A pale pot with steam rising from it. */
  potOfBoiledWater: { colour: "#e8eef2", parts: [...POT, { d: "M9 7.5c-1.3-1.3 1.3-2.5 0-4.5M15 7.5c-1.3-1.3 1.3-2.5 0-4.5", as: "line" }] },
};

/** Draws the icon for one kind of backpack content. Screen readers skip it, because a hidden text label always goes with it. */
export function BackpackIcon({ content }: { content: BackpackContent }) {
  const { colour, parts } = DRAWINGS[content];
  return (
    <svg class="backpack-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {parts.map(({ d, as }, index) => {
        const paint = as === "cut" || as === "cutLine" ? CHIP_BACKGROUND : colour;
        return as === "fill" || as === "cut" ? (
          <path key={index} d={d} fill={paint} fill-rule="evenodd" />
        ) : (
          <path key={index} d={d} fill="none" stroke={paint} stroke-width={as === "line" ? 2.6 : 1.8} stroke-linecap="round" stroke-linejoin="round" />
        );
      })}
    </svg>
  );
}
