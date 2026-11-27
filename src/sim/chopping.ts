import type { Refusal } from "./api-refusal";
import type { ApproachReach } from "./approach";
import { toolRefusal } from "./refusals";
import { setComponent, type Entity, type EntityStore } from "./entities";
import { growingTreeEntities, playerEntities } from "./entity-queries";
import { isYoungTree, justFelled } from "./tree-growth";
import { chopSecondsForTreeSize, logsForTreeSize, treeSizeAt } from "./tree-size";
import { terrainHeightAt, type Valley } from "./valley";
import { groundDistance, headingToward, stepAlongHeading, type GroundPoint } from "./ground-point";
import { isWalkable } from "./walk-map";
import type { Walking } from "./walking";
import type { CommandRules } from "./command-rule";

export { CHOP_SECONDS, MOST_LOGS_PER_TREE } from "./tree-size";

/** How far the player is through chopping, from 0 to 1, and the tree they chop, or undefined if they are not chopping now. */
export function choppingNow(entities: EntityStore, player: Entity): { progress: number; targetId: number } | undefined {
  if (player.chopTask === undefined) return undefined;
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
/** The felled trunk must stay this far from any other tree's, young tree's, or stump's trunk, in metres. */
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
  /** Where the approach takes the player to chop a tree: within reach of its trunk. Undefined if the entity is not a standing tree. */
  reach(treeId: number): ApproachReach | undefined;
  /**
   * Starts the player chopping a standing tree within reach. The approach runs it once they arrive.
   * Does nothing if the entity is not a standing tree. The game calls it only once `refusal` passes.
   */
  start(treeId: number): void;
  /** Why the player could not chop this tree, given by its entity id: it is a young tree, or the player has no axe. */
  refusal(treeId: number): Refusal | undefined;
  /** Stops the player chopping. The tree keeps standing. */
  cancel(): void;
  /** Moves every chop on by one logic step. Run it after walking has moved the player. */
  step(stepSeconds: number): undefined;
}

export function createChopping(entities: EntityStore, walking: Walking, valley: Valley): Chopping {
  const players = playerEntities(entities);
  const choppers = entities.with("chopTask", "position");
  const trees = entities.with("tree", "position");
  const stumps = entities.with("stump", "position");
  const growing = growingTreeEntities(entities);

  return {
    reach(treeId) {
      const tree = standingTree(treeId);
      if (tree === undefined) return undefined;
      return { target: tree.position, metres: chopReach(tree), walk: { style: "beside" } };
    },
    start(treeId) {
      if (standingTree(treeId) === undefined) return;
      for (const player of players) setComponent(entities, player, "chopTask", { treeId, secondsDone: 0 });
    },
    refusal(treeId) {
      if (isYoungTree(entities.entity(treeId)?.growth)) return { kind: "tooYoungToChop" };
      return toolRefusal(players.first, "axe");
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "chopTask");
    },
    step(stepSeconds) {
      // Copy the list first, because players who finish or give up leave the query while it is being walked.
      for (const chopper of [...choppers]) {
        const tree = standingTree(chopper.chopTask.treeId);
        if (tree === undefined) {
          entities.removeComponent(chopper, "chopTask");
          continue;
        }
        chopper.chopTask.secondsDone += stepSeconds;
        if (chopper.chopTask.secondsDone >= chopSecondsFor(tree)) {
          entities.removeComponent(chopper, "chopTask");
          // Every log lands on the ground. The player picks one up only when they choose to.
          fell(tree, tree.position, chopper.position);
        }
      }
    },
  };

  /** The standing tree with this entity id, or undefined if the entity is gone, is not a tree, or has no place. */
  function standingTree(treeId: number): (Entity & { position: NonNullable<Entity["position"]> }) | undefined {
    const tree = entities.entity(treeId);
    if (tree?.tree !== true || tree.position === undefined) return undefined;
    return tree as Entity & { position: NonNullable<Entity["position"]> };
  }

  /** Turns a standing tree at `at` into a stump that starts growing back, and lays its logs, more for a bigger tree, on clear ground, falling away from `from` if it can. */
  function fell(tree: Entity, at: GroundPoint, from: GroundPoint): void {
    const logCount = logsForTreeSize(treeSizeAt(at.x, at.z));
    const heading = clearFallHeading(tree, at, headingToward(from, at), logCount);
    // The heading goes on before the tree goes, so the renderer can read it as the tree falls.
    entities.addComponent(tree, "fellHeading", heading);
    // The stump keeps the tree's place and its `blocksWalking`, so it blocks walking just as the tree did.
    entities.removeComponent(tree, "tree");
    entities.addComponent(tree, "stump", true);
    entities.addComponent(tree, "growth", justFelled());
    for (let i = 0; i < logCount; i += 1) {
      const { x, z } = stepAlongHeading(at, heading, FIRST_LOG_FROM_STUMP_METRES + i * LOG_SPACING_METRES);
      entities.add({ log: { heading }, position: { x, y: terrainHeightAt(valley.terrain, x, z), z } });
    }
  }

  /**
   * The heading closest to `preferred` along which a trunk of `logCount` logs lies on clear ground.
   * If no heading is clear, it picks the one with the least ground in the way.
   */
  function clearFallHeading(tree: Entity, at: GroundPoint, preferred: number, logCount: number): number {
    const trunkMetres = FIRST_LOG_FROM_STUMP_METRES + (logCount - 0.5) * LOG_SPACING_METRES;
    const reach = trunkMetres + FALL_TRUNK_CLEARANCE_METRES;
    // Stumps and young trees are in the way too. A sapling grows from a stump, so the stump stands for it.
    const trunksNearby = [...new Set([...trees, ...stumps, ...growing])]
      .filter((other) => other !== tree && groundDistance(other.position, at) <= reach)
      .map((other) => other.position);
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
      const point = stepAlongHeading(at, heading, along);
      const nearTrunk = trunksNearby.some((trunk) => groundDistance(trunk, point) < FALL_TRUNK_CLEARANCE_METRES);
      const offGround = along >= STUMP_BLOCK_METRES && !isWalkable(walking.walkMap, point);
      if (nearTrunk || offGround) blocked += 1;
    }
    return blocked;
  }
}

/** The rule for chopping a tree. */
export function choppingRules(chopping: Chopping): CommandRules<"chopTree"> {
  return {
    chopTree: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => chopping.refusal(command.treeId),
      approach: {
        reach: (command) => chopping.reach(command.treeId),
        act: (command) => {
          chopping.start(command.treeId);
        },
      },
    },
  };
}
