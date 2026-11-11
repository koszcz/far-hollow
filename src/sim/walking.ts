import { playerEntities, setComponent, walkBlockerEntities, type Entity, type EntityStore } from "./entities";
import { findPath } from "./pathfinding";
import { distanceToRiver, terrainHeightAt, type GroundPoint, type Valley } from "./valley";
import { blockCircle, blockWhere, createWalkMap, nearestWalkableSpot, unblockCircle, type WalkMap } from "./walk-map";

/** How fast the player walks, in metres per second. */
export const WALK_SPEED_METRES_PER_SECOND = 3;

/** The player cannot walk into the water or this close to its edge. */
const RIVER_BANK_BLOCK_METRES = 1;

export interface Walking {
  /** Which parts of the valley floor can be walked on. It updates itself as blockers are added and removed. */
  readonly walkMap: WalkMap;
  /** Sets the player walking to a spot, around anything in the way. If the spot cannot be reached, the player walks as close as they can. */
  walkTo(target: GroundPoint): void;
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

  return {
    walkMap,
    walkTo(target) {
      for (const player of players) {
        const path = findPath(walkMap, player.position, target);
        if (path.length === 0) entities.removeComponent(player, "walkPath");
        else setComponent(entities, player, "walkPath", path);
      }
    },
    step(stepSeconds) {
      const stepDistance = WALK_SPEED_METRES_PER_SECOND * stepSeconds;
      // Copy the list first, because entities that arrive leave the query while it is being walked.
      for (const walker of [...walkers]) {
        if (walkAlong(walker, stepDistance, valley)) entities.removeComponent(walker, "walkPath");
      }
    },
  };
}

/** Moves an entity up to `distance` metres along its path. Returns true once it has reached the end. */
function walkAlong(walker: Entity & Required<Pick<Entity, "walkPath" | "position">>, distance: number, valley: Valley): boolean {
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
  position.y = terrainHeightAt(valley.terrain, position.x, position.z);
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

/** Where the player starts: on open ground at the valley's west edge, which the river never reaches. */
export function playerStartSpot(walking: Walking, valley: Valley): GroundPoint {
  const edgeSpot = { x: -valley.size / 2 + PLAYER_START_INSET_METRES, z: 0 };
  return nearestWalkableSpot(walking.walkMap, edgeSpot) ?? edgeSpot;
}

/** How far inside the valley's edge the player starts. */
const PLAYER_START_INSET_METRES = 2;

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
}
