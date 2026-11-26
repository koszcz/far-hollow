// Every action a thing offers the player: a thing in the world, a backpack content in the hotbar, or the log on their shoulder.
// A click opens the action menu, which lists them all with the main one on top. E does the main one.
// It decides which actions to list, in what order, and which is the main one. The game decides whether each is allowed:
// every action asks the reader why the game would refuse its command, and is greyed out with that reason.
// It only reads game state through the reader, so tests can pass a real game's client.
import {
  CAMPFIRE_FUELS,
  CARRIED_LOGS,
  furnitureMoreUses,
  isCarriedLog,
  isHost,
  furnitureUse,
  hasRoom,
  holdsWater,
  isJug,
  JUG_CONTENTS,
  RACK_FOODS,
  withOneMoreDrink,
  WOODPILE_WOODS,
} from "../sim/api";
import type {
  BackpackContent,
  CampfireView,
  CarriedLog,
  DryingRackView,
  CarriedThing,
  Command,
  FurnitureKind,
  FurnitureUse,
  GroundOrThingPick,
  JugContent,
  Plantable,
  ScenePick,
  GameClient,
  GameView,
  SledView,
  WoodpileView,
  WoodpileWood,
} from "../sim/api";
import { strings } from "../strings";
import type { HotbarTarget } from "../ui/hotbar-cells";
import { refusalText } from "../ui/refusal-text";
import { isListed, type ActionIcon, type ActionId, type ThingAction } from "../ui/thing-action";

export type { ActionIcon, ActionId, ThingAction } from "../ui/thing-action";

/** What the player points at or clicks: a thing in the world, or a hotbar cell, which holds a backpack content or the log on their shoulder. */
export type ActionTarget = { readonly kind: "scene"; readonly pick: ScenePick } | HotbarTarget;

/** What the module reads. game.client satisfies it, so tests can pass a real game. */
export type ActionReader = Pick<
  GameClient,
  "getView" | "describeBlueprint" | "describeCampfire" | "describeWoodpile" | "describeSled" | "describeDryingRack" | "describeThing" | "refusal"
>;

/** An action before it is known whether it is the main one. */
type Offer = Omit<ThingAction, "isMain">;

/** What every function below reads: the view, the reader for anything more, and `offer`, which makes an action that the game allows or refuses. */
interface Context {
  readonly view: GameView;
  readonly reader: ActionReader;
  /** An action that sends `command`. It is greyed out, with the game's reason, if the game would refuse the command now. */
  readonly offer: (id: ActionId, label: string, icon: ActionIcon, command: Command) => Offer;
}

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

/** Letting go of the dragged sled, as the only and main action. */
function letGoActions({ offer }: Context): readonly ThingAction[] {
  return withMain([offer("letGo", strings.actions.letGo, { hud: "log" }, { type: "letGoOfSled" })], "letGo");
}

/** Planting the lit torch in the player's hand, as the main action, then putting it out. */
function litTorchActions({ offer }: Context): readonly ThingAction[] {
  return withMain(
    [
      offer("plant", strings.actions.plant, { content: "torch" }, { type: "plantTorch" }),
      offer("putOut", strings.actions.putOut, { content: "torch" }, { type: "putOutTorch" }),
    ],
    "plant",
  );
}

/** Puts the main action first and marks it. `main` is its id. Without one, no action is marked main. */
function withMain(offers: readonly Offer[], main: ActionId | undefined): readonly ThingAction[] {
  const first = offers.find(({ id }) => id === main);
  const rest = offers.filter((offer) => offer !== first);
  return [...(first === undefined ? [] : [{ ...first, isMain: true }]), ...rest.map((offer) => ({ ...offer, isMain: false }))];
}

const has = (view: GameView, content: BackpackContent): boolean => (view.backpack[content] ?? 0) > 0;

/** The offer `make` gives, in a list, if `shown`. Otherwise an empty list. */
function offerIf(shown: boolean, make: () => Offer): readonly Offer[] {
  return shown ? [make()] : [];
}

function chop({ offer }: Context, treeId: number): Offer {
  return offer("chop", strings.actions.chop, { hud: "axe" }, { type: "chopTree", treeId });
}

function digUp({ offer }: Context, saplingId: number): Offer {
  return offer("digUp", strings.actions.digUp, { content: "sapling" }, { type: "digUpSapling", saplingId });
}

