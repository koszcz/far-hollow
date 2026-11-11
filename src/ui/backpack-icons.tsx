// Coloured icons for the things in the backpack, the approved "backpack-icons" asset in asset-manifest.json. Built in code.
// Added by hud-icons ticket 01. The owner approved the two-tone version on 2026-11-11.
// Each icon is drawn on a 24 by 24 grid in a main colour and an accent, such as a wooden handle on a steel blade. Shape and colour together tell the items apart.
import type { BackpackContent } from "../sim/api";

/**
 * One part of an icon. `fill` is a filled shape and `line` is a thick stroke. A part takes the icon's main colour,
 * or its own `colour` when it has one, so tools can show a wooden handle and a steel blade.
 * `cut` and `cutLine` draw in the chip's background colour, to carve detail out of a filled shape.
 */
interface IconPart {
  d: string;
  as: "fill" | "line" | "cut" | "cutLine";
  colour?: string;
}

interface BackpackIconDrawing {
  colour: string;
  parts: readonly IconPart[];
}

/** The background of a backpack chip. Cut parts use it, so it must match `.hud-backpack li` in style.css. */
const CHIP_BACKGROUND = "#3d2b1e";

/** Colours shared by several icons. */
const WOOD = "#c0763a";
const STEEL = "#b8c4cc";
const LEAF = "#7fb069";

/** A circle path, centred on (x, y) with radius r. */
function circle(x: number, y: number, r: number): string {
  return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}

/** One split piece of firewood seen from its end: pale end grain, with bark along the curved outer side. */
function splitPiece(x: number, y: number): IconPart[] {
  return [
    { d: `M${x} ${y - 4.5}L${x + 4.8} ${y + 2}Q${x} ${y + 5.5} ${x - 4.8} ${y + 2}z`, as: "fill" },
    { d: `M${x + 4.8} ${y + 2}Q${x} ${y + 5.5} ${x - 4.8} ${y + 2}`, as: "line", colour: "#a0643a" },
  ];
}

/** The pot body, rim, and side handles, shared by the three pot icons. */
const POT: readonly IconPart[] = [
  { d: "M5 9.5h14v6.5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z", as: "fill" },
  { d: "M3 9.5h18M5 12.5H3M19 12.5h2", as: "line", colour: "#dde5ea" },
];

/** A wave across the pot body, showing the water inside. */
const POT_WAVE = "M7.5 15.5c1.5-1.2 3 1.2 4.5 0s3 1.2 4.5 0";

