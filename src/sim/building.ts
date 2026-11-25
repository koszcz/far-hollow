import type { BlueprintView, BuildLack, Notice, PlacementCheck, Refusal } from "./api";
import type { ApproachReach } from "./approach";
import { countInBackpack, hasInBackpack, removeFromBackpack } from "./backpack";
import { addCount, countOf, takeCount } from "./counts";
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
  type GroundRect,
  type KeptMaterial,
  type MaterialCost,
  type PlacedStructure,
  type StructureKind,
} from "./structures";
import { TAKEN_MATERIALS } from "./structure-kind";
import { gardenThingInTheWay } from "./garden-things";
import { type QuarterTurns } from "./quarter-turns";
import { terrainHeightAt, type Valley } from "./valley";
import { addGroundPoints, type GroundPoint, scaleGroundPoint } from "./ground-point";
import type { HandReach } from "./hand-reach";
import { WALK_REACH_MARGIN_METRES, type Walking } from "./walking";
import { distanceToTarget, walkingDistancesFrom, type WalkTarget } from "./pathfinding";
import { isWalkable } from "./walk-map";
import { refusedNotice } from "./notices";
import type { CommandRules, RuleGame } from "./command-rule";

/** The player walks to a spot this far outside the ground a blueprint covers to build it, in metres. */
export const BUILD_STAND_METRES = 0.7;
/** The player can build a blueprint, or add a material to it, from this far outside the ground it covers, in metres. */
export const BUILD_REACH_METRES = 1.7;
/**
 * The player fetches a stage's material themselves if it lies within this many metres of the blueprint's edge, measured along
 * the walking path. They fetch from logs and debarked logs lying on the ground, plank and stone piles, and parked sleds.
 */
export const FETCH_METRES = 10;
/** The player picks up a fetched material from this far from a pile's or log's middle, or from a sled's edge, in metres. */
const FETCH_REACH_METRES = 2;

type Blueprint = NonNullable<Entity["blueprint"]>;
type Backpack = NonNullable<Entity["backpack"]>;
type Builder = Entity & Required<Pick<Entity, "buildTask" | "position" | "backpack">>;

/** One place the player can fetch a material from: a pile, a log lying on the ground, or a parked sled. */
interface Source {
  readonly id: number;
  /** Where it lies: the middle of a pile or a log, or the ground a sled covers. */
  readonly target: WalkTarget;
  /** Where the player walks to pick it up, if they can stand on it: the middle of a pile or a log. */
  readonly spot?: GroundPoint;
  /** Where the hand reaches to take one. */
  readonly reachToward: GroundPoint;
  /** Takes one of the material from it. */
  take(): void;
}

/** Why building stopped, with the notice that says so, if any. */
interface Stop {
  readonly notice?: Notice;
}

/** Building stopped without a notice, such as when the player cannot walk back to the blueprint. */
const STOP: Stop = {};

/** Building stopped because the next stage lacks something, and the notice says what. */
function stopLacking(lacks: BuildLack): Stop {
  return { notice: refusedNotice({ kind: "cannotBuildYet", lacks }) };
}

/** Building stopped because the player carries something the next stage does not need. */
const STOP_HANDS_FULL: Stop = { notice: refusedNotice({ kind: "handsFull" }) };