function takeDown({ offer }: Context, id: number): Offer {
  return offer("takeDown", strings.actions.takeDown, { hud: "backpack" }, { type: "takeDown", pieceId: id });
}

function sceneActions(pick: ScenePick, context: Context): readonly ThingAction[] {
  if (pick.kind !== "structure") return thingActions(pick, context);
  // A finished fireplace offers its fire, as it does when the player reaches it with E, and taking it down.
  if (pick.structure === "fireplace") return thingActions({ kind: "fireplace", id: pick.id }, context);
  // So do finished shutters: opening or closing them, and taking them down.
  if (pick.structure === "shutters") return thingActions({ kind: "shutters", id: pick.id }, context);
  // A finished structure acts like the thing under it, and can also be taken down. Ground under it offers a walk there, such as onto a foundation.
  const under = pick.under === undefined ? [] : thingActions(pick.under, context);
  const own = structureOffers(pick, context);
  const takeDownStructure = notMain([{ ...takeDown(context, pick.id), id: "takeDownStructure" }]);
  // A finished door frame, window, or roof frame that does not hold its add-on yet offers to build it, as the main action.
  const [addOn] = addOnOffers(pick.id, context);
  if (addOn !== undefined) return [{ ...addOn, isMain: true }, ...notMain(under), ...notMain(own), ...takeDownStructure];
  const [ownMain] = own;
  if (ownMain === undefined) return [...under, ...takeDownStructure];
  // The structure's own action is the main one when nothing under it has one, such as when the pointer is on the lean-to's roof.
  if (under[0]?.isMain === true) return [...under, ...notMain(own), ...takeDownStructure];
  return [{ ...ownMain, isMain: true }, ...under, ...takeDownStructure];
}

/**
 * Building a finished host's add-on, such as hanging a door in a door frame, while the host does not hold it, finished or as a blueprint.
 * Empty for anything else, including a host that is still a blueprint. The game says why it would refuse, such as something in the way.
 */
function addOnOffers(hostId: number, { reader, offer }: Context): readonly Offer[] {
  const host = reader.describeThing(hostId);
  if (host?.kind !== "structure" || !isHost(host.structure) || !("holdsAddOn" in host) || host.holdsAddOn) return [];
  return [offer("addOn", strings.actions.addOn[host.structure], { hud: "place" }, { type: "buildAddOn", hostId })];
}

/** The same actions or offers, none of them the main one. */
function notMain(actions: readonly Offer[]): readonly ThingAction[] {
  return actions.map((action) => ({ ...action, isMain: false }));
}

/** What a finished structure itself offers, besides being taken down. A lean-to offers to lay the bedroll in it while the backpack holds one. */
function structureOffers(pick: Extract<ScenePick, { kind: "structure" }>, { view, offer }: Context): readonly Offer[] {
  if (pick.structure !== "leanTo" || !has(view, "bedroll")) return [];
  return [offer("layBedroll", strings.actions.layBedrollHere, { content: "bedroll" }, { type: "layBedrollInLeanTo", leanToId: pick.id })];
}

