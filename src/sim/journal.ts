// The journal: the goals it suggests to a new player, in order, from a first campfire to a first snug room.
// Following it is optional, and the game never ends. A goal is done the first time the player does it, and stays done.
import { hasInBackpack } from "./backpack";
import {
  campfireEntities,
  debarkedLogEntities,
  leanToEntities,
  logEntities,
  pileEntities,
  sledEntities,
  stumpEntities,
  workStationEntities,
  type Entity,
  type EntityStore,
} from "./entities";
import { findRooms, isRoomSnug } from "./rooms";
import type { CommandRules } from "./command-rule";

/** How many game minutes the notice that a goal is done shows for. One game minute is one real second. */
export const GOAL_NOTICE_MINUTES = 6;

/** Every goal, in the order the journal suggests them. */
export const GOALS = ["pickUpSticks", "lightCampfire", "fellTree", "buildLeanTo", "sleepOnBedroll", "cutPlank", "buildRoom", "makeRoomSnug"] as const;

/** One thing the journal suggests the player do. */
export type Goal = (typeof GOALS)[number];

/** The journal's state: the goals done, in the order the player did them, and whether the player hid the journal. */
export interface Journal {
  done: Goal[];
  hidden: boolean;
}

/** The journal of a new game: no goal done, and not hidden. */
export function newJournal(): Journal {
  return { done: [], hidden: false };
}

/** Whether this goal is done. */
export function isGoalDone(journal: Journal, goal: Goal): boolean {
  return journal.done.includes(goal);
}

/** Marks the goal done. Returns true if it was not done before. */
export function markGoalDone(journal: Journal, goal: Goal): boolean {
  if (isGoalDone(journal, goal)) return false;
  journal.done.push(goal);
  return true;
}

/** The first goal in the journal's order that is not done yet, or undefined once every goal is done. */
export function nextGoal(journal: { readonly done: readonly Goal[] }): Goal | undefined {
  return GOALS.find((goal) => !journal.done.includes(goal));
}

/**
 * Whether the valley shows that the player has done this goal now. It only covers goals that leave a trace in the valley.
 * Sleeping on a bedroll leaves none, so the game marks it done when the player sleeps.
 */
function goalShowsNow(goal: Goal, entities: EntityStore, player: Entity): boolean {
  switch (goal) {
    case "pickUpSticks":
      return player.backpack !== undefined && hasInBackpack(player.backpack, "stick");
    case "lightCampfire":
      return campfireEntities(entities).entities.some((entity) => entity.campfire.lit);
    case "fellTree":
      // A felled tree leaves a stump, and logs until the player moves them.
      return stumpEntities(entities).first !== undefined || logEntities(entities).first !== undefined || debarkedLogEntities(entities).first !== undefined;
    case "buildLeanTo":
      return leanToEntities(entities).first !== undefined;
    case "sleepOnBedroll":
      return false;
    case "cutPlank":
      // Cut planks go in the backpack, or onto a sled or a pile beside the sawhorse when they do not fit.
      return (
        (player.backpack !== undefined && hasInBackpack(player.backpack, "plank")) ||
        pileEntities(entities).entities.some((entity) => entity.pile.content === "plank") ||
        sledEntities(entities).entities.some((entity) => entity.sled.plank > 0)
      );
    case "buildRoom":
      return findRooms(entities).length > 0;
    case "makeRoomSnug":
      return findRooms(entities).some((room) => isRoomSnug(entities, room));
  }
}

/** The goals not yet done that the valley shows the player has done now, in the journal's order. */
export function goalsShownNow(journal: Journal, entities: EntityStore, player: Entity): Goal[] {
  return GOALS.filter((goal) => !isGoalDone(journal, goal) && goalShowsNow(goal, entities, player));
}

/**
 * The goals the camp proves the player once did, in the journal's order, for a save made before the journal existed.
 * A proven goal also proves every goal before it: a room shows that the player once picked up sticks.
 * A sawhorse proves cutting a plank, since the player builds one to cut planks.
 */
export function goalsProvenByCamp(entities: EntityStore, player: Entity): Goal[] {
  // The sawhorse is the only work station.
  const proves = (goal: Goal): boolean => goalShowsNow(goal, entities, player) || (goal === "cutPlank" && workStationEntities(entities).first !== undefined);
  const provenCount = GOALS.reduce((count, goal, index) => (proves(goal) ? index + 1 : count), 0);
  return GOALS.slice(0, provenCount);
}

/** What the journal's command rule needs from the game. */
export interface JournalControls {
  setHidden(hidden: boolean): void;
}

/** The rule for hiding and showing the journal. It is not the player acting, so it keeps them sitting and leaves the queue alone. */
export function journalRules(controls: JournalControls): CommandRules<"setJournalHidden"> {
  return {
    setJournalHidden: {
      start: "alongside",
      keepsPlayerSitting: true,
      queue: "apart",
      run: (command) => {
        controls.setHidden(command.hidden);
      },
    },
  };
}
