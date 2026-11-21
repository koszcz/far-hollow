// Icons for queued actions on things that have no icon elsewhere: a standing tree, the river, and a spot on the ground.
// The approved "action-queue-icons" asset in asset-manifest.json.
// Built in code, in the build icons' shaded style on the same 24 by 24 grid. Logs and debarked logs reuse their approved icons.
import type { BackpackIconDrawing } from "./icon-drawing";

/** A thing in the world that a queued action can work on, drawn here. */
export type QueueThing = "tree" | "river" | "ground";

/** A circle path, centred on (x, y) with radius r. */
function circle(x: number, y: number, r: number): string {
  return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}

/** An ellipse path, centred on (x, y) with radii rx and ry. */
function ellipse(x: number, y: number, rx: number, ry: number): string {
  return `M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`;
}

const GRASS = "#5f8f45";
const EARTH = "#8a6a45";

/** The patch of ground that the tree and the pin both stand on, so the icons read as one set in the round chips. */
const PATCH = ellipse(12, 19.6, 9, 3.2);

export const QUEUE_THING_DRAWINGS: Readonly<Record<QueueThing, BackpackIconDrawing>> = {
  /** A conifer: three green tiers on a short brown trunk, standing on a grassy patch with its shadow. */
  tree: {
    colour: "#3f7a3a",
    parts: [
      { d: PATCH, as: "fill", colour: GRASS },
      { d: ellipse(13, 20.2, 5, 1.5), as: "fill", colour: "#47703a" },
      { d: "M10.6 16.5h2.8v4.2h-2.8z", as: "fill", colour: "#7a5232" },
      { d: "M12 9.6l7.3 8c-2.4-.7-4.9-.7-7.3 0s-4.9-.7-7.3 0z", as: "fill", colour: "#356b31" },
      { d: "M12 5.4l5.9 6.8c-2-.6-3.9-.6-5.9 0s-3.9-.6-5.9 0z", as: "fill" },
      { d: "M12 1.5l4.5 5.4c-1.5-.5-3-.5-4.5 0s-3-.5-4.5 0z", as: "fill", colour: "#4d8c46" },
    ],
  },
  /** A stretch of river: a blue stream winding across a round grassy patch, with pale ripples. */
  river: {
    colour: "#3f86c0",
    parts: [
      { d: ellipse(12, 12, 10, 8), as: "fill", colour: GRASS },
      // The stream's banks run from edge to edge of the patch. The arcs follow the patch's own outline.
      {
        d: "M2.08 13C6 10 9 15.5 12 12.5S16.5 8 19.81 7A10 8 0 0 1 21.92 11C18.5 11.5 16.5 14 13.5 16.5S7.5 15.5 4.19 17A10 8 0 0 1 2.08 13z",
        as: "fill",
      },
      { d: "M5.6 14.2c1.2-.7 2.3-.6 3.4 0M14.2 11.6c1.2-.9 2.4-1.1 3.6-.6", as: "shine", colour: "#cfe8f7" },
    ],
  },
  /** A spot on the ground to walk to: an amber pin standing on a patch of earth, with a small shadow at its tip. */
  ground: {
    colour: "#f0a04b",
    parts: [
      { d: PATCH, as: "fill", colour: EARTH },
      { d: ellipse(13, 19.9, 4, 1.3), as: "fill", colour: "#6e5236" },
      { d: "M12 19.4s-5.2-4.8-5.2-8.9a5.2 5.2 0 0 1 10.4 0c0 4.1-5.2 8.9-5.2 8.9z", as: "fill" },
      { d: circle(12, 10.5, 1.9), as: "cut" },
    ],
  },
};
