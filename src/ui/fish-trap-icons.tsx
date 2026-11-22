// The cord and fish trap icons, the draft "fish-trap-icons" asset in asset-manifest.json. Built in code. Added by fish-trap ticket 01.
// Each is the backpack icon and the craft menu icon. BackpackIcon in backpack-icons.tsx draws them, in the same style as the
// approved "backpack-icons", on the same 24 by 24 grid.
import type { BackpackIconDrawing } from "./icon-drawing";

/** Twisted bark: the same brown as the bark icon, a little darker. */
const CORD = "#a0703f";
const CORD_LIGHT = "#d6ab78";
/** The same colour as the stick icon, because the trap is made of sticks. */
const STICK = "#c08a55";

/** A coil of cord: two loops wound round each other, with a loose end, and twists marked across it. */
export const CORD_DRAWING: BackpackIconDrawing = {
  colour: CORD,
  parts: [
    { d: "M12 5.5a6.5 5.5 0 1 1-.01 0M12 8.5a3.6 3 0 1 0 .01 0", as: "line" },
    { d: "M18 14.5l3.5 5", as: "line" },
    { d: "M7.5 8l1.2 1.4M15.8 7.3l-1 1.5M7 14l1.6-.6M16.4 14.4l-1.5-.8", as: "cutLine" },
    { d: "M8.2 7.3c1-.8 2.2-1.2 3.4-1.3", as: "shine", colour: CORD_LIGHT },
  ],
};

/** A fish trap: a cone basket of sticks lying on its side, its wide mouth on the left, bound with two rings of cord. */
export const FISH_TRAP_DRAWING: BackpackIconDrawing = {
  colour: STICK,
  parts: [
    { d: "M3 6.5L21 11v2L3 17.5z", as: "fill" },
    { d: "M3 9.5L21 12M3 14.5L21 12M3 12h18", as: "cutLine" },
    { d: "M7.5 7.6v8.8M14 9.2v5.6", as: "line", colour: CORD },
    { d: "M3 6.5v11", as: "line", colour: "#8a5a32" },
    { d: "M5 8l6 1.5", as: "shine", colour: "#e0bf8f" },
  ],
};