const DRAWINGS: Readonly<Record<BackpackContent, BackpackIconDrawing>> = {
  /** A steel axe head on a red-painted handle. */
  axe: {
    colour: STEEL,
    parts: [
      { d: "M14.5 6.5L3.5 20.5", as: "line", colour: "#d0533f" },
      { d: "M10.5 3h5.5c3.5 0 5.5 3.2 5.5 6s-1.8 4.5-4 4.5l-2.8-2.8h-4.2z", as: "fill" },
      { d: "M18.5 5.5c1.2 1 1.8 2.4 1.8 3.8", as: "cutLine" },
    ],
  },
  /** A bright blade with a curved back, and a wooden handle. */
  knife: {
    colour: "#e6edf2",
    parts: [
      { d: "M9.5 14.5L20.5 3c1.5 4.8-.5 9.5-8 14z", as: "fill" },
      { d: "M2.5 20l5.5-5.5 2.5 2.5-5.5 5.5z", as: "fill", colour: WOOD },
    ],
  },
  /** A long curved blue-steel blade with a wooden handle at each end. */
  drawknife: {
    colour: "#9fc0d8",
    parts: [
      { d: "M4.5 10.5h15c-1 4.5-4.2 6.5-7.5 6.5s-6.5-2-7.5-6.5z", as: "fill" },
      { d: "M4.5 10.5L2.5 4.5M19.5 10.5l2-6", as: "line", colour: "#d9a066" },
    ],
  },
  /** A steel loop with orange sparks flying up. */
  fireStriker: {
    colour: STEEL,
    parts: [
      { d: "M7 12.5h10a4 4 0 0 1 0 8H7a4 4 0 0 1 0-8zm1 2.5a1.5 1.5 0 0 0 0 3h8a1.5 1.5 0 0 0 0-3z", as: "fill" },
      { d: "M12 3v5M6.5 4.5l2 3.5M17.5 4.5l-2 3.5", as: "line", colour: "#ffb340" },
    ],
  },
  /** A green bedroll, rolled up, with two leather straps and its spiral end towards the viewer. */
  bedroll: {
    colour: "#6f9a5a",
    parts: [
      { d: "M8 6.5h9a5.5 5.5 0 0 1 0 11H8z", as: "fill" },
      { d: "M14.5 6.5v11M19 7.3v9.4", as: "line", colour: "#c8975f" },
      { d: circle(8, 12, 5.5), as: "fill", colour: "#a8cf8f" },
      { d: "M7 12a1.2 1.2 0 1 1 2.4 0a2.4 2.4 0 1 1-4.8 0a3.6 3.6 0 1 1 7.2 0", as: "cutLine" },
    ],
  },
  /** A branch with a side twig and a green leaf, so it never reads as a tool handle. */
  stick: {
    colour: "#c08a55",
    parts: [
      { d: "M3.5 20.5L20 4M11.5 12.5l5 1M8 16l-1.5-4.5", as: "line" },
      { d: "M16.5 13.5c1-2.8 3.8-3.6 6-2.8-.6 2.8-3.4 4-6 2.8z", as: "fill", colour: LEAF },
    ],
  },
  /** Three split pieces of firewood stacked in a pile, end on. */
  firewood: {
    colour: "#e8b878",
    parts: [...splitPiece(6.8, 15.5), ...splitPiece(17.2, 15.5), ...splitPiece(12, 6.5)],
  },
  /** A peeled strip of bark, with its pale inner side showing where the end rolls into a curl. */
  bark: {
    colour: "#a8794c",
    parts: [
      { d: "M2.5 7.5c4-1.5 8.5-1.5 12.5-1v9c-4-.5-8.5-.5-12.5 1z", as: "fill" },
      { d: "M15 6.5a4.5 4.5 0 1 1 0 9", as: "line", colour: "#e0bf8f" },
    ],
  },
  /** Three red berries on a green stem with a leaf. */
  berries: {
    colour: "#e05565",
    parts: [
      { d: circle(7.5, 15.5, 4), as: "fill" },
      { d: circle(16, 16, 4), as: "fill" },
      { d: circle(12, 9.5, 3.8), as: "fill" },
      { d: "M12 6c0-1.5 1-3 3-3.5", as: "line", colour: LEAF },
      { d: "M14 4c1.5-2 4.2-2.5 6.5-1.5-1.5 2.2-4.2 2.8-6.5 1.5z", as: "fill", colour: LEAF },
    ],
  },
  /** A brown cap with pale spots, on a pale stem. */
  mushroom: {
    colour: "#c8643a",
    parts: [
      { d: "M9.5 12h5v7a2.5 2.5 0 0 1-5 0z", as: "fill", colour: "#ead8b8" },
      { d: "M2.5 12.5a9.5 8.5 0 0 1 19 0z", as: "fill" },
      { d: circle(7.5, 9, 1.3), as: "fill", colour: "#f3e6d3" },
      { d: circle(14.5, 7, 1.5), as: "fill", colour: "#f3e6d3" },
      { d: circle(17, 10.5, 1), as: "fill", colour: "#f3e6d3" },
    ],
  },
  /** An empty steel pot. */
  pot: { colour: "#9aa6b0", parts: POT },
  /** A steel pot with a blue wave across it. */
  potOfRiverWater: { colour: "#9aa6b0", parts: [...POT, { d: POT_WAVE, as: "line", colour: "#4f9fd0" }] },
  /** A steel pot with a pale blue wave and white steam rising from it. */
  potOfBoiledWater: {
    colour: "#9aa6b0",
    parts: [
      ...POT,
      { d: POT_WAVE, as: "line", colour: "#bfe3f5" },
      { d: "M9 7c-1.3-1.3 1.3-2.5 0-4.5M15 7c-1.3-1.3 1.3-2.5 0-4.5", as: "line", colour: "#f4f8fa" },
    ],
  },
};

/** Draws the icon for one kind of backpack content. Screen readers skip it, because a hidden text label always goes with it. */
export function BackpackIcon({ content }: { content: BackpackContent }) {
  const drawing = DRAWINGS[content];
  return (
    <svg class="backpack-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {drawing.parts.map(({ d, as, colour }, index) => {
        const paint = as === "cut" || as === "cutLine" ? CHIP_BACKGROUND : (colour ?? drawing.colour);
        return as === "fill" || as === "cut" ? (
          <path key={index} d={d} fill={paint} fill-rule="evenodd" />
        ) : (
          <path key={index} d={d} fill="none" stroke={paint} stroke-width={as === "line" ? 2.6 : 1.8} stroke-linecap="round" stroke-linejoin="round" />
        );
      })}
    </svg>
  );
}