function thingActions(pick: GroundOrThingPick, context: Context): readonly ThingAction[] {
  const { view, reader, offer } = context;
  switch (pick.kind) {
    case "ground": {
      const { x, z } = pick.spot;
      const walk = offer("walk", strings.actions.walk, { hud: "place" }, { type: "walkTo", x, z });
      // With a log on the shoulder, the player can also carry it to the spot and drop it there.
      const dropHere = view.carrying === null ? [] : [offer("dropHere", strings.actions.dropHere[view.carrying], { hud: "log" }, { type: "dropLogAt", x, z })];
      // River bank ground also gives stone and clay.
      const riverBankWork = pick.riverBank === true ? riverBankOffers(pick.spot, context) : [];
      return withMain([walk, ...dropHere, ...riverBankWork], "walk");
    }
    case "river":
      return riverActions(pick.spot, context);
    case "tree":
      return withMain([chop(context, pick.id)], "chop");
    // A young tree, a bare stump, and a sapling all offer to dig up. The game says why it refuses the first two.
    case "youngTree":
      return withMain([chop(context, pick.id), digUp(context, pick.id)], "chop");
    case "stump":
    case "sapling":
      return withMain([digUp(context, pick.id)], "digUp");
    case "log":
    case "debarkedLog": {
      const pickUp = offer("pickUp", strings.actions.pickUp, { hud: "log" }, { type: "pickUpLog", logId: pick.id });
      if (pick.kind === "debarkedLog") return withMain([pickUp], "pickUp");
      const split = offer("split", strings.actions.split, { content: "firewood" }, { type: "splitLog", logId: pick.id });
      const debark = offer("debark", strings.actions.debark, { content: "bark" }, { type: "debarkLog", logId: pick.id });
      // Planting a mushroom shows only while the backpack holds one.
      const plantMushroom = has(view, "mushroom")
        ? [offer("plantMushroom", strings.actions.plantMushroom, { content: "mushroom" }, { type: "plantMushroom", logId: pick.id })]
        : [];
      return withMain([pickUp, split, debark, ...plantMushroom], "pickUp");
    }
    case "stick":
      return withMain([offer("pickUp", strings.actions.pickUp, { content: "stick" }, { type: "pickUpStick", stickId: pick.id })], "pickUp");
    case "bark":
      return withMain([offer("pickUp", strings.actions.pickUp, { content: "bark" }, { type: "pickUpBark", barkId: pick.id })], "pickUp");
    case "pile":
      return withMain([offer("pickUp", strings.actions.pickUp, { hud: "backpack" }, { type: "pickUpPile", pileId: pick.id })], "pickUp");
    case "plantedTorch":
      return withMain([offer("pickUp", strings.actions.pickUp, { content: "torch" }, { type: "pickUpTorch", torchId: pick.id })], "pickUp");
    case "fishTrap":
      return fishTrapActions(pick.id, context);
    case "shutters":
      return shuttersActions(pick.id, context);
    case "forage":
      return forageActions(pick.id, context);
    case "mushroomLog":
      return withMain(
        [
          offer("forage", strings.actions.forage, { content: "mushroom" }, { type: "forage", spotId: pick.id }),
          offer("takeDown", strings.actions.takeDown, { hud: "backpack" }, { type: "takeDownMushroomLog", mushroomLogId: pick.id }),
        ],
        "forage",
      );
    case "campfire": {
      const campfire = reader.describeCampfire(pick.id);
      return campfire === null ? withMain([takeDown(context, pick.id)], undefined) : campfireActions(campfire, context);
    }
    case "fireplace": {
      // A fireplace also offers to build its chimney, just before taking it down. The fire keeps the main action.
      const campfire = reader.describeCampfire(pick.id);
      const fire = campfire === null ? withMain([takeDown(context, pick.id)], undefined) : campfireActions(campfire, context);
      return [...fire.slice(0, -1), ...notMain(addOnOffers(pick.id, context)), ...fire.slice(-1)];
    }
    case "woodpile": {
      const woodpile = reader.describeWoodpile(pick.id);
      return woodpile === null ? withMain([takeDown(context, pick.id)], undefined) : woodpileActions(woodpile, context);
    }
    case "sled": {
      const sled = reader.describeSled(pick.id);
      return sled === null ? withMain([takeDown(context, pick.id)], undefined) : sledActions(sled, context);
    }
    case "furniture": {
      if (pick.furniture !== "dryingRack") return furnitureActions(pick.furniture, pick.id, context);
      const rack = reader.describeDryingRack(pick.id);
      return rack === null ? withMain([takeDown(context, pick.id)], undefined) : dryingRackActions(rack, context);
    }
    case "bedroll":
      return withMain(
        [
          offer("sleep", strings.actions.sleep, { hud: "moon" }, { type: "sleep", bedrollId: pick.id }),
          offer("pickUp", strings.actions.pickUp, { content: "bedroll" }, { type: "pickUpBedroll", bedrollId: pick.id }),
        ],
        "sleep",
      );
    case "blueprint":
      return blueprintActions(pick.id, context);
    case "workStation":
      return withMain(
        [
          // Opening the menu sends no command, so the game has nothing to refuse.
          { id: "openMenu", label: strings.actions.openMenu, icon: { hud: "place" }, enabled: true, command: undefined },
          ...view.craftMenu
            .filter(({ station }) => station === pick.station)
            .map(({ kind, result }) =>
              offer(`craft:${kind}`, strings.craftMenu.recipes[kind], { content: result.content }, { type: "craft", recipe: kind, stationId: pick.id }),
            ),
          takeDown(context, pick.id),
        ],
        "openMenu",
      );
  }
}

