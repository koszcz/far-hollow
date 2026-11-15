// Every action a thing offers the player: a thing in the world, a backpack content in the hotbar, or the log on their shoulder.
// A click opens the action menu, which lists them all with the main one on top. E does the main one.
// It only reads game state through the reader, so tests can pass a real game's client.
import type { GroundOrThingPick, ScenePick } from "../render/scene-renderer";
import { CAMPFIRE_FUELS, CARRIED_LOGS, needsFreeHands, WOODPILE_WOODS } from "../sim/api";
import type {
  BackpackContent,
  BuildLack,
  CampfireView,
  CarriedLog,
  Command,
  GameClient,
  GameView,
  RecipeLack,
  SledView,
  WoodpileView,
  WoodpileWood,
} from "../sim/api";
import { strings } from "../strings";
import type { HotbarTarget } from "../ui/hotbar-cells";
import type { ActionIcon, ActionId, ThingAction } from "../ui/thing-action";

export type { ActionIcon, ActionId, ThingAction } from "../ui/thing-action";

/** What the player points at or clicks: a thing in the world, or a hotbar cell, which holds a backpack content or the log on their shoulder. */
export type ActionTarget = { readonly kind: "scene"; readonly pick: ScenePick } | HotbarTarget;

/** What the module reads. game.client satisfies it, so tests can pass a real game. */
export type ActionReader = Pick<GameClient, "getView" | "describeBlueprint" | "describeCampfire" | "describeWoodpile" | "describeSled">;

/** An action before it is known whether it is the main one. */
type Offer = Omit<ThingAction, "isMain">;

/** Every action the target offers, main first. Empty for nothing. Ground gives one main "walk". */
export function actionsFor(target: ActionTarget, reader: ActionReader): readonly ThingAction[] {
  const view = reader.getView();
  return view.dragging === null ? targetActions(target, reader, view) : targetActions(target, reader, view).map(withHandsBusy);
}

function targetActions(target: ActionTarget, reader: ActionReader, view: GameView): readonly ThingAction[] {
  switch (target.kind) {
    case "scene":
      return sceneActions(target.pick, reader, view);
    case "backpackContent":
      return backpackContentActions(target.content, view);
    case "shoulder":
      return shoulderActions(target.log, view);
    case "sled":
      return letGoActions();
  }
}

/** Letting go of the dragged sled, as the only and main action. */
function letGoActions(): readonly ThingAction[] {
  return withMain([offer("letGo", strings.actions.letGo, { hud: "log" }, { type: "letGoOfSled" })], "letGo");
}

/** While the player drags a sled, their hands are busy, so an action that needs them is off until they let go. */
function withHandsBusy(action: ThingAction): ThingAction {
  if (!action.enabled || action.command === undefined || !needsFreeHands(action.command)) return action;
  return { ...action, enabled: false, reason: strings.actionReasons.letGoFirst };
}

/** Convenience: the main action, or undefined. */
export function mainAction(actions: readonly ThingAction[]): ThingAction | undefined {
  return actions[0]?.isMain === true ? actions[0] : undefined;
}

/**
 * The actions the action menu lists for a target, in list order: the main action first, at the top, then the rest.
 * Actions that send no command, such as a work station's "open menu", are left out. Empty when the target offers none.
 */
export function menuActions(target: ActionTarget, reader: ActionReader): readonly ThingAction[] {
  return actionsFor(target, reader).filter(({ command }) => command !== undefined);
}

/** Puts the main action first and marks it. `main` is its id. Without one, no action is marked main. */
function withMain(offers: readonly Offer[], main: ActionId | undefined): readonly ThingAction[] {
  const first = offers.find(({ id }) => id === main);
  const rest = offers.filter((offer) => offer !== first);
  return [...(first === undefined ? [] : [{ ...first, isMain: true }]), ...rest.map((offer) => ({ ...offer, isMain: false }))];
}

