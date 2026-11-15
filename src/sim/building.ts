import type { BlueprintView, BuildLack, PlacementCheck, Refusal } from "./api";
import { countInBackpack, hasInBackpack, removeFromBackpack } from "./backpack";
import { snapToGridPoint } from "./build-grid";
import {
  blueprintEntities,
  debarkedLogEntities,
  isParked,
  logEntities,
  pileEntities,
  playerEntities,
  setComponent,
  sledEntities,
  type Entity,
  type EntityStore,
} from "./entities";
import {
  costOf,
  footprintOfEntity,
  isDelivered,
  isKept,
  isPlacedStructure,
  stageMaterials,
  structureOf,
  type BuildMaterial,
  type DeliveredMaterial,
  type GroundRect,
  type KeptMaterial,
  type MaterialCost,
  type QuarterTurns,
  type StructureKind,
} from "./structures";
import { terrainHeightAt, type GroundPoint, type Valley } from "./valley";
import type { HandReach } from "./hand-reach";
import { walkOntoOrWithinReach, type Walking } from "./walking";

/** The player walks to a spot this far outside the ground a blueprint covers to build it, in metres. */
export const BUILD_STAND_METRES = 0.7;
/** The player can build a blueprint, or add a material to it, from this far outside the ground it covers, in metres. */
export const BUILD_REACH_METRES = 1.7;
/**
 * A blueprint takes the planks, logs, and debarked logs it costs from parked sleds whose edge is within this many metres of its edge.
 * It also takes planks from plank piles, and logs and debarked logs lying on the ground, whose middle is within this many metres of its edge.
 */
export const NEARBY_MATERIALS_METRES = 2;

type Blueprint = NonNullable<Entity["blueprint"]>;
type Backpack = NonNullable<Entity["backpack"]>;

/** One material a blueprint can take from near it, besides what is in the backpack or was carried to it. */
interface MaterialNearby {
  /** How many lie there in all. */
  readonly count: number;
  /** Takes up to `count` of them, nearest first. Returns how many it took. */
  take(count: number): number;
}

/** Every material a blueprint can take from near it. */
type MaterialsNearby = Readonly<Record<KeptMaterial, MaterialNearby>>;

const NOTHING_NEARBY: MaterialNearby = { count: 0, take: () => 0 };

/** Nothing nearby, as with free building. */
const NO_MATERIALS_NEARBY: MaterialsNearby = { log: NOTHING_NEARBY, debarkedLog: NOTHING_NEARBY, plank: NOTHING_NEARBY };

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
  /** Why the player could not build a blueprint's next stage now: the tool or material it lacks. */
  refusal(blueprintId: number): Refusal | undefined;
  /** The blueprint nearest the player within reach, or undefined if none is. */
  nearby(): BlueprintView | undefined;
  /** Moves construction and deliveries on by one logic step. Run it after walking has moved the player. */
  step(stepSeconds: number): undefined;
}

/**
 * Lets the player place blueprints, add materials to them, and turn them into finished building pieces.
 * With `freeBuilding`, building spends no materials and needs no tools. The playground uses it.
 */
