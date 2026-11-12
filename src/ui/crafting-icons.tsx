// Backpack icons for the things crafting uses or makes, the approved "crafting-icons" asset in asset-manifest.json. Built in code.
// Added by crafting ticket 01. Crafting ticket 03 added the plank. The owner approved the bow saw version on 2026-11-12. BackpackIcon in backpack-icons.tsx draws them, in the same style as the approved "backpack-icons".
// The saw is a bow saw: the saw blade strung across a stick bent into a bow.
import type { BackpackContent, CraftingContent } from "../sim/api";
import type { BackpackIconDrawing } from "./icon-drawing";

const STEEL = "#b8c4cc";
/** The same colour as the stick icon, because the saw's frame is made of sticks. */
const STICK = "#c08a55";
const TWINE = "#eadbb0";
const PLANK = "#e3bd85";
const PLANK_SIDE = "#c48f55";
const GRAIN = "#a8774a";

/** A circle path, centred on (x, y) with radius r. */
function circle(x: number, y: number, r: number): string {
  return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}

/**
 * The outline of a blade with its teeth, as one filled shape.
 * The blade runs from `left` to `right` between `top` and `bottom`, and each tooth is 2 wide and `toothHeight` tall.
 */
function bladeOutline(left: number, right: number, top: number, bottom: number, toothHeight: number): [number, number][] {
  const points: [number, number][] = [
    [left, top],
    [right, top],
    [right, bottom],
  ];
  for (let x = right; x > left; x -= 2) {
    points.push([x - 1, bottom + toothHeight], [x - 2, bottom]);
  }
  return points;
}

/** The angle the lone saw blade lies at, in degrees. Negative turns it so its right end rises. */
const BLADE_TILT = -28;

/** Turns a point about the centre of the icon grid by `BLADE_TILT`. */
function tilt([x, y]: [number, number]): [number, number] {
  const angle = (BLADE_TILT * Math.PI) / 180;
  const dx = x - 12;
  const dy = y - 12;
  const round = (n: number) => Math.round(n * 100) / 100;
  return [round(12 + dx * Math.cos(angle) - dy * Math.sin(angle)), round(12 + dx * Math.sin(angle) + dy * Math.cos(angle))];
}

/** A path through `points`. `closed` joins the last point back to the first. */
function path(points: [number, number][], closed: boolean): string {
  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join("") + (closed ? "z" : "");
}

/** True if `content` is something crafting uses or makes, so this module draws its icon. */
export function isCraftingContent(content: BackpackContent): content is CraftingContent {
  return Object.hasOwn(CRAFTING_DRAWINGS, content);
}

export const CRAFTING_DRAWINGS: Readonly<Record<CraftingContent, BackpackIconDrawing>> = {
  /** A long, thin steel blade lying at a slant, with big teeth along its lower edge and a pin hole at each end. */
  sawBlade: {
    colour: STEEL,
    parts: [
      { d: path(bladeOutline(2, 22, 9.5, 12.5, 2.2).map(tilt), true), as: "fill" },
      { d: circle(...tilt([4, 11]), 0.9), as: "cut" },
      { d: circle(...tilt([20, 11]), 0.9), as: "cut" },
      { d: path([tilt([6.5, 10.3]), tilt([17.5, 10.3])], false), as: "shine" },
    ],
  },
  /** A bow saw: the blade strung across the ends of a stick bent into a bow, lashed on with twine. */
  saw: {
    colour: STEEL,
    parts: [
      { d: path(bladeOutline(3, 21, 15.5, 17.5, 2), true), as: "fill" },
      { d: "M6 16.1h12", as: "shine" },
      { d: "M4 17C3 8 7.5 4 12 4s9 4 8 13", as: "line", colour: STICK },
      { d: "M2.8 15.2l2.4 1M2.8 16.8l2.4 1M21.2 15.2l-2.4 1M21.2 16.8l-2.4 1", as: "shine", colour: TWINE },
    ],
  },
  /** A pale sawn board lying at a slant, with its square end facing the viewer and grain lines along its face. */
  plank: {
    colour: PLANK,
    parts: [
      { d: "M2 14L15.5 5.5 22 8.5 8.5 17z", as: "fill" },
      { d: "M2 14l6.5 3v3L2 17z", as: "fill", colour: PLANK_SIDE },
      { d: "M8.5 17L22 8.5v3L8.5 20z", as: "fill", colour: PLANK_SIDE },
      { d: "M6.2 13.7l9.5-6M8.3 14.7l9.5-5.7", as: "shine", colour: GRAIN },
    ],
  },
};