/** Open closed shutters, or close open ones, as the main action, then take them down. */
function shuttersActions(shuttersId: number, context: Context): readonly ThingAction[] {
  const { reader, offer } = context;
  const thing = reader.describeThing(shuttersId);
  const open = thing?.kind === "structure" && thing.structure === "shutters" && thing.open === true;
  const toggle = open
    ? offer("closeShutters", strings.actions.closeShutters, { hud: "flame" }, { type: "setShutters", shuttersId, open: false })
    : offer("openShutters", strings.actions.openShutters, { hud: "sun" }, { type: "setShutters", shuttersId, open: true });
  return withMain([toggle, takeDown(context, shuttersId)], toggle.id);
}

/**
 * Forage, then, for a berry bush, dig it up. Foraging is the main action while the bush has berries, and digging it up while it grows them back.
 * A mushroom patch cannot be dug up.
 */
function forageActions(spotId: number, { reader, offer }: Context): readonly ThingAction[] {
  const forage = offer("forage", strings.actions.forage, { hud: "berry" }, { type: "forage", spotId });
  const thing = reader.describeThing(spotId);
  if (thing?.kind !== "forage" || thing.food !== "berries") return withMain([forage], "forage");
  const digUpBush = offer("digUp", strings.actions.digUp, { content: "berryBush" }, { type: "digUpBerryBush", bushId: spotId });
  return withMain([forage, digUpBush], forage.enabled ? "forage" : "digUp");
}

/** How the action menu shows one way to use a piece of furniture. `listed`, if given, says whether to list it at all. */
interface FurnitureUseAction {
  readonly id: ActionId;
  readonly label: string;
  readonly icon: ActionIcon;
  readonly listed?: (view: GameView) => boolean;
}

/** The action id, label, and icon for each way the player uses a piece of furniture. */
const FURNITURE_USE_ACTIONS: { readonly [Name in FurnitureUse["name"]]: FurnitureUseAction } = {
  open: { id: "open", label: strings.actions.open, icon: { hud: "backpack" } },
  sleep: { id: "sleep", label: strings.actions.sleep, icon: { hud: "moon" } },
  sit: { id: "sit", label: strings.actions.sit, icon: { hud: "moon" } },
  drink: { id: "drink", label: strings.actions.drink, icon: { hud: "droplet" } },
  fillPot: { id: "fillPot", label: strings.actions.fillPotHere, icon: { content: "potOfBoiledWater" } },
  // Filling a jug is listed only while the backpack holds a jug, so a player without one never sees it.
  fillJug: {
    id: "fillJug",
    label: strings.actions.fillJug,
    icon: { content: "jugWith3Drinks" },
    listed: (view) => JUG_CONTENTS.some((jug) => has(view, jug)),
  },
};

/**
 * Use the piece, if its definition gives it a use, then its other uses, then take it down. Using it is the main action.
 * A piece with no use, such as a table, offers only taking it down. The player eats at a table as they eat anywhere.
 * A rain barrel offers drinking, then filling the pot, then filling a jug while the backpack holds one.
 * Each shows greyed, with the reason, when the game would refuse it.
 */
function furnitureActions(kind: FurnitureKind, id: number, context: Context): readonly ThingAction[] {
  const use = furnitureUse(kind);
  if (use === undefined) return withMain([takeDown(context, id)], undefined);
  const offerUse = ({ name, command }: FurnitureUse): Offer => {
    const action = FURNITURE_USE_ACTIONS[name];
    return context.offer(action.id, action.label, action.icon, command(id));
  };
  const main = offerUse(use);
  const moreUses = furnitureMoreUses(kind).filter(({ name }) => FURNITURE_USE_ACTIONS[name].listed?.(context.view) ?? true);
  return withMain([main, ...moreUses.map(offerUse), takeDown(context, id)], main.id);
}

/**
 * Hang each food, take the food off, then take the rack down. Hanging a food shows only while the backpack holds it, and taking
 * food off only while the rack holds some. Each shows greyed, with the reason, when the game would refuse it, such as on a full rack.
 * Main: take the food off once some has dried, or else hang the first food the player can hang.
 */
