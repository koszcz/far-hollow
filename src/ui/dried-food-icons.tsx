// Backpack icons for dried berries and a dried mushroom, the draft "dried-food-icons" asset in asset-manifest.json. Built in code.
// Added by food-keeping ticket 02. BackpackIcon in backpack-icons.tsx draws them, in the same style as the approved "backpack-icons".
// Each looks like its fresh food, shrunk, darker, and wrinkled, so the player tells the dried kind from the fresh one at a glance.
import type { BackpackContent, PreservedFood } from "../sim/api";
import type { BackpackIconDrawing } from "./icon-drawing";

/** A circle path, centred on (x, y) with radius r. */
function circle(x: number, y: number, r: number): string {
  return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}

/** Dried berries: a dark wine red, with a darker crease across each. */
const DRIED_BERRY = "#8c2f3f";
const DRIED_BERRY_CREASE = "#4f1822";
/** A dried mushroom: a leathery brown cap and a pale tan stem, with dark wrinkles. */
const DRIED_CAP = "#8a5a36";
const DRIED_STEM = "#c9b38c";
const DRIED_WRINKLE = "#4a2e1a";
/** The twine the dried berries are threaded on. */
const TWINE = "#d8c08a";

/** The dried foods this module draws. Smoked fish is drawn in smoked-fish-icon.tsx. */
export type DriedFood = Exclude<PreservedFood, "smokedFish">;

/** True if `content` is dried food, so this module draws its icon. */
export function isDriedFood(content: BackpackContent): content is DriedFood {
  return Object.hasOwn(DRIED_FOOD_DRAWINGS, content);
}

export const DRIED_FOOD_DRAWINGS: Readonly<Record<DriedFood, BackpackIconDrawing>> = {
  /** Five small shrivelled berries, darker than fresh ones, each with a crease, under a loop of twine. */
  driedBerries: {
    colour: DRIED_BERRY,
    parts: [
      { d: "M4 6.5Q12 2 20 6.5", as: "line", colour: TWINE },
      { d: circle(6, 11, 2.8), as: "fill" },
      { d: circle(11.5, 9.5, 2.8), as: "fill" },
      { d: circle(17.5, 11, 2.8), as: "fill" },
      { d: circle(8.5, 17, 2.8), as: "fill" },
      { d: circle(15, 17.5, 2.8), as: "fill" },
      {
        d: "M4.8 11.6q1.2-1 2.4 0M10.3 10.1q1.2-1 2.4 0M16.3 11.6q1.2-1 2.4 0M7.3 17.6q1.2-1 2.4 0M13.8 18.1q1.2-1 2.4 0",
        as: "line",
        colour: DRIED_BERRY_CREASE,
      },
    ],
  },
  /** A shrunken mushroom with a flat, wrinkled brown cap curling at the rim, on a thin tan stem. */
  driedMushroom: {
    colour: DRIED_CAP,
    parts: [
      { d: "M10.5 12h3v7.5a1.5 1.5 0 0 1-3 0z", as: "fill", colour: DRIED_STEM },
      { d: "M3.5 13q1-6.5 8.5-7t8.5 7q-2.5-1.2-4.2 0-2.2-1.2-4.3 0-2.1-1.2-4.3 0-2-1.2-4.2 0z", as: "fill" },
      { d: "M7 10.5q2-1.6 3.5-.5M12.5 8.5q2.2-.6 3.8 1M8.5 12.2q1.6-.8 3-.2", as: "line", colour: DRIED_WRINKLE },
    ],
  },
};
