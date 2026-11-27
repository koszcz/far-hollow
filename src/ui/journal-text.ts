// What the journal's HUD line and panel say, worked out from the journal in the view.
import { GOALS, nextGoal, type Goal } from "../sim/api";
import { type JournalView } from "../sim/api-game-view";
import { strings } from "../strings";

/** One goal as the journal panel lists it. */
export interface JournalEntry {
  readonly goal: Goal;
  readonly name: string;
  readonly hint: string;
}

/** What the journal panel shows: the goals not yet done, first ones first, the goals done, and the closing line once all are done. */
export interface JournalSections {
  readonly toDo: readonly JournalEntry[];
  readonly done: readonly JournalEntry[];
  readonly finished: string | null;
}

/** The HUD line that names the next goal, or null while the journal is hidden, in the playground, or once every goal is done. */
export function journalLineText(journal: JournalView | null): string | null {
  if (journal === null || journal.hidden) return null;
  const goal = nextGoal(journal);
  return goal === undefined ? null : strings.journal.next(strings.journal.goals[goal].name);
}

/** The journal panel's sections. Done goals are listed in the journal's order too. */
export function journalSections(journal: JournalView): JournalSections {
  const entry = (goal: Goal): JournalEntry => ({ goal, ...strings.journal.goals[goal] });
  const toDo = GOALS.filter((goal) => !journal.done.includes(goal)).map(entry);
  const done = GOALS.filter((goal) => journal.done.includes(goal)).map(entry);
  return { toDo, done, finished: toDo.length === 0 ? strings.journal.finished : null };
}
