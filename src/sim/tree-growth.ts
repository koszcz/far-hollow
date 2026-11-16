// How far a tree has grown back: a value object (ADR 0009). A felled tree's stump grows a sapling, the sapling becomes a
// young tree, and the young tree becomes a full tree. See .scratch/regrowth/spec.md.
import { MINUTES_PER_DAY } from "./clock";

/** The stages a tree grows through before it is a full tree again, in order. */
export const GROWTH_STAGES = ["stump", "sapling", "youngTree"] as const;
export type GrowthStage = (typeof GROWTH_STAGES)[number];

/** A growing tree's stage, and the game minutes left until it reaches the next stage. */
export interface TreeGrowth {
  readonly stage: GrowthStage;
  readonly minutesLeft: number;
}

/** How long each stage lasts, in game minutes. A stump becomes a full tree 6 game days after the tree is felled. */
export const STAGE_MINUTES: Readonly<Record<GrowthStage, number>> = {
  stump: 1 * MINUTES_PER_DAY,
  sapling: 2 * MINUTES_PER_DAY,
  youngTree: 3 * MINUTES_PER_DAY,
};

/** The growth of a tree felled just now: a bare stump with the whole stump stage ahead of it. */
export function justFelled(): TreeGrowth {
  return startOfStage("stump");
}

/** The growth at the very start of `stage`. */
export function startOfStage(stage: GrowthStage): TreeGrowth {
  return { stage, minutesLeft: STAGE_MINUTES[stage] };
}

/**
 * The growth `minutes` game minutes later, or "grown" once it is a full tree.
 * A long stretch can pass more than one stage. Time left over from one stage counts toward the next.
 */
export function grow(growth: TreeGrowth, minutes: number): TreeGrowth | "grown" {
  let stage = growth.stage;
  let minutesLeft = growth.minutesLeft - minutes;
  while (minutesLeft <= 0) {
    const next = GROWTH_STAGES[GROWTH_STAGES.indexOf(stage) + 1];
    if (next === undefined) return "grown";
    stage = next;
    minutesLeft += STAGE_MINUTES[next];
  }
  return { stage, minutesLeft };
}

/** Whether the stump is still there at this stage. It goes when the sapling becomes a young tree. */
export function hasStump(growth: TreeGrowth): boolean {
  return growth.stage === "stump" || growth.stage === "sapling";
}

/** Whether this is a young tree: it stands like a tree, but is too young to chop. */
export function isYoungTree(growth: TreeGrowth | undefined): boolean {
  return growth?.stage === "youngTree";
}
