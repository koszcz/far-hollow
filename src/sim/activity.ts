// What the player does over time, such as chopping, building, or walking to pick something up.
// The game holds one list of activities. A new command cancels them all, and each logic step runs each in turn.
// playerActivity says which timed work the player is doing now, for both the HUD and the player's drawn pose.
import type { Notice, PlainNotice, PlayerAction } from "./api";
import { buildingNow } from "./building";
import { choppingNow } from "./chopping";
import { craftingNow } from "./crafting";
import { debarkingNow } from "./debarking";
import type { Entity, EntityStore } from "./entities";
import { fishingNow } from "./fishing";
import { splittingNow } from "./gathering";
import { gatheringStoneNow } from "./stone";
import { takingDownNow } from "./taking-down";

/** Something the player does over time, which a new command cancels. */
export interface Activity {
  /** Stops it, if the player is doing it or walking to do it. */
  cancel(): void;
  /** Runs it for one logic step of `playerSeconds`. It may return a notice to show, such as a refusal. */
  step(playerSeconds: number): Notice | PlainNotice | undefined;
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
  ["chop", choppingNow],
  ["fish", (_entities, player) => fishingNow(player)],
  ["gatherStone", (_entities, player) => gatheringStoneNow(player)],
];

/** Each part of the player that means they are walking to do something, or doing it. */
type TaskPart = Extract<keyof Entity, `${string}Task`> | "walkPath" | "approach" | "handReach" | "sitting";

/** Every task part. TypeScript reports a missing one, so a new kind of task counts at once. */
const TASK_PARTS: Readonly<Record<TaskPart, true>> = {
  walkPath: true,
  approach: true,
  handReach: true,
  sitting: true,
  chopTask: true,
  logPickUpTask: true,
  logDropTask: true,
  debarkTask: true,
  splitTask: true,
  craftTask: true,
  buildTask: true,
  takeDownTask: true,
  deliverTask: true,
  bedrollTask: true,
  tendTask: true,
  fishTask: true,
  drinkTask: true,
  stoneTask: true,
  fillPotTask: true,
  pileTask: true,
  layBedrollTask: true,
  torchPickUpTask: true,
};

/**
 * Whether the player has anything left to do: walking somewhere, reaching, sitting, or any task.
 * When they have nothing, the action under way in the action queue is finished.
 */
export function playerIsBusy(player: Entity): boolean {
  return Object.keys(TASK_PARTS).some((part) => player[part as TaskPart] !== undefined);
}

/** The timed work the player is doing now, or undefined if none. Walking to the work does not count. */
export function playerActivity(entities: EntityStore, player: Entity): PlayerActivity | undefined {
  for (const [kind, now] of TIMED_WORK) {
    const work = now(entities, player);
    if (work !== undefined) return { kind, ...work };
  }
  return undefined;
}
