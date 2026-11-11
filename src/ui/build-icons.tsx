// Coloured icons for the build menu, the draft "build-icons" asset in asset-manifest.json. Built in code. Awaiting owner approval.
// One icon per structure the player can build, and one for each build material that is not a backpack content.
// They use the same shaded style and renderer as the backpack icons in backpack-icons.tsx, drawn on a 24 by 24 grid.
import type { BuildMaterial, StructureKind } from "../sim/api";
import { BackpackIcon, ShadedIcon } from "./backpack-icons";
import type { BackpackIconDrawing as IconDrawing } from "./icon-drawing";

/** Colours shared by several icons. */
const WOOD = "#c0763a";
const DARK_WOOD = "#8a5530";
const END_GRAIN = "#e8c890";
const STEEL = "#b8c4cc";
const LEAF = "#7fb069";

/** A circle path, centred on (x, y) with radius r. */
function circle(x: number, y: number, r: number): string {
  return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}

/** A log lying on its side, from x0 to x1 at height y, with radius r. Its pale cut end faces left. */
function sideLog(x0: number, x1: number, y: number, r: number): IconDrawing["parts"] {
  return [
    { d: `M${x0} ${y - r}H${x1}a${r} ${r} 0 0 1 0 ${2 * r}H${x0}z`, as: "fill" },
    { d: circle(x0, y, r), as: "fill", colour: END_GRAIN },
  ];
}

/** A log seen from its end: pale end grain inside a bark ring. */
function logEnd(x: number, y: number): IconDrawing["parts"] {
  return [
    { d: circle(x, y, 3.2), as: "fill", colour: "#7a4a2a" },
    { d: circle(x, y, 2.2), as: "fill", colour: END_GRAIN },
  ];
}

