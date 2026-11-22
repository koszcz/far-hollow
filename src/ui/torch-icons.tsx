// The torch icons, the approved "torch-icons" asset in asset-manifest.json. Built in code. Added by torch ticket 01.
// The owner approved the bold redraw, with a bark cone, a three-tongued flame, and sparks, on 2026-11-22.
// The unlit torch is the backpack icon and the craft menu icon. BackpackIcon in backpack-icons.tsx draws it.
// The lit torch is the icon of the hotbar cell for the torch in the player's hand. Both are drawn in the same style as the
// approved "backpack-icons", on the same 24 by 24 grid.
import type { BackpackIconDrawing, IconPart } from "./icon-drawing";

/** The same colour as the stick icon, because the handle is a stick. */
const STICK = "#c08a55";
/** The same colour as the bark icon, because the head is bark wrapped round the stick. */
const BARK = "#a8794c";
const CHAR = "#3a2a20";
const FLAME = "#f08a3a";
const FLAME_HEART = "#ffd65a";

/**
 * A stick handle leaning to the right, with a cone of bark wrapped round its top end. The cone widens towards the
 * top and is tied with two dark bands.
 */
const TORCH: readonly IconPart[] = [
  { d: "M3.3 21.1L9.4 13.1 11.6 14.9 5.1 22.5a1.1 1.1 0 0 1-1.8-1.4z", as: "fill" },
  { d: "M4.8 20.3l4.1-5", as: "shine", colour: "#e0bf8f" },
  { d: "M8.9 12.7L11.95 6.8Q15.7 7.5 17.25 11.1L12.1 15.3z", as: "fill", colour: BARK },
  { d: "M9.7 11.3l3.6 2.9M10.6 9.5l4.3 3.5", as: "cutLine" },
  { d: "M10.2 11.4l1.6-2.9", as: "shine", colour: "#e0bf8f" },
];

/** The unlit torch: the top of the bark cone is charred dark. */
export const TORCH_DRAWING: BackpackIconDrawing = {
  colour: STICK,
  parts: [...TORCH, { d: "M11.5 7.8L11.95 6.8Q15.7 7.5 17.25 11.1L16.35 11.8Q15 8.6 11.5 7.8z", as: "fill", colour: CHAR }],
};

/** The lit torch: the same torch, with a big three-tongued orange flame, a yellow heart, and two sparks above the bark cone. */
export const LIT_TORCH_DRAWING: BackpackIconDrawing = {
  colour: STICK,
  parts: [
    ...TORCH,
    {
      d: "M11.6 7.6C10 5.4 10.4 3 11.6 1.4 11.9 3 12.6 3.8 13.2 4 13 1.8 14 0 15.6-.8 15.4 1.2 16.4 2.6 16.9 3.6 17.5 3 17.9 2.4 18.1 1.8 19.8 4.4 19.4 8.6 17.2 11.2Q15.4 7.6 11.6 7.6z",
      as: "fill",
      colour: FLAME,
    },
    {
      d: "M13 8C12.2 6.2 13 4.6 14 3.6 14 5 14.8 5.6 15.2 6 15.6 5.4 15.8 4.9 15.8 4.4 17.2 5.8 17.2 8.4 16.2 9.6Q14.8 8.2 13 8z",
      as: "fill",
      colour: FLAME_HEART,
    },
    { d: "M19.4.6a.45.45 0 1 0 .9 0a.45.45 0 1 0-.9 0zM9.2 2a.4.4 0 1 0 .8 0a.4.4 0 1 0-.8 0z", as: "fill", colour: FLAME_HEART },
  ],
};