export interface Building {
  /** Where a blueprint of `structure` facing `turns` would go if placed near `at`, and whether it is allowed there. Changes nothing. */
  checkPlacement(structure: StructureKind, at: GroundPoint, turns: QuarterTurns): PlacementCheck;
  /**
   * Places a blueprint of `structure` facing `turns` at the grid spot nearest to `at`. Placing costs nothing.
   * Returns the new blueprint's entity id. Does nothing, and returns undefined, if the structure's placement rule refuses the spot.
   * With instant building, the blueprint is finished at once, and the id names the finished piece.
   */
  place(structure: StructureKind, at: GroundPoint, turns: QuarterTurns): number | undefined;
  /**
   * Whether the player could start building a blueprint now: they carry nothing its next stage does not need, and they have
   * the tool it needs and the material for its next stage.
   */
  canStartBuilding(blueprintId: number): boolean;
  /**
   * Starts the player building a blueprint within reach. The approach runs it once they arrive.
   * Building goes one stage at a time. When the blueprint lacks a stage's material, the player fetches it from within FETCH_METRES.
   * It goes on until the player stops, the piece is finished, or no material for the next stage is left within reach.
   */
  build(blueprintId: number): void;
  /**
   * Where the approach takes the player to build a blueprint or add a material to it: just outside the ground it covers,
   * on their side of it. A player standing on it steps off it. Undefined if the entity is not a placed blueprint.
   */
  reach(blueprintId: number): ApproachReach | undefined;
  /**
   * Has the player hand what they carry, such as a debarked log, to a blueprint within reach, which takes it when
   * the hand gets there. The approach runs it once they arrive. The material is added only if the blueprint still needs more of it.
   */
  deliver(blueprintId: number): void;
  /** Stops the player building. The blueprint keeps its progress, and the player keeps what they carry. */
  cancel(): void;
  /** What a blueprint needs and has, or undefined if the entity is not a blueprint. */
  describe(blueprintId: number): BlueprintView | undefined;
  /** Why the player could not start building a blueprint now: their hands are full, or the next stage lacks a tool or material. */
  refusal(blueprintId: number): Refusal | undefined;
  /** The blueprint nearest the player within reach, or undefined if none is. */
  nearby(): BlueprintView | undefined;
  /** Moves construction, fetching, and deliveries on by one logic step. Run it after walking has moved the player. */
  step(stepSeconds: number): Notice | undefined;
}

/**
 * Lets the player place blueprints, add materials to them, and turn them into finished building pieces.
 * With `freeBuilding`, building spends no materials, needs no tools, and fetches nothing. The playground uses it.
 * With `instantBuilding`, a placed blueprint turns into the finished piece at once, so nobody builds it. The instant playground uses it.
 */
