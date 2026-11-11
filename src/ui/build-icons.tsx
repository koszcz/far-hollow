// Coloured icons for the build menu, the approved "build-icons" asset in asset-manifest.json. Built in code.
// Added by hud-icons ticket 02. The owner approved the version drawn from each structure's model on 2026-11-11.
// One icon per structure the player can build, and one for each build material that is not a backpack content.
// Each icon is drawn from its structure's approved model: pale debarked logs, curled bark strips, and stones, in the model's own colours.
// They use the same shaded style and renderer as the backpack icons in backpack-icons.tsx, drawn on a 24 by 24 grid.
import type { BuildMaterial, StructureKind } from "../sim/api";
import { BackpackIcon, ShadedIcon } from "./backpack-icons";
import type { BackpackIconDrawing as IconDrawing, IconPart } from "./icon-drawing";

/** The pale wood of a debarked log, its paler cut end, and the darker grain and growth rings on it. */
const DEBARKED = "#e3c38f";
const DEBARKED_SHADE = "#cfa66c";
const CUT_END = "#f3dcae";
const GRAIN = "#c09a60";

/** Bark: dark on the outside, pale on the inside, as the lean-to and roof models show it. */
const BARK = "#8a5f3a";
const BARK_DARK = "#7a5232";
const BARK_LIGHT = "#a07045";
const BARK_INSIDE = "#e0bf8f";

/** The colour of a stick, matching the stick backpack icon. */
const STICK = "#c08a55";

/** A circle path, centred on (x, y) with radius r. */
function circle(x: number, y: number, r: number): string {
  return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}

/** The cut end of a debarked log, seen end on: pale wood with one growth ring. */
function cutEnd(x: number, y: number, r: number): IconPart[] {
  return [
    { d: circle(x, y, r), as: "fill", colour: CUT_END },
    { d: circle(x, y, r * 0.45), as: "shine", colour: GRAIN },
  ];
}

/** A debarked log lying on its side, from x0 to x1 at height y, with radius r. Its cut end faces left and a grain line runs along it. */
function sideLog(x0: number, x1: number, y: number, r: number, colour = DEBARKED): IconPart[] {
  return [
    { d: `M${x0} ${y - r}H${x1}a${r} ${r} 0 0 1 0 ${2 * r}H${x0}z`, as: "fill", colour },
    { d: `M${x0 + r + 1.5} ${y - r * 0.3}H${x1 - 1}`, as: "shine", colour: GRAIN },
    ...cutEnd(x0, y, r),
  ];
}

/** A log with its bark on, seen end on: pale end grain inside a dark bark ring. */
function barkLogEnd(x: number, y: number, r: number): IconPart[] {
  return [
    { d: circle(x, y, r), as: "fill", colour: BARK_DARK },
    { d: circle(x, y, r * 0.68), as: "fill", colour: CUT_END },
  ];
}

/**
 * One row of bark strips on the roof, from yTop down to yBottom. The roof is seen from the front and a little above,
 * so its sides lean left as they come forward. The row's lower edge is ragged, like the curled strips on the model.
 */
function barkRow(yTop: number, yBottom: number, colour: string): IconPart {
  const left = (y: number) => 5 - (y - 4) * 0.25;
  const right = (y: number) => 22 - (y - 4) * 0.25;
  const x0 = left(yBottom);
  const x1 = right(yBottom);
  const teeth = 5;
  let edge = "";
  for (let i = teeth; i >= 0; i -= 1) {
    const x = x0 + ((x1 - x0) * i) / teeth;
    edge += `L${x.toFixed(2)} ${(i % 2 === 0 ? yBottom : yBottom - 0.9).toFixed(2)}`;
  }
  return { d: `M${left(yTop)} ${yTop}H${right(yTop)}${edge}z`, as: "fill", colour };
}

