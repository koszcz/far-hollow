// Build menu icons for furniture built from planks: the "furniture-icons" asset in asset-manifest.json, built in code.
// The owner approved the version drawn from each furniture model on 2026-11-15.
// Each icon is drawn from its furniture's model, seen from the front and a little above, as the chest's build icon is.
// They are drawn on the same 24 by 24 grid, in the same shaded style, as the approved build icons in build-icons.tsx.
// FURNITURE_DRAWINGS lists every piece's icon. The chest's icon is part of the approved build icons, so its entry points there.
// The rain barrel's icon is its own approved asset, so its entry points to rain-barrel-icon.tsx.
import type { FurnitureKind } from "../sim/api";
import { CHEST_DRAWING } from "./build-icons";
import { RAIN_BARREL_DRAWING } from "./rain-barrel-icon";
import type { BackpackIconDrawing, IconPart } from "./icon-drawing";

/**
 * Plank wood in four shades, lit from above: a pale shade for top faces, the plank shade for front faces,
 * a darker shade for posts and legs, and the darkest for parts deep in shadow, such as back legs and back planks.
 * PLANK matches the plank wood colour of the furniture models in plank-furniture-meshes.ts.
 */
const TOP = "#ecc995";
const PLANK = "#d9b07a";
const PLANK_SHADE = "#b38350";
const PLANK_DARK = "#8f6438";

/** The fine dark seam between two planks, and the pale glint along a front edge. */
const SEAM = "#a8763f";
const GLINT = "#f6e2bc";

/** The dark wood of the pegs on the shelf's front posts, as in shelf-meshes.ts. */
const PEG = "#6b4f33";

/** The bed's linen and wool, as in bed-meshes.ts, and the paler fold along the blanket's top edge. */
const MATTRESS = "#e8dcc0";
const PILLOW = "#f6efe0";
const BLANKET = "#7f90aa";
const BLANKET_FOLD = "#a9b6c8";

/** A circle path, centred on (x, y) with radius r. */
function circle(x: number, y: number, r: number): string {
  return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}

/** One shelf board between the posts, with its top at y: its top face going back to the back planks, then its front lip. */
function shelfBoard(y: number): IconPart[] {
  return [
    { d: `M6.9 ${y - 1.1}h10.2l.5 1.1H6.4z`, as: "fill", colour: TOP },
    { d: `M6.2 ${y}h11.6v1.4H6.2z`, as: "fill", colour: PLANK },
  ];
}

/** The two dark pegs where the shelf board with its top at y meets the front posts. */
function shelfPegs(y: number): IconPart[] {
  return [
    { d: circle(5.5, y + 0.7, 0.55), as: "fill", colour: PEG },
    { d: circle(18.5, y + 0.7, 0.55), as: "fill", colour: PEG },
  ];
}

/**
 * The shelf, drawn from its model in shelf-meshes.ts: three back planks in shadow, two shelf boards,
 * the overhanging top, two square front posts that stand on the ground as short feet,
 * and a dark peg where each board meets a post. Like the model, it shows the shelf empty.
 */
const SHELF_DRAWING: BackpackIconDrawing = {
  colour: PLANK,
  parts: [
    // The three back planks, between the posts.
    { d: "M6.2 4.8h11.6v15.4H6.2z", as: "fill", colour: PLANK_DARK },
    { d: "M10.1 5v15M13.9 5v15", as: "cutLine" },
    // The middle board, two thirds of the way up, and the lowest board, just above the ground.
    ...shelfBoard(11.8),
    ...shelfBoard(18.6),
    // The front posts, from under the top down to the ground.
    { d: "M4.5 4.8h2v16.7h-2zM17.5 4.8h2v16.7h-2z", as: "fill", colour: PLANK_SHADE },
    ...shelfPegs(11.8),
    ...shelfPegs(18.6),
    // The top: its face going back, then its front edge, reaching a little past the posts.
    { d: "M4.8 2.2h14.4l1.2 1.6H3.6z", as: "fill", colour: TOP },
    { d: "M3.6 3.8h16.8v1.5H3.6z", as: "fill", colour: PLANK },
    { d: "M4.2 3.9h15.6", as: "shine", colour: GLINT },
  ],
};

/**
 * The bed, drawn from its model in bed-meshes.ts and seen from the foot end, so its length runs back into the picture:
 * a headboard of two planks at the far end, a linen mattress inside the frame, a pillow at the head,
 * a blue blanket over the foot half, a lower footboard of two planks in front, and two short legs under it.
 */
