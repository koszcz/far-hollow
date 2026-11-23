// The build menu icon for the rain barrel, the approved "rain-barrel-icon" asset in asset-manifest.json. Built in code.
// The owner approved the version with bulging staves and iron hoops on 2026-11-23. It is drawn from the barrel's model in
// rain-barrel-meshes.ts, seen from the front and a little above, on the same 24 by 24 grid and in the same shaded style
// as the approved furniture icons in furniture-icons.tsx.
// Like the model, the staves bulge at the middle, a darker rim band runs round the top, and two dark iron hoops hold the staves.
import type { BackpackIconDrawing, IconPart } from "./icon-drawing";

/** Plank wood, as in furniture-icons.tsx: the plank shade, a darker shade inside the barrel, and a pale glint. */
const PLANK = "#d9b07a";
const PLANK_DARK = "#8f6438";
const GLINT = "#f6e2bc";
/** The rim band: plank wood at the model's rim shade, 0.78 of plank. */
const RIM = "#a9895f";
/** The dark iron of the hoops, as in rain-barrel-meshes.ts, and the light along their top edges. */
const HOOP = "#3e3d3b";
const HOOP_SHINE = "#8a8884";
/** The water inside, as in rain-barrel-meshes.ts, and the light on its surface. */
const WATER = "#4f7f9c";
const WATER_SHINE = "#9cc3da";

/** The barrel's middle across the icon, and the height of its top and bottom ellipses' middles. */
const MIDDLE_X = 12;
const TOP_Y = 5.5;
const BOTTOM_Y = 20;
/** Half the barrel's width at its top and bottom, and how deep its top and bottom ellipses are, front to back. */
const END_HALF_WIDTH = 6.2;
const END_DEPTH = 2;
/** How far the sides bulge out past the ends at half height. */
const BULGE = 1;

/**
 * The visible staves, left to right. Each has the sines of the angles of its edges round the barrel, from -1 at the left side
 * to 1 at the right. Twelve staves stand round the model, so six face the front, each 30 degrees wide.
 * Each has its shade: lit from the left, and a little different from its neighbours, as the model's staves are.
 */
const STAVES = [
  { left: -1, right: -0.866, shade: "#e4c08d" },
  { left: -0.866, right: -0.5, shade: "#d6ad76" },
  { left: -0.5, right: 0, shade: "#dfb985" },
  { left: 0, right: 0.5, shade: "#cfa46c" },
  { left: 0.5, right: 0.866, shade: "#c19560" },
  { left: 0.866, right: 1, shade: "#a97d4a" },
] as const;

/** How far down the barrel each hoop's top edge sits, as a share of the barrel's height, from the model's hoop heights. And how tall a hoop is. */
const HOOP_SHARES = [0.18, 0.76];
const HOOP_HEIGHT = 1.2;

/** A number rounded for a path. */
function n(value: number): string {
  return Number(value.toFixed(2)).toString();
}

/** Half the barrel's width at this share of the way down it: widest at half height. */
function halfWidth(share: number): number {
  return END_HALF_WIDTH + 4 * BULGE * share * (1 - share);
}

/** How far below the middle of the barrel's ellipse a point on its front sits, for an edge at this sine round the barrel. */
function frontDrop(sine: number, depth: number): number {
  return depth * Math.sqrt(1 - sine * sine);
}

/**
 * One stave, between the edges at these sines round the barrel: down one edge as it bulges out, along the bottom, and back up the other edge.
 * Each side is a curve whose control point puts it at the full half width at half height.
 */
function stave(left: number, right: number): string {
  const sideControl = 2 * halfWidth(0.5) - END_HALF_WIDTH;
  const edge = (sine: number) => ({
    top: `${n(MIDDLE_X + END_HALF_WIDTH * sine)} ${n(TOP_Y + frontDrop(sine, END_DEPTH))}`,
    control: `${n(MIDDLE_X + sideControl * sine)} ${n((TOP_Y + BOTTOM_Y) / 2 + frontDrop(sine, END_DEPTH))}`,
    bottom: `${n(MIDDLE_X + END_HALF_WIDTH * sine)} ${n(BOTTOM_Y + frontDrop(sine, END_DEPTH))}`,
  });
  const a = edge(left);
  const b = edge(right);
  const arc = `${END_HALF_WIDTH} ${END_DEPTH} 0 0`;
  return `M${a.top}Q${a.control} ${a.bottom}A${arc} 0 ${b.bottom}Q${b.control} ${b.top}A${arc} 1 ${a.top}z`;
}

