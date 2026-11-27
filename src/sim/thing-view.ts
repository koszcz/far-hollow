// Says what a thing in the world is, given by its entity id. The action queue uses it to pick the icon of an action on it.
import type { ThingView } from "./api-scene-pick";
import type { EntityStore } from "./entities";
import { holdsAddOn } from "./add-ons";
import { isHost } from "./structure-kind";
import { structureKindOf } from "./structures";
import { isSapling, isYoungTree } from "./tree-growth";

/** What the entity with this id is, or undefined if it is gone or is none of the kinds ThingView names. */
export function describeThing(entities: EntityStore, id: number): ThingView | undefined {
  const entity = entities.entity(id);
  if (entity === undefined) return undefined;
  const structure = structureKindOf(entity);
  if (structure === "shutters" && entity.shutters !== undefined) return { kind: "structure", structure, open: entity.shutters.open };
  if (structure !== undefined && isHost(structure) && entity.blueprint === undefined && entity.position !== undefined) {
    return { kind: "structure", structure, holdsAddOn: holdsAddOn(entities, structure, entity.position) };
  }
  if (structure !== undefined) return { kind: "structure", structure };
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
