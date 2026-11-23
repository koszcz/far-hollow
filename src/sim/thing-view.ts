// Says what a thing in the world is, given by its entity id. The action queue uses it to pick the icon of an action on it.
import type { ThingView } from "./api";
import type { EntityStore } from "./entities";
import { structureKindOf } from "./structures";
import { isSapling, isYoungTree } from "./tree-growth";

/** What the entity with this id is, or undefined if it is gone or is none of the kinds ThingView names. */
export function describeThing(entities: EntityStore, id: number): ThingView | undefined {
  const entity = entities.entity(id);
  if (entity === undefined) return undefined;
  const structure = structureKindOf(entity);
  if (structure !== undefined)
    return entity.shutters === undefined ? { kind: "structure", structure } : { kind: "structure", structure, open: entity.shutters.open };
  if (entity.forageSpot !== undefined) return { kind: "forage", food: entity.forageSpot.food };
  if (entity.pile !== undefined) return { kind: "pile", content: entity.pile.content };
  if (entity.fishTrap !== undefined) return { kind: "fishTrap", holdsFish: entity.fishTrap.holding };
  if (entity.tree === true || isYoungTree(entity.growth)) return { kind: "tree" };
  if (isSapling(entity.growth)) return { kind: "sapling" };
  if (entity.stump === true) return { kind: "stump" };
  if (entity.log !== undefined) return { kind: "log" };
  if (entity.debarkedLog !== undefined) return { kind: "debarkedLog" };
  if (entity.stick === true) return { kind: "stick" };
  if (entity.bark === true) return { kind: "bark" };
  if (entity.bedroll === true) return { kind: "bedroll" };
  return undefined;
}
