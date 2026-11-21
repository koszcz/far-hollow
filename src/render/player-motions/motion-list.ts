// Names every player motion: each animation asset that poses the player in code, with its props. The player mesh runs
// them in this order, and the first body motion playing wins. To add a motion, add its module to this folder, then one
// import line and one entry line here. Git merges this file by union (see .gitattributes), so two branches that each add
// a motion merge without a conflict. A line kept twice fails the typecheck. See docs/adr/0012-each-player-motion-is-its-own-module.md.
import { createGatherStoneMotion } from "./gather-stone-animation";
import type { PlayerMotion, PlayerRig } from "./player-motion";

/** Each motion's asset id, with the function that makes it. */
export const PLAYER_MOTIONS = {
  "gather-stone-animation": createGatherStoneMotion,
} as const;

export type MotionId = keyof typeof PLAYER_MOTIONS;

/** Each motion as made, by its id. */
export type PlayerMotions = { readonly [Id in MotionId]: ReturnType<(typeof PLAYER_MOTIONS)[Id]> };

/** The moment each motion moves on to, by its id, such as a steady clock time or the `Fishing` shape. */
export type MotionMoment<Id extends MotionId> = PlayerMotions[Id] extends PlayerMotion<infer Moment> ? Moment : never;

/** Makes every motion on `rig`, in the list's order. */
export function createPlayerMotions(rig: PlayerRig): PlayerMotions {
  return Object.fromEntries(Object.entries(PLAYER_MOTIONS).map(([id, create]) => [id, create(rig)])) as unknown as PlayerMotions;
}
