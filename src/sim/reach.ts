// Finds the thing the E key acts on: the one nearest the player within reach.
import type { ThingInReach } from "./api";
import { distanceOutside } from "./building";
import type { Entity, EntityStore } from "./entities";
import { footprintOfEntity, isPlacedStructure } from "./structures";
import { groundDistance, type GroundPoint } from "./valley";

/** E reaches things this far from the player, in metres. It is measured to a structure's edge and to a tree's trunk. */
export const USE_REACH_METRES = 2.5;

/** No structure's footprint or tree's trunk reaches further than this from its middle, in metres. */
const LARGEST_HALF_SIZE_METRES = 5;

/** The thing nearest `at` within USE_REACH_METRES, or null if none is. Of two things just as near, the first found wins. */
export function nearestInReach(entities: EntityStore, at: GroundPoint): ThingInReach | null {
  let nearest: ThingInReach | null = null;
  let nearestDistance = Infinity;
  const far = USE_REACH_METRES + LARGEST_HALF_SIZE_METRES;
  for (const entity of entities.with("position")) {
    // A cheap check first, since most of the valley is far away.
    if (Math.abs(entity.position.x - at.x) > far || Math.abs(entity.position.z - at.z) > far) continue;
    const id = entities.id(entity);
    const thing = id === undefined ? undefined : thingOf(entity, id);
    if (thing === undefined) continue;
    const distance = distanceTo(entity, at);
    if (distance <= USE_REACH_METRES && distance < nearestDistance) {
      nearest = thing;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/** What E would act on in this entity, or undefined if E acts on nothing in it, as for the player, a stump, or a finished wall. */
function thingOf(entity: Entity, id: number): ThingInReach | undefined {
  // A blueprint of a campfire or chest is a blueprint, not yet the thing it will be.
  if (entity.blueprint !== undefined) return { kind: "blueprint", id };
  if (entity.workStation !== undefined) return { kind: "workStation", id, station: entity.workStation };
  if (entity.tree === true) return { kind: "tree", id };
  if (entity.log !== undefined) return { kind: "log", id };
  if (entity.debarkedLog !== undefined) return { kind: "debarkedLog", id };
  if (entity.stick === true) return { kind: "stick", id };
  if (entity.bark === true) return { kind: "bark", id };
  // A bush growing back has nothing to forage yet.
  if (entity.forageSpot !== undefined) return entity.regrowing === undefined ? { kind: "forage", id } : undefined;
  if (entity.campfire !== undefined) return { kind: "campfire", id };
  if (entity.woodpile !== undefined) return { kind: "woodpile", id };
  if (entity.chest !== undefined) return { kind: "chest", id };
  if (entity.bedroll === true) return { kind: "bedroll", id };
  if (entity.pile !== undefined) return { kind: "pile", id };
  return undefined;
}

/** How far `at` is from the entity: from its edge for a structure, from its trunk for a tree, and from its middle for anything else. */
function distanceTo(entity: Entity & { position: GroundPoint }, at: GroundPoint): number {
  if (isPlacedStructure(entity)) return distanceOutside(footprintOfEntity(entity), at);
  return Math.max(0, groundDistance(entity.position, at) - (entity.blocksWalking?.radius ?? 0));
}