/** An action the player can do now. */
function offer(id: ActionId, label: string, icon: ActionIcon, command: Command | undefined): Offer {
  return { id, label, icon, enabled: true, command };
}

/** An action that is off if `reason` is given. */
function offerUnless(reason: string | undefined, id: ActionId, label: string, icon: ActionIcon, command: Command): Offer {
  return reason === undefined ? offer(id, label, icon, command) : { id, label, icon, enabled: false, reason, command };
}

const has = (view: GameView, content: BackpackContent): boolean => (view.backpack[content] ?? 0) > 0;
const needsTool = (view: GameView, tool: BackpackContent): string | undefined =>
  has(view, tool) ? undefined : strings.actionReasons.needsTool(strings.backpackContents[tool]);

function takeDown(id: number, reason?: string): Offer {
  return offerUnless(reason, "takeDown", strings.actions.takeDown, { hud: "backpack" }, { type: "takeDown", pieceId: id });
}

function sceneActions(pick: ScenePick, reader: ActionReader, view: GameView): readonly ThingAction[] {
  if (pick.kind !== "structure") return thingActions(pick, reader, view);
  // A finished structure acts like the thing under it, and can also be taken down. Ground under it offers a walk there, such as onto a foundation.
  const under = pick.under === undefined ? [] : thingActions(pick.under, reader, view);
  return [...under, { ...takeDown(pick.id), id: "takeDownStructure", isMain: false }];
}

function thingActions(pick: GroundOrThingPick, reader: ActionReader, view: GameView): readonly ThingAction[] {
  switch (pick.kind) {
    case "ground": {
      const { x, z } = pick.spot;
      const walk = offer("walk", strings.actions.walk, { hud: "place" }, { type: "walkTo", x, z });
      // With a log on the shoulder, the player can also carry it to the spot and drop it there.
      const dropHere = view.carrying === null ? [] : [offer("dropHere", strings.actions.dropHere[view.carrying], { hud: "log" }, { type: "dropLogAt", x, z })];
      return withMain([walk, ...dropHere], "walk");
    }
    case "river":
      return riverActions(pick.spot, view);
    case "tree":
      return withMain([offerUnless(needsTool(view, "axe"), "chop", strings.actions.chop, { hud: "axe" }, { type: "chopTree", treeId: pick.id })], "chop");
    case "log":
    case "debarkedLog": {
      const shoulderFull = view.carrying === null ? undefined : strings.actionReasons.shoulderFull;
      const pickUp = offerUnless(shoulderFull, "pickUp", strings.actions.pickUp, { hud: "log" }, { type: "pickUpLog", logId: pick.id });
      if (pick.kind === "debarkedLog") return withMain([pickUp], "pickUp");
      // Splitting picks the log up first, so it also needs a free shoulder.
      const split = offerUnless(
        needsTool(view, "axe") ?? shoulderFull,
        "split",
        strings.actions.split,
        { content: "firewood" },
        {
          type: "splitLog",
          logId: pick.id,
        },
      );
      const debark = offerUnless(needsTool(view, "drawknife"), "debark", strings.actions.debark, { content: "bark" }, { type: "debarkLog", logId: pick.id });
      return withMain([pickUp, split, debark], "pickUp");
    }
    case "stick":
      return withMain([offer("pickUp", strings.actions.pickUp, { content: "stick" }, { type: "pickUpStick", stickId: pick.id })], "pickUp");
    case "bark":
      return withMain([offer("pickUp", strings.actions.pickUp, { content: "bark" }, { type: "pickUpBark", barkId: pick.id })], "pickUp");
    case "pile":
      return withMain([offer("pickUp", strings.actions.pickUp, { hud: "backpack" }, { type: "pickUpPile", pileId: pick.id })], "pickUp");
    case "forage":
      return withMain([offer("forage", strings.actions.forage, { hud: "berry" }, { type: "forage", spotId: pick.id })], "forage");
    case "campfire": {
      const campfire = reader.describeCampfire(pick.id);
      return campfire === null ? [] : campfireActions(campfire, view);
    }
    case "woodpile": {
      const woodpile = reader.describeWoodpile(pick.id);
      return woodpile === null ? withMain([takeDown(pick.id)], undefined) : woodpileActions(woodpile, view);
    }
    case "sled": {
      const sled = reader.describeSled(pick.id);
      return sled === null ? withMain([takeDown(pick.id)], undefined) : sledActions(sled, view);
    }
    case "chest":
    case "shelf":
      return withMain([offer("open", strings.actions.open, { hud: "backpack" }, { type: "openChest", chestId: pick.id }), takeDown(pick.id)], "open");
    case "bed":
      return withMain([offer("sleep", strings.actions.sleep, { hud: "moon" }, { type: "sleepInBed", bedId: pick.id }), takeDown(pick.id)], "sleep");
    case "table":
      // The player eats at a table as they eat anywhere, so the table offers nothing but taking it down.
      return withMain([takeDown(pick.id)], undefined);
    case "bedroll":
      return withMain(
        [
          offer("sleep", strings.actions.sleep, { hud: "moon" }, { type: "sleep", bedrollId: pick.id }),
          offer("pickUp", strings.actions.pickUp, { content: "bedroll" }, { type: "pickUpBedroll", bedrollId: pick.id }),
        ],
        "sleep",
      );
    case "blueprint":
      return blueprintActions(pick.id, reader, view);
    case "workStation":
      return withMain(
        [
          offer("openMenu", strings.actions.openMenu, { hud: "place" }, undefined),
          ...view.craftMenu
            .filter(({ station }) => station === pick.station)
            .map(({ kind, result, lacks }) =>
              offerUnless(
                lacks.length === 0 ? undefined : strings.craftMenu.needs(lacks.map(lackingText)),
                `craft:${kind}`,
                strings.craftMenu.recipes[kind],
                { content: result.content },
                { type: "craft", recipe: kind, stationId: pick.id },
              ),
            ),
          takeDown(pick.id),
        ],
        "openMenu",
      );
  }
}