/** A band round the front of the barrel, from this share of the way down it, this tall: a hoop or the rim. */
function band(share: number, height: number): string {
  const span = BOTTOM_Y - TOP_Y;
  const upperY = TOP_Y + share * span;
  const lowerY = upperY + height;
  const upper = halfWidth(share);
  const lower = halfWidth(share + height / span);
  const upperDepth = (END_DEPTH * upper) / END_HALF_WIDTH;
  const lowerDepth = (END_DEPTH * lower) / END_HALF_WIDTH;
  return (
    `M${n(MIDDLE_X - upper)} ${n(upperY)}A${n(upper)} ${n(upperDepth)} 0 0 0 ${n(MIDDLE_X + upper)} ${n(upperY)}` +
    `L${n(MIDDLE_X + lower)} ${n(lowerY)}A${n(lower)} ${n(lowerDepth)} 0 0 1 ${n(MIDDLE_X - lower)} ${n(lowerY)}z`
  );
}

/** The light along the top edge of a band, from this share of the way down the barrel, on its left, lit half. */
function bandShine(share: number): string {
  const y = TOP_Y + share * (BOTTOM_Y - TOP_Y) + 0.3;
  const half = halfWidth(share) - 0.8;
  const depth = (END_DEPTH * half) / END_HALF_WIDTH;
  return `M${n(MIDDLE_X - half)} ${n(y)}A${n(half)} ${n(depth)} 0 0 0 ${n(MIDDLE_X - half * 0.35)} ${n(y + depth * 0.94)}`;
}

/** An ellipse path, centred on (x, y). */
function ellipse(x: number, y: number, rx: number, ry: number): string {
  return `M${n(x - rx)} ${n(y)}a${n(rx)} ${n(ry)} 0 1 0 ${n(2 * rx)} 0a${n(rx)} ${n(ry)} 0 1 0 ${n(-2 * rx)} 0z`;
}

/**
 * Seen from the front and a little above: six staves in turn that bulge at the middle, the darker rim band, two dark iron hoops,
 * and the open top, with water just below the rim.
 */
export const RAIN_BARREL_DRAWING: BackpackIconDrawing = {
  colour: PLANK,
  parts: [
    // The staves.
    ...STAVES.map(({ left, right, shade }): IconPart => ({ d: stave(left, right), as: "fill", colour: shade })),
    // The light down the second stave from the left, the most lit.
    { d: "M6.9 8.4Q5.7 13.4 6.9 18.6", as: "shine", colour: GLINT },
    // The rim band round the top edge, and the two hoops.
    { d: band(0, 0.7), as: "fill", colour: RIM },
    ...HOOP_SHARES.map((share): IconPart => ({ d: band(share, HOOP_HEIGHT), as: "fill", colour: HOOP })),
    ...HOOP_SHARES.map((share): IconPart => ({ d: bandShine(share), as: "shine", colour: HOOP_SHINE })),
    // The open top: the rim's top edge, the dark inside, and the water near the rim.
    { d: ellipse(MIDDLE_X, TOP_Y, END_HALF_WIDTH, END_DEPTH), as: "fill", colour: RIM },
    { d: ellipse(MIDDLE_X, TOP_Y + 0.1, END_HALF_WIDTH - 0.8, END_DEPTH - 0.4), as: "fill", colour: PLANK_DARK },
    { d: ellipse(MIDDLE_X, TOP_Y + 0.45, END_HALF_WIDTH - 1.2, END_DEPTH - 0.75), as: "fill", colour: WATER },
    { d: "M8.6 5.4h3.8", as: "shine", colour: WATER_SHINE },
  ],
};
