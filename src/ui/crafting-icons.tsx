// Backpack icons for the things crafting uses or makes, the draft "crafting-icons" asset in asset-manifest.json. Built in code.
// Added by crafting ticket 01. BackpackIcon in backpack-icons.tsx draws them, in the same style as the approved "backpack-icons".
import type { CraftingContent } from "../sim/api";
import type { BackpackIconDrawing } from "./icon-drawing";

const STEEL = "#b8c4cc";
const WOOD = "#c0763a";

/** Teeth along the lower edge of a blade that starts at `x` and has `count` teeth. */
function teeth(x: number, count: number): string {
  return `M${x} 15.5` + "l.75 2 .75-2".repeat(count);
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
};