/**
 * Drink, fill the empty pot, then fish. Drinking is the main action. Filling the pot shows only when the backpack holds the empty pot.
 * Fishing needs the fishing rod and free hands.
 */
function riverActions({ x, z }: { readonly x: number; readonly z: number }, view: GameView): readonly ThingAction[] {
  const fishReason = needsTool(view, "fishingRod") ?? (view.carrying === null ? undefined : strings.actionReasons.putLogDownFirst);
  const fillPot = has(view, "pot") ? [offer("fillPot", strings.actions.fillPotHere, { content: "potOfRiverWater" }, { type: "fillPot" })] : [];
  return withMain(
    [
      offer("drink", strings.actions.drink, { hud: "droplet" }, { type: "drinkFromRiver", x, z }),
      ...fillPot,
      offerUnless(fishReason, "fish", strings.actions.fish, { content: "fishingRod" }, { type: "fish", x, z }),
    ],
    "drink",
  );
}

/**
 * Light, each fuel, the pot, the fish, then Take down. A fire with a pot or fish on it cannot be taken down until they come off.
 * Main: an unlit fire with fuel is lit. Otherwise the first fuel the player can add goes on, firewood first.
 */
function campfireActions(campfire: CampfireView, view: GameView): readonly ThingAction[] {
  const campfireId = campfire.id;
  const reasons = strings.actionReasons;
  const lightReason = campfire.fuelMinutes <= 0 ? reasons.fireEmpty : needsTool(view, "steelAndFlint");
  // The menu lists the fuels in the order a lit fire takes them.
  const fuels = CAMPFIRE_FUELS.map((fuel) =>
    offerUnless(
      !has(view, fuel) ? reasons.noContent[fuel] : !campfire.fits[fuel] ? reasons.fireFull : undefined,
      `addFuel:${fuel}`,
      strings.actions.addFuel[fuel],
      { content: fuel },
      { type: "addFuel", campfireId, fuel },
    ),
  );
  const hasFullPot = has(view, "potOfRiverWater") || has(view, "potOfBoiledWater");
  const pot =
    campfire.pot === null
      ? offerUnless(
          !campfire.lit ? reasons.lightFirst : !hasFullPot ? reasons.noPotOfWater : undefined,
          "putPotOn",
          strings.actions.putPotOn,
          { content: "potOfRiverWater" },
          { type: "putPotOnFire", campfireId },
        )
      : offer("takePotOff", strings.actions.takePotOff, { content: "pot" }, { type: "takePotOffFire", campfireId });
  const cookFish = offerUnless(
    !campfire.lit ? reasons.lightFirst : !has(view, "rawFish") ? reasons.noRawFish : !campfire.fitsFish ? reasons.fireFullOfFish : undefined,
    "cookFish",
    strings.actions.cookFish,
    { content: "rawFish" },
    { type: "cookFish", campfireId },
  );
  const fishIcon: ActionIcon = { content: campfire.fish.some(({ cooked }) => cooked) ? "cookedFish" : "rawFish" };
  const takeFishOff = campfire.fish.length === 0 ? [] : [offer("takeFishOff", strings.actions.takeFishOff, fishIcon, { type: "takeFishOff", campfireId })];
  const light = campfire.lit ? [] : [offerUnless(lightReason, "light", strings.actions.light, { hud: "flame" }, { type: "lightCampfire", campfireId })];
  const takeDownReason = campfire.pot !== null ? reasons.potOnFire : campfire.fish.length > 0 ? reasons.fishOnFire : undefined;
  const offers = [...light, ...fuels, pot, cookFish, ...takeFishOff, takeDown(campfireId, takeDownReason)];
  const lightsNow = !campfire.lit && campfire.fuelMinutes > 0;
  const main = lightsNow ? "light" : (fuels.find(({ enabled }) => enabled) ?? fuels[0])?.id;
  return withMain(offers, main);
}

