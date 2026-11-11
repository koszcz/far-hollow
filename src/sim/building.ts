import type { BlueprintView, PlacementCheck } from "./api";
import { removeFromBackpack } from "./backpack";
import { blueprintEntities, playerEntities, setComponent, type CarriedLog, type Entity, type EntityStore } from "./entities";
import { isDelivered, stageCount, structureOf, type BuildMaterial, type DeliveredMaterial, type QuarterTurns, type StructureKind } from "./structures";
import { groundDistance, type GroundPoint, type Valley } from "./valley";
import type { Walking } from "./walking";

export { BUILD_GRID_METRES } from "./build-grid";
export { CAMPFIRE_BUILD_SECONDS, CAMPFIRE_STICK_COST, FOUNDATION_BUILD_SECONDS, FOUNDATION_LOG_COST } from "./structures";

/** The player walks to a spot this far from a blueprint's centre to build it, in metres. */
const BUILD_STAND_METRES = 1.5;
/** The player can build a blueprint, or add a material to it, from this far from its centre, in metres. */
const BUILD_REACH_METRES = 2.5;

type Blueprint = NonNullable<Entity["blueprint"]>;

export interface Building {
  /** Where a blueprint of `structure` facing `turns` would go if placed near `at`, and whether it is allowed there. Changes nothing. */
  checkPlacement(structure: StructureKind, at: GroundPoint, turns: QuarterTurns): PlacementCheck;
  /**
   * Places a blueprint of `structure` facing `turns` at the grid spot nearest to `at`. Placing costs nothing.
   * Does nothing if the structure's placement rule refuses the spot.
   */
  place(structure: StructureKind, at: GroundPoint, turns: QuarterTurns): void;
  /**
   * Starts the player building a blueprint, walking to it first if needed.
   * Building goes on for as long as the build action is held, until the piece is finished or its materials run out.
   */
  build(blueprintId: number): void;
  /**
   * Sets the player walking to a blueprint to add the material on their shoulder, such as a debarked log, to it.
   * The material is added only if the blueprint still needs more of it.
   */
  deliver(blueprintId: number): void;
  /** Stops the player building, or walking to build or to add a material. The blueprint keeps its progress. */
  cancel(): void;
  /** What a blueprint needs and has, or undefined if the entity is not a blueprint. */
  describe(blueprintId: number): BlueprintView | undefined;
  /** The blueprint nearest the player within reach, or undefined if none is. */
  nearby(): BlueprintView | undefined;
  /** Moves construction and deliveries on by one logic step. Run it after walking has moved the player. */
  step(stepSeconds: number): void;
}

