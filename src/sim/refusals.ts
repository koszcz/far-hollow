// Refusals that several kinds of work share: a tool missing from the backpack, or a log already on the shoulder.
// Each module that carries out a command also says why it would refuse it, so the UI and the work read the same rule.
import type { Refusal } from "./api";
import { hasInBackpack } from "./backpack";
import type { Entity } from "./entities";

/** The refusal for work that needs `tool`, if the player's backpack lacks it. */
export function toolRefusal(player: Entity | undefined, tool: Extract<Refusal, { kind: "needsTool" }>["tool"]): Refusal | undefined {
  return player?.backpack !== undefined && hasInBackpack(player.backpack, tool) ? undefined : { kind: "needsTool", tool };
}

/** The refusal for work that puts a log on the player's shoulder, if one is already there. */
export function shoulderRefusal(player: Entity | undefined): Refusal | undefined {
  return player?.carrying === undefined ? undefined : { kind: "shoulderFull" };
}
