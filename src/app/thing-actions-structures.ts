// The actions of a piece of furniture, a drying rack, a campfire, a woodpile, and a sled.
import { CAMPFIRE_FUELS, CARRIED_LOGS, JUG_CONTENTS, RACK_FOODS, WOODPILE_WOODS } from "../sim/api";
import { furnitureMoreUses, furnitureUse } from "../sim/api-build-menu";
import type { CarriedLog, FoodToHang, FurnitureKind, FurnitureUse, WoodpileWood } from "../sim/api";
import type { CampfireView, DryingRackView, SledView, WoodpileView } from "../sim/api-nearby";
import type { GameView } from "../sim/api-game-view";
import { actionsText } from "../strings/actions";
import type { ActionIcon, ActionId, ThingAction } from "../ui/thing-action";
import { has, offerIf, shoulderedLog, takeDown, withMain, letGoActions, type Context, type Offer } from "./thing-actions-context";

/** How the action menu shows one way to use a piece of furniture. `listed`, if given, says whether to list it at all. */
interface FurnitureUseAction {
  readonly id: ActionId;
  readonly label: string;
  readonly icon: ActionIcon;
  readonly listed?: (view: GameView) => boolean;
}

/** The action id, label, and icon for each way the player uses a piece of furniture. */
const FURNITURE_USE_ACTIONS: { readonly [Name in FurnitureUse["name"]]: FurnitureUseAction } = {
  open: { id: "open", label: actionsText.actions.open, icon: { hud: "backpack" } },
  sleep: { id: "sleep", label: actionsText.actions.sleep, icon: { hud: "moon" } },
  sit: { id: "sit", label: actionsText.actions.sit, icon: { hud: "moon" } },
  drink: { id: "drink", label: actionsText.actions.drink, icon: { hud: "droplet" } },
  fillPot: { id: "fillPot", label: actionsText.actions.fillPotHere, icon: { content: "potOfBoiledWater" } },
  // Filling a jug is listed only while the backpack holds a jug, so a player without one never sees it.
  fillJug: {
    id: "fillJug",
    label: actionsText.actions.fillJug,
    icon: { content: "jugWith3Drinks" },
    listed: (view) => JUG_CONTENTS.some((jug) => has(view, jug)),
  },
  putInFirewood: { id: "putInFirewood", label: actionsText.actions.putInFirewood, icon: { content: "firewood" } },
  putInAllFirewood: { id: "putInAllFirewood", label: actionsText.actions.putInAllFirewood, icon: { content: "firewood" } },
  takeFirewood: { id: "takeFirewood", label: actionsText.actions.takeFirewood, icon: { content: "firewood" } },
};

/**
 * Use the piece, if its definition gives it a use, then its other uses, then take it down. Using it is the main action,
 * unless the game would refuse it and allows one of the other uses, which is then the main action.
 * A piece with no use, such as a table, offers only taking it down. The player eats at a table as they eat anywhere.
 * A rain barrel offers drinking, then filling the pot, then filling a jug while the backpack holds one.
 * A wood box offers putting in one firewood, then all that fit, then taking firewood.
 * Each shows greyed, with the reason, when the game would refuse it.
 */
export function furnitureActions(kind: FurnitureKind, id: number, context: Context): readonly ThingAction[] {
  const use = furnitureUse(kind);
  if (use === undefined) return withMain([takeDown(context, id)], undefined);
  const offerUse = ({ name, command }: FurnitureUse): Offer => {
    const action = FURNITURE_USE_ACTIONS[name];
    return context.offer(action.id, action.label, action.icon, command(id));
  };
  const main = offerUse(use);
  const moreUses = furnitureMoreUses(kind)
    .filter(({ name }) => FURNITURE_USE_ACTIONS[name].listed?.(context.view) ?? true)
    .map(offerUse);
  // A greyed main action does nothing, so another use the player can do now takes its place, such as taking firewood from a wood box.
  const mainId = main.enabled ? main.id : (moreUses.find(({ enabled }) => enabled)?.id ?? main.id);
  return withMain([main, ...moreUses, takeDown(context, id)], mainId);
}

/**
 * Hang each food, take the food off, then take the rack down. Hanging a food shows only while the backpack holds it, and taking
 * food off only while the rack holds some. Each shows greyed, with the reason, when the game would refuse it, such as on a full rack.
 * Hanging cooked fish shows, greyed with the reason, while the backpack holds cooked fish but no raw fish, so the player learns
 * that only raw fish can be smoked.
 * Main: take the food off once some is preserved, or else hang the first food the player can hang.
 */
