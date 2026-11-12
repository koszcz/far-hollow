// Icons for the sled, the approved "sled-icon" asset in asset-manifest.json. Built in code.
// The build menu shows the sled icon over the sled's cost, and the log icon for the logs it costs. The hotbar's sled cell shows the sled icon too.
// The owner approved the three-quarter view, with skid tips, lashings, and a tow rope, on 2026-11-12.
// They are drawn on the same 24 by 24 grid, in the same shaded style, as the approved build icons in build-icons.tsx.
import type { BackpackIconDrawing, IconPart } from "./icon-drawing";

/** The bark of a log, a darker shade of it, and a log's pale cut end, in the build icons' bark colours. */
const BARK = "#8a5f3a";
const BARK_DARK = "#6b4729";
const CUT_END = "#d9b47a";
/** The colour of a stick, matching the stick backpack icon. */
const STICK = "#c08a55";
/** The dark rope of the lashings, as the sled model shows it, and the tow rope, drawn paler so it shows on the chip. */
const ROPE = "#3d3128";
const TOW_ROPE = "#b39a78";

/** A circle path, centred on (x, y) with radius r. */
function circle(x: number, y: number, r: number): string {
  return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}

/**
 * One log runner, seen from the side and a little above. It runs from its back end at x1 forward to x0,
 * then narrows and curls up like a skid. Returns the runner and the point of its tip, where the tow rope starts.
 */
function runner(x0: number, x1: number, y: number, r: number, colour: string): { parts: IconPart[]; tip: [number, number] } {
  const top = y - r;
  const bottom = y + r;
  const tip: [number, number] = [x0 - 4.4, top - 2.6];
  return {
    tip,
    parts: [
      {
        d:
          `M${x1} ${top}H${x0}C${x0 - 2} ${top} ${x0 - 3} ${top - 1.1} ${x0 - 3.8} ${top - 2.9}` +
          `L${x0 - 5} ${top - 2.3}C${x0 - 4.2} ${bottom - 2.4} ${x0 - 2.5} ${bottom} ${x0} ${bottom}H${x1}` +
          `A${r} ${r} 0 0 0 ${x1} ${top}Z`,
        as: "fill",
        colour,
      },
      { d: `M${x0 + 1} ${y + 0.2}H${x1 - 0.5}`, as: "shine", colour: BARK_DARK },
      { d: circle(tip[0], tip[1], 0.75), as: "fill", colour: CUT_END },
    ],
  };
}

/** Where each stick crosses the near runner, and how far it leans, so the sticks look a little crooked, like those on the model. */
const STICKS = [
  { x: 10.2, lean: 2.3 },
  { x: 13.8, lean: 2 },
  { x: 17.4, lean: 2.4 },
  { x: 21, lean: 2.1 },
];

const FAR = runner(10.3, 22.8, 9.8, 1.9, BARK_DARK);
const NEAR = runner(8.5, 21.5, 18.5, 2.1, BARK);

/** The ends of each stick: just past the outer side of the near runner and of the far runner. */
const STICK_NEAR_Y = 20.4;
const STICK_FAR_Y = 7.4;
/** Half a stick's width. Sticks are thinner than the log runners. */
const STICK_HALF = 0.75;

/** A stick laid across both runners, leaning back by `lean` from its near end at x. */
function stick(x: number, lean: number): IconPart {
  return {
    d: `M${x - STICK_HALF} ${STICK_NEAR_Y}H${x + STICK_HALF}L${x + lean + STICK_HALF} ${STICK_FAR_Y}H${x + lean - STICK_HALF}Z`,
    as: "fill",
    colour: STICK,
  };
}

/** Where a stick from x, leaning by `lean`, crosses height y. */
function stickX(x: number, lean: number, y: number): number {
  return x + (lean * (STICK_NEAR_Y - y)) / (STICK_NEAR_Y - STICK_FAR_Y);
}

/** A small X of dark rope, centred on (x, y), lashing a stick to a runner. */
function lashing(x: number, y: number): string {
  const s = 0.55;
  return `M${x - s} ${y - s}L${x + s} ${y + s}M${x + s} ${y - s}L${x - s} ${y + s}`;
}

/** The loop at the front of the tow rope. */
const LOOP: [number, number] = [1.8, 10];

/**
 * Seen from the front left and a little above: two log runners with skid tips curling up at the front, the far one higher up,
 * four crooked sticks lashed across them with dark rope, and a tow rope running in a V from the tips to a loop in front.
 */
export const SLED_DRAWING: BackpackIconDrawing = {
  colour: BARK,
  parts: [
    ...FAR.parts,
    ...NEAR.parts,
    ...STICKS.map(({ x, lean }) => stick(x, lean)),
    ...STICKS.map(({ x, lean }): IconPart => ({
      d: lashing(stickX(x, lean, 18.5), 18.5) + lashing(stickX(x, lean, 9.8), 9.8),
      as: "shine",
      colour: ROPE,
    })),
    { d: `M${NEAR.tip[0]} ${NEAR.tip[1]}Q${LOOP[0] + 1.8} ${LOOP[1] + 2.6} ${LOOP[0] + 0.7} ${LOOP[1] + 0.6}`, as: "shine", colour: TOW_ROPE },
    { d: `M${FAR.tip[0]} ${FAR.tip[1]}Q${LOOP[0] + 2.2} ${LOOP[1] - 2} ${LOOP[0] + 0.7} ${LOOP[1] - 0.6}`, as: "shine", colour: TOW_ROPE },
    { d: circle(LOOP[0], LOOP[1], 1), as: "shine", colour: TOW_ROPE },
  ],
};

/** A log on its side with its bark on: dark bark along it, and a pale cut end with one growth ring. */
export const LOG_DRAWING: BackpackIconDrawing = {
  colour: BARK,
  parts: [
    { d: "M6 7.5h12a4.5 4.5 0 0 1 0 9H6z", as: "fill" },
    { d: "M10 10.5h7M9 13.5h5", as: "line", colour: BARK_DARK },
    { d: circle(6, 12, 4.5), as: "fill", colour: CUT_END },
    { d: circle(6, 12, 2), as: "line", colour: BARK_DARK },
  ],
};