export function createBuilding(
  entities: EntityStore,
  walking: Walking,
  valley: Valley,
  hand: Pick<HandReach, "start">,
  freeBuilding = false,
  instantBuilding = false,
): Building {
  const players = playerEntities(entities);
  const blueprints = blueprintEntities(entities);
  const builders = entities.with("buildTask", "position", "backpack");

  function checkPlacement(structure: StructureKind, at: GroundPoint, turns: QuarterTurns): PlacementCheck {
    const definition = structureOf(structure);
    const site = { entities, walkMap: walking.walkMap, valley };
    const { x, z } = definition.snap?.(site, at, turns) ?? snapToGridPoint(at);
    const y = definition.heightAt?.(site, { x, z }) ?? terrainHeightAt(valley.terrain, x, z);
    const facing = definition.facingAt?.(site, { x, z }, turns) ?? turns;
    const footprint = definition.footprint({ x, z }, facing);
    // Nothing else shows the player that a garden thing is in the way, or that a door frame or window may not stand at a corner, so the game says why.
    const refusal = gardenThingInTheWay(entities, footprint) ?? definition.placementRefusal?.(site, { x, z }, turns);
    const allowed = refusal === undefined && definition.canPlace(site, { x, z }, turns);
    return Object.freeze({ spot: Object.freeze({ x, y, z }), turns: facing, allowed, ...(refusal === undefined ? {} : { refusal: Object.freeze(refusal) }) });
  }

  /** The placed blueprint with this id, if it still exists. */
  function placedBlueprint(blueprintId: number) {
    const target = entities.entity(blueprintId);
    const blueprint = target?.blueprint;
    const position = target?.position;
    if (target === undefined || blueprint === undefined || position === undefined || !isPlacedStructure(target)) return undefined;
    return { target, blueprint, position };
  }

  type Placed = NonNullable<ReturnType<typeof placedBlueprint>>;

  /** Whether a worker stands within reach of a placed blueprint. */
  function inReach(worker: { position: GroundPoint }, target: PlacedStructure): boolean {
    return distanceOutside(footprintOfEntity(target), worker.position) <= BUILD_REACH_METRES;
  }

  /** The blueprint a task points at, if it still exists and the worker has it within reach. */
  function reachedBlueprint(worker: { position: GroundPoint }, blueprintId: number) {
    const placed = placedBlueprint(blueprintId);
    // The player may have walked as close as they could but still be out of reach.
    if (placed === undefined || !inReach(worker, placed.target)) return undefined;
    return placed;
  }

  /** The entity as a place to fetch one `material` from, if it is one now: a pile, a log on the ground, or a parked sled holding some. */
  function sourceOf(entity: Entity, material: KeptMaterial): Source | undefined {
    const id = entities.id(entity);
    const position = entity.position;
    if (id === undefined || position === undefined) return undefined;
    const at = { x: position.x, z: position.z };
    const lying = material === "log" ? entity.log : material === "debarkedLog" ? entity.debarkedLog : undefined;
    if (lying !== undefined) {
      return {
        id,
        target: at,
        spot: at,
        reachToward: at,
        take: () => {
          entities.remove(entity);
        },
      };
    }
    const pile = entity.pile;
    if (pile !== undefined && pile.content === material && pile.count > 0) {
      return {
        id,
        target: at,
        spot: at,
        reachToward: at,
        take: () => {
          pile.count -= 1;
          if (pile.count === 0) entities.remove(entity);
        },
      };
    }
    // A sled carries logs, debarked logs, and planks, but never stone. A sled the player drags is no source.
    const load = entity.sled;
    if (load !== undefined && material !== "stone" && load[material] > 0 && isPlacedStructure(entity) && isParked(entities, entity)) {
      return {
        id,
        target: footprintOfEntity(entity),
        reachToward: at,
        take: () => {
          entity.sled = takeCount(load, material, 1);
        },
      };
    }
    return undefined;
  }

  /** Every place to fetch `material` from, anywhere in the valley. */
  function sourcesOf(material: KeptMaterial): Source[] {
    const candidates: readonly Entity[] =
      material === "log"
        ? logEntities(entities).entities
        : material === "debarkedLog"
          ? debarkedLogEntities(entities).entities
          : pileEntities(entities).entities;
    const sleds = material === "stone" ? [] : sledEntities(entities).entities;
    return [...candidates, ...sleds].flatMap((entity) => sourceOf(entity, material) ?? []);
  }

  /** The places to fetch `material` from within FETCH_METRES of a blueprint, measured along the walking path, nearest first. */
  function fetchableSources(target: PlacedStructure, material: KeptMaterial): Source[] {
    const footprint = footprintOfEntity(target);
    // No walk is shorter than the straight line, so anything further than that cannot count.
    const close = sourcesOf(material).filter((source) => gapTo(footprint, source.target) <= FETCH_METRES);
    if (close.length === 0) return [];
    const walks = walkingDistancesFrom(walking.walkMap, footprint, FETCH_METRES);
    return close
      .map((source) => ({ source, distance: walks.to(source.target) }))
      .filter((found): found is { source: Source; distance: number } => found.distance !== undefined)
      .sort((a, b) => a.distance - b.distance)
      .map(({ source }) => source);
  }

  /** Whether the player carries something a blueprint's next stage does not need. Their hands must be free to build it then. */
  function handsFull(player: Entity, blueprint: Blueprint, cost: readonly MaterialCost[]): boolean {
    if (freeBuilding || player.carrying === undefined) return false;
    return stageMaterials(cost)[blueprint.materialsSpent] !== player.carrying;
  }

  /** What the player lacks to build a blueprint's next stage, or undefined if nothing. A material they carry or can fetch counts. */
  function lackOf(player: Entity, backpack: Backpack, target: Entity, blueprint: Blueprint): BuildLack | undefined {
    const available = (material: KeptMaterial) => player.carrying === material || (isPlacedStructure(target) && fetchableSources(target, material).length > 0);
    return nextStageLack(blueprint, costOf(target, blueprint.structure), backpack, available, freeBuilding);
  }

  function describe(blueprintId: number): BlueprintView | undefined {
    const target = entities.entity(blueprintId);
    const blueprint = target?.blueprint;
    if (target === undefined || blueprint === undefined) return undefined;
    const cost = costOf(target, blueprint.structure);
    // With free building, a blueprint needs nothing brought to it.
    const deliveries = cost.flatMap(({ material, count }) =>
      isKept(material) && !freeBuilding ? [Object.freeze({ material, has: countOf(blueprint.delivered, material), needs: count })] : [],
    );
    const player = players.first;
    const lacks = player?.backpack === undefined ? null : lackOf(player, player.backpack, target, blueprint);
    return Object.freeze({
      id: blueprintId,
      structure: blueprint.structure,
      progress: blueprint.progress,
      deliveries: Object.freeze(deliveries),
      lacks: lacks === undefined ? null : Object.freeze(lacks),
    });
  }

  /** Why the player could not start building a blueprint now, if they could not. Full hands come first. */
  function refusal(blueprintId: number): Refusal | undefined {
    const target = entities.entity(blueprintId);
    const blueprint = target?.blueprint;
    const player = players.first;
    if (target === undefined || blueprint === undefined) return undefined;
    if (player !== undefined && handsFull(player, blueprint, costOf(target, blueprint.structure))) return { kind: "handsFull" };
    const lacks = describe(blueprintId)?.lacks ?? null;
    return lacks === null ? undefined : { kind: "cannotBuildYet", lacks };
  }

  /** Whether the walk the player has just set off on ends within `metres` of `target`. */
  function arrivesWithin(walker: Entity & { position: GroundPoint }, target: WalkTarget, metres: number): boolean {
    const end = walker.walkPath?.at(-1) ?? walker.position;
    return distanceToTarget(target, end) <= metres;
  }

  /**
   * Sets the player walking to within `metres` of `target`: onto `spot` if it is open ground, or else the shortest way to within reach.
   * Returns false, and stops them, if no walk gets them within reach.
   */
  function walkWithinReach(walker: Entity & { position: GroundPoint }, target: WalkTarget, metres: number, spot?: GroundPoint): boolean {
    if (spot !== undefined && isWalkable(walking.walkMap, spot)) {
      walking.walkTo(spot);
      if (arrivesWithin(walker, target, metres)) return true;
    }
    walking.walkWithin(target, metres - WALK_REACH_MARGIN_METRES);
    if (arrivesWithin(walker, target, metres)) return true;
    entities.removeComponent(walker, "walkPath");
    return false;
  }

  /** Sets the builder walking back within reach of the blueprint, on the side they come from. */
  function walkBack(builder: Builder, placed: Placed): Stop | undefined {
    const reach = structureReach(placed.target, builder.position);
    const spot = reach.walk.style === "offAndBeside" ? reach.walk.spot : undefined;
    return walkWithinReach(builder, reach.target, reach.metres, spot) ? undefined : STOP;
  }

  /** Has the builder reach out and hand the material they carry to the blueprint, which keeps it, when the hand gets there. */
  function handOver(builder: Builder, placed: Placed, material: KeptMaterial): void {
    const blueprintId = builder.buildTask.blueprintId;
    hand.start("low", placed.position, () => {
      const still = reachedBlueprint(builder, blueprintId);
      if (still === undefined || builder.carrying !== material) return undefined;
      entities.removeComponent(builder, "carrying");
      still.blueprint.delivered = addCount(still.blueprint.delivered, material, 1);
      return undefined;
    });
  }

  /**
   * Gets the material for a blueprint's next stage, which the blueprint does not keep yet. A material the builder carries is
   * handed over, and planks or stone in the backpack are taken once they stand within reach. Otherwise the builder sets off
   * to fetch one from the nearest source within FETCH_METRES.
   */
  function bringStageMaterial(builder: Builder, placed: Placed, material: KeptMaterial, withinReach: boolean): Stop | undefined {
    if (builder.carrying === material) {
      if (!withinReach) return walkBack(builder, placed);
      handOver(builder, placed, material);
      return undefined;
    }
    // Building takes planks and stone from the backpack once the player stands within reach. A log never goes in the backpack.
    if (!isDelivered(material) && hasInBackpack(builder.backpack, material)) return walkBack(builder, placed);
    if (builder.carrying !== undefined) return STOP_HANDS_FULL;
    const source = fetchableSources(placed.target, material)[0];
    if (source === undefined) return stopLacking({ kind: "material", material });
    builder.buildTask = { blueprintId: builder.buildTask.blueprintId, fetchFrom: source.id };
    return walkWithinReach(builder, source.target, FETCH_REACH_METRES, source.spot) ? undefined : stopLacking({ kind: "material", material });
  }

  /**
   * Has the builder, who has walked to a source to fetch the next stage's material, pick one up. A log goes on the shoulder,
   * and a plank or stone in the hands. If the source has none left, the builder looks again on the next step.
   */
  function pickUp(builder: Builder, placed: Placed, sourceId: number): Stop | undefined {
    builder.buildTask = { blueprintId: builder.buildTask.blueprintId };
    const material = stageMaterials(costOf(placed.target, placed.blueprint.structure))[placed.blueprint.materialsSpent];
    if (material === undefined || !isKept(material)) return undefined;
    const entity = entities.entity(sourceId);
    const source = entity === undefined ? undefined : sourceOf(entity, material);
    if (entity === undefined || source === undefined) return undefined;
    if (builder.carrying !== undefined) return STOP_HANDS_FULL;
    if (distanceToTarget(source.target, builder.position) > FETCH_REACH_METRES) return stopLacking({ kind: "material", material });
    hand.start("low", source.reachToward, () => {
      const still = sourceOf(entity, material);
      if (still === undefined || builder.carrying !== undefined) return undefined;
      still.take();
      entities.addComponent(builder, "carrying", material);
      return undefined;
    });
    return undefined;
  }

  /**
   * Works on a blueprint for one step: fetches or hands over the next stage's material if the blueprint lacks it,
   * spends it, and builds. Each stage spends its material before work on it starts: a stick or bark comes out of the backpack,
   * and a kept material, such as a debarked log, a plank, or a stone, from what the blueprint keeps.
   * Returns why building stopped, if it did. With free building, every stage's material counts as spent without taking anything.
   */
  function workOn(builder: Builder, placed: Placed, stepSeconds: number): Stop | undefined {
    const { target, blueprint } = placed;
    const cost = costOf(target, blueprint.structure);
    const structure = structureOf(blueprint.structure);
    const stages = stageMaterials(cost);
    if (!freeBuilding && structure.tool !== undefined && !hasInBackpack(builder.backpack, structure.tool)) {
      return stopLacking({ kind: "tool", tool: structure.tool });
    }
    const fetchFrom = builder.buildTask.fetchFrom;
    if (!freeBuilding && fetchFrom !== undefined) return pickUp(builder, placed, fetchFrom);
    const withinReach = inReach(builder, target);
    if (!freeBuilding && withinReach) takeFromBackpack(blueprint, cost, builder.backpack);
    if (stages.length > 0 && blueprint.materialsSpent < stageOf(blueprint.progress, stages.length) + 1) {
      const material = stages[blueprint.materialsSpent];
      if (material === undefined) return STOP;
      if (!freeBuilding && isKept(material) && keptLeft(blueprint, stages, material) <= 0) {
        return bringStageMaterial(builder, placed, material, withinReach);
      }
      if (!withinReach) return walkBack(builder, placed);
      if (!freeBuilding && !isKept(material) && !removeFromBackpack(builder.backpack, material, 1)) return stopLacking({ kind: "material", material });
      blueprint.materialsSpent += 1;
    }
    if (!withinReach) return walkBack(builder, placed);
    // A structure that costs nothing, such as a woodpile, is one stage of work with nothing to spend.
    const builtUpTo = stages.length === 0 ? 1 : blueprint.materialsSpent / stages.length;
    blueprint.progress = Math.min(builtUpTo, blueprint.progress + stepSeconds / structure.buildSeconds);
    return undefined;
  }

  /** Turns a blueprint whose progress has reached 1 into the finished structure. */
  function finish({ target, blueprint, position }: Placed): void {
    entities.removeComponent(target, "blueprint");
    const finished = structureOf(blueprint.structure).finish({ x: position.x, z: position.z }, target.facing?.turns ?? 0, entities);
    for (const key of Object.keys(finished) as (keyof Entity)[]) entities.addComponent(target, key, finished[key]);
  }

  return {
    refusal,
    checkPlacement,
    place(structure, at, turns) {
      const { spot, turns: facing, allowed } = checkPlacement(structure, at, turns);
      if (!allowed) return undefined;
      const definition = structureOf(structure);
      definition.clearSite?.({ entities, walkMap: walking.walkMap, valley }, spot);
      const blocks = definition.blueprintBlocksWalkingSpots?.(spot);
      const added = entities.add({
        blueprint: { structure, progress: 0, materialsSpent: 0, delivered: {} },
        facing: { turns: facing },
        position: { ...spot },
        ...(blocks === undefined ? {} : { blocksWalkingSpots: blocks }),
      });
      const id = entities.id(added);
      if (instantBuilding && id !== undefined) {
        const placed = placedBlueprint(id);
        if (placed !== undefined) finish(placed);
      }
      return id;
    },
    canStartBuilding(blueprintId) {
      const target = entities.entity(blueprintId);
      const blueprint = target?.blueprint;
      if (target === undefined || blueprint === undefined) return false;
      const cost = costOf(target, blueprint.structure);
      const stages = stageMaterials(cost);
      // Every stage built already leaves nothing to build.
      if (!freeBuilding && stages.length > 0 && stages[blueprint.materialsSpent] === undefined) return false;
      return players.entities.some(
        (player) => player.backpack !== undefined && !handsFull(player, blueprint, cost) && lackOf(player, player.backpack, target, blueprint) === undefined,
      );
    },
    build(blueprintId) {
      if (placedBlueprint(blueprintId) === undefined) return;
      for (const player of players) setComponent(entities, player, "buildTask", { blueprintId });
    },
    reach(blueprintId) {
      const blueprint = entities.entity(blueprintId);
      const player = players.first;
      if (blueprint?.blueprint === undefined || !isPlacedStructure(blueprint) || player === undefined) return undefined;
      return structureReach(blueprint, player.position);
    },
    deliver(blueprintId) {
      for (const deliverer of players) {
        const reached = reachedBlueprint(deliverer, blueprintId);
        if (reached === undefined || !canDeliver(deliverer, reached.target, reached.blueprint)) continue;
        // The player lays the log down by the blueprint, then hands it over when the hand gets there.
        hand.start("low", reached.position, () => {
          const still = reachedBlueprint(deliverer, blueprintId);
          const carried = deliverer.carrying;
          if (still === undefined || carried === undefined || !canDeliver(deliverer, still.target, still.blueprint)) return undefined;
          entities.removeComponent(deliverer, "carrying");
          still.blueprint.delivered = addCount(still.blueprint.delivered, carried, 1);
          return undefined;
        });
      }
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "buildTask");
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
      let notice: Notice | undefined;
      // Copy the list first, because players who finish or give up leave the query while it is being walked.
      for (const builder of [...builders]) {
        const placed = placedBlueprint(builder.buildTask.blueprintId);
        if (placed === undefined) {
          entities.removeComponent(builder, "buildTask");
          continue;
        }
        // The builder is still walking to fetch or bring back a material, or their hand is still on its way to it.
        if (builder.walkPath !== undefined || builder.handReach !== undefined) continue;
        const stopped = workOn(builder, placed, stepSeconds);
        if (stopped !== undefined) {
          entities.removeComponent(builder, "buildTask");
          notice = stopped.notice ?? notice;
          continue;
        }
        if (placed.blueprint.progress < 1) continue;
        entities.removeComponent(builder, "buildTask");
        finish(placed);
      }
      return notice;
    },
  };
}

