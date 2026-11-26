// The build menu icon for the wood box, the draft "wood-box-icon" asset in asset-manifest.json. Built in code.
// It is drawn from the box's model in wood-box-meshes.ts, seen from the front and a little above, on the same 24 by 24 grid
// and in the same shaded style as the approved furniture icons in furniture-icons.tsx.
// An open box of planks: the back planks inside, firewood ends heaped above the front, three front planks, and a darker
// post at each front corner.
import type { BackpackIconDrawing, IconPart } from "./icon-drawing";

/** Plank wood, as in furniture-icons.tsx: the plank shade, a darker shade for posts, the darkest inside the box, and a pale glint. */
const PLANK = "#d9b07a";
const PLANK_SHADE = "#b38350";
const PLANK_DARK = "#8f6438";
const TOP = "#ecc995";
const SEAM = "#a8763f";
const GLINT = "#f6e2bc";
/** Firewood end grain and bark, as in the firewood backpack icon. */
const END_GRAIN = "#e8b878";
const BARK = "#a0643a";

/** One split piece of firewood seen from its end, as in backpack-icons.tsx, but smaller: pale end grain with bark on the curved side. */
function firewoodEnd(x: number, y: number): IconPart[] {
  return [
    { d: `M${x} ${y - 2.6}L${x + 2.8} ${y + 1.2}Q${x} ${y + 3.2} ${x - 2.8} ${y + 1.2}z`, as: "fill", colour: END_GRAIN },
    { d: `M${x + 2.8} ${y + 1.2}Q${x} ${y + 3.2} ${x - 2.8} ${y + 1.2}`, as: "line", colour: BARK },
  ];
}

/** Seen from the front and a little above: an open plank box full of firewood. */
export const WOOD_BOX_DRAWING: BackpackIconDrawing = {
  colour: PLANK,
  parts: [
    // The inside of the box, in shadow, and the top edge of the back planks.
    { d: "M4 7.5h16l1.5 3.5h-19z", as: "fill", colour: PLANK_DARK },
    { d: "M4 7h16v1H4z", as: "fill", colour: TOP },
    // Firewood heaped inside, ends toward the viewer.
    ...firewoodEnd(8, 9.5),
    ...firewoodEnd(13.5, 9.2),
    ...firewoodEnd(18, 9.8),
    ...firewoodEnd(10.8, 7.2),
    ...firewoodEnd(15.8, 7),
    // The front: three planks one above the other, with seams between them.
    { d: "M2.5 11h19v10h-19z", as: "fill", colour: PLANK },
    { d: "M3.5 14.4h17M3.5 17.7h17", as: "shine", colour: SEAM },
    { d: "M3.5 11.6h17", as: "shine", colour: GLINT },
    // The corner posts, darker, from the rim to the ground.
    { d: "M2 10.5h2.2V21.5H2zM19.8 10.5H22V21.5h-2.2z", as: "fill", colour: PLANK_SHADE },
  ],
};