export function createBuilding(entities: EntityStore, walking: Walking, valley: Valley, hand: Pick<HandReach, "start">, freeBuilding = false): Building {
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

  /**
   * The materials lying near a blueprint, within NEARBY_MATERIALS_METRES of it.
   * Planks come from parked sleds, nearest first, then from plank piles, nearest first.
   * Logs and debarked logs come from the ground, nearest first, then from parked sleds, nearest first.
   */
  function materialsNearby(target: Entity): MaterialsNearby {
    if (!isPlacedStructure(target)) return NO_MATERIALS_NEARBY;
    const footprint = footprintOfEntity(target);
    const sleds = sledEntities(entities)
      .entities.filter((sled) => isParked(entities, sled))
      .map((sled) => ({ sled, distance: gapBetween(footprintOfEntity(sled), footprint) }))
      .filter(({ distance }) => distance <= NEARBY_MATERIALS_METRES)
      .sort((a, b) => a.distance - b.distance)
      .map(({ sled }) => sled);
    /** The entities in `list` whose middle lies within NEARBY_MATERIALS_METRES of the blueprint, nearest first. */
    const near = <T extends Entity & { position: GroundPoint }>(list: readonly T[]): T[] =>
      list
        .map((entity) => ({ entity, distance: distanceOutside(footprint, entity.position) }))
        .filter(({ distance }) => distance <= NEARBY_MATERIALS_METRES)
        .sort((a, b) => a.distance - b.distance)
        .map(({ entity }) => entity);

    const piles = near(pileEntities(entities).entities.filter((pile) => pile.pile.content === "plank"));
    const plank: MaterialNearby = {
      count: sleds.reduce((total, sled) => total + sled.sled.plank, 0) + piles.reduce((total, pile) => total + pile.pile.count, 0),
      take(wanted) {
        let taken = 0;
        for (const sled of sleds) {
          const fromSled = Math.min(wanted - taken, sled.sled.plank);
          sled.sled.plank -= fromSled;
          taken += fromSled;
        }
        for (const pile of piles) {
          const fromPile = Math.min(wanted - taken, pile.pile.count);
          pile.pile.count -= fromPile;
          taken += fromPile;
          if (pile.pile.count === 0) entities.remove(pile);
        }
        return taken;
      },
    };

    /** The logs of one kind lying near the blueprint, on the ground in `onGround` or on a parked sled. */
    function logsNearby(material: DeliveredMaterial, onGround: readonly (Entity & { position: GroundPoint })[]): MaterialNearby {
      const lying = near(onGround);
      return {
        count: lying.length + sleds.reduce((total, sled) => total + sled.sled[material], 0),
        take(wanted) {
          let taken = 0;
          for (const log of lying) {
            if (taken >= wanted) break;
            entities.remove(log);
            taken += 1;
          }
          for (const sled of sleds) {
            while (taken < wanted && sled.sled[material] > 0) {
              sled.sled[material] -= 1;
              taken += 1;
            }
          }
          return taken;
        },
      };
    }

    return {
      plank,
      log: logsNearby("log", logEntities(entities).entities),
      debarkedLog: logsNearby("debarkedLog", debarkedLogEntities(entities).entities),
    };
  }

  function describe(blueprintId: number): BlueprintView | undefined {
    const target = entities.entity(blueprintId);
    const blueprint = target?.blueprint;
    if (target === undefined || blueprint === undefined) return undefined;
    const cost = costOf(target, blueprint.structure);
    // With free building, a blueprint needs nothing brought to it.
    const deliveries = cost.flatMap(({ material, count }) =>
      isKept(material) && !freeBuilding ? [Object.freeze({ material, has: blueprint.delivered[material] ?? 0, needs: count })] : [],
    );
    const backpack = players.first?.backpack;
    const lacks = backpack === undefined ? null : nextStageLack(blueprint, cost, backpack, materialsNearby(target), freeBuilding);
    return Object.freeze({
      id: blueprintId,
      structure: blueprint.structure,
      progress: blueprint.progress,
      deliveries: Object.freeze(deliveries),
      lacks: lacks === undefined ? null : Object.freeze(lacks),
    });
  }

  return {
    refusal(blueprintId) {
      const lacks = describe(blueprintId)?.lacks ?? null;
      return lacks === null ? undefined : { kind: "cannotBuildYet", lacks };
    },
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
      const target = entities.entity(blueprintId);
      const blueprint = target?.blueprint;
      if (target === undefined || blueprint === undefined) return false;
      const cost = costOf(target, blueprint.structure);
      return players.entities.some(
        (player) => player.backpack !== undefined && hasNextStage(blueprint, cost, player.backpack, materialsNearby(target), freeBuilding),
      );
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
        const { blueprintId } = deliverer.deliverTask;
        entities.removeComponent(deliverer, "deliverTask");
        const reached = reachedBlueprint(deliverer, blueprintId);
        if (reached === undefined || !canDeliver(deliverer, reached.target, reached.blueprint)) continue;
        // The player lays the log down by the blueprint, then hands it over when the hand gets there.
        hand.start("low", reached.position, () => {
          const still = reachedBlueprint(deliverer, blueprintId);
          const carried = deliverer.carrying;
          if (still === undefined || carried === undefined || !canDeliver(deliverer, still.target, still.blueprint)) return undefined;
          entities.removeComponent(deliverer, "carrying");
          still.blueprint.delivered[carried] = (still.blueprint.delivered[carried] ?? 0) + 1;
          return undefined;
        });
      }
      for (const builder of [...builders]) {
        if (builder.walkPath) continue;
        const reached = reachedBlueprint(builder, builder.buildTask.blueprintId);
        if (
          reached === undefined ||
          !buildOn(
            reached.blueprint,
            costOf(reached.target, reached.blueprint.structure),
            builder.backpack,
            freeBuilding ? NO_MATERIALS_NEARBY : materialsNearby(reached.target),
            stepSeconds,
            freeBuilding,
          )
        ) {
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

/** Whether the deliverer carries something on the shoulder that the blueprint still needs. */
function canDeliver(deliverer: Entity, target: Entity, blueprint: Blueprint): boolean {
  // Everything carried on the shoulder, a log or a debarked log, is a material some structure is built from.
  return deliverer.carrying !== undefined && stillNeeded(blueprint, costOf(target, blueprint.structure), deliverer.carrying) > 0;
}

/** How many more of a material it keeps a blueprint costing `cost` needs, on top of what it has had. */
function stillNeeded(blueprint: Blueprint, cost: readonly MaterialCost[], material: KeptMaterial): number {
  const needed = cost.find((item) => item.material === material)?.count ?? 0;
  return Math.max(0, needed - (blueprint.delivered[material] ?? 0));
}

/**
 * Moves planks to a blueprint costing `cost`, as many as it still needs: from the backpack first, then from `nearby`.
 * The blueprint keeps them, so the player can bring the rest on later trips.
 */
function takePlanks(blueprint: Blueprint, cost: readonly MaterialCost[], backpack: Backpack, nearby: MaterialNearby): void {
  const needed = stillNeeded(blueprint, cost, "plank");
  if (needed <= 0) return;
  const fromBackpack = Math.min(needed, countInBackpack(backpack, "plank"));
  if (fromBackpack > 0) removeFromBackpack(backpack, "plank", fromBackpack);
  const fromNearby = fromBackpack < needed && nearby.count > 0 ? nearby.take(needed - fromBackpack) : 0;
  if (fromBackpack + fromNearby > 0) blueprint.delivered.plank = (blueprint.delivered.plank ?? 0) + fromBackpack + fromNearby;
}

/**
 * Works on a blueprint costing `cost` for one step. First the blueprint takes the planks it still needs,
 * from the backpack, then from `nearby`.
 * Each stage spends its material before work on it starts: a stick or bark comes out of the backpack,
 * and a kept material, such as a debarked log or a plank, from what the blueprint keeps.
 * A stage that needs a log or debarked log the blueprint does not have yet takes one from `nearby`.
 * Returns false when the next stage's material has run out or the player lacks the tool the structure needs.
 * With `free`, every stage's material counts as spent without taking anything, and no tool is needed.
 */
function buildOn(
  blueprint: Blueprint,
  cost: readonly MaterialCost[],
  backpack: Backpack,
  nearby: MaterialsNearby,
  stepSeconds: number,
  free: boolean,
): boolean {
  const structure = structureOf(blueprint.structure);
  if (!free && structure.tool !== undefined && !hasInBackpack(backpack, structure.tool)) return false;
  const stages = stageMaterials(cost);
  // A structure that costs nothing, such as a woodpile, is one stage of work with nothing to spend.
  if (stages.length === 0) {
    blueprint.progress = Math.min(1, blueprint.progress + stepSeconds / structure.buildSeconds);
    return true;
  }
  if (!free) takePlanks(blueprint, cost, backpack, nearby.plank);
  if (blueprint.materialsSpent < stageOf(blueprint.progress, stages.length) + 1) {
    const material = stages[blueprint.materialsSpent];
    if (material === undefined) return false;
    if (!free && !spendStageMaterial(blueprint, backpack, stages, material, nearby)) return false;
    blueprint.materialsSpent += 1;
  }
  blueprint.progress = Math.min(blueprint.materialsSpent / stages.length, blueprint.progress + stepSeconds / structure.buildSeconds);
  return true;
}

/**
 * Whether a blueprint costing `cost` has a next stage that can be worked on: the player has the tool it needs,
 * and its material is in the backpack, kept by the blueprint, or lies `nearby`.
 */
function hasNextStage(blueprint: Blueprint, cost: readonly MaterialCost[], backpack: Backpack, nearby: MaterialsNearby, free: boolean): boolean {
  if (free) return true;
  const stages = stageMaterials(cost);
  // Every stage built already leaves nothing to build.
  if (stages.length > 0 && stages[blueprint.materialsSpent] === undefined) return false;
  return nextStageLack(blueprint, cost, backpack, nearby, free) === undefined;
}

/**
 * What the player lacks to build the next stage of a blueprint costing `cost`, or undefined if nothing.
 * `nearby` holds what the blueprint can take from sleds, piles, and the ground near it.
 */
function nextStageLack(blueprint: Blueprint, cost: readonly MaterialCost[], backpack: Backpack, nearby: MaterialsNearby, free: boolean): BuildLack | undefined {
  if (free) return undefined;
  const structure = structureOf(blueprint.structure);
  if (structure.tool !== undefined && !hasInBackpack(backpack, structure.tool)) return { kind: "tool", tool: structure.tool };
  const stages = stageMaterials(cost);
  const material = stages[blueprint.materialsSpent];
  if (material === undefined) return undefined;
  if (!isKept(material)) return hasInBackpack(backpack, material) ? undefined : { kind: "material", material };
  if (keptLeft(blueprint, stages, material) > 0 || nearby[material].count > 0) return undefined;
  // Building takes planks from the backpack too. A log or debarked log never goes in the backpack.
  return !isDelivered(material) && hasInBackpack(backpack, material) ? undefined : { kind: "material", material };
}

/** How many of a material the blueprint keeps that construction has not spent yet. */
function keptLeft(blueprint: Blueprint, stages: readonly BuildMaterial[], material: KeptMaterial): number {
  const spent = stages.slice(0, blueprint.materialsSpent).filter((earlier) => earlier === material).length;
  return (blueprint.delivered[material] ?? 0) - spent;
}

/**
 * Spends the material for the blueprint's next stage. A log or debarked log the blueprint does not have yet comes from `nearby`.
 * Returns false, changing nothing, if it has run out.
 */
function spendStageMaterial(
  blueprint: Blueprint,
  backpack: Backpack,
  stages: readonly BuildMaterial[],
  material: BuildMaterial,
  nearby: MaterialsNearby,
): boolean {
  if (!isKept(material)) return removeFromBackpack(backpack, material, 1);
  if (keptLeft(blueprint, stages, material) > 0) return true;
  if (!isDelivered(material) || nearby[material].take(1) === 0) return false;
  blueprint.delivered[material] = (blueprint.delivered[material] ?? 0) + 1;
  return true;
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

/** How far apart two rectangles lie at their nearest edges, in metres. It is 0 if they touch or overlap. */
export function gapBetween(a: GroundRect, b: GroundRect): number {
  const dx = Math.max(a.min.x - b.max.x, 0, b.min.x - a.max.x);
  const dz = Math.max(a.min.z - b.max.z, 0, b.min.z - a.max.z);
  return Math.hypot(dx, dz);
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
  if (outside === 0) walking.walkTo(standSpot(footprint, centre, player));
  else if (outside > BUILD_REACH_METRES) walkOntoOrWithinReach(walking, standSpot(footprint, centre, player), footprint, BUILD_REACH_METRES);
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
