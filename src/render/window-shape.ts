// The shape of the draft "window" asset: which courses each stage lays, and where the opening is.
// The window itself, the shutters hung in it, and its night glow all fit this opening.
import { COURSE_LENGTH_METRES, courseHeights, courseRadius } from "./log-courses";

/** The courses under the opening: the sill. The window's first stage lays them. */
const SILL_COURSES = [0, 1, 2] as const;
/** The courses beside the opening, each two short logs. The window's second stage lays them. */
const COURSES_BESIDE_OPENING = [3, 4, 5] as const;
/** The courses over the opening. The window's third stage lays them. */
const COURSES_OVER_OPENING = [6, 7] as const;

/**
 * The courses of a window each stage of construction lays, from the bottom up: the sill courses, the courses beside
 * the opening, and the courses over it. A window has the same courses as a log wall, so the two line up side by side.
 */
export const WINDOW_STAGE_COURSES: readonly (readonly number[])[] = [SILL_COURSES, COURSES_BESIDE_OPENING, COURSES_OVER_OPENING];

/** How wide the window's opening is, in metres. Shutters hung in it fit this gap. */
export const WINDOW_OPENING_WIDTH_METRES = 0.6;
/** How long each short log beside the opening is, in metres: from the opening to just past the end of the edge, like a plain course. */
export const WINDOW_STUB_LENGTH_METRES = (COURSE_LENGTH_METRES - WINDOW_OPENING_WIDTH_METRES) / 2;

/** Whether a course of a window runs beside its opening, so it is two short logs. */
export function isBesideOpening(course: number): boolean {
  return (COURSES_BESIDE_OPENING as readonly number[]).includes(course);
}

/**
 * Where a window's opening is, in metres above the deck: from the top of the sill under it to the bottom of the
 * first course over it. Shutters hung in the window fit this gap.
 */
export const WINDOW_OPENING: { readonly bottom: number; readonly top: number } = (() => {
  const heights = courseHeights();
  const topSillCourse = Math.max(...SILL_COURSES);
  const lowestCourseOver = Math.min(...COURSES_OVER_OPENING);
  const sillTop = (heights[topSillCourse] ?? 0) + courseRadius(topSillCourse);
  const lintelBottom = (heights[lowestCourseOver] ?? 0) - courseRadius(lowestCourseOver);
  return { bottom: sillTop, top: lintelBottom };
})();
