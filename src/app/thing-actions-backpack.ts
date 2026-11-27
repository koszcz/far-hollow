// The actions of a backpack content in the hotbar, and of the log on the player's shoulder.
import { holdsWater, hasRoom, isJug, withOneMoreDrink } from "../sim/api";
import type { BackpackContent, CarriedThing, JugContent, Plantable } from "../sim/api";
import type { Command } from "../sim/api-commands";
import { actionsText } from "../strings/actions";
import type { ActionIcon, ActionId, ThingAction } from "../ui/thing-action";
import { offerIf, withMain, type Context, type Offer } from "./thing-actions-context";

/** What using a backpack content does, if it has a use. */
function useCommand(content: BackpackContent): { readonly label: string; readonly command: Command } | undefined {
  switch (content) {
    case "berries":
    case "mushroom":
    case "rawFish":
    case "cookedFish":
    case "driedBerries":
    case "driedMushroom":
    case "smokedFish":
      return { label: actionsText.actions.eat, command: { type: "eat", food: content } };
    case "bedroll":
      return { label: actionsText.actions.layOut, command: { type: "layBedroll" } };
    case "torch":
      return { label: actionsText.actions.light, command: { type: "lightTorch" } };
    case "pot":
      return { label: actionsText.actions.fillPot, command: { type: "fillPot" } };
    case "potOfRiverWater":
    case "potOfBoiledWater":
      return { label: actionsText.actions.drinkFromPot, command: { type: "drinkFromPot" } };
    default:
      return undefined;
  }
}

/** Planting a sapling or berry bush: it puts a see-through one under the mouse, so it sends no command until the player clicks the ground. */
function plantOffer(plant: Plantable): Offer {
  return { id: "plant", label: actionsText.actions.plant, icon: { content: plant }, enabled: true, command: undefined, startsPlanting: plant };
}

/** A backpack content's own actions, which come before dropping it, and which of them is the main action, if any. */
interface OwnOffers {
  readonly offers: readonly Offer[];
  readonly main: ActionId | undefined;
}

/**
 * A jug's own actions: drinking, while it holds water, then pouring in clean water, while it has room.
 * Each command picks its own jug: drinking takes from the emptiest jug with water, and pouring fills the fullest jug with room.
 * Drinking is the main action. Without it, pouring is the main action only when it can run, since a greyed main action does nothing.
 */
function jugOffers(jug: JugContent, { offer }: Context): OwnOffers {
  const drink = offerIf(holdsWater(jug), () => offer("drinkFromJug", actionsText.actions.drinkFromJug, { content: jug }, { type: "drinkFromJug" }));
  // The icon shows the jug as pouring leaves it, with one more drink.
  const pour = offerIf(hasRoom(jug), () => offer("pourIntoJug", actionsText.actions.pourIntoJug, { content: withOneMoreDrink(jug) }, { type: "pourIntoJug" }));
  const main = drink[0] ?? pour.find(({ enabled }) => enabled);
  return { offers: [...drink, ...pour], main: main?.id };
}

/** Using it, for a content with a use. A jug's own actions. Planting, for a sapling or berry bush. Nothing for anything else. */
function ownOffers(content: BackpackContent, context: Context): OwnOffers {
  const use = useCommand(content);
  if (use !== undefined) return { offers: [context.offer("use", use.label, { content }, use.command)], main: "use" };
  if (isJug(content)) return jugOffers(content, context);
  if (content === "sapling" || content === "berryBush") return { offers: [plantOffer(content)], main: "plant" };
  return { offers: [], main: undefined };
}

/**
 * Its own actions, then drop it. With a chest or shelf open, putting it there comes first and is the main action.
 * Otherwise the main action is its own, if it has one. See ownOffers.
 */
export function backpackContentActions(content: BackpackContent, context: Context): readonly ThingAction[] {
  const { view, offer } = context;
  const icon: ActionIcon = { content };
  const own = ownOffers(content, context);
  const chest = view.nearby.find((thing) => thing.kind === "openChest");
  const intoChest =
    chest === undefined
      ? []
      : [
          offer("putInChest", actionsText.actions.putInChest[chest.view.furniture], icon, { type: "putInChest", chestId: chest.view.id, content, all: false }),
          offer("putInChest:all", actionsText.actions.putAllInChest[chest.view.furniture], icon, {
            type: "putInChest",
            chestId: chest.view.id,
            content,
            all: true,
          }),
        ];
  const offers = [...intoChest, ...own.offers, offer("drop", actionsText.actions.drop, icon, { type: "dropFromBackpack", content })];
  return withMain(offers, chest !== undefined ? "putInChest" : own.main);
}

/** Drop it, then split it into firewood if it is a log. */
export function shoulderActions(log: CarriedThing, { offer }: Context): readonly ThingAction[] {
  const drop = offer("drop", actionsText.actions.drop, { hud: "log" }, { type: "dropLog" });
  const split = log === "log" ? [offer("split", actionsText.actions.split, { content: "firewood" }, { type: "splitLog" })] : [];
  return withMain([drop, ...split], "drop");
}
