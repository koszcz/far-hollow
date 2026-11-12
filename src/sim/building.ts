import type { BlueprintView, BuildLack, PlacementCheck } from "./api";
import { hasInBackpack, removeFromBackpack } from "./backpack";
import { snapToGridPoint } from "./build-grid";
import { blueprintEntities, playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import {
  footprintOfEntity,
  isDelivered,
  isPlacedStructure,
  stageMaterials,
  structureOf,
  type BuildMaterial,
  type DeliveredMaterial,
  type GroundRect,
  type QuarterTurns,
  type StructureKind,
} from "./structures";
import { terrainHeightAt, type GroundPoint, type Valley } from "./valley";
import type { Walking } from "./walking";

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
   * Returns the new blueprint's entity id. Does nothing, and returns undefined, if the structure's placement rule refuses the spot.
   */
  place(structure: StructureKind, at: GroundPoint, turns: QuarterTurns): number | undefined;
  /** Whether the player could start building a blueprint now: they have the tool it needs and the material for its next stage. */
  canStartBuilding(blueprintId: number): boolean;
  /**
   * Starts the player building a blueprint, walking to it first if needed.
   * Building goes on until the player stops, the piece is finished, or the next material runs out.
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
  step(stepSeconds: number): undefined;
}

/**
 * Lets the player place blueprints, add materials to them, and turn them into finished building pieces.
 * With `freeBuilding`, building spends no materials and needs no tools. The playground uses it.
 */
export function createBuilding(entities: EntityStore, walking: Walking, valley: Valley, freeBuilding = false): Building {
  const players = playerEntities(entities);
  const blueprints = blueprintEntities(entities);
  const builders = entities.with("buildTask", "position", "backpack");
  const deliverers = entities.with("deliverTask", "position");

  function checkPlacement(structure: StructureKind, at: GroundPoint, turns: QuarterTurns): PlacementCheck {
    const definition = structureOf(structure);
    const site = { entities, walkMap: walking.walkMap, valley };
    const { x, z } = definition.snap?.(site, at, turns) ?? snapToGridPoint(at);
    const allowed = definition.canPlace(site, { x, z }, turns);
    const y = definition.heightAt?.(site, { x, z }) ?? terrainHeightAt(valley.terrain, x, z);
    const facing = definition.facingAt?.(site, { x, z }, turns) ?? turns;
    return Object.freeze({ spot: Object.freeze({ x, y, z }), turns: facing, allowed });
  }

  /** Walks the player within reach of a blueprint, then gives them a task on it. */
  function goTo(blueprintId: number, task: "buildTask" | "deliverTask"): void {
    const blueprint = entities.entity(blueprintId);
    if (blueprint?.blueprint === undefined || !isPlacedStructure(blueprint)) return;
    const footprint = footprintOfEntity(blueprint);
    for (const player of players) {
      walkWithinReach(walking, footprint, blueprint.position, player.position);
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
    if (!isPlacedStructure(target) || distanceOutside(footprintOfEntity(target), worker.position) > BUILD_REACH_METRES) return undefined;
    return { target, blueprint, position };
  }

  function describe(blueprintId: number): BlueprintView | undefined {
    const blueprint = entities.entity(blueprintId)?.blueprint;
    if (blueprint === undefined) return undefined;
    // With free building, nothing needs to be carried to a blueprint.
    const deliveries = structureOf(blueprint.structure).cost.flatMap(({ material, count }) =>
      isDelivered(material) && !freeBuilding ? [Object.freeze({ material, has: blueprint.delivered[material] ?? 0, needs: count })] : [],
    );
    const backpack = players.first?.backpack;
    const lacks = backpack === undefined ? null : nextStageLack(blueprint, backpack, freeBuilding);
    return Object.freeze({
      id: blueprintId,
      structure: blueprint.structure,
      progress: blueprint.progress,
      deliveries: Object.freeze(deliveries),
      lacks: lacks === undefined ? null : Object.freeze(lacks),
    });
  }

  return {
    checkPlacement,
    place(structure, at, turns) {
      const { spot, turns: facing, allowed } = checkPlacement(structure, at, turns);
      if (!allowed) return undefined;
      structureOf(structure).clearSite?.(entities, spot);
      const added = entities.add({
        blueprint: { structure, progress: 0, materialsSpent: 0, delivered: {} },
        facing: { turns: facing },
        position: { ...spot },
      });
      return entities.id(added);
    },
    canStartBuilding(blueprintId) {
      const blueprint = entities.entity(blueprintId)?.blueprint;
      if (blueprint === undefined) return false;
      return players.entities.some((player) => player.backpack !== undefined && hasNextStage(blueprint, player.backpack, freeBuilding));
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
          const distance = distanceOutside(footprintOfEntity(blueprint), player.position);
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
        // Everything carried on the shoulder, a log or a debarked log, is a material some structure is built from.
        if (reached === undefined || carried === undefined || !needsMore(reached.blueprint, carried)) continue;
        entities.removeComponent(deliverer, "carrying");
        reached.blueprint.delivered[carried] = (reached.blueprint.delivered[carried] ?? 0) + 1;
      }
      for (const builder of [...builders]) {
        if (builder.walkPath) continue;
        const reached = reachedBlueprint(builder, builder.buildTask.blueprintId);
        if (reached === undefined || !buildOn(reached.blueprint, builder.backpack, stepSeconds, freeBuilding)) {
          entities.removeComponent(builder, "buildTask");
          continue;
        }
        if (reached.blueprint.progress < 1) continue;
        entities.removeComponent(builder, "buildTask");
        const { target, blueprint, position } = reached;
        entities.removeComponent(target, "blueprint");
        const finished = structureOf(blueprint.structure).finish({ x: position.x, z: position.z }, target.facing?.turns ?? 0, entities);
        for (const key of Object.keys(finished) as (keyof Entity)[]) entities.addComponent(target, key, finished[key]);
      }
    },
  };
}

/** Whether a blueprint still needs more of a material carried to it. */
function needsMore(blueprint: Blueprint, material: DeliveredMaterial): boolean {
  const needed = structureOf(blueprint.structure).cost.find((item) => item.material === material)?.count ?? 0;
  return (blueprint.delivered[material] ?? 0) < needed;
}

/**
 * Works on a blueprint for one step. Each stage spends its material before work on it starts:
 * a backpack material comes out of the backpack, and a delivered one from what was carried to the blueprint.
 * Returns false, changing nothing, when the next stage's material has run out or the player lacks the tool the structure needs.
 * With `free`, every stage's material counts as spent without taking anything, and no tool is needed.
 */
function buildOn(blueprint: Blueprint, backpack: NonNullable<Entity["backpack"]>, stepSeconds: number, free: boolean): boolean {
  const structure = structureOf(blueprint.structure);
  if (!free && structure.tool !== undefined && !hasInBackpack(backpack, structure.tool)) return false;
  const stages = stageMaterials(structure.cost);
  // A structure that costs nothing, such as a woodpile, is one stage of work with nothing to spend.
  if (stages.length === 0) {
    blueprint.progress = Math.min(1, blueprint.progress + stepSeconds / structure.buildSeconds);
    return true;
  }
  if (blueprint.materialsSpent < stageOf(blueprint.progress, stages.length) + 1) {
    const material = stages[blueprint.materialsSpent];
    if (material === undefined) return false;
    if (!free && !spendStageMaterial(blueprint, backpack, stages, material)) return false;
    blueprint.materialsSpent += 1;
  }
  blueprint.progress = Math.min(blueprint.materialsSpent / stages.length, blueprint.progress + stepSeconds / structure.buildSeconds);
  return true;
}

/** Whether a blueprint's next stage can be worked on: the player has the tool it needs, and its material is in the backpack or was carried to it. */
function hasNextStage(blueprint: Blueprint, backpack: NonNullable<Entity["backpack"]>, free: boolean): boolean {
  if (free) return true;
  const stages = stageMaterials(structureOf(blueprint.structure).cost);
  // Every stage built already leaves nothing to build.
  if (stages.length > 0 && stages[blueprint.materialsSpent] === undefined) return false;
  return nextStageLack(blueprint, backpack, free) === undefined;
}

/** What the player lacks to build the blueprint's next stage, or undefined if nothing. */
function nextStageLack(blueprint: Blueprint, backpack: NonNullable<Entity["backpack"]>, free: boolean): BuildLack | undefined {
  if (free) return undefined;
  const structure = structureOf(blueprint.structure);
  if (structure.tool !== undefined && !hasInBackpack(backpack, structure.tool)) return { kind: "tool", tool: structure.tool };
  const stages = stageMaterials(structure.cost);
  const material = stages[blueprint.materialsSpent];
  if (material === undefined) return undefined;
  if (!isDelivered(material)) return hasInBackpack(backpack, material) ? undefined : { kind: "material", material };
  const spent = stages.slice(0, blueprint.materialsSpent).filter((earlier) => earlier === material).length;
  return (blueprint.delivered[material] ?? 0) > spent ? undefined : { kind: "material", material };
}

/** Spends the material for the blueprint's next stage. Returns false, changing nothing, if it has run out. */
function spendStageMaterial(
  blueprint: Blueprint,
  backpack: NonNullable<Entity["backpack"]>,
  stages: readonly BuildMaterial[],
  material: BuildMaterial,
): boolean {
  if (!isDelivered(material)) return removeFromBackpack(backpack, material, 1);
  const spent = stages.slice(0, blueprint.materialsSpent).filter((earlier) => earlier === material).length;
  return (blueprint.delivered[material] ?? 0) > spent;
}

/** Which stage of construction a blueprint is in, from 0 to one less than its number of stages. */
/** How far the blueprint the player builds has got, from 0 to 1, and the blueprint, or undefined if they are not building now. Walking there does not count. */
export function buildingNow(entities: EntityStore, player: Entity): { progress: number; targetId: number } | undefined {
  if (player.buildTask === undefined || player.walkPath !== undefined) return undefined;
  const blueprint = entities.entity(player.buildTask.blueprintId)?.blueprint;
  return blueprint === undefined ? undefined : { progress: blueprint.progress, targetId: player.buildTask.blueprintId };
}

export function stageOf(progress: number, stages: number): number {
  // The small allowance stops rounding errors from holding a stage back at its very end.
  return Math.min(stages - 1, Math.floor(progress * stages + 1e-9));
}

/** How far a spot lies outside a rectangle, in metres. It is 0 for a spot inside it. */
export function distanceOutside(rect: GroundRect, spot: GroundPoint): number {
  const dx = Math.max(rect.min.x - spot.x, 0, spot.x - rect.max.x);
  const dz = Math.max(rect.min.z - spot.z, 0, spot.z - rect.max.z);
  return Math.hypot(dx, dz);
}

/**
 * Walks the player just outside the ground a blueprint or structure covers, on their side of it, if they are out of reach of it.
 * A player standing on it steps off it too, so a finished structure never traps them.
 */
export function walkWithinReach(walking: Walking, footprint: GroundRect, centre: GroundPoint, player: GroundPoint): void {
  const outside = distanceOutside(footprint, player);
  if (outside > BUILD_REACH_METRES || outside === 0) walking.walkTo(standSpot(footprint, centre, player));
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