const BED_DRAWING: BackpackIconDrawing = {
  colour: PLANK,
  parts: [
    // The headboard at the far end: two planks, one above the other.
    { d: "M5.6 2.8h12.8v6.4H5.6z", as: "fill", colour: PLANK_SHADE },
    { d: "M5.8 6h12.4", as: "shine", colour: PLANK_DARK },
    { d: "M6 3h12", as: "shine", colour: GLINT },
    // The side rails of the frame, running back to the headboard, and the mattress inside them.
    { d: "M5.6 9.2h12.8L21 16H3z", as: "fill", colour: PLANK },
    { d: "M6.6 9.2h10.8l2.3 6.6H4.3z", as: "fill", colour: MATTRESS },
    // The pillow at the head.
    { d: "M8.4 9.6h7.2l.5 2.2H7.9z", as: "fill", colour: PILLOW },
    // The blanket over the foot half, with a pale fold along its top edge.
    { d: "M5.2 12.4h13.6l1.3 3.6H3.9z", as: "fill", colour: BLANKET },
    { d: "M5.4 12.9h13.2", as: "shine", colour: BLANKET_FOLD },
    // The footboard: two planks, rising a little above the mattress.
    { d: "M3 15.2h18v3.6H3z", as: "fill", colour: PLANK },
    { d: "M3.3 17h17.4", as: "shine", colour: SEAM },
    { d: "M3.5 15.4h17", as: "shine", colour: GLINT },
    // The two front legs.
    { d: "M3 18.8h2.2v2.7H3zM18.8 18.8H21v2.7h-2.2z", as: "fill", colour: PLANK_SHADE },
  ],
};

/** One seam across the table top at height y. The top's sides lean out as they come forward, so the seam follows them. */
function tableSeam(y: number): string {
  const left = 4.5 - ((y - 5) * 2) / 4.5 + 0.4;
  return `M${left.toFixed(2)} ${y}H${(24 - left).toFixed(2)}`;
}

/**
 * The table, drawn from its model in table-meshes.ts and seen from its long side:
 * a top of four planks laid along its length, the rail under the top, two front legs, and two back legs in shadow.
 */
const TABLE_DRAWING: BackpackIconDrawing = {
  colour: PLANK,
  parts: [
    // The back legs, in shadow behind the front ones.
    { d: "M6.4 11h1.6v8.2H6.4zM16 11h1.6v8.2H16z", as: "fill", colour: PLANK_DARK },
    // The top: four planks running along it, each a little deeper than the one behind it.
    { d: "M4.5 5h15l2 4.5h-19z", as: "fill", colour: TOP },
    { d: [6, 7.1, 8.25].map(tableSeam).join(""), as: "shine", colour: PLANK_DARK },
    // The front edge of the top, and the rail under it between the legs.
    { d: "M2.5 9.5h19V11h-19z", as: "fill", colour: PLANK },
    { d: "M3 9.6h18", as: "shine", colour: GLINT },
    { d: "M5 11h14v1.5H5z", as: "fill", colour: PLANK_DARK },
    // The front legs.
    { d: "M3.2 11h2v10.5h-2zM18.8 11h2v10.5h-2z", as: "fill", colour: PLANK_SHADE },
  ],
};

/**
 * The stool, drawn from its model in stool-meshes.ts: a low, square seat of two boards running front to back,
 * four straight square legs, the rail between the front legs, and the lower rail along each side.
 */
const STOOL_DRAWING: BackpackIconDrawing = {
  colour: PLANK,
  parts: [
    // The back legs, in shadow behind the front ones.
    { d: "M7.6 12h1.9v6.6H7.6zM14.5 12h1.9v6.6h-1.9z", as: "fill", colour: PLANK_DARK },
    // The side rails, lower than the front rail, running back from each front leg.
    { d: "M7 17.4l2.6-1v1.3L7 18.7zM17 17.4l-2.6-1v1.3l2.6 1z", as: "fill", colour: PLANK_DARK },
    // The front legs, and the rail between them.
    { d: "M4.6 12.5h2.6v8.5H4.6zM16.8 12.5h2.6v8.5h-2.6z", as: "fill", colour: PLANK_SHADE },
    { d: "M7.2 15.4h9.6v1.6H7.2z", as: "fill", colour: PLANK_SHADE },
    // The seat: its top of two boards, then its thick front edge.
    { d: "M6.2 7.4h11.6l2 3.6H4.2z", as: "fill", colour: TOP },
    { d: "M12 7.6v3.2", as: "shine", colour: SEAM },
    { d: "M4.2 11h15.6v2.2H4.2z", as: "fill", colour: PLANK },
    { d: "M4.7 11.1h14.6", as: "shine", colour: GLINT },
  ],
};

/** The build menu icon of each piece of furniture. TypeScript reports a piece with no entry. */
export const FURNITURE_DRAWINGS: Readonly<Record<FurnitureKind, BackpackIconDrawing>> = {
  chest: CHEST_DRAWING,
  shelf: SHELF_DRAWING,
  bed: BED_DRAWING,
  table: TABLE_DRAWING,
  stool: STOOL_DRAWING,
  rainBarrel: RAIN_BARREL_DRAWING,
};
