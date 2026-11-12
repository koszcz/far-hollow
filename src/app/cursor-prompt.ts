// The cursor prompt: a label beside the cursor that names the thing under it and says what each mouse button does.
// This file decides the words. src/ui/cursor-prompt-view.tsx draws them, and src/app/cursor-prompt-overlay.tsx shows it.
import type { ThingInReach } from "../sim/api";
import { strings } from "../strings";
import type { CursorPrompt, PromptButton, PromptLine } from "../ui/cursor-prompt-view";
import { actionsFor, hasMoreActions, leftClickAction, targetName, type ActionReader, type ActionTarget, type ThingAction } from "./thing-actions";

export type { CursorPrompt, PromptButton, PromptLine } from "../ui/cursor-prompt-view";

/**
 * The prompt for what the cursor is over, or undefined when there should be none.
 * Plain ground shows none, because a click there only walks.
 * A finished structure, such as a wall, is named with what is behind it when that is a thing, since a left-click acts on that.
 * Its action menu always offers to take it down, so it always shows "More actions".
 * The right-click line shows whenever the action menu would open.
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
  else if (target.kind === "backpackContent") lines.push({ button: strings.prompt.leftClick, text: strings.prompt.noUse, enabled: false });
  if (hasMoreActions(actionsFor(target, reader), left)) lines.push({ button: strings.prompt.rightClick, text: strings.prompt.moreActions, enabled: true });
  return { title: targetName(named, reader), lines };
}

/** The prompt for the build or craft button. `open` says whether its wheel is open now. */
export function promptForButton(button: PromptButton, open: boolean): CursorPrompt {
  const title = button === "build" ? strings.buildMenu.open : strings.craftMenu.open;
  const text = open ? strings.prompt.closeToolMenu[button] : strings.prompt.openToolMenu[button];
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
