// Refusals that several kinds of work share: a tool missing from the backpack, a log already on the shoulder, or a thing that is gone.
// Each module that carries out a command also says why it would refuse it, so the UI and the work read the same rule.
import type { Refusal } from "./api-refusal";
import { hasInBackpack } from "./backpack";
import type { Entity, EntityStore } from "./entities";

/** The refusal for work that needs `tool`, if the player's backpack lacks it. */
export function toolRefusal(player: Entity | undefined, tool: Extract<Refusal, { kind: "needsTool" }>["tool"]): Refusal | undefined {
  return player?.backpack !== undefined && hasInBackpack(player.backpack, tool) ? undefined : { kind: "needsTool", tool };
}

/** The refusal for work that puts a log on the player's shoulder, if one is already there. */
export function shoulderRefusal(player: Entity | undefined): Refusal | undefined {
  return player?.carrying === undefined ? undefined : { kind: "shoulderFull" };
}

/**
 * The refusal for work on the entity with this id, if no entity has it any more, such as a stick already picked up.
 * The module that does the work still does nothing for an entity of the wrong kind.
 */
export function goneRefusal(entities: EntityStore, id: number): Refusal | undefined {
  return entities.entity(id) === undefined ? { kind: "gone" } : undefined;
}