const STRUCTURE_DRAWINGS: Readonly<Record<StructureKind, IconDrawing>> = {
  /** A flame over a cone of sticks, inside a ring of grey stones. */
  campfire: {
    colour: "#ff8a3c",
    parts: [
      { d: "M6.5 19.5L10.5 12.5M17.5 19.5L13.5 12.5M12 19.5V14", as: "line", colour: STICK },
      { d: "M12 3c1 2.5 4.5 4 4.5 7.5a4.5 4.5 0 0 1-9 0c0-2 1.2-3.2 2.1-4 0 1.6.7 2.4 1.5 2.7C11 7.5 11.1 5.5 12 3z", as: "fill" },
      { d: "M12 8.5c.5 1.3 2.1 1.9 2.1 3.5a2.1 2.1 0 0 1-4.2 0c0-1.1 1-1.9 2.1-3.5z", as: "fill", colour: "#ffd25a" },
      { d: circle(3.4, 19.8, 2.2), as: "fill", colour: "#8f8a80" },
      { d: circle(20.6, 19.8, 2.2), as: "fill", colour: "#8f8a80" },
      { d: circle(7.7, 20.9, 2.3), as: "fill", colour: "#a29d92" },
      { d: circle(16.3, 20.9, 2.3), as: "fill", colour: "#a29d92" },
      { d: circle(12, 21.3, 2.3), as: "fill", colour: "#979288" },
    ],
  },
  /** Seen from the side: bark strips laid like shingles on a crooked stick rafter, propped on a forked front post. */
  leanTo: {
    colour: BARK,
    parts: [
      { d: "M17.5 21.5V12.8M17.5 13L16 10.6M17.5 13l1.5-2.4", as: "line", colour: STICK },
      { d: "M3.1 19.5L20.9 4.8", as: "line", colour: STICK },
      { d: "M1.5 17.5L7.7 12.4L10.9 16.3L4.7 21.4L4 18.7z", as: "fill" },
      { d: "M6.1 13.7L12.3 8.6L15.5 12.5L9.3 17.6L8.7 14.9z", as: "fill", colour: BARK_LIGHT },
      { d: "M10.8 9.9L17.5 4.3L20.7 8.2L14 13.8L13.3 11.1z", as: "fill" },
      { d: "M5.2 20.6L20.2 8.2", as: "shine", colour: BARK_INSIDE },
    ],
  },
  /** Seen from the front: four debarked logs side by side, resting on a cross beam with a leg under each end. */
  foundation: {
    colour: DEBARKED,
    parts: [
      { d: "M4.5 18.5V22M19.5 18.5V22", as: "line", colour: DEBARKED_SHADE },
      ...[4.5, 9.5, 14.5, 19.5].flatMap((x): IconPart[] => [
        { d: `M${x - 2.4} 13V6a2.4 1.6 0 0 1 4.8 0v7z`, as: "fill" },
        { d: `M${x} 6.5v3.5`, as: "shine", colour: GRAIN },
      ]),
      ...sideLog(2, 22, 16.8, 1.7, DEBARKED_SHADE),
      ...cutEnd(4.5, 13, 2.5),
      ...cutEnd(9.5, 13, 2.5),
      ...cutEnd(14.5, 13, 2.5),
      ...cutEnd(19.5, 13, 2.5),
    ],
  },
  /** Four debarked logs stacked into a wall, their cut ends to the left. */
  logWall: {
    colour: DEBARKED,
    parts: [
      ...sideLog(4.5, 19.5, 19, 2.4),
      ...sideLog(4.5, 20, 14, 2.4, DEBARKED_SHADE),
      ...sideLog(4.5, 19, 9, 2.4),
      ...sideLog(4.5, 19.5, 4, 2.4, DEBARKED_SHADE),
    ],
  },
  /** Two debarked-log posts under a lintel, framing an open doorway, standing on a foundation log. */
  doorFrame: {
    colour: DEBARKED,
    parts: [
      { d: "M4 20V6.5h3.5V20zM16.5 20V6.5H20V20z", as: "fill" },
      { d: "M5.7 8.5v9M18.2 8.5v9", as: "shine", colour: GRAIN },
      ...sideLog(2.5, 21.5, 4.6, 2.3, DEBARKED_SHADE),
      ...sideLog(1.5, 22.5, 21.3, 1.6, DEBARKED_SHADE),
    ],
  },
  /** A gently sloped roof of four bark rows, each lapping over the one in front, with three log rafter ends under its front edge on a wall log. */
  roof: {
    colour: BARK,
    parts: [
      ...sideLog(2.5, 20, 20.6, 1.7, DEBARKED_SHADE),
      ...cutEnd(4.5, 17.9, 1.6),
      ...cutEnd(10.5, 17.9, 1.6),
      ...cutEnd(16.5, 17.9, 1.6),
      barkRow(13, 16.6, BARK_DARK),
      barkRow(10, 13.6, BARK),
      barkRow(7, 10.6, BARK_DARK),
      barkRow(4, 7.6, BARK),
      { d: "M5.5 4.8H21", as: "shine", colour: BARK_INSIDE },
    ],
  },
  /** Seen end on: logs, debarked logs, and firewood stacked in layers between two stakes, on a rail. */
  woodpile: {
    colour: DEBARKED,
    parts: [
      { d: "M2.5 22V8.5M21.5 22V8.5", as: "line", colour: DEBARKED_SHADE },
      { d: "M1.5 22.2h21", as: "line", colour: DEBARKED_SHADE },
      ...barkLogEnd(5.4, 18.6, 2.3),
      ...barkLogEnd(9.8, 18.6, 2.3),
      ...barkLogEnd(14.2, 18.6, 2.3),
      ...barkLogEnd(18.6, 18.6, 2.3),
      ...cutEnd(7.6, 14.6, 2.3),
      ...cutEnd(12, 14.6, 2.3),
      ...cutEnd(16.4, 14.6, 2.3),
      { d: "M9.8 8.2L12.2 12.6H7.4z", as: "fill", colour: "#e8b878" },
      { d: "M14.2 8.2L16.6 12.6H11.8z", as: "fill", colour: "#e8b878" },
    ],
  },
  /** A pale debarked beam resting in the crook of two pairs of crossed legs. */
  sawhorse: {
    colour: DEBARKED,
    parts: [
      { d: "M9.6 21L3.6 6M21.6 21L15.6 6", as: "line", colour: DEBARKED_SHADE },
      ...sideLog(1.5, 22.5, 9.5, 2),
      { d: "M2.4 21L8.4 6M14.4 21L20.4 6", as: "line", colour: DEBARKED_SHADE },
    ],
  },
  /** A rough plank chest: corner posts, three planks a side, a grip at each end, and a plank lid with two battens. */
  chest: {
    colour: "#cf9f62",
    parts: [
      { d: "M1.8 14h2v2.5h-2zM20.2 14h2v2.5h-2z", as: "fill", colour: "#a8763f" },
      { d: "M3.5 12h17v9h-17z", as: "fill" },
      { d: "M6 15.1h12M6 18h12", as: "cutLine" },
      { d: "M3.5 12h2.5v9H3.5zM18 12h2.5v9H18z", as: "fill", colour: "#b38350" },
      { d: "M2.5 11L4.5 5.5h15L21.5 11z", as: "fill", colour: "#d9ac70" },
      { d: "M4 9.2h16M3.4 7.4h17.2", as: "shine", colour: "#a8763f" },
      { d: "M7 11l.7-5.5h1.8L9 11zM15 11l-.5-5.5h1.8L17 11z", as: "fill", colour: "#a8763f" },
      { d: "M2.5 11h19v1.4h-19z", as: "fill", colour: "#c49158" },
    ],
  },
};

/** Build materials that are not backpack contents, so they have no backpack icon. */
type DeliveredOnlyMaterial = Exclude<BuildMaterial, "stick" | "bark">;

const MATERIAL_DRAWINGS: Readonly<Record<DeliveredOnlyMaterial, IconDrawing>> = {
  /** A pale, peeled log on its side, with grain lines and growth rings on its cut end. */
  debarkedLog: {
    colour: DEBARKED,
    parts: [
      { d: "M6 7.5h12a4.5 4.5 0 0 1 0 9H6z", as: "fill" },
      { d: "M10 10.5h7M9 13.5h5", as: "line", colour: GRAIN },
      { d: circle(6, 12, 4.5), as: "fill", colour: CUT_END },
      { d: circle(6, 12, 2), as: "line", colour: GRAIN },
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
