import type { BlueprintView, PlacementCheck } from "./api";
import { hasInBackpack, removeFromBackpack } from "./backpack";
import { snapToGridPoint } from "./build-grid";
import { blueprintEntities, playerEntities, setComponent, type CarriedLog, type Entity, type EntityStore } from "./entities";
import {
  isDelivered, stageMaterials, structureOf, type BuildMaterial, type DeliveredMaterial, type GroundRect, type QuarterTurns, type StructureKind,
} from "./structures";
import { terrainHeightAt, type GroundPoint, type Valley } from "./valley";
import type { Walking } from "./walking";

export { BUILD_GRID_METRES } from "./build-grid";
export { CAMPFIRE_BUILD_SECONDS, CAMPFIRE_STICK_COST, FOUNDATION_BUILD_SECONDS, FOUNDATION_LOG_COST } from "./structures";

/** The player walks to a spot this far outside the ground a blueprint covers to build it, in metres. */
export const BUILD_STAND_METRES = 0.7;
/** The player can build a blueprint, or add a material to it, from this far outside the ground it covers, in metres. */
export const BUILD_REACH_METRES = 1.7;

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
   * Building goes on for as long as the build action is held, until the piece is finished or the next material runs out.
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
    const site = { entities, walkMap: walking.walkMap, valley };
    const { x, z } = definition.snap?.(site, at, turns) ?? snapToBuildGrid(at);
    const allowed = definition.canPlace(site, { x, z }, turns);
    const y = definition.heightAt?.(site, { x, z }) ?? terrainHeightAt(valley.terrain, x, z);
    return Object.freeze({ spot: Object.freeze({ x, y, z }), allowed });
  }

  /** Walks the player just outside a blueprint if they are out of reach or standing on it, then gives them a task on it. */
  function goTo(blueprintId: number, task: "buildTask" | "deliverTask"): void {
    const blueprint = entities.entity(blueprintId);
    if (blueprint?.blueprint === undefined || blueprint.position === undefined) return;
    const footprint = footprintOf(blueprint.blueprint.piece, blueprint.position, blueprint.facing?.turns ?? 0);
    for (const player of players) {
      const outside = distanceOutside(footprint, player.position);
      // A player standing on the blueprint steps off it too, so a finished piece never traps them.
      if (outside > BUILD_REACH_METRES || outside === 0) {
        // Stand just outside the blueprint on the player's side.
        walking.walkTo(standSpot(footprint, blueprint.position, player.position));
      }
      setComponent(entities, player, task, { blueprintId });
    }
  }

  /** The blueprint a task points at, if it still exists and the worker has it within reach. */
  function reachedBlueprint(worker: { position: GroundPoint }, blueprintId: number) {
    const target = entities.entity(blueprintId);
    const blueprint = target?.blueprint;
    const position = target?.position;
    if (target === undefined || blueprint === undefined || position === undefined) return undefined;
    // The player may have walked as close as they could but still be out of reach.
    const footprint = footprintOf(blueprint.piece, position, target.facing?.turns ?? 0);
    if (distanceOutside(footprint, worker.position) > BUILD_REACH_METRES) return undefined;
    return { target, blueprint, position };
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
        blueprint: { piece: structure, progress: 0, materialsSpent: 0, delivered: {} },
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
          const footprint = footprintOf(blueprint.blueprint.piece, blueprint.position, blueprint.facing?.turns ?? 0);
          const distance = distanceOutside(footprint, player.position);
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
        const { target, blueprint, position } = reached;
        entities.removeComponent(target, "blueprint");
        const finished = structureOf(blueprint.piece).finish({ x: position.x, z: position.z }, target.facing?.turns ?? 0, entities);
        for (const key of Object.keys(finished) as (keyof Entity)[]) entities.addComponent(target, key, finished[key]);
      }
    },
  };
}

/** Whether something the player carries on their shoulder is a material a structure is built from. A log with its bark on is not. */
function isBuildMaterial(carried: CarriedLog): carried is DeliveredMaterial {
  return isDelivered(carried as BuildMaterial);
}

/** Whether a blueprint still needs more of a material carried to it. */
function needsMore(blueprint: Blueprint, material: DeliveredMaterial): boolean {
  const needed = structureOf(blueprint.piece).cost.find((item) => item.material === material)?.count ?? 0;
  return (blueprint.delivered[material] ?? 0) < needed;
}

/**
 * Works on a blueprint for one step. Each stage spends its material before work on it starts:
 * a backpack material comes out of the backpack, and a delivered one from what was carried to the blueprint.
 * Returns false, changing nothing, when the next stage's material has run out or the player lacks the tool the structure needs.
 */
function buildOn(blueprint: Blueprint, backpack: NonNullable<Entity["backpack"]>, stepSeconds: number): boolean {
  const structure = structureOf(blueprint.piece);
  if (structure.tool !== undefined && !hasInBackpack(backpack, structure.tool)) return false;
  const stages = stageMaterials(structure.cost);
  if (blueprint.materialsSpent < stageOf(blueprint.progress, stages.length) + 1) {
    const material = stages[blueprint.materialsSpent];
    if (material === undefined) return false;
    if (isDelivered(material)) {
      const spent = stages.slice(0, blueprint.materialsSpent).filter((earlier) => earlier === material).length;
      if ((blueprint.delivered[material] ?? 0) <= spent) return false;
    } else if (!removeFromBackpack(backpack, material, 1)) {
      return false;
    }
    blueprint.materialsSpent += 1;
  }
  blueprint.progress = Math.min(blueprint.materialsSpent / stages.length, blueprint.progress + stepSeconds / structure.buildSeconds);
  return true;
}

/** Which stage of construction a blueprint is in, from 0 to one less than its number of stages. */
export function stageOf(progress: number, stages: number): number {
  // The small allowance stops rounding errors from holding a stage back at its very end.
  return Math.min(stages - 1, Math.floor(progress * stages + 1e-9));
}

/** The grid point nearest to a spot. */
export function snapToBuildGrid(at: GroundPoint): GroundPoint {
  return snapToGridPoint(at);
}

/** The ground a blueprint of `piece` covers at `at`, facing `turns`. */
export function footprintOf(piece: StructureKind, at: GroundPoint, turns: QuarterTurns): GroundRect {
  return structureOf(piece).footprint({ x: at.x, z: at.z }, turns);
}

/** How far a spot lies outside a rectangle, in metres. It is 0 for a spot inside it. */
export function distanceOutside(rect: GroundRect, spot: GroundPoint): number {
  const dx = Math.max(rect.min.x - spot.x, 0, spot.x - rect.max.x);
  const dz = Math.max(rect.min.z - spot.z, 0, spot.z - rect.max.z);
  return Math.hypot(dx, dz);
}

/** Where the player stands to build: just outside the blueprint, on the line from its centre towards the player. */
export function standSpot(rect: GroundRect, centre: GroundPoint, player: GroundPoint): GroundPoint {
  const dx = player.x - centre.x;
  const dz = player.z - centre.z;
  const distance = Math.hypot(dx, dz);
  const away = distance > 0 ? { x: dx / distance, z: dz / distance } : { x: 1, z: 0 };
  // How far along that line the edge of the blueprint is.
  const halfX = (rect.max.x - rect.min.x) / 2;
  const halfZ = (rect.max.z - rect.min.z) / 2;
  const toEdge = Math.min(away.x === 0 ? Infinity : halfX / Math.abs(away.x), away.z === 0 ? Infinity : halfZ / Math.abs(away.z));
  const reach = toEdge + BUILD_STAND_METRES;
  return { x: centre.x + away.x * reach, z: centre.z + away.z * reach };
}
