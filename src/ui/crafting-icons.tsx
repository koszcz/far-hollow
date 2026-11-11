// Backpack icons for the things crafting uses or makes, the draft "crafting-icons" asset in asset-manifest.json. Built in code.
// Added by crafting ticket 01. Crafting ticket 03 added the plank. BackpackIcon in backpack-icons.tsx draws them, in the same style as the approved "backpack-icons".
import type { BackpackContent, CraftingContent } from "../sim/api";
import type { BackpackIconDrawing } from "./icon-drawing";

const STEEL = "#b8c4cc";
const WOOD = "#c0763a";
const PLANK = "#e3bd85";

/** Teeth along the lower edge of a blade that starts at `x` and has `count` teeth. */
function teeth(x: number, count: number): string {
  return `M${x} 15.5` + "l.75 2 .75-2".repeat(count);
}

/** True if `content` is something crafting uses or makes, so this module draws its icon. */
export function isCraftingContent(content: BackpackContent): content is CraftingContent {
  return Object.hasOwn(CRAFTING_DRAWINGS, content);
}

export const CRAFTING_DRAWINGS: Readonly<Record<CraftingContent, BackpackIconDrawing>> = {
  /** A bare steel blade with teeth along its lower edge and a pin hole at each end. */
  sawBlade: {
    colour: STEEL,
    parts: [
      { d: "M3 9.5h18v6H3z", as: "fill" },
      { d: teeth(3, 12), as: "line" },
      { d: "M5.5 12.5h.1M18.5 12.5h.1", as: "cutLine" },
      { d: "M6.5 10.8h11", as: "shine" },
    ],
  },
  /** The same blade, fixed to a wooden handle on the left. */
  saw: {
    colour: STEEL,
    parts: [
      { d: "M8 9.5h14v6H8z", as: "fill" },
      { d: teeth(8, 9), as: "line" },
      { d: "M2 7.5h7v10H2z", as: "fill", colour: WOOD },
      { d: "M4 10.5h3v4H4z", as: "cut" },
      { d: "M10.5 10.8h9.5", as: "shine" },
    ],
  },
  /** A pale sawn board lying at a slant, with its square end facing the viewer and grain lines along its face. */
  plank: {
    colour: PLANK,
    parts: [
      { d: "M2.5 15.5 17 6.5l4.5 2-14.5 9z", as: "fill" },
      { d: "M2.5 15.5l4.5 2v2.5l-4.5-2z", as: "fill", colour: WOOD },
      { d: "M7 17.5l14.5-9v2.5L7 20z", as: "fill", colour: WOOD },
      { d: "M6.5 14.5l10-6.2M9 15.3l8.5-5.3", as: "cutLine" },
    ],
  },
};
