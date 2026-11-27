// What every action builder shares: the context it reads, the offers it makes, and the helpers that order them.
import { isCarriedLog } from "../sim/api";
import type { BackpackContent, CarriedLog } from "../sim/api";
import type { Command } from "../sim/api-commands";
import type { GameClient } from "../sim/api-client";
import type { GameView } from "../sim/api-game-view";
import { actionsText } from "../strings/actions";
import type { ActionIcon, ActionId, ThingAction } from "../ui/thing-action";

/** What the module reads. game.client satisfies it, so tests can pass a real game. */
export type ActionReader = Pick<
  GameClient,
  "getView" | "describeBlueprint" | "describeCampfire" | "describeWoodpile" | "describeSled" | "describeDryingRack" | "describeThing" | "refusal"
>;

/** An action before it is known whether it is the main one. */
export type Offer = Omit<ThingAction, "isMain">;

/** What every function below reads: the view, the reader for anything more, and `offer`, which makes an action that the game allows or refuses. */
export interface Context {
  readonly view: GameView;
  readonly reader: ActionReader;
  /** An action that sends `command`. It is greyed out, with the game's reason, if the game would refuse the command now. */
  readonly offer: (id: ActionId, label: string, icon: ActionIcon, command: Command) => Offer;
}

/** Letting go of the dragged sled, as the only and main action. */
export function letGoActions({ offer }: Context): readonly ThingAction[] {
  return withMain([offer("letGo", actionsText.actions.letGo, { hud: "log" }, { type: "letGoOfSled" })], "letGo");
}

/** Puts the main action first and marks it. `main` is its id. Without one, no action is marked main. */
export function withMain(offers: readonly Offer[], main: ActionId | undefined): readonly ThingAction[] {
  const first = offers.find(({ id }) => id === main);
  const rest = offers.filter((offer) => offer !== first);
  return [...(first === undefined ? [] : [{ ...first, isMain: true }]), ...rest.map((offer) => ({ ...offer, isMain: false }))];
}

export const has = (view: GameView, content: BackpackContent): boolean => (view.backpack[content] ?? 0) > 0;

/** The offer `make` gives, in a list, if `shown`. Otherwise an empty list. */
export function offerIf(shown: boolean, make: () => Offer): readonly Offer[] {
  return shown ? [make()] : [];
}

export function takeDown({ offer }: Context, id: number): Offer {
  return offer("takeDown", actionsText.actions.takeDown, { hud: "backpack" }, { type: "takeDown", pieceId: id });
}

/** The same actions or offers, none of them the main one. */
export function notMain(actions: readonly Offer[]): readonly ThingAction[] {
  return actions.map((action) => ({ ...action, isMain: false }));
}

/** The log or debarked log on the player's shoulder, or null if they carry none. A plank or stone in the hands is no log. */
export function shoulderedLog(view: GameView): CarriedLog | null {
  return view.carrying !== null && isCarriedLog(view.carrying) ? view.carrying : null;
}
