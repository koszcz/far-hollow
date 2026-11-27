import { takeCount } from "./counts";
import { type Entity, type EntityStore } from "./entities";
import { debarkedLogEntities, isParked, logEntities, pileEntities, sledEntities } from "./entity-queries";
import { footprintOfEntity, isPlacedStructure } from "./structure-queries";
import type { KeptMaterial } from "./structure-kind";
import type { PlacedStructure } from "./structure-types";
import type { GroundPoint } from "./ground-point";
import { walkingDistancesFrom } from "./pathfinding";
import type { WalkMap } from "./walk-map";
import type { WalkTarget } from "./walk-target";
import { gapTo } from "./building-reach";

/**
 * The player fetches a stage's material themselves if it lies within this many metres of the blueprint's edge, measured along
 * the walking path. They fetch from logs and debarked logs lying on the ground, plank and stone piles, and parked sleds.
 */
export const FETCH_METRES = 10;
/** The player picks up a fetched material from this far from a pile's or log's middle, or from a sled's edge, in metres. */
export const FETCH_REACH_METRES = 2;

/** One place the player can fetch a material from: a pile, a log lying on the ground, or a parked sled. */
export interface Source {
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

/** The entity as a place to fetch one `material` from, if it is one now: a pile, a log on the ground, or a parked sled holding some. */
export function sourceOf(entities: EntityStore, entity: Entity, material: KeptMaterial): Source | undefined {
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
function sourcesOf(entities: EntityStore, material: KeptMaterial): Source[] {
  const candidates: readonly Entity[] =
    material === "log" ? logEntities(entities).entities : material === "debarkedLog" ? debarkedLogEntities(entities).entities : pileEntities(entities).entities;
  const sleds = material === "stone" ? [] : sledEntities(entities).entities;
  return [...candidates, ...sleds].flatMap((entity) => sourceOf(entities, entity, material) ?? []);
}

/** The places to fetch `material` from within FETCH_METRES of a blueprint, measured along the walking path, nearest first. */
export function fetchableSources(entities: EntityStore, walkMap: WalkMap, target: PlacedStructure, material: KeptMaterial): Source[] {
  const footprint = footprintOfEntity(target);
  // No walk is shorter than the straight line, so anything further than that cannot count.
  const close = sourcesOf(entities, material).filter((source) => gapTo(footprint, source.target) <= FETCH_METRES);
  if (close.length === 0) return [];
  const walks = walkingDistancesFrom(walkMap, footprint, FETCH_METRES);
  return close
    .map((source) => ({ source, distance: walks.to(source.target) }))
    .filter((found): found is { source: Source; distance: number } => found.distance !== undefined)
    .sort((a, b) => a.distance - b.distance)
    .map(({ source }) => source);
}