const STRUCTURE_DRAWINGS: Readonly<Record<StructureKind, IconDrawing>> = {
  /** A yellow and orange flame over two crossed logs. */
  campfire: {
    colour: "#ff8a3c",
    parts: [
      { d: "M4 20.5L20 15.5M4 15.5l16 5", as: "line", colour: DARK_WOOD },
      { d: "M12 2.5c1.3 3.2 5.5 5 5.5 9.5a5.5 5.5 0 0 1-11 0c0-2.5 1.5-4 2.6-5 0 2 .9 3 1.9 3.4C10.8 8 10.9 5.5 12 2.5z", as: "fill" },
      { d: "M12 9c.6 1.6 2.6 2.4 2.6 4.4a2.6 2.6 0 0 1-5.2 0c0-1.4 1.2-2.4 2.6-4.4z", as: "fill", colour: "#ffd25a" },
    ],
  },
  /** A sloped roof of poles, thatched with leaves, propped on one post. */
  leanTo: {
    colour: WOOD,
    parts: [
      { d: "M18.5 7.5v13", as: "line", colour: DARK_WOOD },
      { d: "M2 19.5L18 5.5l2.5 2.5L5 21.5z", as: "fill" },
      { d: "M5.5 17l11-9.5", as: "line", colour: LEAF },
      { d: "M2 21.5h20", as: "line", colour: "#6b8a4a" },
    ],
  },
  /** A square floor of planks, seen from above at an angle, with a dark front edge. */
  foundation: {
    colour: "#c99a62",
    parts: [
      { d: "M2 13.5v3.5l10 5 10-5v-3.5l-10 5z", as: "fill", colour: DARK_WOOD },
      { d: "M2 13.5l10-5 10 5-10 5z", as: "fill" },
      { d: "M7 11l10 5M12 8.5l-5 9.5", as: "cutLine" },
    ],
  },
  /** Three logs stacked into a wall, their cut ends to the left. */
  logWall: {
    colour: "#a8693a",
    parts: [...sideLog(5, 18.5, 17.5, 3), ...sideLog(5, 18.5, 11.5, 3), ...sideLog(5, 18.5, 5.5, 3)],
  },
  /** Two posts under a beam, framing an open doorway. */
  doorFrame: {
    colour: WOOD,
    parts: [
      { d: "M4 21.5V3h16v18.5h-3.5V6.5h-9v15z", as: "fill" },
      { d: "M2.5 21.5h19", as: "line", colour: "#6b8a4a" },
    ],
  },
  /** A bare roof frame: two sloped rafters on a level beam, with no bark on them yet. */
  roofFrame: {
    colour: WOOD,
    parts: [
      { d: "M3 16.5L12 5.5l9 11", as: "line", colour: DARK_WOOD },
      { d: "M7.5 11h9", as: "line", colour: DARK_WOOD },
      ...sideLog(3, 21, 18, 2.5),
    ],
  },
  /** A pitched roof of red-brown shingles, with rows cut across it. */
  roof: {
    colour: "#a5513a",
    parts: [
      { d: "M1.5 15.5L12 4l10.5 11.5z", as: "fill" },
      { d: "M6.5 11h11M4 14h16", as: "cutLine" },
      { d: "M5 17.5h14v3.5H5z", as: "fill", colour: "#a8693a" },
    ],
  },
  /** Six log ends stacked into a pyramid. */
  woodpile: {
    colour: END_GRAIN,
    parts: [...logEnd(5.5, 18), ...logEnd(12, 18), ...logEnd(18.5, 18), ...logEnd(8.8, 12.2), ...logEnd(15.2, 12.2), ...logEnd(12, 6.4)],
  },
  /** A sawhorse: a beam on two pairs of splayed legs, with a log resting across it. */
  sawhorse: {
    colour: WOOD,
    parts: [
      { d: "M4 21l4-10M10 21L8 11M14 21l2-10M20 21l-4-10", as: "line", colour: DARK_WOOD },
      { d: "M3 9.5h18v2.5H3z", as: "fill" },
      ...sideLog(6, 18, 6.5, 2.5),
    ],
  },
  /** A wooden chest with a rounded lid, a steel band, and a lock. */
  chest: {
    colour: WOOD,
    parts: [
      { d: "M3 11h18v8.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5z", as: "fill" },
      { d: "M3 11V8.5A4.5 4.5 0 0 1 7.5 4h9A4.5 4.5 0 0 1 21 8.5V11z", as: "fill", colour: "#a8693a" },
      { d: "M3 11h18", as: "line", colour: STEEL },
      { d: "M10.5 10h3v4.5h-3z", as: "fill", colour: "#e0c060" },
    ],
  },
};

/** Build materials that are not backpack contents, so they have no backpack icon. */
type DeliveredOnlyMaterial = Exclude<BuildMaterial, "stick" | "bark">;

const MATERIAL_DRAWINGS: Readonly<Record<DeliveredOnlyMaterial, IconDrawing>> = {
  /** A pale, peeled log on its side, with grain lines and growth rings on its cut end. */
  debarkedLog: {
    colour: "#e3c38f",
    parts: [
      { d: "M6 7.5h12a4.5 4.5 0 0 1 0 9H6z", as: "fill" },
      { d: "M10 10.5h7M9 13.5h5", as: "line", colour: "#c09a60" },
      { d: circle(6, 12, 4.5), as: "fill", colour: "#f3dcae" },
      { d: circle(6, 12, 2), as: "line", colour: "#c09a60" },
    ],
  },
};

/** Draws the icon for one structure in the build menu. Screen readers skip it, because a text label always goes with it. */
export function StructureIcon({ structure }: { structure: StructureKind }) {
  return <ShadedIcon drawing={STRUCTURE_DRAWINGS[structure]} className="build-icon" />;
}

/** Draws the icon for one build material. Sticks and bark reuse their backpack icons. */
export function MaterialIcon({ material }: { material: BuildMaterial }) {
  if (material === "stick" || material === "bark") return <BackpackIcon content={material} />;
  return <ShadedIcon drawing={MATERIAL_DRAWINGS[material]} className="backpack-icon" />;
}
