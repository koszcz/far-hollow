// The cursor prompt: a label beside the cursor that names the thing under it and says what each mouse button does.
// This file decides the words. src/app/cursor-prompt-overlay.ts draws them and moves them with the cursor.
import type { ThingInReach } from "../sim/api";
import { strings } from "../strings";
import { actionsFor, hasMoreActions, leftClickAction, targetName, type ActionReader, type ActionTarget, type ThingAction } from "./thing-actions";

/** One line of the prompt: a mouse button and what it does. */
export interface PromptLine {
  /** The button's name, such as "Left-click". */
  readonly button: string;
  /** The key that does the same, such as "E", if one does. */
  readonly key?: string;
  /** What the button does, such as "Chop", or "Chop: needs the axe" when the player cannot do it yet. */
  readonly text: string;
  /** False when the player cannot do it yet. The prompt greys the line. */
  readonly enabled: boolean;
}

export interface CursorPrompt {
  /** The thing's name, such as "Tree". */
  readonly title: string;
  readonly lines: readonly PromptLine[];
}

/** The HUD buttons that show a prompt without being a thing the player acts on. */
export type PromptButton = "build" | "craft";

/**
 * The prompt for what the cursor is over, or undefined when there should be none.
 * Plain ground shows none, because a click there only walks.
 * A finished structure, such as a wall, is named with what is behind it when that is a thing, since a left-click acts on that.
 * Its right-click menu always offers to take it down, so it always shows "More actions".
 * `nearest` is the thing nearest the player within reach. Over it, the left-click line shows E too, since E does the same.
 */
export function promptFor(target: ActionTarget, reader: ActionReader, nearest: ThingInReach | null = null): CursorPrompt | undefined {
  if (target.kind === "scene" && target.pick.kind === "ground") return undefined;
  const left = leftClickAction(target, reader);
  // A left-click on a finished structure acts on the thing behind it, so the prompt names that thing. Over ground, it names the structure.
  const behind = target.kind === "scene" && target.pick.kind === "structure" ? target.pick.under : undefined;
  const named: ActionTarget = behind === undefined || behind.kind === "ground" ? target : { kind: "scene", pick: behind };
  const lines: PromptLine[] = [];
  if (left !== undefined) lines.push(leftLine(left, isThing(named, nearest)));
  else if (target.kind === "item") lines.push({ button: strings.prompt.leftClick, text: strings.prompt.noUse, enabled: false });
  if (hasMoreActions(actionsFor(target, reader), left)) lines.push({ button: strings.prompt.rightClick, text: strings.prompt.moreActions, enabled: true });
  return { title: targetName(named, reader), lines };
}

/** The prompt for the build or craft button. `open` says whether its wheel is open now. */
export function promptForButton(button: PromptButton, open: boolean): CursorPrompt {
  const title = button === "build" ? strings.buildMenu.open : strings.craftMenu.open;
  const text = open ? strings.prompt.closeWheel[button] : strings.prompt.openWheel[button];
  return { title, lines: [{ button: strings.prompt.leftClick, text, enabled: true }] };
}

function leftLine(action: ThingAction, byKey: boolean): PromptLine {
  const text = action.enabled || action.reason === undefined ? action.label : strings.actions.withReason(action.label, action.reason);
  return { button: strings.prompt.leftClick, ...(byKey ? { key: strings.prompt.useKey } : {}), text, enabled: action.enabled };
}

/** Whether the target is this thing in the world. */
function isThing(target: ActionTarget, thing: ThingInReach | null): boolean {
  return thing !== null && target.kind === "scene" && target.pick.kind === thing.kind && "id" in target.pick && target.pick.id === thing.id;
}