/** Whether the deliverer carries something that the blueprint still needs. */
function canDeliver(deliverer: Entity, target: Entity, blueprint: Blueprint): boolean {
  // Everything carried outside the backpack, a log, a debarked log, a plank, or a stone, is a material some structure is built from.
  return deliverer.carrying !== undefined && stillNeeded(blueprint, costOf(target, blueprint.structure), deliverer.carrying) > 0;
}

/** How many more of a material it keeps a blueprint costing `cost` needs, on top of what it has had. */
function stillNeeded(blueprint: Blueprint, cost: readonly MaterialCost[], material: KeptMaterial): number {
  const needed = cost.find((item) => item.material === material)?.count ?? 0;
  return Math.max(0, needed - countOf(blueprint.delivered, material));
}

/**
 * Moves planks and stone from the backpack to a blueprint costing `cost`, as many of each as it still needs.
 * The blueprint keeps them, so the player can bring the rest on later trips.
 */
function takeFromBackpack(blueprint: Blueprint, cost: readonly MaterialCost[], backpack: Backpack): void {
  for (const material of TAKEN_MATERIALS) {
    const fromBackpack = Math.min(stillNeeded(blueprint, cost, material), countInBackpack(backpack, material));
    if (fromBackpack <= 0) continue;
    removeFromBackpack(backpack, material, fromBackpack);
    blueprint.delivered = addCount(blueprint.delivered, material, fromBackpack);
  }
}

