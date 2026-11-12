// The cursor prompt: a label beside the cursor that names the thing under it and the top action a click offers.
// This file decides the words. src/ui/cursor-prompt-view.tsx draws them, and src/app/cursor-prompt-overlay.tsx shows it.
import type { ThingInReach } from "../sim/api";
import { strings } from "../strings";
import type { CursorPrompt, PromptButton, PromptLine } from "../ui/cursor-prompt-view";
import { menuActions, targetName, type ActionReader, type ActionTarget, type ThingAction } from "./thing-actions";

export type { CursorPrompt, PromptButton, PromptLine } from "../ui/cursor-prompt-view";

/**
 * The prompt for what the cursor is over, or undefined when there should be none.
 * Plain ground shows none, because a click there only walks.
 * A click opens the action menu, so the click line names the menu's top action, greyed with its reason when the player cannot do it yet.
 * A finished structure over a thing is named for that thing, since its menu leads with that thing's actions.
 * `nearest` is the thing nearest the player within reach. Over it, the click line shows E too, when E does that top action.
 */
export function promptFor(target: ActionTarget, reader: ActionReader, nearest: ThingInReach | null = null): CursorPrompt | undefined {
  if (target.kind === "scene" && target.pick.kind === "ground") return undefined;
  const behind = target.kind === "scene" && target.pick.kind === "structure" ? target.pick.under : undefined;
  const named: ActionTarget = behind === undefined || behind.kind === "ground" ? target : { kind: "scene", pick: behind };
  const top = menuActions(target, reader)[0];
  const lines = top === undefined ? [] : [clickLine(top, top.isMain && isThing(named, nearest))];
  return { title: targetName(named, reader), lines };
}

/** The prompt for the build or craft button. `open` says whether its wheel is open now. */
export function promptForButton(button: PromptButton, open: boolean): CursorPrompt {
  const title = button === "build" ? strings.buildMenu.open : strings.craftMenu.open;
  const text = open ? strings.prompt.closeToolMenu[button] : strings.prompt.openToolMenu[button];
  return { title, lines: [{ button: strings.prompt.click, text, enabled: true }] };
}

function clickLine(action: ThingAction, byKey: boolean): PromptLine {
  const text = action.enabled || action.reason === undefined ? action.label : strings.actions.withReason(action.label, action.reason);
  return { button: strings.prompt.click, ...(byKey ? { key: strings.prompt.useKey } : {}), text, enabled: action.enabled };
}

/** Whether the target is this thing in the world. */
function isThing(target: ActionTarget, thing: ThingInReach | null): boolean {
  return thing !== null && target.kind === "scene" && target.pick.kind === thing.kind && "id" in target.pick && target.pick.id === thing.id;
}