function dryingRackActions(rack: DryingRackView, context: Context): readonly ThingAction[] {
  const { view, offer } = context;
  const rackId = rack.id;
  const hang = RACK_FOODS.flatMap((food) =>
    offerIf(has(view, food), () => offer(`hang:${food}`, strings.actions.hangOnRack[food], { content: food }, { type: "hangOnRack", rackId, food })),
  );
  const driedOne = rack.food.find(({ dried }) => dried);
  const takeIcon: ActionIcon = {
    content: driedOne === undefined ? (rack.food[0]?.food ?? "berries") : driedOne.food === "berries" ? "driedBerries" : "driedMushroom",
  };
  const takeOff = offerIf(rack.food.length > 0, () => offer("takeFoodOffRack", strings.actions.takeFoodOffRack, takeIcon, { type: "takeFoodOffRack", rackId }));
  const main = driedOne !== undefined ? takeOff[0] : (hang.find(({ enabled }) => enabled) ?? takeOff[0] ?? hang[0]);
  return withMain([...hang, ...takeOff, takeDown(context, rackId)], main?.id);
}

/** Gathering one stone, then digging one clay, at a spot on the river bank or in the river. */
function riverBankOffers({ x, z }: { readonly x: number; readonly z: number }, { offer }: Context): readonly Offer[] {
  return [
    offer("gatherStone", strings.actions.gatherStone, { content: "stone" }, { type: "gatherStone", x, z }),
    offer("digClay", strings.actions.digClay, { content: "clay" }, { type: "digClay", x, z }),
  ];
}

/**
 * Take fish, then pick the trap up. Taking the fish is the main action while the trap holds one, and picking it up while it does not.
 * Take fish shows only while the trap holds a fish.
 */
function fishTrapActions(trapId: number, { reader, offer }: Context): readonly ThingAction[] {
  const pickUp = offer("pickUp", strings.actions.pickUp, { content: "fishTrap" }, { type: "pickUpFishTrap", trapId });
  const thing = reader.describeThing(trapId);
  if (thing?.kind !== "fishTrap" || !thing.holdsFish) return withMain([pickUp], "pickUp");
  const takeFish = offer("takeFish", strings.actions.takeFish, { content: "rawFish" }, { type: "takeFishFromTrap", trapId });
  return withMain([takeFish, pickUp], "takeFish");
}

/**
 * Drink, fill the empty pot, fish, set a fish trap, gather stone, then dig clay. Drinking is the main action.
 * Filling the pot shows only when the backpack holds the empty pot.
 */
function riverActions({ x, z }: { readonly x: number; readonly z: number }, context: Context): readonly ThingAction[] {
  const { view, offer } = context;
  const fillPot = has(view, "pot") ? [offer("fillPot", strings.actions.fillPotHere, { content: "potOfRiverWater" }, { type: "fillPot" })] : [];
  return withMain(
    [
      offer("drink", strings.actions.drink, { hud: "droplet" }, { type: "drinkFromRiver", x, z }),
      ...fillPot,
      offer("fish", strings.actions.fish, { content: "fishingRod" }, { type: "fish", x, z }),
      offer("setFishTrap", strings.actions.setFishTrap, { content: "fishTrap" }, { type: "setFishTrap", x, z }),
      ...riverBankOffers({ x, z }, context),
    ],
    "drink",
  );
}

/**
 * Firing a jug, then taking the jug off. Firing shows while the backpack holds an unfired jug. It is greyed, with the reason,
 * while the fire already holds a jug, since a fire fires one jug at a time. Taking the jug off shows only while one is on the fire.
 */
