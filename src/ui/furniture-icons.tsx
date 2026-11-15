// Build menu icons for furniture built from planks: the "furniture-icons" asset in asset-manifest.json, built in code. A rough draft.
// Added by furniture ticket 03 with the shelf icon, and ticket 02 added the bed. The table and stool add theirs here.
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

/** A plank bed frame seen from the foot end and a little above: a tall headboard, a pale mattress, and a folded blanket. */
const BED_DRAWING: BackpackIconDrawing = {
  colour: "#cf9f62",
  parts: [
    // The headboard at the back, with two plank lines across it.
    { d: "M4 4.5h16v8h-16z", as: "fill", colour: PLANK_SHADE },
    { d: "M4.5 7.2h15M4.5 9.8h15", as: "cutLine" },
    // The side rails and the mattress on them.
    { d: "M3 11l1-1.5h16l1 1.5v6h-18z", as: "fill" },
    { d: "M4.5 10.2h15l.8 2.8H3.7z", as: "fill", colour: "#efe3c8" },
    // The blanket over the foot half of the mattress.
    { d: "M3.7 13l.4-1.6h15.8l.4 1.6z", as: "fill", colour: "#7f8fa6" },
    // The foot board and the legs.
    { d: "M2.5 15.5h19v3h-19z", as: "fill", colour: "#d9ac70" },
    { d: "M3 16.9h18", as: "shine", colour: "#a8763f" },
    { d: "M2.5 18.5h2v2.5h-2zM19.5 18.5h2v2.5h-2z", as: "fill", colour: "#a8763f" },
  ],
};

/** The furniture whose icons are drawn here. The chest's icon is in the approved build icons instead. */
export type FurnitureWithOwnIcon = Exclude<FurnitureKind, "chest">;

/** The icon of each piece of furniture this asset draws. */
export const FURNITURE_DRAWINGS: Readonly<Record<FurnitureWithOwnIcon, BackpackIconDrawing>> = {
  shelf: SHELF_DRAWING,
  bed: BED_DRAWING,
};

/** Whether a structure's build menu icon is drawn here. */
export function hasFurnitureIcon(structure: string): structure is FurnitureWithOwnIcon {
  return structure in FURNITURE_DRAWINGS;
}
