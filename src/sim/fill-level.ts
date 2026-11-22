/**
 * A fill level: how many whole ones something holds, up to a limit, and how far it is toward the next one.
 * A rain barrel holds its drinks this way. Progress carries over from one filling to the next, and stops while it is full.
 * Each function returns a new level. The caller assigns it back to the component. See ADR 0009.
 */

/** How many whole ones it holds, and how far toward the next one, from 0 up to but not including 1. */
export interface FillLevel {
  readonly held: number;
  readonly progress: number;
}

/** Nothing held, and no progress toward the first one. */
export const EMPTY_FILL: FillLevel = Object.freeze({ held: 0, progress: 0 });

/** Progress this close to a whole one counts as a whole one, so many small fillings that add up to 1 make 1. */
const WHOLE_TOLERANCE = 1e-6;

/**
 * The level after it fills by `share` of one whole: each whole share adds one, and the part left over carries over.
 * It holds at most `limit`. A full level builds up no progress.
 */
export function fillBy(level: FillLevel, share: number, limit: number): FillLevel {
  if (level.held >= limit) return { held: limit, progress: 0 };
  const total = level.progress + Math.max(0, share);
  const whole = Math.floor(total + WHOLE_TOLERANCE);
  const held = level.held + whole;
  if (held >= limit) return { held: limit, progress: 0 };
  return { held, progress: Math.max(0, total - whole) };
}

/** The level with one whole taken out. Its progress stays. An empty level stays empty. */
export function takeOne(level: FillLevel): FillLevel {
  return { held: Math.max(0, level.held - 1), progress: level.progress };
}

/** Whether it holds nothing whole. */
export function isEmptyFill(level: FillLevel): boolean {
  return level.held <= 0;
}

/** Whether a value is a fill level's progress: a finite number from 0 up to but not including 1. A save check uses it. */
export function isFillProgress(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 1;
}