function campfireJugOffers(campfire: CampfireView, { view, offer }: Context): readonly Offer[] {
  const campfireId = campfire.id;
  const jugOn = campfire.jug;
  return [
    ...offerIf(has(view, "unfiredJug"), () => offer("fireJug", strings.actions.fireJug, { content: "unfiredJug" }, { type: "fireJug", campfireId })),
    ...offerIf(jugOn !== null, () =>
      offer("takeJugOff", strings.actions.takeJugOff, { content: jugOn?.fired === true ? "jug" : "unfiredJug" }, { type: "takeJugOff", campfireId }),
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
function campfireActions(campfire: CampfireView, context: Context): readonly ThingAction[] {
  const { offer } = context;
  const campfireId = campfire.id;
  // The menu lists the fuels in the order a lit fire takes them.
  const fuels = CAMPFIRE_FUELS.map((fuel) => offer(`addFuel:${fuel}`, strings.actions.addFuel[fuel], { content: fuel }, { type: "addFuel", campfireId, fuel }));
  const pot =
    campfire.pot === null
      ? offer("putPotOn", strings.actions.putPotOn, { content: "potOfRiverWater" }, { type: "putPotOnFire", campfireId })
      : offer("takePotOff", strings.actions.takePotOff, { content: "pot" }, { type: "takePotOffFire", campfireId });
  const cookFish = offer("cookFish", strings.actions.cookFish, { content: "rawFish" }, { type: "cookFish", campfireId });
  const fishIcon: ActionIcon = { content: campfire.fish.some(({ cooked }) => cooked) ? "cookedFish" : "rawFish" };
  const takeFishOff = campfire.fish.length === 0 ? [] : [offer("takeFishOff", strings.actions.takeFishOff, fishIcon, { type: "takeFishOff", campfireId })];
  const light = campfire.lit ? [] : [offer("light", strings.actions.light, { hud: "flame" }, { type: "lightCampfire", campfireId })];
  const putOut = campfire.lit ? [offer("putOut", strings.actions.putOut, { hud: "flame" }, { type: "putOutCampfire", campfireId })] : [];
  const offers = [...light, ...fuels, pot, cookFish, ...takeFishOff, ...campfireJugOffers(campfire, context), ...putOut, takeDown(context, campfireId)];
  const lightsNow = !campfire.lit && campfire.fuelMinutes > 0;
  const main = lightsNow ? "light" : (fuels.find(({ enabled }) => enabled) ?? fuels[0])?.id;
  return withMain(offers, main);
}

/**
 * Stack the log on the shoulder, stack firewood one or all, take each kind of wood, then take it down.
 * Main: stack the log on the shoulder, or take firewood if the player carries nothing.
 */
function woodpileActions(woodpile: WoodpileView, context: Context): readonly ThingAction[] {
  const { view, offer } = context;
  const woodpileId = woodpile.id;
  const woodIcon = (wood: WoodpileWood): ActionIcon => (wood === "firewood" ? { content: "firewood" } : { hud: "log" });
  const shouldered = shoulderedLog(view);
  // With nothing on the shoulder, stacking the log still shows, greyed, so the player learns they can.
  const stackLog = offer(`stack:${shouldered ?? "log"}`, strings.actions.stack[shouldered ?? "log"], woodIcon(shouldered ?? "log"), {
    type: "stackOnWoodpile",
    woodpileId,
    wood: shouldered ?? "log",
    all: false,
  });
  const stackFirewood = [
    offer("stack:firewood", strings.actions.stack.firewood, woodIcon("firewood"), { type: "stackOnWoodpile", woodpileId, wood: "firewood", all: false }),
    offer("stack:firewood:all", strings.actions.stackAllFirewood, woodIcon("firewood"), { type: "stackOnWoodpile", woodpileId, wood: "firewood", all: true }),
  ];
  const take = WOODPILE_WOODS.map((wood) => offer(`take:${wood}`, strings.actions.take[wood], woodIcon(wood), { type: "takeFromWoodpile", woodpileId, wood }));
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
function sledActions(sled: SledView, context: Context): readonly ThingAction[] {
  const { view, offer } = context;
  const sledId = sled.id;
  if (view.dragging?.id === sledId) return letGoActions(context);
  const drag = offer("drag", strings.actions.drag, { hud: "log" }, { type: "dragSled", sledId });
  const shouldered = shoulderedLog(view);
  const load = shouldered === null ? [] : [offer(`load:${shouldered}`, strings.actions.loadSled[shouldered], { hud: "log" }, { type: "loadSled", sledId })];
  // Only the kinds the sled holds are offered. An empty sled still shows taking a log, greyed, so the player learns they can.
  const held = CARRIED_LOGS.filter((log) => sled.contents[log] > 0);
  const take = (held.length === 0 ? (["log"] as const) : held).map((log: CarriedLog) =>
    offer(`take:${log}`, strings.actions.take[log], { hud: "log" }, { type: "takeFromSled", sledId, log }),
  );
  const loadPlanks = has(view, "plank") ? [offer("load:plank", strings.actions.loadPlanks, { content: "plank" }, { type: "loadPlanksOnSled", sledId })] : [];
  const takePlanks =
    sled.contents.plank > 0 ? [offer("take:plank", strings.actions.takePlanks, { content: "plank" }, { type: "takePlanksFromSled", sledId })] : [];
  const fill = offer("fillSled", strings.actions.fillSled, { hud: "log" }, { type: "fillSled", sledId });
  const tipOut = offer("tipOut", strings.actions.tipOut, { hud: "log" }, { type: "tipOutSled", sledId });
  // A loaded sled can be taken down. Its logs are laid on the ground beside it first, and its planks drop in a pile.
  const offers = [...load, ...loadPlanks, drag, fill, ...take, ...takePlanks, tipOut, takeDown(context, sledId)];
  return withMain(offers, shouldered === null ? "drag" : `load:${shouldered}`);
}

/** The log or debarked log on the player's shoulder, or null if they carry none. A plank or stone in the hands is no log. */
function shoulderedLog(view: GameView): CarriedLog | null {
  return view.carrying !== null && isCarriedLog(view.carrying) ? view.carrying : null;
}

/** Main: add the carried material if the blueprint still needs it, otherwise build. Then taking it down. */
function blueprintActions(blueprintId: number, context: Context): readonly ThingAction[] {
  const { view, reader, offer } = context;
  const blueprint = reader.describeBlueprint(blueprintId);
  const build = offer("build", strings.actions.build, { hud: "place" }, { type: "build", blueprintId });
  const carried = view.carrying;
  const needed = carried !== null && blueprint?.deliveries.some(({ material, has: delivered, needs }) => material === carried && delivered < needs);
  const icon: ActionIcon = carried === null || isCarriedLog(carried) ? { hud: "log" } : { content: carried };
  const deliver = needed ? [offer(`deliver:${carried}`, strings.actions.deliver[carried], icon, { type: "deliverToBlueprint", blueprintId })] : [];
  return withMain([...deliver, build, takeDown(context, blueprintId)], deliver[0]?.id ?? "build");
}

/** What using a backpack content does, if it has a use. */
function useCommand(content: BackpackContent): { readonly label: string; readonly command: Command } | undefined {
  switch (content) {
    case "berries":
    case "mushroom":
    case "rawFish":
    case "cookedFish":
    case "driedBerries":
    case "driedMushroom":
      return { label: strings.actions.eat, command: { type: "eat", food: content } };
    case "bedroll":
      return { label: strings.actions.layOut, command: { type: "layBedroll" } };
    case "torch":
      return { label: strings.actions.light, command: { type: "lightTorch" } };
    case "pot":
      return { label: strings.actions.fillPot, command: { type: "fillPot" } };
    case "potOfRiverWater":
    case "potOfBoiledWater":
      return { label: strings.actions.drinkFromPot, command: { type: "drinkFromPot" } };
    default:
      return undefined;
  }
}

/** Planting a sapling or berry bush: it puts a see-through one under the mouse, so it sends no command until the player clicks the ground. */
function plantOffer(plant: Plantable): Offer {
  return { id: "plant", label: strings.actions.plant, icon: { content: plant }, enabled: true, command: undefined, startsPlanting: plant };
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
  const drink = offerIf(holdsWater(jug), () => offer("drinkFromJug", strings.actions.drinkFromJug, { content: jug }, { type: "drinkFromJug" }));
  // The icon shows the jug as pouring leaves it, with one more drink.
  const pour = offerIf(hasRoom(jug), () => offer("pourIntoJug", strings.actions.pourIntoJug, { content: withOneMoreDrink(jug) }, { type: "pourIntoJug" }));
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
function backpackContentActions(content: BackpackContent, context: Context): readonly ThingAction[] {
  const { view, offer } = context;
  const icon: ActionIcon = { content };
  const own = ownOffers(content, context);
  const chest = view.nearby.find((thing) => thing.kind === "openChest");
  const intoChest =
    chest === undefined
      ? []
      : [
          offer("putInChest", strings.actions.putInChest[chest.view.furniture], icon, { type: "putInChest", chestId: chest.view.id, content, all: false }),
          offer("putInChest:all", strings.actions.putAllInChest[chest.view.furniture], icon, {
            type: "putInChest",
            chestId: chest.view.id,
            content,
            all: true,
          }),
        ];
  const offers = [...intoChest, ...own.offers, offer("drop", strings.actions.drop, icon, { type: "dropFromBackpack", content })];
  return withMain(offers, chest !== undefined ? "putInChest" : own.main);
}

/** Drop it, then split it into firewood if it is a log. */
function shoulderActions(log: CarriedThing, { offer }: Context): readonly ThingAction[] {
  const drop = offer("drop", strings.actions.drop, { hud: "log" }, { type: "dropLog" });
  const split = log === "log" ? [offer("split", strings.actions.split, { content: "firewood" }, { type: "splitLog" })] : [];
  return withMain([drop, ...split], "drop");
}
