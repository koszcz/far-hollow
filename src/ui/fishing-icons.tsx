// Backpack icons for fishing gear and fish, the approved "fishing-icons" asset in asset-manifest.json. Built in code.
// Added by fishing ticket 01. Fishing ticket 02 added raw fish. The owner approved the polished version, with the coiled hank of line, on 2026-11-14. BackpackIcon in backpack-icons.tsx draws them, in the same style as the approved "backpack-icons".
import type { BackpackContent, Fish, FishingContent } from "../sim/api";
import type { BackpackIconDrawing } from "./icon-drawing";

/** The same colour as the stick icon, because the rod and the winder are made of sticks. */
const STICK = "#c08a55";
const LINE = "#ece6d2";
const LINE_SHADOW = "#a89f86";
const TWINE = "#eadbb0";
const HOOK = "#b8c4cc";
/** A river trout: grey-green back and a pale belly with pink along the side. */
const FISH_BACK = "#7f9a86";
const FISH_BELLY = "#e4d9c2";
const FISH_STRIPE = "#d99a94";
const FISH_EYE = "#2a2622";
const GILL = "#4c6354";

/** A thin steel hook with a barb, drawn as a filled J so it stays finer than a stroked line. One hangs from the hank, one from the rod tip. */
const HOOK_LINE = "M18.4 16.6H19.3V18.5A1.7 1.7 0 0 1 15.9 18.5V17.3L16.8 18V18.5A.8 .8 0 0 0 18.4 18.5Z";
const HOOK_ROD = "M19.35 15H20.25V16.5A1.7 1.7 0 0 1 16.85 16.5V15.3L17.75 16V16.5A.8 .8 0 0 0 19.35 16.5Z";

/** True if `content` is fishing gear or a fish, so this module draws its icon. */
export function isFishingContent(content: BackpackContent): content is FishingContent | Fish {
  return Object.hasOwn(FISHING_DRAWINGS, content);
}

export const FISHING_DRAWINGS: Readonly<Record<FishingContent | Fish, BackpackIconDrawing>> = {
  /** A loose hank of pale line, coiled into a loop and tied in two places, with a small steel hook on the loose end. */
  fishingLine: {
    colour: LINE,
    parts: [
      { d: "M4 10.4a7 5.4 0 1 0 14 0a7 5.4 0 1 0-14 0", as: "line" },
      { d: "M4.6 9.6a6.6 5 0 1 0 13.2 0a6.6 5 0 1 0-13.2 0", as: "line" },
      { d: "M4.6 9.6a6.6 5 0 0 1 13.2 0M5.2 12.2c2 3 10 3.4 12.2 0", as: "shine", colour: LINE_SHADOW },
      { d: "M3.2 8.2h2v3.6h-2zM17.3 8.2h2v3.6h-2z", as: "fill", colour: TWINE },
      { d: "M15.2 14.6c2 .5 3.4 1 3.65 2.2", as: "shine", colour: LINE },
      { d: HOOK_LINE, as: "fill", colour: HOOK },
    ],
  },
  /** A rod lying at a slant, thicker at the butt and lashed with two bands of twine, with the line and hook hanging from its tip. */
  fishingRod: {
    colour: STICK,
    parts: [
      { d: "M1.7 20.1L19.4 2.7 20.2 3.3 4.3 22.5z", as: "fill" },
      { d: "M6.84 19.93L4.03 17.36 3.22 18.25 6.03 20.82zM8.19 18.45L5.39 15.88 4.58 16.77 7.38 19.34z", as: "fill", colour: TWINE },
      { d: "M19.8 3V15", as: "shine", colour: LINE },
      { d: HOOK_ROD, as: "fill", colour: HOOK },
    ],
  },
  /** A whole raw trout lying on its side, head to the left: a grey-green back, a pale belly, a pink stripe, a gill line, a ringed eye, and a forked tail. */
  rawFish: {
    colour: FISH_BACK,
    parts: [
      { d: "M2.5 12c3-4.5 9-5.5 14-2.5L21.5 6v12l-5-3.5c-5 3-11 2-14-2.5z", as: "fill" },
      { d: "M4.5 13.5c3.5 2.5 8 2.6 11.5.6", as: "line", colour: FISH_BELLY },
      { d: "M8.6 11.3c2.6-.6 5.4-.5 7.9.3v1.3c-2.5-.7-5.3-.8-7.9-.2z", as: "fill", colour: FISH_STRIPE },
      { d: "M8.4 8.9c1 1.5 1 3.7 0 5.2", as: "shine", colour: GILL },
      { d: "M4.9 10.4a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0", as: "fill", colour: FISH_BELLY },
      { d: "M5.6 10.4a.7 .7 0 1 0 1.4 0a.7 .7 0 1 0-1.4 0", as: "fill", colour: FISH_EYE },
    ],
  },
};
