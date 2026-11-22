// Grows trees back over game time: stump, then sapling, then young tree, then a full tree. See .scratch/regrowth/spec.md.
// A felled tree grows back as the felled tree's own entity, so it keeps its spot and its `blocksWalking` through every stage.
// A planted sapling starts at the sapling stage and blocks no walking until it becomes a young tree.
import { growingTreeEntities, playerEntities, type Entity, type EntityStore } from "./entities";
import { groundDistance, type GroundPoint } from "./ground-point";
import { grow, hasStump, type TreeGrowth } from "./tree-growth";
import { TREE_WALK_BLOCK_RADIUS_METRES } from "./tree-size";
import { cellCentre, cellIndexAt, type WalkMap } from "./walk-map";

export interface Regrowth {
  /**
   * Grows every growing tree on by this many game minutes. Time asleep counts the same as time awake.
   * A planted sapling waits to become a young tree while the player stands where the young tree would block walking.
   */
  grow(gameMinutes: number): void;
}

export function createRegrowth(entities: EntityStore, walkMap: WalkMap): Regrowth {
  const growing = growingTreeEntities(entities);
  const players = playerEntities(entities);

  /** Whether a tree starting to block walking at `spot` would shut a player in: they stand within its radius, or in a cell it would block. */
  function playerInTheWay(spot: GroundPoint): boolean {
    return players.entities.some((player) => {
      if (groundDistance(player.position, spot) <= TREE_WALK_BLOCK_RADIUS_METRES) return true;
      const cell = cellIndexAt(walkMap, player.position);
      return cell !== undefined && groundDistance(cellCentre(walkMap, cell), spot) <= TREE_WALK_BLOCK_RADIUS_METRES;
    });
  }

  /**
   * The growth a tree reaches next. A tree that blocks no walking yet, a planted sapling, starts to block it as a young tree.
   * While the player is in the way, it holds at the very end of the sapling stage instead.
   */
  function heldBack(tree: Entity & { position: GroundPoint }, next: TreeGrowth | "grown"): TreeGrowth | "grown" {
    if (tree.blocksWalking !== undefined || (next !== "grown" && next.stage === "sapling")) return next;
    if (playerInTheWay(tree.position)) return { stage: "sapling", minutesLeft: 0 };
    entities.addComponent(tree, "blocksWalking", { radius: TREE_WALK_BLOCK_RADIUS_METRES });
    return next;
  }

  return {
    grow(gameMinutes) {
      // Copy the list first, because trees that are full grown leave the query while it is being walked.
      for (const tree of [...growing]) {
        const next = heldBack(tree, grow(tree.growth, gameMinutes));
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
