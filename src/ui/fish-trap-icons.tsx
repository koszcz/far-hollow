// The cord and fish trap icons, the approved "fish-trap-icons" asset in asset-manifest.json. Built in code. Added by fish-trap ticket 01.
// Each is the backpack icon and the craft menu icon. BackpackIcon in backpack-icons.tsx draws them, in the same style as the
// approved "backpack-icons", on the same 24 by 24 grid.
import type { BackpackIconDrawing } from "./icon-drawing";

/** Twisted bark: the same brown as the bark icon, a little darker, with a darker shade for the twists and the tie. */
const CORD = "#a0703f";
const CORD_DARK = "#6e4826";
const CORD_LIGHT = "#d6ab78";
/** The same colour as the stick icon, because the trap is made of sticks, with a darker shade for the ribs and the rim. */
const STICK = "#c08a55";
const STICK_DARK = "#7f5530";
const STICK_LIGHT = "#e0bf8f";
/** The dark inside of the trap, seen through its mouth. */
const TRAP_INSIDE = "#2e1d10";

/** A hank of cord: two loops in a figure of eight, tied round the middle, with both loose ends hanging below and twists marked along it. */
export const CORD_DRAWING: BackpackIconDrawing = {
  colour: CORD,
  parts: [
    { d: "M11.4 12.8c-.4 2.6-1.6 4.6-3.6 6.6M12.6 12.8c.6 2.4 2 4.4 4 5.8", as: "line" },
    {
      d: "M12 10.4c-2-2.6-3.8-3.6-5.4-3.6-2 0-3.4 1.6-3.4 3.6s1.4 3.6 3.4 3.6c1.6 0 3.4-1 5.4-3.6 2 2.6 3.8 3.6 5.4 3.6 2 0 3.4-1.6 3.4-3.6s-1.4-3.6-3.4-3.6c-1.6 0-3.4 1-5.4 3.6",
      as: "line",
    },
    { d: "M10.7 8.2h2.6v4.6h-2.6z", as: "fill", colour: CORD_DARK },
    {
      d: "M5.4 7.2l.7 1.2M8.4 7.6l-.5 1.2M3.6 9.8l1.3.2M5.6 13.4l.4-1.2M15.4 7.6l.6 1.2M18.6 7.2l-.7 1.2M20.4 10.6l-1.3-.2M18.2 13.6l-.4-1.2",
      as: "shine",
      colour: CORD_DARK,
    },
    { d: "M4.6 8.6c.6-.8 1.4-1.2 2.2-1.2M16.4 7.6c.8-.2 1.8 0 2.4.6", as: "shine", colour: CORD_LIGHT },
  ],
};

/**
 * A fish trap: a cone basket of sticks lying on its side, its round mouth on the left, open to show its dark inside.
 * The ribs taper to a tail tied off with cord, and two bands of cord wrap round the cone.
 */
export const FISH_TRAP_DRAWING: BackpackIconDrawing = {
  colour: STICK,
  parts: [
    { d: "M20.6 12.6l1.8 1.8", as: "line", colour: CORD },
    { d: "M4.5 5.5L20 10.6c1 .5 1 2.3 0 2.8L4.5 18.5z", as: "fill" },
    { d: "M4.5 8.6l16 3M4.5 12h16.4M4.5 15.4l16-3", as: "shine", colour: STICK_DARK },
    { d: "M9.4 6.9c1 1.5 1.4 3.3 1.4 5.1s-.4 3.6-1.4 5.1M15 8.8c.6 1 .9 2.1.9 3.2s-.3 2.2-.9 3.2", as: "line", colour: CORD },
    { d: "M19.6 12a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 1 0-2.6 0z", as: "fill", colour: CORD },
    { d: "M2 12a2.5 6.5 0 1 0 5 0 2.5 6.5 0 1 0-5 0z", as: "fill", colour: STICK_DARK },
    { d: "M3 12a1.5 5.3 0 1 0 3 0 1.5 5.3 0 1 0-3 0z", as: "fill", colour: TRAP_INSIDE },
    { d: "M7.6 7.4l5.2 1.7", as: "shine", colour: STICK_LIGHT },
  ],
};
