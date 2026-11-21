// The torch icons, the draft "torch-icons" asset in asset-manifest.json. Built in code. Added by torch ticket 01.
// The unlit torch is the backpack icon and the craft menu icon. BackpackIcon in backpack-icons.tsx draws it.
// The lit torch is the icon of the hotbar cell for the torch in the player's hand. Both are drawn in the same style as the
// approved "backpack-icons", on the same 24 by 24 grid.
import type { BackpackIconDrawing, IconPart } from "./icon-drawing";

/** The same colour as the stick icon, because the handle is a stick. */
const STICK = "#c08a55";
/** The same colour as the bark icon, because the head is bark wrapped round the stick. */
const BARK = "#a8794c";
const CHAR = "#3a2a20";

/** A stick handle leaning to the right, with a head of bark wrapped round its top end, tied with two dark bands. */
const TORCH: readonly IconPart[] = [
  { d: "M5 21.5L13.5 10", as: "line" },
  { d: "M12.2 6.8l4.6 3.4-3.4 4.6-4.6-3.4z", as: "fill", colour: BARK },
  { d: "M11.2 8.6l4.6 3.4M10 10.2l4.6 3.4", as: "cutLine" },
  { d: "M12.6 9.6l1.6-2.1", as: "shine", colour: "#e0bf8f" },
];

/** The unlit torch: the bark head is charred dark at its tip. */
export const TORCH_DRAWING: BackpackIconDrawing = {
  colour: STICK,
  parts: [...TORCH, { d: "M12.2 6.8l4.6 3.4 .9-1.2-4.6-3.4z", as: "fill", colour: CHAR }],
};

/** The lit torch: the same torch, with an orange flame and a yellow heart rising from the bark head. */
export const LIT_TORCH_DRAWING: BackpackIconDrawing = {
  colour: STICK,
  parts: [
    ...TORCH,
    { d: "M12.5 7c-1-2.8.6-4.6 2.2-6 .2 1.8 1.4 2.4 2.4 3.6 1.4 1.8.8 4-1 5z", as: "fill", colour: "#f08a3a" },
    { d: "M14 7.4c-.6-1.4.2-2.6 1-3.4.2 1 .9 1.4 1.3 2.1.5 1-.1 2-1 2.2z", as: "fill", colour: "#ffd65a" },
  ],
};
