import { playerEntities, setComponent, walkBlockerEdgeEntities, walkBlockerEntities, walkBlockerSpotEntities, type Entity, type EntityStore } from "./entities";
import { distanceToTarget, findPath, findPathWithin, type WalkTarget } from "./pathfinding";
import { standingHeightAt } from "./foundations";
import { distanceToRiver, startSpotBeside, type GroundPoint, type Valley } from "./valley";
import {
  blockCircle,
  blockEdges,
  blockSpots,
  blockWhere,
  createWalkMap,
  nearestWalkableSpot,
  unblockCircle,
  unblockEdges,
  unblockSpots,
  type WalkEdge,
  type WalkMap,
} from "./walk-map";

/** How fast the player walks, in metres per second. */
export const WALK_SPEED_METRES_PER_SECOND = 3;

/** The player cannot walk into the water or this close to its edge. */
const RIVER_BANK_BLOCK_METRES = 1;

export interface Walking {
  /** Which parts of the valley floor can be walked on. It updates itself as blockers are added and removed. */
  readonly walkMap: WalkMap;
  /** Sets the player walking to a spot, around anything in the way. If the spot cannot be reached, the player walks as close as they can. */
  walkTo(target: GroundPoint): void;
  /**
   * Sets the player walking the shortest way to a spot within `distance` of a target, around anything in the way.
   * The distance is measured to a point, or to a rectangle's edge.
   * The player stays put if they already stand within it. If no such spot can be reached, the player walks as close as they can.
   */
  walkWithin(target: WalkTarget, distance: number): void;
  /** Moves every walking entity along its path by one logic step. */
  step(stepSeconds: number): void;
}

/**
 * Keeps the walk map in step with the river and every entity that blocks walking, and moves walking entities.
 */
export function createWalking(entities: EntityStore, valley: Valley): Walking {
  const walkMap = createWalkMap({ size: valley.size });
  blockRiver(walkMap, valley);
  trackBlockers(walkMap, entities);
  const players = playerEntities(entities);
  const walkers = entities.with("walkPath", "position");

  const setPath = (player: Entity, path: GroundPoint[]) => {
    if (path.length === 0) entities.removeComponent(player, "walkPath");
    else setComponent(entities, player, "walkPath", path);
  };

  return {
    walkMap,
    walkTo(target) {
      for (const player of players) setPath(player, findPath(walkMap, player.position, target));
    },
    walkWithin(target, distance) {
      for (const player of players) setPath(player, findPathWithin(walkMap, player.position, target, distance));
    },
    step(stepSeconds) {
      const stepDistance = WALK_SPEED_METRES_PER_SECOND * stepSeconds;
      // Copy the list first, because entities that arrive leave the query while it is being walked.
      for (const walker of [...walkers]) {
        if (walkAlong(walker, stepDistance, entities, valley)) entities.removeComponent(walker, "walkPath");
      }
    },
  };
}

/**
 * Walks the player the shortest way to stand within `standMetres` of something, unless they are already within `reachMetres`.
 * Both distances are measured to a point's centre, or to a rectangle's edge, such as a sled's footprint.
 * On open ground the player stops `standMetres` from it, on their own side. `standMetres` must be less than `reachMetres`,
 * so the player always stops within reach. For things that block walking, such as a campfire, chest, or woodpile,
 * this stops the player beside them rather than on them.
 */
export function walkBeside(walking: Walking, from: GroundPoint, target: WalkTarget, reachMetres: number, standMetres: number): void {
  if (distanceToTarget(target, from) <= reachMetres) return;
  walking.walkWithin(target, standMetres);
}

/** Moves an entity up to `distance` metres along its path. Returns true once it has reached the end. */
function walkAlong(walker: Entity & Required<Pick<Entity, "walkPath" | "position">>, distance: number, entities: EntityStore, valley: Valley): boolean {
  let left = distance;
  const { position, walkPath } = walker;
  while (left > 0) {
    const next = walkPath[0];
    if (next === undefined) break;
    const dx = next.x - position.x;
    const dz = next.z - position.z;
    const toNext = Math.hypot(dx, dz);
    if (toNext <= left) {
      position.x = next.x;
      position.z = next.z;
      walkPath.shift();
      left -= toNext;
    } else {
      position.x += (dx / toNext) * left;
      position.z += (dz / toNext) * left;
      left = 0;
    }
  }
  // On a finished foundation the walker stands on its deck.
  position.y = standingHeightAt(entities, valley.terrain, position);
  return walkPath.length === 0;
}

