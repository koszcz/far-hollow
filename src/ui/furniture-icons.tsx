// Build menu icons for furniture built from planks: the "furniture-icons" asset in asset-manifest.json, built in code. A rough draft.
// Added by furniture ticket 03 with the shelf icon. The bed, table, and stool add theirs here.
// They are drawn on the same 24 by 24 grid, in the same shaded style, as the approved build icons in build-icons.tsx.
// The chest's icon is part of the approved build icons, so it is not here.
import type { FurnitureKind } from "../sim/api";
import type { BackpackIconDrawing, IconPart } from "./icon-drawing";

/** Pale sawn plank wood, as the plank in a pile shows it, a darker shade for the parts in shadow, and a paler shade for cut ends. */
const PLANK = "#d9b07a";
const PLANK_SHADE = "#b38350";
const PLANK_DARK = "#8f6438";
const CUT_END = "#f0d3a0";

/** One shelf board, seen from the front and a little above: its top face, then its front edge. */
function board(y: number): IconPart[] {
  return [
    { d: `M5.5 ${y - 1.2}h13l.8 1.2h-14.6z`, as: "fill", colour: CUT_END },
    { d: `M4.7 ${y}h14.6v1.4H4.7z`, as: "fill", colour: PLANK },
  ];
}

/**
 * A standing plank shelf, seen from the front: two upright side planks, a dark back of planks between them,
 * and three shelf boards across, the lowest just above the ground.
 */
const SHELF_DRAWING: BackpackIconDrawing = {
  colour: PLANK,
  parts: [
    { d: "M5 3h14v18H5z", as: "fill", colour: PLANK_DARK },
    { d: "M9.7 3v18M14.3 3v18", as: "cutLine" },
    ...board(8.5),
    ...board(14),
    ...board(19.2),
    { d: "M3 2.2h2.2v20.3H3zM18.8 2.2H21v20.3h-2.2z", as: "fill", colour: PLANK_SHADE },
    { d: "M3 2.2h2.2M18.8 2.2H21", as: "shine", colour: CUT_END },
  ],
};

/** The icon of each piece of furniture this asset draws. */
export const FURNITURE_DRAWINGS: Readonly<Record<Exclude<FurnitureKind, "chest">, BackpackIconDrawing>> = {
  shelf: SHELF_DRAWING,
};