/**
 * What the player lacks to build the next stage of a blueprint costing `cost`, or undefined if nothing.
 * `available` says whether the player carries a kept material or can fetch it.
 */
function nextStageLack(
  blueprint: Blueprint,
  cost: readonly MaterialCost[],
  backpack: Backpack,
  available: (material: KeptMaterial) => boolean,
  free: boolean,
): BuildLack | undefined {
  if (free) return undefined;
  const structure = structureOf(blueprint.structure);
  if (structure.tool !== undefined && !hasInBackpack(backpack, structure.tool)) return { kind: "tool", tool: structure.tool };
  const stages = stageMaterials(cost);
  const material = stages[blueprint.materialsSpent];
  if (material === undefined) return undefined;
  if (!isKept(material)) return hasInBackpack(backpack, material) ? undefined : { kind: "material", material };
  if (keptLeft(blueprint, stages, material) > 0 || available(material)) return undefined;
  // Building takes planks and stone from the backpack too. A log or debarked log never goes in the backpack.
  return !isDelivered(material) && hasInBackpack(backpack, material) ? undefined : { kind: "material", material };
}

/** How many of a material the blueprint keeps that construction has not spent yet. */
function keptLeft(blueprint: Blueprint, stages: readonly BuildMaterial[], material: KeptMaterial): number {
  const spent = stages.slice(0, blueprint.materialsSpent).filter((earlier) => earlier === material).length;
  return countOf(blueprint.delivered, material) - spent;
}

