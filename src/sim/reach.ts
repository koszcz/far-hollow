// Finds the thing the E key acts on: the one nearest the player within reach.
import type { ThingInReach } from "./api-scene-pick";
import type { Entity, EntityStore } from "./entities";
import { footprintOfEntity, isPlacedStructure } from "./structures";
import { isSapling, isYoungTree } from "./tree-growth";
import type { GroundPoint } from "./ground-point";
import { distanceToTarget, type WalkTarget } from "./walk-target";
import { isBehindWall, wallsIn } from "./wall-reach";

/** E reaches things this far from the player, in metres. It is measured to a structure's edge and to a tree's trunk. */
export const USE_REACH_METRES = 2.5;

/** No structure's footprint or tree's trunk reaches further than this from its middle, in metres. */
const LARGEST_HALF_SIZE_METRES = 5;

/** The thing nearest `at` within USE_REACH_METRES, on the same side of every wall, or null if none is. Of two things just as near, the first found wins. */
export function nearestInReach(entities: EntityStore, at: GroundPoint): ThingInReach | null {
  let nearest: ThingInReach | null = null;
  let nearestDistance = Infinity;
  const far = USE_REACH_METRES + LARGEST_HALF_SIZE_METRES;
  const walls = wallsIn(entities);
  for (const entity of entities.with("position")) {
    // A cheap check first, since most of the valley is far away.
    if (Math.abs(entity.position.x - at.x) > far || Math.abs(entity.position.z - at.z) > far) continue;
    const id = entities.id(entity);
    const thing = id === undefined ? undefined : thingOf(entity, id);
    if (thing === undefined) continue;
    const { target, radius } = reachOf(entity);
    const distance = Math.max(0, distanceToTarget(target, at) - radius);
    if (distance <= USE_REACH_METRES && distance < nearestDistance && !isBehindWall(walls, at, target)) {
      nearest = thing;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/** What E would act on in this entity, or undefined if E acts on nothing in it, as for the player, a bare stump, or a finished wall. */
function thingOf(entity: Entity, id: number): ThingInReach | undefined {
  // A blueprint of a campfire or a piece of furniture is a blueprint, not yet the thing it will be.
  if (entity.blueprint !== undefined) return { kind: "blueprint", id };
  if (entity.workStation !== undefined) return { kind: "workStation", id, station: entity.workStation };
  if (entity.tree === true) return { kind: "tree", id };
  // A young tree is offered, so its menu says why it cannot be chopped or dug up yet.
  if (isYoungTree(entity.growth)) return { kind: "youngTree", id };
  // A bare stump is not: it would hide the logs lying beside it. A click on it still says why it offers nothing yet.
  if (isSapling(entity.growth)) return { kind: "sapling", id };
  if (entity.log !== undefined) return { kind: "log", id };
  if (entity.debarkedLog !== undefined) return { kind: "debarkedLog", id };
  if (entity.stick === true) return { kind: "stick", id };
  if (entity.bark === true) return { kind: "bark", id };
  // A mushroom log growing its mushrooms back can still be taken down, so it is offered either way.
  if (entity.mushroomLog !== undefined) return { kind: "mushroomLog", id };
  // A bush growing back has nothing to forage yet.
  if (entity.forageSpot !== undefined) return entity.regrowing === undefined ? { kind: "forage", id } : undefined;
  if (entity.campfire !== undefined) return { kind: "campfire", id };
  if (entity.fireplace !== undefined) return { kind: "fireplace", id };
  if (entity.woodpile !== undefined) return { kind: "woodpile", id };
  if (entity.furniture !== undefined) return { kind: "furniture", id, furniture: entity.furniture };
  if (entity.sled !== undefined) return { kind: "sled", id };
  if (entity.bedroll === true) return { kind: "bedroll", id };
  if (entity.pile !== undefined) return { kind: "pile", id };
  if (entity.plantedTorch !== undefined) return { kind: "plantedTorch", id };
  if (entity.fishTrap !== undefined) return { kind: "fishTrap", id };
  if (entity.shutters !== undefined) return { kind: "shutters", id };
  return undefined;
}

/**
 * What E measures to in the entity, and how much of that distance it forgives, in metres.
 * For a structure, E measures to the edge of its footprint. For anything else, it measures to the middle, less the trunk's radius for a tree.
 */
function reachOf(entity: Entity & { position: GroundPoint }): { target: WalkTarget; radius: number } {
  if (isPlacedStructure(entity)) return { target: footprintOfEntity(entity), radius: 0 };
  return { target: { x: entity.position.x, z: entity.position.z }, radius: entity.blocksWalking?.radius ?? 0 };
}
