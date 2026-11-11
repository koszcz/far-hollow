// What the player does over time, such as chopping, building, or walking to pick something up.
// The game holds one list of activities. A new command cancels them all, and each logic step runs each in turn.
// playerActivity says which timed work the player is doing now, for both the HUD and the player's drawn pose.
import type { GameNotice, PlayerAction } from "./api";
import { buildingNow } from "./building";
import { choppingNow } from "./chopping";
import { craftingNow } from "./crafting";
import { debarkingNow } from "./debarking";
import type { Entity, EntityStore } from "./entities";
import { splittingNow } from "./gathering";
import { takingDownNow } from "./taking-down";

/** Something the player does over time, which a new command cancels. */
export interface Activity {
  /** Stops it, if the player is doing it or walking to do it. */
  cancel(): void;
  /** Runs it for one logic step of `playerSeconds`. It may return a notice to show, such as a refusal. */
  step(playerSeconds: number): GameNotice | undefined;
}

/** The timed work the player is doing now, with what they work on, given by its entity id, if anything. */
export interface PlayerActivity extends PlayerAction {
  readonly targetId?: number;
}

type ActivityNow = (entities: EntityStore, player: Entity) => { progress: number; targetId?: number } | undefined;

/**
 * Each kind of timed work, with how to tell whether the player is doing it now.
 * Only one is normally under way. If more are, the first in this list wins.
 */
const TIMED_WORK: readonly (readonly [PlayerAction["kind"], ActivityNow])[] = [
  ["craft", (_entities, player) => craftingNow(player)],
  ["build", buildingNow],
  ["takeDown", takingDownNow],
  ["debark", (_entities, player) => debarkingNow(player)],
  ["split", (_entities, player) => splittingNow(player)],
  ["chop", (_entities, player) => choppingNow(player)],
];

/** The timed work the player is doing now, or undefined if none. Walking to the work does not count. */
export function playerActivity(entities: EntityStore, player: Entity): PlayerActivity | undefined {
  for (const [kind, now] of TIMED_WORK) {
    const work = now(entities, player);
    if (work !== undefined) return { kind, ...work };
  }
  return undefined;
}
