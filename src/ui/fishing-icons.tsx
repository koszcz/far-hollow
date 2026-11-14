// Backpack icons for fishing gear, the draft "fishing-icons" asset in asset-manifest.json. Built in code.
// Added by fishing ticket 01. Fishing ticket 02 added raw fish, and ticket 03 cooked fish. BackpackIcon in backpack-icons.tsx draws them, in the same style as the approved "backpack-icons".
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
/** A cooked trout: browned skin, a golden belly, and dark grill marks from the fire. */
const COOKED_BACK = "#8a5a32";
const COOKED_BELLY = "#d9a35c";
const COOKED_MARK = "#3d2614";

/** True if `content` is fishing gear or a fish, so this module draws its icon. */
export function isFishingContent(content: BackpackContent): content is FishingContent | Fish {
  return Object.hasOwn(FISHING_DRAWINGS, content);
}

export const FISHING_DRAWINGS: Readonly<Record<FishingContent | Fish, BackpackIconDrawing>> = {
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
  /** A whole raw trout lying on its side, head to the left: a grey-green back, a pale belly, a pink stripe, and a forked tail. */
  rawFish: {
    colour: FISH_BACK,
    parts: [
      { d: "M2.5 12c3-4.5 9-5.5 14-2.5L21.5 6v12l-5-3.5c-5 3-11 2-14-2.5z", as: "fill" },
      { d: "M4.5 13.5c3.5 2.5 8 2.6 11.5.6", as: "line", colour: FISH_BELLY },
      { d: "M5.5 11.8c3.5-.6 7-.4 10 .4", as: "shine", colour: FISH_STRIPE },
      { d: "M6.2 10.3h.1", as: "line", colour: FISH_EYE },
    ],
  },
  /** The same trout, cooked: browned skin, a golden belly, dark marks from the fire across its side, and a pale cooked eye. */
  cookedFish: {
    colour: COOKED_BACK,
    parts: [
      { d: "M2.5 12c3-4.5 9-5.5 14-2.5L21.5 6v12l-5-3.5c-5 3-11 2-14-2.5z", as: "fill" },
      { d: "M4.5 13.5c3.5 2.5 8 2.6 11.5.6", as: "line", colour: COOKED_BELLY },
      { d: "M8.5 9.5l-1 5M11.5 9l-1 6M14.5 9.5l-1 5", as: "line", colour: COOKED_MARK },
      { d: "M6.2 10.3h.1", as: "line", colour: FISH_BELLY },
    ],
  },
};
