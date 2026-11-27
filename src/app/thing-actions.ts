// Every action a thing offers the player: a thing in the world, a backpack content in the hotbar, or the log on their shoulder.
// A click opens the action menu, which lists them all with the main one on top. E does the main one.
// It decides which actions to list, in what order, and which is the main one. The game decides whether each is allowed:
// every action asks the reader why the game would refuse its command, and is greyed out with that reason.
// It only reads game state through the reader, so tests can pass a real game's client.
import type { Command } from "../sim/api-commands";
import type { ScenePick } from "../sim/api-scene-pick";
import type { HotbarTarget } from "../ui/hotbar-cells";
import { actionsText } from "../strings/actions";
import { refusalText } from "../ui/refusal-text";
import { isListed, type ActionIcon, type ActionId, type ThingAction } from "../ui/thing-action";
import { backpackContentActions, shoulderActions } from "./thing-actions-backpack";
import { letGoActions, withMain, type ActionReader, type Context, type Offer } from "./thing-actions-context";
import { sceneActions } from "./thing-actions-scene";

export type { ActionIcon, ActionId, ThingAction } from "../ui/thing-action";

/** What the player points at or clicks: a thing in the world, or a hotbar cell, which holds a backpack content or the log on their shoulder. */
export type ActionTarget = { readonly kind: "scene"; readonly pick: ScenePick } | HotbarTarget;

/** Every action the target offers, main first. Empty for nothing. Ground gives one main "walk". */
export function actionsFor(target: ActionTarget, reader: ActionReader): readonly ThingAction[] {
  const offer = (id: ActionId, label: string, icon: ActionIcon, command: Command): Offer => {
    const refusal = reader.refusal(command);
    return refusal === null ? { id, label, icon, enabled: true, command } : { id, label, icon, enabled: false, reason: refusalText(refusal), command };
  };
  const context: Context = { view: reader.getView(), reader, offer };
  switch (target.kind) {
    case "scene":
      return sceneActions(target.pick, context);
    case "backpackContent":
      return backpackContentActions(target.content, context);
    case "shoulder":
      return shoulderActions(target.log, context);
    case "sled":
      return letGoActions(context);
    case "litTorch":
      return litTorchActions(context);
  }
}

/** Convenience: the main action, or undefined. */
export function mainAction(actions: readonly ThingAction[]): ThingAction | undefined {
  return actions[0]?.isMain === true ? actions[0] : undefined;
}

/**
 * The actions the action menu lists for a target, in list order: the main action first, at the top, then the rest.
 * Actions that send no command, such as a work station's "open menu", are left out. Planting a sapling stays, since picking it
 * starts placing the sapling. Empty when the target offers none.
 */
export function menuActions(target: ActionTarget, reader: ActionReader): readonly ThingAction[] {
  return actionsFor(target, reader).filter(isListed);
}

/** Planting the lit torch in the player's hand, as the main action, then putting it out. */
function litTorchActions({ offer }: Context): readonly ThingAction[] {
  return withMain(
    [
      offer("plant", actionsText.actions.plant, { content: "torch" }, { type: "plantTorch" }),
      offer("putOut", actionsText.actions.putOut, { content: "torch" }, { type: "putOutTorch" }),
    ],
    "plant",
  );
}
