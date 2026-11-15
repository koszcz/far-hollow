// Build menu icons for furniture, the draft "furniture-icons" asset in asset-manifest.json. Built in code.
// Added by furniture ticket 02 with the bed icon. Later furniture tickets add the shelf, table, and stool here.
// They are drawn on the same 24 by 24 grid, in the same shaded style, as the approved build icons in build-icons.tsx.
// The chest keeps its approved icon in build-icons.tsx.
import type { FurnitureKind } from "../sim/api";
import type { BackpackIconDrawing } from "./icon-drawing";

/** The furniture whose icons live here, rather than in the approved build icons. */
export type DraftIconFurniture = Exclude<FurnitureKind, "chest">;

export const FURNITURE_DRAWINGS: Readonly<Record<DraftIconFurniture, BackpackIconDrawing>> = {
  /** A plank bed frame seen from the foot end and a little above: a tall headboard, a pale mattress, and a folded blanket. */
  bed: {
    colour: "#cf9f62",
    parts: [
      // The headboard at the back, with two plank lines across it.
      { d: "M4 4.5h16v8h-16z", as: "fill", colour: "#b38350" },
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
  },
};