function blockRiver(walkMap: WalkMap, valley: Valley): void {
  const { river } = valley;
  const reach = river.width / 2 + RIVER_BANK_BLOCK_METRES;
  const isRiver = (spot: GroundPoint) => distanceToRiver(river, spot) <= reach;
  // Check only the cells near each stretch of the river, so the whole valley is not measured against every stretch.
  for (let i = 1; i < river.path.length; i += 1) {
    const a = river.path[i - 1];
    const b = river.path[i];
    if (a === undefined || b === undefined) continue;
    const min = { x: Math.min(a.x, b.x) - reach, z: Math.min(a.z, b.z) - reach };
    const max = { x: Math.max(a.x, b.x) + reach, z: Math.max(a.z, b.z) + reach };
    // Neighbouring stretches overlap, so some cells are blocked twice. The river never moves, so that does no harm.
    blockWhere(walkMap, min, max, isRiver);
  }
}

/** Where the player starts: on open ground on the river's west bank, halfway down the valley. */
export function playerStartSpot(walking: Walking, valley: Valley): GroundPoint {
  const bankSpot = startSpotBeside(valley.river);
  return nearestWalkableSpot(walking.walkMap, bankSpot) ?? bankSpot;
}

/** Blocks the cells around each blocker entity, now and whenever one is added or removed later. */
function trackBlockers(walkMap: WalkMap, entities: EntityStore): void {
  const blockers = walkBlockerEntities(entities).connect();
  // Remember each blocked circle, so it can be undone exactly even if the entity has changed by the time it is removed.
  const blocked = new Map<Entity, { centre: GroundPoint; radius: number }>();
  const block = (entity: Entity & Required<Pick<Entity, "blocksWalking" | "position">>) => {
    const circle = { centre: { x: entity.position.x, z: entity.position.z }, radius: entity.blocksWalking.radius };
    blocked.set(entity, circle);
    blockCircle(walkMap, circle.centre, circle.radius);
  };
  for (const entity of blockers) block(entity);
  blockers.onEntityAdded.subscribe(block);
  blockers.onEntityRemoved.subscribe((entity) => {
    const circle = blocked.get(entity);
    if (circle === undefined) return;
    blocked.delete(entity);
    unblockCircle(walkMap, circle.centre, circle.radius);
  });

  const spotBlockers = walkBlockerSpotEntities(entities).connect();
  // Remember each entity's blocked spots, for the same reason.
  const blockedSpots = new Map<Entity, GroundPoint[]>();
  const blockAtSpots = (entity: Entity & Required<Pick<Entity, "blocksWalkingSpots">>) => {
    const spots = entity.blocksWalkingSpots.map(({ x, z }) => ({ x, z }));
    blockedSpots.set(entity, spots);
    blockSpots(walkMap, spots);
  };
  for (const entity of spotBlockers) blockAtSpots(entity);
  spotBlockers.onEntityAdded.subscribe(blockAtSpots);
  spotBlockers.onEntityRemoved.subscribe((entity) => {
    const spots = blockedSpots.get(entity);
    if (spots === undefined) return;
    blockedSpots.delete(entity);
    unblockSpots(walkMap, spots);
  });

  const edgeBlockers = walkBlockerEdgeEntities(entities).connect();
  // Remember each entity's blocked edges, for the same reason.
  const blockedEdges = new Map<Entity, WalkEdge[]>();
  const blockAtEdges = (entity: Entity & Required<Pick<Entity, "blocksWalkingEdges">>) => {
    const edges = entity.blocksWalkingEdges.map(({ from, to }) => ({ from: { x: from.x, z: from.z }, to: { x: to.x, z: to.z } }));
    blockedEdges.set(entity, edges);
    blockEdges(walkMap, edges);
  };
  for (const entity of edgeBlockers) blockAtEdges(entity);
  edgeBlockers.onEntityAdded.subscribe(blockAtEdges);
  edgeBlockers.onEntityRemoved.subscribe((entity) => {
    const edges = blockedEdges.get(entity);
    if (edges === undefined) return;
    blockedEdges.delete(entity);
    unblockEdges(walkMap, edges);
  });
}
