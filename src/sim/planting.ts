// Planting a sapling or a berry bush from the backpack. The player walks into reach of a spot, works there for a few seconds,
// and leaves it growing there. A sapling grows into a full tree as a felled tree does, but from the sapling stage. It does not
// block walking until it becomes a young tree. A berry bush bears its first berries 2 days after planting, then works like a
// wild bush. It never blocks walking. See .scratch/regrowth/spec.md and .scratch/garden/spec.md.
import type { Refusal } from "./api-refusal";
import type { ApproachReach } from "./approach";
import type { CommandRules } from "./command-rule";
import { hasInBackpack, removeFromBackpack, type Plantable } from "./backpack";
import { setComponent, type Entity, type EntityStore, type Vec3 } from "./entities";
import { forageSpotEntities, growingTreeEntities, mushroomLogEntities, playerEntities, stumpEntities, treeEntities } from "./entity-queries";
import { isBerryBush } from "./foraging";
import { groundDistance, type GroundPoint } from "./ground-point";
import { distanceToLogBody, logBody } from "./log-body";
import { isRiverBank } from "./river-bank-work";
import { isInRect, widenRect } from "./structure-kind";
import { footprintOfEntity, placedStructures } from "./structure-queries";
import { startOfStage } from "./tree-growth";
import { terrainHeightAt, TREE_MIN_SPACING_METRES, type Valley } from "./valley";
import { cellIndexAt, type WalkMap } from "./walk-map";

/** How long the player works to plant one sapling or berry bush, in seconds. */
export const PLANT_SECONDS = 4;

/** The player plants from this far away from the spot, in metres. */
const PLANT_REACH_METRES = 1.5;

/**
 * A sapling keeps at least this far outside the ground any structure or blueprint covers, in metres.
 * It is more than TREE_WALK_BLOCK_RADIUS_METRES, so the young tree it becomes never blocks walking inside a building or in its doorway.
 */
export const SAPLING_STRUCTURE_CLEARANCE_METRES = 1;

/** A berry bush keeps at least this far from any tree, stump, sapling, other berry bush, mushroom log, structure, blueprint, or foundation square, in metres. */
export const BERRY_BUSH_SPACING_METRES = 1;

/** A planted berry bush bears its first berries this many game minutes after planting. Two days. */
export const FIRST_BERRIES_MINUTES = 2 * 24 * 60;

/** How far the player is through planting, from 0 to 1, or undefined if they are not planting now. */
export function plantingNow(player: Entity): { progress: number } | undefined {
  if (player.plantTask === undefined) return undefined;
  return { progress: Math.min(1, player.plantTask.secondsDone / PLANT_SECONDS) };
}

/**
 * How far each kind of plant keeps from trees, stumps, and saplings, from structures, and from garden things: berry bushes and mushroom logs.
 * A sapling does not keep clear of garden things. Also what the backpack lacks without one, and what grows once it is planted.
 */
const RULES: Readonly<
  Record<Plantable, { treeSpacing: number; structureClearance: number; gardenSpacing?: number; noneLeft: Refusal; grows: (position: Vec3) => Entity }>
> = {
  sapling: {
    treeSpacing: TREE_MIN_SPACING_METRES,
    structureClearance: SAPLING_STRUCTURE_CLEARANCE_METRES,
    noneLeft: { kind: "noSapling" },
    grows: (position) => ({ growth: startOfStage("sapling"), position }),
  },
  berryBush: {
    treeSpacing: BERRY_BUSH_SPACING_METRES,
    structureClearance: BERRY_BUSH_SPACING_METRES,
    gardenSpacing: BERRY_BUSH_SPACING_METRES,
    noneLeft: { kind: "noBerryBush" },
    // A planted bush has no berries at first. Growing its first ones works as growing them back after foraging does.
    grows: (position) => ({ forageSpot: { food: "berries" }, regrowing: { minutesLeft: FIRST_BERRIES_MINUTES }, position }),
  },
};

/** Whether any of `distances` is less than `metres`. */
function anyWithin(distances: Iterable<number>, metres: number): boolean {
  for (const distance of distances) if (distance < metres) return true;
  return false;
}

