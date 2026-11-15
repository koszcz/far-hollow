import type { Refusal } from "./api";
import { shoulderLog } from "./carrying";
import { toolRefusal } from "./refusals";
import { playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import { chopSecondsForTreeSize, logsForTreeSize, treeSizeAt } from "./tree-size";
import { groundDistance, terrainHeightAt, type GroundPoint, type Valley } from "./valley";
import { isWalkable } from "./walk-map";
import { WALK_REACH_MARGIN_METRES, type Walking } from "./walking";

export { CHOP_SECONDS, MOST_LOGS_PER_TREE } from "./tree-size";

/** How far the player is through chopping, from 0 to 1, and the tree they chop, or undefined if they are not chopping now. Walking there does not count. */
export function choppingNow(entities: EntityStore, player: Entity): { progress: number; targetId: number } | undefined {
  if (player.chopTask === undefined || player.walkPath !== undefined) return undefined;
  const { treeId, secondsDone } = player.chopTask;
  return { progress: Math.min(1, secondsDone / chopSecondsFor(entities.entity(treeId))), targetId: treeId };
}

/** How long the player chops at this tree before it falls, in seconds. A tree that is gone counts as size 1. */
function chopSecondsFor(tree: Entity | undefined): number {
  return chopSecondsForTreeSize(tree?.position === undefined ? 1 : treeSizeAt(tree.position.x, tree.position.z));
}
/** The felled trunk lies from the stump outward. These place the middle of each log along it, in metres. */
const FIRST_LOG_FROM_STUMP_METRES = 1;
const LOG_SPACING_METRES = 1.1;

/**
 * A tree falls away from the player if it can. If its logs would land on another tree, a stump, a structure, or the river,
 * it falls a little to one side instead, turning by this step each try, in radians, until the ground is clear.
 */
const FALL_TURN_STEP_RADIANS = Math.PI / 12;
/** The felled trunk must stay this far from any other tree's or stump's trunk, in metres. */
const FALL_TRUNK_CLEARANCE_METRES = 0.6;
/**
 * Along the felled trunk, the ground is checked every this many metres.
 * Points closer to the stump than STUMP_BLOCK_METRES are not checked for walking, since the stump itself blocks them.
 */
const FALL_CHECK_SPACING_METRES = 0.3;
const STUMP_BLOCK_METRES = 1.3;

/** The player can chop a tree from this far beyond the edge of the ground the tree blocks, in metres. */
const CHOP_REACH_METRES = 1;

/** How far from a tree's centre the player can chop it, in metres. */
function chopReach(tree: Entity): number {
  return (tree.blocksWalking?.radius ?? 0) + CHOP_REACH_METRES;
}

export interface Chopping {
  /** Sets the player walking to a standing tree to chop it. Does nothing if the entity is not a standing tree or the player has no axe. */
  start(treeId: number): void;
  /** Why the player could not chop a tree now: without the axe. */
  refusal(): Refusal | undefined;
  /** Stops the player chopping, or walking to chop. The tree keeps standing. */
  cancel(): void;
  /** Moves every chop on by one logic step. Run it after walking has moved the player. */
  step(stepSeconds: number): undefined;
}

export function createChopping(entities: EntityStore, walking: Walking, valley: Valley): Chopping {
  const players = playerEntities(entities);
  const choppers = entities.with("chopTask", "position");
  const trees = entities.with("tree", "position");
  const stumps = entities.with("stump", "position");

  return {
    start(treeId) {
      const tree = entities.entity(treeId);
      if (tree?.tree !== true || tree.position === undefined) return;
      for (const player of players) {
        if (toolRefusal(player, "axe") !== undefined) continue;
        walking.walkWithin(tree.position, chopReach(tree) - WALK_REACH_MARGIN_METRES);
        const task = { treeId, secondsDone: 0 };
        setComponent(entities, player, "chopTask", task);
      }
    },
    refusal() {
      return toolRefusal(players.first, "axe");
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
        if (groundDistance(tree.position, chopper.position) > chopReach(tree)) {
          // The player walked as close as they could but the tree is out of reach.
          entities.removeComponent(chopper, "chopTask");
          continue;
        }
        chopper.chopTask.secondsDone += stepSeconds;
        if (chopper.chopTask.secondsDone >= chopSecondsFor(tree)) {
          entities.removeComponent(chopper, "chopTask");
          const logs = fell(tree, tree.position, chopper.position);
          const first = logs[0];
          if (first !== undefined) shoulderLog(entities, chopper, first);
        }
      }
    },
  };

  /** Turns a standing tree at `at` into a stump and lays its logs, more for a bigger tree, on clear ground, falling away from `from` if it can. Returns the logs. */
  function fell(tree: Entity, at: GroundPoint, from: GroundPoint): Entity[] {
    const logCount = logsForTreeSize(treeSizeAt(at.x, at.z));
    const heading = clearFallHeading(tree, at, Math.atan2(at.x - from.x, at.z - from.z), logCount);
    const direction = { x: Math.sin(heading), z: Math.cos(heading) };
    // The heading goes on before the tree goes, so the renderer can read it as the tree falls.
    entities.addComponent(tree, "fellHeading", heading);
    // The stump keeps the tree's place and its `blocksWalking`, so it blocks walking just as the tree did.
    entities.removeComponent(tree, "tree");
    entities.addComponent(tree, "stump", true);
    const logs: Entity[] = [];
    for (let i = 0; i < logCount; i += 1) {
      const along = FIRST_LOG_FROM_STUMP_METRES + i * LOG_SPACING_METRES;
      const x = at.x + direction.x * along;
      const z = at.z + direction.z * along;
      logs.push(entities.add({ log: { heading }, position: { x, y: terrainHeightAt(valley.terrain, x, z), z } }));
    }
    return logs;
  }

  /**
   * The heading closest to `preferred` along which a trunk of `logCount` logs lies on clear ground.
   * If no heading is clear, it picks the one with the least ground in the way.
   */
  function clearFallHeading(tree: Entity, at: GroundPoint, preferred: number, logCount: number): number {
    const trunkMetres = FIRST_LOG_FROM_STUMP_METRES + (logCount - 0.5) * LOG_SPACING_METRES;
    const reach = trunkMetres + FALL_TRUNK_CLEARANCE_METRES;
    const trunksNearby = [...trees, ...stumps].filter((other) => other !== tree && groundDistance(other.position, at) <= reach).map((other) => other.position);
    let best = { heading: preferred, blocked: Infinity };
    const turns = Math.round(Math.PI / FALL_TURN_STEP_RADIANS);
    for (let turn = 0; turn <= turns; turn += 1) {
      for (const side of turn === 0 || turn === turns ? [1] : [1, -1]) {
        const heading = preferred + turn * side * FALL_TURN_STEP_RADIANS;
        const blocked = blockedPoints(at, heading, trunkMetres, trunksNearby);
        if (blocked === 0) return heading;
        if (blocked < best.blocked) best = { heading, blocked };
      }
    }
    return best.heading;
  }

  /** How many checked points along a felled trunk from `at` toward `heading` are in the way of another trunk or of ground the player cannot walk on. */
  function blockedPoints(at: GroundPoint, heading: number, trunkMetres: number, trunksNearby: readonly GroundPoint[]): number {
    let blocked = 0;
    for (let along = FALL_CHECK_SPACING_METRES; along <= trunkMetres; along += FALL_CHECK_SPACING_METRES) {
      const point = { x: at.x + Math.sin(heading) * along, z: at.z + Math.cos(heading) * along };
      const nearTrunk = trunksNearby.some((trunk) => groundDistance(trunk, point) < FALL_TRUNK_CLEARANCE_METRES);
      const offGround = along >= STUMP_BLOCK_METRES && !isWalkable(walking.walkMap, point);
      if (nearTrunk || offGround) blocked += 1;
    }
    return blocked;
  }
}
