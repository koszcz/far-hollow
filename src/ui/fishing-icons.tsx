// Backpack icons for fishing gear, the draft "fishing-icons" asset in asset-manifest.json. Built in code.
// Added by fishing ticket 01. BackpackIcon in backpack-icons.tsx draws them, in the same style as the approved "backpack-icons".
import type { BackpackContent, FishingContent } from "../sim/api";
import type { BackpackIconDrawing } from "./icon-drawing";

/** The same colour as the stick icon, because the rod and the winder are made of sticks. */
const STICK = "#c08a55";
const LINE = "#ece6d2";
const LINE_SHADOW = "#a89f86";
const TWINE = "#eadbb0";
const HOOK = "#b8c4cc";

/** True if `content` is fishing gear, so this module draws its icon. */
export function isFishingContent(content: BackpackContent): content is FishingContent {
  return Object.hasOwn(FISHING_DRAWINGS, content);
}

export const FISHING_DRAWINGS: Readonly<Record<FishingContent, BackpackIconDrawing>> = {
  /** A wooden winder with pale line wound round its middle, and a steel hook on the loose end. */
  fishingLine: {
    colour: LINE,
    parts: [
      { d: "M4 4h12v3.5h-2.5v9H16V20H4v-3.5h2.5v-9H4z", as: "fill", colour: STICK },
      { d: "M5.5 8h9v8h-9z", as: "fill" },
      { d: "M6 10h8M6 12h8M6 14h8", as: "shine", colour: LINE_SHADOW },
      { d: "M14.5 15c3 0 4.5 0.5 4.5 2.5", as: "shine", colour: LINE },
      { d: "M19 17v2.5a1.6 1.6 0 0 1-3.2 0", as: "line", colour: HOOK },
    ],
  },
  /** A thin rod lying at a slant, thicker at the butt and lashed with twine, with the line and hook hanging from its tip. */
  fishingRod: {
    colour: STICK,
    parts: [
      { d: "M2 20.3L19.4 2.6 20.2 3.4 3.7 22z", as: "fill" },
      { d: "M4 18.7l1.6 1.6M5.2 17.5l1.6 1.6", as: "shine", colour: TWINE },
      { d: "M19.8 3V15", as: "shine", colour: LINE },
      { d: "M19.8 15v2.2a1.6 1.6 0 0 1-3.2 0", as: "line", colour: HOOK },
    ],
  },
};