/** How far a walk target lies from the edge of a rectangle in a straight line, in metres. */
function gapTo(rect: GroundRect, target: WalkTarget): number {
  return "min" in target ? gapBetween(rect, target) : distanceOutside(rect, target);
}

/**
 * How far the blueprint the player builds has got, from 0 to 1, and the blueprint, or undefined if they are not building now.
 * Walking there, fetching a material, and handing it over do not count.
 */
export function buildingNow(entities: EntityStore, player: Entity): { progress: number; targetId: number } | undefined {
  const task = player.buildTask;
  if (task === undefined || task.fetchFrom !== undefined || player.walkPath !== undefined || player.handReach !== undefined) return undefined;
  const blueprint = entities.entity(task.blueprintId)?.blueprint;
  return blueprint === undefined ? undefined : { progress: blueprint.progress, targetId: task.blueprintId };
}

/** Which stage of construction a blueprint is in, from 0 to one less than its number of stages. */
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
 * Where the approach takes a player at `player` to work on a blueprint or structure: within BUILD_REACH_METRES of the ground
 * it covers, just outside it, on their side of it. A player standing on it steps off it too, so a finished structure never traps them.
 */
export function structureReach(structure: PlacedStructure, player: GroundPoint): ApproachReach {
  const footprint = footprintOfEntity(structure);
  return { target: footprint, metres: BUILD_REACH_METRES, walk: { style: "offAndBeside", spot: standSpot(footprint, structure.position, player) } };
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
  return addGroundPoints(centre, scaleGroundPoint(away, reach));
}