export interface Planting {
  /** Where the approach takes the player to plant at a spot: within reach of it. */
  reach(spot: GroundPoint): ApproachReach;
  /** Starts the player planting `plant` at a spot within reach. The approach runs it once they arrive. The game calls it only once `refusal` passes. */
  start(plant: Plantable, spot: GroundPoint): void;
  /**
   * Why the player could not plant `plant` at this spot now: the backpack holds none, the ground is not forest floor or clearing,
   * a tree, stump, or sapling stands too close, another berry bush stands too close, or a structure or blueprint is in the way.
   * A berry bush also keeps clear of mushroom logs. A sapling keeps TREE_MIN_SPACING_METRES from trees. A berry bush keeps BERRY_BUSH_SPACING_METRES from everything.
   */
  refusal(plant: Plantable, spot: GroundPoint): Refusal | undefined;
  /** Stops the player planting. The sapling or bush stays in the backpack. */
  cancel(): void;
  /** Moves planting on by one logic step. */
  step(stepSeconds: number): undefined;
}

/** Lets the player plant saplings and berry bushes from the backpack. */
export function createPlanting(entities: EntityStore, walkMap: WalkMap, valley: Valley): Planting {
  const players = playerEntities(entities);
  const planters = entities.with("plantTask", "position", "backpack");

  /** Why `plant` cannot grow at this spot, leaving the backpack aside. */
  function spotRefusal(plant: Plantable, spot: GroundPoint): Refusal | undefined {
    if (cellIndexAt(walkMap, spot) === undefined || isRiverBank(valley, spot)) return { kind: "notPlantableGround" };
    const { treeSpacing, structureClearance, gardenSpacing } = RULES[plant];
    const away = (thing: { position: GroundPoint }) => groundDistance(thing.position, spot);
    const trees = [...treeEntities(entities), ...stumpEntities(entities), ...growingTreeEntities(entities)];
    if (anyWithin(trees.map(away), treeSpacing)) return { kind: "tooCloseToTree" };
    if (gardenSpacing !== undefined) {
      if (anyWithin(forageSpotEntities(entities).entities.filter(isBerryBush).map(away), gardenSpacing)) return { kind: "tooCloseToBerryBush" };
      // A mushroom log is 1 m long, so a bush keeps clear of all of it, not only its middle.
      const logs = mushroomLogEntities(entities).entities.map(({ position, mushroomLog }) => distanceToLogBody(logBody(position, mushroomLog.heading), spot));
      if (anyWithin(logs, gardenSpacing)) return { kind: "tooCloseToMushroomLog" };
    }
    for (const { entity } of placedStructures(entities)) {
      if (isInRect(widenRect(footprintOfEntity(entity), structureClearance), spot)) return { kind: "tooCloseToStructure" };
    }
    return undefined;
  }

  function refusal(plant: Plantable, spot: GroundPoint): Refusal | undefined {
    const backpack = players.first?.backpack;
    if (backpack !== undefined && !hasInBackpack(backpack, plant)) return RULES[plant].noneLeft;
    return spotRefusal(plant, spot);
  }

  /** What grows at a spot once it is planted. */
  function planted(plant: Plantable, spot: GroundPoint): Entity {
    return RULES[plant].grows({ x: spot.x, y: terrainHeightAt(valley.terrain, spot.x, spot.z), z: spot.z });
  }

  return {
    reach(spot) {
      const target = { x: spot.x, z: spot.z };
      return { target, metres: PLANT_REACH_METRES, walk: { style: "beside" } };
    },
    start(plant, spot) {
      if (refusal(plant, spot) !== undefined) return;
      for (const player of players) setComponent(entities, player, "plantTask", { x: spot.x, z: spot.z, secondsDone: 0, plant });
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
        // The spot may have been taken, or the plant dropped, while the player worked.
        const spot = { x: task.x, z: task.z };
        if (refusal(task.plant, spot) !== undefined || !removeFromBackpack(planter.backpack, task.plant, 1)) continue;
        entities.add(planted(task.plant, spot));
      }
      return undefined;
    },
  };
}

/** The rules for planting a sapling and a berry bush. */
export function plantingRules(planting: Planting): CommandRules<"plantSapling" | "plantBerryBush"> {
  return {
    plantSapling: {
      start: "fresh",
      refusal: (command) => planting.refusal("sapling", command),
      approach: {
        reach: (command) => planting.reach(command),
        act: (command) => {
          planting.start("sapling", { x: command.x, z: command.z });
        },
      },
    },
    plantBerryBush: {
      start: "fresh",
      refusal: (command) => planting.refusal("berryBush", command),
      approach: {
        reach: (command) => planting.reach(command),
        act: (command) => {
          planting.start("berryBush", { x: command.x, z: command.z });
        },
      },
    },
  };
}
