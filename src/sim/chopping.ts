import { hasInBackpack } from "./backpack";
import { shoulderLog } from "./carrying";
import { playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import { groundDistance, terrainHeightAt, type GroundPoint, type Valley } from "./valley";
import type { Walking } from "./walking";

/** How long the player chops at a tree before it falls, in seconds. */
export const CHOP_SECONDS = 4;

/** How far the player is through chopping, from 0 to 1, and the tree they chop, or undefined if they are not chopping now. Walking there does not count. */
export function choppingNow(player: Entity): { progress: number; targetId: number } | undefined {
  if (player.chopTask === undefined || player.walkPath !== undefined) return undefined;
  return { progress: Math.min(1, player.chopTask.secondsDone / CHOP_SECONDS), targetId: player.chopTask.treeId };
}

/** How many logs a felled tree gives. */
export const LOGS_PER_TREE = 3;
/** The felled trunk lies from the stump outward. These place the middle of each log along it, in metres. */
const FIRST_LOG_FROM_STUMP_METRES = 1;
const LOG_SPACING_METRES = 1.1;

/** The player can chop a tree from this far beyond the edge of the ground the tree blocks, in metres. */
const CHOP_REACH_METRES = 1;

export interface Chopping {
  /** Sets the player walking to a standing tree to chop it. Does nothing if the entity is not a standing tree or the player has no axe. */
  start(treeId: number): void;
  /** Stops the player chopping, or walking to chop. The tree keeps standing. */
  cancel(): void;
  /** Moves every chop on by one logic step. Run it after walking has moved the player. */
  step(stepSeconds: number): undefined;
}

export function createChopping(entities: EntityStore, walking: Walking, valley: Valley): Chopping {
  const players = playerEntities(entities);
  const choppers = entities.with("chopTask", "position");

  return {
    start(treeId) {
      const tree = entities.entity(treeId);
      if (tree?.tree !== true || tree.position === undefined) return;
      for (const player of players) {
        if (player.backpack === undefined || !hasInBackpack(player.backpack, "axe")) continue;
        walking.walkTo(tree.position);
        const task = { treeId, secondsDone: 0 };
        setComponent(entities, player, "chopTask", task);
      }
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "chopTask");
    },
    step(stepSeconds) {
      // Copy the list first, because players who finish or give up leave the query while it is being walked.
      for (const chopper of [...choppers]) {
        if (chopper.walkPath) continue;
        const tree = entities.entity(chopper.chopTask.treeId);
        if (tree?.tree !== true || tree.position === undefined) {
          entities.removeComponent(chopper, "chopTask");
          continue;
        }
        const reach = (tree.blocksWalking?.radius ?? 0) + CHOP_REACH_METRES;
        if (groundDistance(tree.position, chopper.position) > reach) {
          // The player walked as close as they could but the tree is out of reach.
          entities.removeComponent(chopper, "chopTask");
          continue;
        }
        chopper.chopTask.secondsDone += stepSeconds;
        if (chopper.chopTask.secondsDone >= CHOP_SECONDS) {
          entities.removeComponent(chopper, "chopTask");
          const logs = fell(tree, tree.position, chopper.position);
          const first = logs[0];
          if (first !== undefined) shoulderLog(entities, chopper, first);
        }
      }
    },
  };

  /** Turns a standing tree at `at` into a stump and lays its logs on the ground, falling away from `from`. Returns the logs. */
  function fell(tree: Entity, at: GroundPoint, from: GroundPoint): Entity[] {
    // The stump keeps the tree's place and its `blocksWalking`, so it blocks walking just as the tree did.
    entities.removeComponent(tree, "tree");
    entities.addComponent(tree, "stump", true);
    const awayX = at.x - from.x;
    const awayZ = at.z - from.z;
    const length = Math.hypot(awayX, awayZ) || 1;
    const direction = { x: awayX / length, z: awayZ / length };
    const heading = Math.atan2(direction.x, direction.z);
    const logs: Entity[] = [];
    for (let i = 0; i < LOGS_PER_TREE; i += 1) {
      const along = FIRST_LOG_FROM_STUMP_METRES + i * LOG_SPACING_METRES;
      const x = at.x + direction.x * along;
      const z = at.z + direction.z * along;
      logs.push(entities.add({ log: { heading }, position: { x, y: terrainHeightAt(valley.terrain, x, z), z } }));
    }
    return logs;
  }
}