/** The rules for placing blueprints, bringing materials to them, and building them. */
export function buildingRules(
  building: Building,
  { startApproach, stopOtherWork }: RuleGame,
): CommandRules<"placeBlueprint" | "build" | "deliverToBlueprint" | "stopBuilding"> {
  return {
    placeBlueprint: {
      // Placing alone leaves the player doing what they were doing. Building it at once starts afresh.
      start: "alongside",
      refusal: (command) => building.checkPlacement(command.structure, { x: command.x, z: command.z }, command.turns).refusal,
      queue: "apart",
      needsFreeHands: (command) => command.thenBuild === true,
      run: (command) => {
        const id = building.place(command.structure, { x: command.x, z: command.z }, command.turns);
        if (command.thenBuild !== true || id === undefined) return undefined;
        // Full hands stop building at once, and the game says why. A blueprint that lacks a material just stays placed.
        const refusal = building.refusal(id);
        if (refusal?.kind === "handsFull") return refusedNotice(refusal);
        if (!building.canStartBuilding(id)) return undefined;
        stopOtherWork();
        return startApproach({ type: "build", blueprintId: id });
      },
    },
    build: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => building.refusal(command.blueprintId),
      approach: {
        reach: (command) => building.reach(command.blueprintId),
        act: (command) => {
          building.build(command.blueprintId);
        },
      },
    },
    deliverToBlueprint: {
      start: "fresh",
      needsFreeHands: true,
      approach: {
        reach: (command) => building.reach(command.blueprintId),
        act: (command) => {
          building.deliver(command.blueprintId);
        },
      },
    },
    stopBuilding: {
      start: "alongside",
      queue: "apart",
      run: () => {
        building.cancel();
      },
    },
  };
}