export function dryingRackActions(rack: DryingRackView, context: Context): readonly ThingAction[] {
  const { view, offer } = context;
  const rackId = rack.id;
  const shown = (food: FoodToHang): boolean => has(view, food) && (food !== "cookedFish" || !has(view, "rawFish"));
  const hang = [...RACK_FOODS, "cookedFish" as const].flatMap((food) =>
    offerIf(shown(food), () => offer(`hang:${food}`, actionsText.actions.hangOnRack[food], { content: food }, { type: "hangOnRack", rackId, food })),
  );
  const preservedOne = rack.food.find(({ preserved }) => preserved);
  const takeIcon: ActionIcon = { content: (preservedOne ?? rack.food[0])?.content ?? "berries" };
  const takeOff = offerIf(rack.food.length > 0, () =>
    offer("takeFoodOffRack", actionsText.actions.takeFoodOffRack, takeIcon, { type: "takeFoodOffRack", rackId }),
  );
  const main = preservedOne !== undefined ? takeOff[0] : (hang.find(({ enabled }) => enabled) ?? takeOff[0] ?? hang[0]);
  return withMain([...hang, ...takeOff, takeDown(context, rackId)], main?.id);
}

/**
 * Firing a jug, then taking the jug off. Firing shows while the backpack holds an unfired jug. It is greyed, with the reason,
 * while the fire already holds a jug, since a fire fires one jug at a time. Taking the jug off shows only while one is on the fire.
 */
function campfireJugOffers(campfire: CampfireView, { view, offer }: Context): readonly Offer[] {
  const campfireId = campfire.id;
  const jugOn = campfire.jug;
  return [
    ...offerIf(has(view, "unfiredJug"), () => offer("fireJug", actionsText.actions.fireJug, { content: "unfiredJug" }, { type: "fireJug", campfireId })),
    ...offerIf(jugOn !== null, () =>
      offer("takeJugOff", actionsText.actions.takeJugOff, { content: jugOn?.fired === true ? "jug" : "unfiredJug" }, { type: "takeJugOff", campfireId }),
    ),
  ];
}

/**
 * Light, each fuel, the pot, the fish, the jug, Put out, then Take down. Lighting shows only while the fire is out.
 * Putting out shows only while it burns.
 * See campfireJugOffers for when the jug's actions show.
 * A campfire and a fireplace offer the same actions.
 * Main: an unlit fire with fuel is lit. Otherwise the first fuel the player can add goes on, firewood first.
 */
export function campfireActions(campfire: CampfireView, context: Context): readonly ThingAction[] {
  const { offer } = context;
  const campfireId = campfire.id;
  // The menu lists the fuels in the order a lit fire takes them.
  const fuels = CAMPFIRE_FUELS.map((fuel) =>
    offer(`addFuel:${fuel}`, actionsText.actions.addFuel[fuel], { content: fuel }, { type: "addFuel", campfireId, fuel }),
  );
  const pot =
    campfire.pot === null
      ? offer("putPotOn", actionsText.actions.putPotOn, { content: "potOfRiverWater" }, { type: "putPotOnFire", campfireId })
      : offer("takePotOff", actionsText.actions.takePotOff, { content: "pot" }, { type: "takePotOffFire", campfireId });
  const cookFish = offer("cookFish", actionsText.actions.cookFish, { content: "rawFish" }, { type: "cookFish", campfireId });
  const fishIcon: ActionIcon = { content: campfire.fish.some(({ cooked }) => cooked) ? "cookedFish" : "rawFish" };
  const takeFishOff = campfire.fish.length === 0 ? [] : [offer("takeFishOff", actionsText.actions.takeFishOff, fishIcon, { type: "takeFishOff", campfireId })];
  const light = campfire.lit ? [] : [offer("light", actionsText.actions.light, { hud: "flame" }, { type: "lightCampfire", campfireId })];
  const putOut = campfire.lit ? [offer("putOut", actionsText.actions.putOut, { hud: "flame" }, { type: "putOutCampfire", campfireId })] : [];
  const offers = [...light, ...fuels, pot, cookFish, ...takeFishOff, ...campfireJugOffers(campfire, context), ...putOut, takeDown(context, campfireId)];
  const lightsNow = !campfire.lit && campfire.fuelMinutes > 0;
  const main = lightsNow ? "light" : (fuels.find(({ enabled }) => enabled) ?? fuels[0])?.id;
  return withMain(offers, main);
}

/**
 * Stack the log on the shoulder, stack firewood one or all, take each kind of wood, then take it down.
 * Main: stack the log on the shoulder, or take firewood if the player carries nothing.
 */
