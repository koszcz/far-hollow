// Grows felled trees back over game time: stump, then sapling, then young tree, then a full tree. See .scratch/regrowth/spec.md.
// A growing tree is the felled tree's own entity, so it keeps its spot and its `blocksWalking` through every stage.
import { growingTreeEntities, type EntityStore } from "./entities";
import { grow, hasStump } from "./tree-growth";

export interface Regrowth {
  /** Grows every growing tree on by this many game minutes. Time asleep counts the same as time awake. */
  grow(gameMinutes: number): void;
}

export function createRegrowth(entities: EntityStore): Regrowth {
  const growing = growingTreeEntities(entities);
  return {
    grow(gameMinutes) {
      // Copy the list first, because trees that are full grown leave the query while it is being walked.
      for (const tree of [...growing]) {
        const next = grow(tree.growth, gameMinutes);
        if (next !== "grown") tree.growth = next;
        if ((next === "grown" || !hasStump(next)) && tree.stump === true) {
          entities.removeComponent(tree, "stump");
          // The tree may be felled again, and then it falls its own new way.
          entities.removeComponent(tree, "fellHeading");
        }
        if (next === "grown") {
          entities.removeComponent(tree, "growth");
          entities.addComponent(tree, "tree", true);
        }
      }
    },
  };
}
