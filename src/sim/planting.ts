// Planting a sapling from the backpack. The player walks into reach of a spot, works there for a few seconds, and leaves a
// sapling growing from the ground. It grows into a full tree as a felled tree does, but from the sapling stage.
// A planted sapling does not block walking until it becomes a young tree. See .scratch/regrowth/spec.md.
import type { Refusal } from "./api";
import type { ApproachReach } from "./approach";
import type { CommandRules } from "./command-rule";
import { hasInBackpack, removeFromBackpack } from "./backpack";
import { growingTreeEntities, playerEntities, setComponent, stumpEntities, treeEntities, type Entity, type EntityStore } from "./entities";
import { groundDistance, type GroundPoint } from "./ground-point";
import { isRiverBank } from "./stone";
import { isInRect } from "./structure-kind";
import { footprintOfEntity, placedStructures } from "./structures";
import { startOfStage } from "./tree-growth";
import { terrainHeightAt, TREE_MIN_SPACING_METRES, type Valley } from "./valley";
import { cellIndexAt, type WalkMap } from "./walk-map";

/** How long the player works to plant one sapling, in seconds. */
export const PLANT_SECONDS = 4;

/** The player plants a sapling from this far away from its spot, in metres. */
const PLANT_REACH_METRES = 1.5;

/** A sapling keeps at least this far outside the ground any structure or blueprint covers, in metres. */
export const SAPLING_STRUCTURE_CLEARANCE_METRES = 1;

/** How far the player is through planting a sapling, from 0 to 1, or undefined if they are not planting now. */
export function plantingNow(player: Entity): { progress: number } | undefined {
  if (player.plantTask === undefined) return undefined;
  return { progress: Math.min(1, player.plantTask.secondsDone / PLANT_SECONDS) };
}

export interface Planting {
  /** Where the approach takes the player to plant a sapling at a spot: within reach of it. */
  reach(spot: GroundPoint): ApproachReach;
  /** Starts the player planting a sapling at a spot within reach. The approach runs it once they arrive. The game calls it only once `refusal` passes. */
  start(spot: GroundPoint): void;
  /**
   * Why the player could not plant a sapling at this spot now: the backpack holds none, the ground is not forest floor or clearing,
   * a tree, stump, or sapling stands within TREE_MIN_SPACING_METRES, or a structure or blueprint is in the way.
   */
  refusal(spot: GroundPoint): Refusal | undefined;
  /** Stops the player planting. The sapling stays in the backpack. */
  cancel(): void;
  /** Moves planting on by one logic step. */
  step(stepSeconds: number): undefined;
}

/** Lets the player plant saplings from the backpack. */
export function createPlanting(entities: EntityStore, walkMap: WalkMap, valley: Valley): Planting {
  const players = playerEntities(entities);
  const planters = entities.with("plantTask", "position", "backpack");

  /** Why a sapling cannot grow at this spot, leaving the backpack aside. */
  function spotRefusal(spot: GroundPoint): Refusal | undefined {
    if (cellIndexAt(walkMap, spot) === undefined || isRiverBank(valley, spot)) return { kind: "notPlantableGround" };
    const trees = [...treeEntities(entities), ...stumpEntities(entities), ...growingTreeEntities(entities)];
    if (trees.some((tree) => groundDistance(tree.position, spot) < TREE_MIN_SPACING_METRES)) return { kind: "tooCloseToTree" };
    const clearance = SAPLING_STRUCTURE_CLEARANCE_METRES;
    for (const { entity } of placedStructures(entities)) {
      const { min, max } = footprintOfEntity(entity);
      const around = { min: { x: min.x - clearance, z: min.z - clearance }, max: { x: max.x + clearance, z: max.z + clearance } };
      if (isInRect(around, spot)) return { kind: "tooCloseToStructure" };
    }
    return undefined;
  }

  function refusal(spot: GroundPoint): Refusal | undefined {
    const backpack = players.first?.backpack;
    if (backpack !== undefined && !hasInBackpack(backpack, "sapling")) return { kind: "noSapling" };
    return spotRefusal(spot);
  }

  return {
    reach(spot) {
      const target = { x: spot.x, z: spot.z };
      return { target, metres: PLANT_REACH_METRES, walk: { style: "beside" } };
    },
    start(spot) {
      if (refusal(spot) !== undefined) return;
      for (const player of players) setComponent(entities, player, "plantTask", { x: spot.x, z: spot.z, secondsDone: 0 });
    },
    refusal,
    cancel() {
      for (const player of players) entities.removeComponent(player, "plantTask");
    },
    step(stepSeconds) {
      // Copy the list first, because players who finish or give up leave the query while it is being walked.
      for (const planter of [...planters]) {
        const task = planter.plantTask;
        task.secondsDone += stepSeconds;
        if (task.secondsDone < PLANT_SECONDS) continue;
        entities.removeComponent(planter, "plantTask");
        // The spot may have been taken, or the sapling dropped, while the player worked.
        const spot = { x: task.x, z: task.z };
        if (refusal(spot) !== undefined || !removeFromBackpack(planter.backpack, "sapling", 1)) continue;
        entities.add({ growth: startOfStage("sapling"), position: { x: spot.x, y: terrainHeightAt(valley.terrain, spot.x, spot.z), z: spot.z } });
      }
      return undefined;
    },
  };
}

/** The rule for planting a sapling. */
export function plantingRules(planting: Planting): CommandRules<"plantSapling"> {
  return {
    plantSapling: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => planting.refusal(command),
      approach: {
        reach: (command) => planting.reach(command),
        act: (command) => {
          planting.start({ x: command.x, z: command.z });
        },
      },
    },
  };
}
