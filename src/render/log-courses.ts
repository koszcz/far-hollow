// The log courses of a log wall and a window: how thick, long, and high each course is.
// The approved "log-wall" asset and the draft "window" asset share them, so a window lines up with the wall beside it.
// The roof frame, the roof, and the gable ends read the wall's height and thickness from here too.
import { BUILD_GRID_METRES } from "../sim/build-grid";
import { LOG_WALL_LOG_COST } from "../sim/structures";

/** How tall a log wall and a door frame stand above the deck, in metres. A little taller than the player. */
export const EDGE_PIECE_HEIGHT_METRES = 2;
/** Each delivered log makes this many courses of a log wall. */
export const COURSES_PER_LOG = 2;
/** How many courses a log wall has. */
const COURSE_COUNT = LOG_WALL_LOG_COST * COURSES_PER_LOG;
/**
 * How each course of a log wall differs from a plain one, from the bottom up: its thickness and length as shares of
 * the plain course, how far it sits off the middle along its length, and how far it is turned about its length, in radians.
 * A plain course is a little longer than the edge, so its ends stick out past it.
 * Fixed, so every wall looks the same and nothing changes from frame to frame.
 */
const COURSE_LOOKS = [
  { thickness: 1.06, length: 1.02, shift: 0.02, turn: 0.3 },
  { thickness: 0.95, length: 0.98, shift: -0.03, turn: 1.1 },
  { thickness: 1.02, length: 1.04, shift: 0.01, turn: 0.6 },
  { thickness: 0.93, length: 1, shift: -0.01, turn: 1.6 },
  { thickness: 1.04, length: 0.97, shift: 0.03, turn: 0.1 },
  { thickness: 0.97, length: 1.03, shift: -0.02, turn: 0.9 },
  { thickness: 1, length: 0.99, shift: 0.02, turn: 1.4 },
  { thickness: 0.94, length: 1.02, shift: -0.02, turn: 0.4 },
] as const;
/** How much of its thickness each course sinks into the notch along the top of the course below. */
const COURSE_NOTCH_SHARE = 0.12;
/** How far a plain course sticks out past each end of the edge, in metres. */
const COURSE_OVERHANG_METRES = 0.06;
/** How long a plain course is, in metres. */
export const COURSE_LENGTH_METRES = BUILD_GRID_METRES + 2 * COURSE_OVERHANG_METRES;

/** How one course of a log wall differs from a plain one. Course 0 is the bottom one. */
export function courseLook(course: number): (typeof COURSE_LOOKS)[number] {
  return COURSE_LOOKS[course % COURSE_LOOKS.length] ?? COURSE_LOOKS[0];
}

/**
 * The radius of a plain course of a log wall, in metres, chosen so the stacked courses reach exactly the wall's height.
 * It is also how far the wall reaches out from the edge it stands on.
 */
export const COURSE_RADIUS_METRES = (() => {
  const looks = Array.from({ length: COURSE_COUNT }, (_, i) => courseLook(i));
  const sunk = looks.slice(1).reduce((sum, look) => sum + look.thickness * (1 - COURSE_NOTCH_SHARE), 0);
  return EDGE_PIECE_HEIGHT_METRES / (2 * ((looks[0]?.thickness ?? 1) + sunk));
})();

/** The radius of one course of a log wall, in metres. Course 0 is the bottom one. */
export function courseRadius(course: number): number {
  return COURSE_RADIUS_METRES * courseLook(course).thickness;
}

/** The height of the middle of each course of a log wall above the deck, from the bottom up. */
export function courseHeights(): number[] {
  const heights: number[] = [];
  let top = 0;
  for (let course = 0; course < COURSE_COUNT; course++) {
    const radius = courseRadius(course);
    const bottom = course === 0 ? 0 : top - 2 * radius * COURSE_NOTCH_SHARE;
    heights.push(bottom + radius);
    top = bottom + 2 * radius;
  }
  return heights;
}

/**
 * How much lower a log wall running along z sits than one running along x, in metres: half the rise from one course to the next.
 * At a corner the logs of the two walls then take turns instead of passing through each other.
 */
export const CORNER_STAGGER_METRES = (() => {
  const heights = courseHeights();
  return ((heights[COURSE_COUNT - 1] ?? 0) - (heights[0] ?? 0)) / (COURSE_COUNT - 1) / 2;
})();
