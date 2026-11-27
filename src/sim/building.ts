import type { BlueprintView } from "./api-nearby";
import type { BuildLack, Refusal } from "./api-refusal";
import type { Notice } from "./api-notice";
import type { PlacementCheck } from "./api-client";
import type { ApproachReach } from "./approach";
import { hasInBackpack, removeFromBackpack } from "./backpack";
import { addCount, countOf } from "./counts";
import { snapToGridPoint } from "./build-grid";
import { setComponent, type Entity, type EntityStore } from "./entities";
import { blueprintEntities, playerEntities } from "./entity-queries";
import { stageMaterials, type MaterialCost, type PlacedStructure } from "./structure-types";
import type { KeptMaterial, StructureKind } from "./structure-kind";
import { footprintOfEntity, isPlacedStructure } from "./structure-queries";
import { costOf, isDelivered, isKept, structureOf } from "./structures";
import { gardenThingInTheWay } from "./garden-things";
import type { QuarterTurns } from "./quarter-turns";
import { terrainHeightAt, type Valley } from "./valley";
import type { GroundPoint } from "./ground-point";
import type { HandReach } from "./hand-reach";
import { WALK_REACH_MARGIN_METRES, type Walking } from "./walking";
import type { WalkTarget } from "./walk-target";
import { isBehindWall, isWithinReach, wallsIn } from "./wall-reach";
import { isWalkable, laySpots } from "./walk-map";
import { standingHeightAt } from "./foundations";
import { wallOn } from "./wall-swaps";
import { refusedNotice } from "./notices";
import { BUILD_REACH_METRES, distanceOutside, structureReach } from "./building-reach";
import { fetchableSources, FETCH_REACH_METRES, sourceOf } from "./building-sources";
import { canDeliver, keptLeft, nextStageLack, stageOf, takeFromBackpack, type Backpack, type Blueprint } from "./building-materials";

type Builder = Entity & Required<Pick<Entity, "buildTask" | "position" | "backpack">>;

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

  /** Whether a worker stands within reach of a placed blueprint, on its side of every wall. */
  function inReach(worker: { position: GroundPoint }, target: PlacedStructure): boolean {
    return isWithinReach(wallsIn(entities), worker.position, footprintOfEntity(target), BUILD_REACH_METRES);
  }

  /** The blueprint a task points at, if it still exists and the worker has it within reach. */
  function reachedBlueprint(worker: { position: GroundPoint }, blueprintId: number) {
    const placed = placedBlueprint(blueprintId);
    // The player may have walked as close as they could but still be out of reach.
    if (placed === undefined || !inReach(worker, placed.target)) return undefined;
    return placed;
  }

  /** Whether the player carries something a blueprint's next stage does not need. Their hands must be free to build it then. */
  function handsFull(player: Entity, blueprint: Blueprint, cost: readonly MaterialCost[]): boolean {
    if (freeBuilding || player.carrying === undefined) return false;
    return stageMaterials(cost)[blueprint.materialsSpent] !== player.carrying;
  }

  /** What the player lacks to build a blueprint's next stage, or undefined if nothing. A material they carry or can fetch counts. */
  function lackOf(player: Entity, backpack: Backpack, target: Entity, blueprint: Blueprint): BuildLack | undefined {
    const available = (material: KeptMaterial) =>
      player.carrying === material || (isPlacedStructure(target) && fetchableSources(entities, walking.walkMap, target, material).length > 0);
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

  /** Whether the walk the player has just set off on ends within `metres` of `target`, on its side of every wall. */
  function arrivesWithin(walker: Entity & { position: GroundPoint }, target: WalkTarget, metres: number): boolean {
    return isWithinReach(wallsIn(entities), walker.walkPath?.at(-1) ?? walker.position, target, metres);
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
    const source = fetchableSources(entities, walking.walkMap, placed.target, material)[0];
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
    const source = entity === undefined ? undefined : sourceOf(entities, entity, material);
    if (entity === undefined || source === undefined) return undefined;
    if (builder.carrying !== undefined) return STOP_HANDS_FULL;
    if (!isWithinReach(wallsIn(entities), builder.position, source.target, FETCH_REACH_METRES)) return stopLacking({ kind: "material", material });
    hand.start("low", source.reachToward, () => {
      const still = sourceOf(entities, entity, material);
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

  /**
   * Takes down the log wall under a swap blueprint that has just finished. The logs the new piece does not need go on the ground
   * near `near`, on that side of the wall. They are laid while the wall still stands, so none lands beyond it.
   */
  function replaceWall(swap: Placed, near: GroundPoint): void {
    const wall = wallOn(entities, swap.position);
    entities.removeComponent(swap.target, "swapsWall");
    if (wall === undefined) return;
    const logsIn = (cost: readonly MaterialCost[]) => cost.filter(({ material }) => material === "debarkedLog").reduce((sum, { count }) => sum + count, 0);
    const spare = Math.max(0, logsIn(costOf(wall, "logWall")) - logsIn(costOf(swap.target, swap.blueprint.structure)));
    const spots = laySpots(walking.walkMap, near, spare);
    for (let i = 0; i < spare; i += 1) {
      const { x, z } = spots[i] ?? near;
      entities.add({ debarkedLog: { heading: 0 }, position: { x, y: standingHeightAt(entities, valley.terrain, { x, z }), z } });
    }
    entities.remove(wall);
  }

  /** Turns a blueprint whose progress has reached 1 into the finished structure. `near` is where the player stands. */
  function finish(placed: Placed, near: GroundPoint): void {
    const { target, blueprint, position } = placed;
    if (target.swapsWall === true) replaceWall(placed, near);
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
      const site = { entities, walkMap: walking.walkMap, valley };
      definition.clearSite?.(site, spot);
      const blocks = definition.blueprintBlocksWalkingSpots?.(spot);
      const added = entities.add({
        ...definition.blueprintParts?.(site, spot),
        blueprint: { structure, progress: 0, materialsSpent: 0, delivered: {} },
        facing: { turns: facing },
        position: { ...spot },
        ...(blocks === undefined ? {} : { blocksWalkingSpots: blocks }),
      });
      const id = entities.id(added);
      if (instantBuilding && id !== undefined) {
        const placed = placedBlueprint(id);
        if (placed !== undefined) finish(placed, players.first?.position ?? placed.position);
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
      const walls = wallsIn(entities);
      for (const player of players) {
        for (const blueprint of blueprints) {
          const footprint = footprintOfEntity(blueprint);
          const distance = distanceOutside(footprint, player.position);
          const id = entities.id(blueprint);
          if (id === undefined || distance > BUILD_REACH_METRES || (nearest !== undefined && distance >= nearest.distance)) continue;
          if (isBehindWall(walls, player.position, footprint)) continue;
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
        finish(placed, builder.position);
      }
      return notice;
    },
  };
}

export function buildingNow(entities: EntityStore, player: Entity): { progress: number; targetId: number } | undefined {
  const task = player.buildTask;
  if (task === undefined || task.fetchFrom !== undefined || player.walkPath !== undefined || player.handReach !== undefined) return undefined;
  const blueprint = entities.entity(task.blueprintId)?.blueprint;
  return blueprint === undefined ? undefined : { progress: blueprint.progress, targetId: task.blueprintId };
}
