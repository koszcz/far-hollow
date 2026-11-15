// How big each standing tree is. A bigger tree gives more logs but takes longer to chop down.
// The renderer draws each tree at this size, so what the player sees matches what the tree gives.

/** The smallest and largest tree, as a share of the tree model's own size. */
export const TREE_MIN_SIZE = 0.8;
export const TREE_MAX_SIZE = 1.25;

/** How many logs a tree gives, by size: below the first limit it gives the fewest, at or above the last it gives the most. */
const LOG_COUNT_SIZE_LIMITS = [0.95, 1.1] as const;
export const FEWEST_LOGS_PER_TREE = 3;
/** The most logs any tree gives. */
export const MOST_LOGS_PER_TREE = FEWEST_LOGS_PER_TREE + LOG_COUNT_SIZE_LIMITS.length;

/** How long the player chops at a tree of size 1 before it falls, in seconds. */
export const CHOP_SECONDS = 4;

/**
 * A steady value from 0 to 1 for a spot. It sets the size of a tree that grows there.
 * The renderer also turns each tree by it, so trees do not all face the same way.
 */
export function treeLookAt(x: number, z: number): number {
  const value = Math.sin(x * 12.9898 + z * 78.233) * 43_758.5453;
  return value - Math.floor(value);
}

/** The size of a tree whose trunk stands at this spot, from TREE_MIN_SIZE to TREE_MAX_SIZE. */
export function treeSizeAt(x: number, z: number): number {
  return TREE_MIN_SIZE + (TREE_MAX_SIZE - TREE_MIN_SIZE) * treeLookAt(x, z);
}

/** How many logs a tree of this size gives when felled. */
export function logsForTreeSize(size: number): number {
  return FEWEST_LOGS_PER_TREE + LOG_COUNT_SIZE_LIMITS.filter((limit) => size >= limit).length;
}

/** How long the player chops at a tree of this size before it falls, in seconds. It grows with the trunk's cross-section. */
export function chopSecondsForTreeSize(size: number): number {
  return CHOP_SECONDS * size * size;
}