/** Lets the player place blueprints, add materials to them, and turn them into finished building pieces. */
export function createBuilding(entities: EntityStore, walking: Walking, valley: Valley): Building {
  const players = playerEntities(entities);
  const blueprints = blueprintEntities(entities);
  const builders = entities.with("buildTask", "position", "backpack");
  const deliverers = entities.with("deliverTask", "position");

  function checkPlacement(structure: StructureKind, at: GroundPoint, turns: QuarterTurns): PlacementCheck {
    const definition = structureOf(structure);
    const { x, z } = definition.snap(at);
    const allowed = definition.canPlace({ entities, walkMap: walking.walkMap, valley }, { x, z }, turns);
    return Object.freeze({ spot: Object.freeze({ x, y: definition.heightAt(valley.terrain, { x, z }), z }), allowed });
  }

  /** Walks the player beside a blueprint if it is out of reach, then gives them a task on it. */
  function goTo(blueprintId: number, task: "buildTask" | "deliverTask"): void {
    const blueprint = entities.entity(blueprintId);
    if (blueprint?.blueprint === undefined || blueprint.position === undefined) return;
    for (const player of players) {
      const dx = player.position.x - blueprint.position.x;
      const dz = player.position.z - blueprint.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > BUILD_REACH_METRES) {
        // Stand beside the blueprint on the player's side, not on top of it, so a finished piece never traps them.
        const away = distance > 0 ? { x: dx / distance, z: dz / distance } : { x: 1, z: 0 };
        walking.walkTo({
          x: blueprint.position.x + away.x * BUILD_STAND_METRES,
          z: blueprint.position.z + away.z * BUILD_STAND_METRES,
        });
      }
      setComponent(entities, player, task, { blueprintId });
    }
  }

  /** The blueprint a task points at, if it still exists and the player has reached it. */
  function reachedBlueprint(worker: Entity & { position: GroundPoint }, blueprintId: number) {
    const target = entities.entity(blueprintId);
    if (target?.blueprint === undefined || target.position === undefined) return undefined;
    // The player may have walked as close as they could but still be out of reach.
    if (groundDistance(target.position, worker.position) > BUILD_REACH_METRES) return undefined;
    return { target, blueprint: target.blueprint };
  }

  function describe(blueprintId: number): BlueprintView | undefined {
    const blueprint = entities.entity(blueprintId)?.blueprint;
    if (blueprint === undefined) return undefined;
    const deliveries = structureOf(blueprint.piece).cost.flatMap(({ material, count }) =>
      isDelivered(material) ? [Object.freeze({ material, has: blueprint.delivered[material] ?? 0, needs: count })] : [],
    );
    return Object.freeze({ id: blueprintId, structure: blueprint.piece, progress: blueprint.progress, deliveries: Object.freeze(deliveries) });
  }

  return {
    checkPlacement,
    place(structure, at, turns) {
      const { spot, allowed } = checkPlacement(structure, at, turns);
      if (!allowed) return;
      structureOf(structure).clearSite?.(entities, spot);
      entities.add({
        blueprint: { piece: structure, progress: 0, spent: {}, delivered: {} },
        facing: { turns },
        position: { ...spot },
      });
    },
    build(blueprintId) {
      goTo(blueprintId, "buildTask");
    },
    deliver(blueprintId) {
      goTo(blueprintId, "deliverTask");
    },
    cancel() {
      for (const player of players) {
        entities.removeComponent(player, "buildTask");
        entities.removeComponent(player, "deliverTask");
      }
    },
    describe,
    nearby() {
      let nearest: { id: number; distance: number } | undefined;
      for (const player of players) {
        for (const blueprint of blueprints) {
          const distance = groundDistance(blueprint.position, player.position);
          const id = entities.id(blueprint);
          if (id === undefined || distance > BUILD_REACH_METRES || (nearest !== undefined && distance >= nearest.distance)) continue;
          nearest = { id, distance };
        }
      }
      return nearest === undefined ? undefined : describe(nearest.id);
    },
    step(stepSeconds) {
      // Copy each list first, because players who finish or give up leave the query while it is being walked.
      for (const deliverer of [...deliverers]) {
        if (deliverer.walkPath) continue;
        const reached = reachedBlueprint(deliverer, deliverer.deliverTask.blueprintId);
        entities.removeComponent(deliverer, "deliverTask");
        const carried = deliverer.carrying;
        if (reached === undefined || carried === undefined || !isBuildMaterial(carried) || !needsMore(reached.blueprint, carried)) continue;
        entities.removeComponent(deliverer, "carrying");
        reached.blueprint.delivered[carried] = (reached.blueprint.delivered[carried] ?? 0) + 1;
      }
      for (const builder of [...builders]) {
        if (builder.walkPath) continue;
        const reached = reachedBlueprint(builder, builder.buildTask.blueprintId);
        if (reached === undefined || !buildOn(reached.blueprint, builder.backpack, stepSeconds)) {
          entities.removeComponent(builder, "buildTask");
          continue;
        }
        if (reached.blueprint.progress < 1) continue;
        entities.removeComponent(builder, "buildTask");
        const { target, blueprint } = reached;
        entities.removeComponent(target, "blueprint");
        for (const [key, value] of Object.entries(structureOf(blueprint.piece).finishedComponents())) {
          setComponent(entities, target, key as keyof Entity, value as never);
        }
      }
    },
  };
}

/** Whether something the player carries on their shoulder is a material any structure is built from. A log with its bark on is not. */
function isBuildMaterial(carried: CarriedLog): carried is DeliveredMaterial {
  return isDelivered(carried as BuildMaterial);
}

/** Whether a blueprint still needs more of a material carried to it. */
function needsMore(blueprint: Blueprint, material: BuildMaterial): boolean {
  const cost = structureOf(blueprint.piece).cost.find((item) => item.material === material);
  return cost !== undefined && isDelivered(material) && (blueprint.delivered[material] ?? 0) < cost.count;
}

/**
 * Works on a blueprint for one step. Each stage spends its material before work on it starts:
 * a backpack material comes out of the backpack, and a delivered one from what was carried to the blueprint.
 * Returns false, changing nothing, when the next stage's material has run out.
 */
function buildOn(blueprint: Blueprint, backpack: NonNullable<Entity["backpack"]>, stepSeconds: number): boolean {
  const structure = structureOf(blueprint.piece);
  const stages = stageCount(structure);
  const spentInAll = Object.values(blueprint.spent).reduce((sum, count) => sum + count, 0);
  if (spentInAll < stageOf(blueprint.progress, stages) + 1) {
    const next = structure.cost.find(({ material, count }) => (blueprint.spent[material] ?? 0) < count);
    if (next === undefined) return false;
    const { material } = next;
    const spent = blueprint.spent[material] ?? 0;
    const available = isDelivered(material) ? (blueprint.delivered[material] ?? 0) > spent : removeFromBackpack(backpack, material, 1);
    if (!available) return false;
    blueprint.spent[material] = spent + 1;
  }
  const spentNow = Object.values(blueprint.spent).reduce((sum, count) => sum + count, 0);
  blueprint.progress = Math.min(spentNow / stages, blueprint.progress + stepSeconds / structure.buildSeconds);
  return true;
}

/** Which stage of construction a blueprint is in, from 0 to one less than `stages`. */
export function stageOf(progress: number, stages: number): number {
  // The small allowance stops rounding errors from holding a stage back at its very end.
  return Math.min(stages - 1, Math.floor(progress * stages + 1e-9));
}