/**
 * Stack the log on the shoulder, stack firewood one or all, take each kind of wood, then take it down.
 * Main: stack the log on the shoulder, or take firewood if the player carries nothing.
 */
function woodpileActions(woodpile: WoodpileView, view: GameView): readonly ThingAction[] {
  const woodpileId = woodpile.id;
  const reasons = strings.actionReasons;
  const full = woodpile.total >= woodpile.capacity ? reasons.woodpileFull : undefined;
  const woodIcon = (wood: WoodpileWood): ActionIcon => (wood === "firewood" ? { content: "firewood" } : { hud: "log" });
  // With nothing on the shoulder, stacking the log still shows, greyed, so the player learns they can.
  const stackLog = (view.carrying === null ? (["log"] as const) : [view.carrying]).map((log) =>
    offerUnless(view.carrying === null ? reasons.noLogCarried : full, `stack:${log}`, strings.actions.stack[log], woodIcon(log), {
      type: "stackOnWoodpile",
      woodpileId,
      wood: log,
      all: false,
    }),
  );
  const firewoodReason = full ?? (has(view, "firewood") ? undefined : reasons.noContent.firewood);
  const stackFirewood = [
    offerUnless(firewoodReason, "stack:firewood", strings.actions.stack.firewood, woodIcon("firewood"), {
      type: "stackOnWoodpile",
      woodpileId,
      wood: "firewood",
      all: false,
    }),
    offerUnless(firewoodReason, "stack:firewood:all", strings.actions.stackAllFirewood, woodIcon("firewood"), {
      type: "stackOnWoodpile",
      woodpileId,
      wood: "firewood",
      all: true,
    }),
  ];
  const take = WOODPILE_WOODS.map((wood) =>
    offerUnless(
      woodpile.contents[wood] <= 0 ? reasons.nothingToTake : wood !== "firewood" && view.carrying !== null ? reasons.shoulderFull : undefined,
      `take:${wood}`,
      strings.actions.take[wood],
      woodIcon(wood),
      { type: "takeFromWoodpile", woodpileId, wood },
    ),
  );
  const offers = [...stackLog, ...stackFirewood, ...take, takeDown(woodpileId, woodpile.total > 0 ? reasons.emptyFirst : undefined)];
  return withMain(
    offers,
    view.carrying === null
      ? woodpileMainWithoutLog([...take.filter(({ id }) => id === "take:firewood"), ...take.filter(({ id }) => id !== "take:firewood"), stackFirewood[0]])
      : `stack:${view.carrying}`,
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
 * Put the log on the shoulder on the sled, load planks, drag it, take one of each kind of log the sled holds, take planks,
 * tip out everything, then take it down.
 * Loading planks shows only when the backpack holds planks. Taking planks shows only when the sled holds planks.
 * Main: put the log on the shoulder on the sled, or drag it if the player carries nothing.
 * While the player drags this sled, they can only let go of it.
 */
function sledActions(sled: SledView, view: GameView): readonly ThingAction[] {
  const sledId = sled.id;
  const reasons = strings.actionReasons;
  if (view.dragging?.id === sledId) return letGoActions();
  const drag = offerUnless(view.dragging === null ? undefined : reasons.letGoFirst, "drag", strings.actions.drag, { hud: "log" }, { type: "dragSled", sledId });
  const load =
    view.carrying === null
      ? []
      : [
          offerUnless(
            sled.logsThatFit <= 0 ? reasons.sledFull : undefined,
            `load:${view.carrying}`,
            strings.actions.loadSled[view.carrying],
            { hud: "log" },
            {
              type: "loadSled",
              sledId,
            },
          ),
        ];
  // Only the kinds the sled holds are offered. An empty sled still shows taking a log, greyed, so the player learns they can.
  const held = CARRIED_LOGS.filter((log) => sled.contents[log] > 0);
  const take = (held.length === 0 ? (["log"] as const) : held).map((log) =>
    offerUnless(
      sled.contents[log] <= 0 ? reasons.nothingToTake : view.carrying !== null ? reasons.shoulderFull : undefined,
      `take:${log}`,
      strings.actions.take[log],
      { hud: "log" },
      { type: "takeFromSled", sledId, log },
    ),
  );
  const loadPlanks = has(view, "plank")
    ? [
        offerUnless(
          sled.planksThatFit <= 0 ? reasons.sledFull : undefined,
          "load:plank",
          strings.actions.loadPlanks,
          { content: "plank" },
          { type: "loadPlanksOnSled", sledId },
        ),
      ]
    : [];
  const takePlanks =
    sled.contents.plank > 0 ? [offer("take:plank", strings.actions.takePlanks, { content: "plank" }, { type: "takePlanksFromSled", sledId })] : [];
  const tipOut = offerUnless(
    sled.total <= 0 ? reasons.nothingToTake : undefined,
    "tipOut",
    strings.actions.tipOut,
    { hud: "log" },
    { type: "tipOutSled", sledId },
  );
  // A loaded sled can be taken down. Its logs are laid on the ground beside it first, and its planks drop in a pile.
  const offers = [...load, ...loadPlanks, drag, ...take, ...takePlanks, tipOut, takeDown(sledId)];
  return withMain(offers, view.carrying === null ? "drag" : `load:${view.carrying}`);
}

/** Main: add the carried material if the blueprint still needs it, otherwise build. Then taking it down. */
function blueprintActions(blueprintId: number, reader: ActionReader, view: GameView): readonly ThingAction[] {
  const blueprint = reader.describeBlueprint(blueprintId);
  const build = offerUnless(buildLackReason(blueprint?.lacks ?? null), "build", strings.actions.build, { hud: "place" }, { type: "build", blueprintId });
  const carried = view.carrying;
  const needed = carried !== null && blueprint?.deliveries.some(({ material, has: delivered, needs }) => material === carried && delivered < needs);
  const deliver = needed ? [offer(`deliver:${carried}`, strings.actions.deliver[carried], { hud: "log" }, { type: "deliverToBlueprint", blueprintId })] : [];
  return withMain([...deliver, build, takeDown(blueprintId)], deliver[0]?.id ?? "build");
}

/** Why the player cannot build a blueprint's next stage, or undefined if they can. */
function buildLackReason(lacks: BuildLack | null): string | undefined {
  if (lacks === null) return undefined;
  const reasons = strings.actionReasons;
  if (lacks.kind === "tool") return reasons.needsTool(strings.backpackContents[lacks.tool]);
  switch (lacks.material) {
    case "stick":
    case "bark":
    case "plank":
      return reasons.noContent[lacks.material];
    case "log":
    case "debarkedLog":
      return reasons.bringFirst[lacks.material];
  }
}

/** What using a backpack content does, if it has a use. */
function useCommand(content: BackpackContent): { readonly label: string; readonly command: Command } | undefined {
  switch (content) {
    case "berries":
    case "mushroom":
    case "rawFish":
    case "cookedFish":
      return { label: strings.actions.eat, command: { type: "eat", food: content } };
    case "bedroll":
      return { label: strings.actions.layOut, command: { type: "layBedroll" } };
    case "pot":
      return { label: strings.actions.fillPot, command: { type: "fillPot" } };
    case "potOfRiverWater":
    case "potOfBoiledWater":
      return { label: strings.actions.drinkFromPot, command: { type: "drinkFromPot" } };
    default:
      return undefined;
  }
}

/** Use it, when it has a use, then drop it. With a chest or shelf open, putting it there comes first. */
function backpackContentActions(content: BackpackContent, view: GameView): readonly ThingAction[] {
  const icon: ActionIcon = { content };
  const use = useCommand(content);
  const chest = view.nearby.find((thing) => thing.kind === "openChest");
  const intoChest =
    chest === undefined
      ? []
      : [
          offer("putInChest", strings.actions.putInChest[chest.view.furniture], icon, {
            type: "putInChest",
            chestId: chest.view.id,
            content,
            all: false,
          }),
          offer("putInChest:all", strings.actions.putAllInChest[chest.view.furniture], icon, {
            type: "putInChest",
            chestId: chest.view.id,
            content,
            all: true,
          }),
        ];
  const offers = [
    ...intoChest,
    ...(use === undefined ? [] : [offer("use", use.label, icon, use.command)]),
    offer("drop", strings.actions.drop, icon, { type: "dropFromBackpack", content }),
  ];
  return withMain(offers, chest !== undefined ? "putInChest" : use === undefined ? undefined : "use");
}

/** Drop it, then split it into firewood if it is a log. */
function shoulderActions(log: CarriedLog, view: GameView): readonly ThingAction[] {
  const drop = offer("drop", strings.actions.drop, { hud: "log" }, { type: "dropLog" });
  const split = log === "log" ? [offerUnless(needsTool(view, "axe"), "split", strings.actions.split, { content: "firewood" }, { type: "splitLog" })] : [];
  return withMain([drop, ...split], "drop");
}

/** Names one thing a recipe lacks, such as "the saw". */
function lackingText(lack: RecipeLack): string {
  switch (lack.kind) {
    case "tool":
      return strings.craftMenu.lacking.tool(strings.backpackContents[lack.tool]);
    case "station":
      return strings.craftMenu.lacking.station(strings.buildMenu.structures[lack.station]);
    case "materials":
      return strings.craftMenu.lacking.materials;
  }
}