export function woodpileActions(woodpile: WoodpileView, context: Context): readonly ThingAction[] {
  const { view, offer } = context;
  const woodpileId = woodpile.id;
  const woodIcon = (wood: WoodpileWood): ActionIcon => (wood === "firewood" ? { content: "firewood" } : { hud: "log" });
  const shouldered = shoulderedLog(view);
  // With nothing on the shoulder, stacking the log still shows, greyed, so the player learns they can.
  const stackLog = offer(`stack:${shouldered ?? "log"}`, actionsText.actions.stack[shouldered ?? "log"], woodIcon(shouldered ?? "log"), {
    type: "stackOnWoodpile",
    woodpileId,
    wood: shouldered ?? "log",
    all: false,
  });
  const stackFirewood = [
    offer("stack:firewood", actionsText.actions.stack.firewood, woodIcon("firewood"), { type: "stackOnWoodpile", woodpileId, wood: "firewood", all: false }),
    offer("stack:firewood:all", actionsText.actions.stackAllFirewood, woodIcon("firewood"), {
      type: "stackOnWoodpile",
      woodpileId,
      wood: "firewood",
      all: true,
    }),
  ];
  const take = WOODPILE_WOODS.map((wood) =>
    offer(`take:${wood}`, actionsText.actions.take[wood], woodIcon(wood), { type: "takeFromWoodpile", woodpileId, wood }),
  );
  const offers = [stackLog, ...stackFirewood, ...take, takeDown(context, woodpileId)];
  return withMain(
    offers,
    shouldered === null
      ? woodpileMainWithoutLog([...take.filter(({ id }) => id === "take:firewood"), ...take.filter(({ id }) => id !== "take:firewood"), stackFirewood[0]])
      : `stack:${shouldered}`,
  );
}

/**
 * The woodpile's main action when the player carries no log: the first of `choices` they can do now.
 * That takes firewood, then a log, then stacks firewood from the backpack. With none possible, it names taking firewood, greyed.
 */
function woodpileMainWithoutLog(choices: readonly (Offer | undefined)[]): ActionId {
  return choices.find((choice) => choice?.enabled === true)?.id ?? "take:firewood";
}

/**
 * Put the log on the shoulder on the sled, load planks, drag it, fill it with nearby logs, take one of each kind of log
 * the sled holds, take planks, tip out everything, then take it down.
 * Loading planks shows only when the backpack holds planks. Taking planks shows only when the sled holds planks.
 * Main: put the log on the shoulder on the sled, or drag it if the player carries nothing.
 * While the player drags this sled, they can only let go of it.
 */
export function sledActions(sled: SledView, context: Context): readonly ThingAction[] {
  const { view, offer } = context;
  const sledId = sled.id;
  if (view.dragging?.id === sledId) return letGoActions(context);
  const drag = offer("drag", actionsText.actions.drag, { hud: "log" }, { type: "dragSled", sledId });
  const shouldered = shoulderedLog(view);
  const load = shouldered === null ? [] : [offer(`load:${shouldered}`, actionsText.actions.loadSled[shouldered], { hud: "log" }, { type: "loadSled", sledId })];
  // Only the kinds the sled holds are offered. An empty sled still shows taking a log, greyed, so the player learns they can.
  const held = CARRIED_LOGS.filter((log) => sled.contents[log] > 0);
  const take = (held.length === 0 ? (["log"] as const) : held).map((log: CarriedLog) =>
    offer(`take:${log}`, actionsText.actions.take[log], { hud: "log" }, { type: "takeFromSled", sledId, log }),
  );
  const loadPlanks = has(view, "plank")
    ? [offer("load:plank", actionsText.actions.loadPlanks, { content: "plank" }, { type: "loadPlanksOnSled", sledId })]
    : [];
  const takePlanks =
    sled.contents.plank > 0 ? [offer("take:plank", actionsText.actions.takePlanks, { content: "plank" }, { type: "takePlanksFromSled", sledId })] : [];
  const fill = offer("fillSled", actionsText.actions.fillSled, { hud: "log" }, { type: "fillSled", sledId });
  const tipOut = offer("tipOut", actionsText.actions.tipOut, { hud: "log" }, { type: "tipOutSled", sledId });
  // A loaded sled can be taken down. Its logs are laid on the ground beside it first, and its planks drop in a pile.
  const offers = [...load, ...loadPlanks, drag, fill, ...take, ...takePlanks, tipOut, takeDown(context, sledId)];
  return withMain(offers, shouldered === null ? "drag" : `load:${shouldered}`);
}
