// Icons for queued actions on things that have no icon elsewhere: a standing tree, the river, and a spot on the ground.
// The draft "action-queue-icons" asset in asset-manifest.json, added by .scratch/action-queue/issues/02-show-and-cancel-the-queue.md.
// Built in code, in the build icons' shaded style on the same 24 by 24 grid. Logs and debarked logs reuse their approved icons.
import type { BackpackIconDrawing } from "./icon-drawing";

/** A thing in the world that a queued action can work on, drawn here. */
export type QueueThing = "tree" | "river" | "ground";

/** A circle path, centred on (x, y) with radius r. */
function circle(x: number, y: number, r: number): string {
  return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}

export const QUEUE_THING_DRAWINGS: Readonly<Record<QueueThing, BackpackIconDrawing>> = {
  /** A conifer: three green tiers stacked on a short brown trunk. */
  tree: {
    colour: "#3f7a3a",
    parts: [
      { d: "M10.5 18h3v4.5h-3z", as: "fill", colour: "#7a5232" },
      { d: "M12 11l7 8H5z", as: "fill", colour: "#356b31" },
      { d: "M12 6.5l5.8 7H6.2z", as: "fill" },
      { d: "M12 2l4.5 6.2h-9z", as: "fill", colour: "#4d8c46" },
    ],
  },
  /** A stretch of river: a blue band between two grassy banks, with pale ripples. */
  river: {
    colour: "#3f86c0",
    parts: [
      { d: "M2 4h20v4.5c-3 1-5-1-8 0s-5 1-8 0c-1.5-.5-3 0-4 .5z", as: "fill", colour: "#5f8f45" },
      { d: "M2 9c1-.5 2.5-1 4-.5 3 1 5 1 8 0s5 1 8 0v7c-3 1-5-1-8 0s-5 1-8 0c-1.5-.5-3 0-4 .5z", as: "fill" },
      { d: "M2 16.5c1-.5 2.5-1 4-.5 3 1 5 1 8 0s5 1 8 0V20H2z", as: "fill", colour: "#5f8f45" },
      { d: "M5 12.2c1.5-.8 3-.8 4.5 0M13 12.6c1.5-.8 3-.8 4.5 0", as: "shine", colour: "#cfe8f7" },
    ],
  },
  /** A spot on the ground to walk to: an amber pin standing on a patch of earth. */
  ground: {
    colour: "#f0a04b",
    parts: [
      { d: "M3 18.5c0-2 4-3.5 9-3.5s9 1.5 9 3.5-4 3.5-9 3.5-9-1.5-9-3.5z", as: "fill", colour: "#8a6a45" },
      { d: "M12 19s-5-4.6-5-8.5a5 5 0 0 1 10 0c0 3.9-5 8.5-5 8.5z", as: "fill" },
      { d: circle(12, 10.5, 1.8), as: "cut" },
    ],
  },
};
