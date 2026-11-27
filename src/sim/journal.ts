// The journal: the goals it suggests to a new player, in order, from a first campfire to a first snug room and food preserved for winter.
// Following it is optional, and the game never ends. A goal is done the first time the player does it, and stays done.
import { hasInBackpack } from "./backpack";
import { type Entity, type EntityStore } from "./entities";
import {
  campfireEntities,
  debarkedLogEntities,
  leanToEntities,
  logEntities,
  pileEntities,
  sledEntities,
  stumpEntities,
  workStationEntities,
} from "./entity-queries";
import { findRooms, isRoomSnug } from "./rooms";
import { anyFoodPreservedOnRack } from "./drying-racks";
import type { CommandRules } from "./command-rule";

/** How many game minutes the notice that a goal is done shows for. One game minute is one real second. */
export const GOAL_NOTICE_MINUTES = 6;

/** Every goal, in the order the journal suggests them. */
export const GOALS = [
  "pickUpSticks",
  "lightCampfire",
  "fellTree",
  "buildLeanTo",
  "sleepOnBedroll",
  "cutPlank",
  "buildRoom",
  "makeRoomSnug",
  "preserveFood",
] as const;

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
 * Whether the valley shows now that the player has done this goal. It only covers goals that leave a trace in the valley.
 * Sleeping on a bedroll leaves none, so the game marks it done when the player sleeps.
 */
function valleyShowsGoal(goal: Goal, entities: EntityStore, player: Entity): boolean {
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
    case "preserveFood":
      // Food finishes on the rack and stays there until the player takes it off, so the rack shows it the moment it does.
      return anyFoodPreservedOnRack(entities);
  }
}

/** The goals not yet marked done that the valley shows the player has now done, in the journal's order. */
export function newlyShownGoals(journal: Journal, entities: EntityStore, player: Entity): Goal[] {
  return GOALS.filter((goal) => !isGoalDone(journal, goal) && valleyShowsGoal(goal, entities, player));
}

/**
 * Whether the camp proves the player once did this goal. It is what the valley shows now, with one more proof:
 * a sawhorse proves cutting a plank, since the player builds one to cut planks. The sawhorse is the only work station.
 */
function campProvesGoal(goal: Goal, entities: EntityStore, player: Entity): boolean {
  if (goal === "cutPlank" && workStationEntities(entities).first !== undefined) return true;
  return valleyShowsGoal(goal, entities, player);
}

/**
 * The goals the camp proves the player once did, in the journal's order, for a save made before the journal existed.
 * A proven goal also proves every goal before it: a room shows that the player once picked up sticks.
 */
export function goalsProvenByCamp(entities: EntityStore, player: Entity): Goal[] {
  const provenCount = GOALS.reduce((count, goal, index) => (campProvesGoal(goal, entities, player) ? index + 1 : count), 0);
  return GOALS.slice(0, provenCount);
}

/** The rule for hiding and showing the journal. It is not the player acting, so it keeps them sitting and leaves the queue alone. */
export function journalRules(setHidden: (hidden: boolean) => void): CommandRules<"setJournalHidden"> {
  return {
    setJournalHidden: {
      start: "alongside",
      keepsPlayerSitting: true,
      keepsHandReach: true,
      queue: "apart",
      run: (command) => {
        setHidden(command.hidden);
      },
    },
  };
}
