// The timed work whose motion the drawing shows, and so makes a sound. This list is the one place that names it.

/** Chopping, sawing at the sawhorse, debarking, digging up, and building. */
export const DRAWN_WORK = ["chop", "saw", "debark", "digUp", "build"] as const;

/** One kind of timed work whose motion the drawing shows. */
export type DrawnWork = (typeof DRAWN_WORK)[number];

/**
 * Whether an activity of this kind draws its own motion. Sawing is not an activity of its own: the drawing shows it
 * for a recipe made at the sawhorse.
 */
export function isDrawnWork(kind: string): kind is DrawnWork {
  return (DRAWN_WORK as readonly string[]).includes(kind);
}
