// Every action a thing offers the player: a thing in the world, a backpack content in the hotbar, or the log on their shoulder.
// The action menu lists them all. The cursor prompt, a left-click, and the E key use the main one.
// It only reads game state through the reader, so tests can pass a real game's client.
import type { GroundOrThingPick, ScenePick } from "../render/scene-renderer";
import { CAMPFIRE_FUELS, CARRIED_LOGS, needsFreeHands, WOODPILE_WOODS } from "../sim/api";
import type { BackpackContent, CampfireView, CarriedLog, Command, GameClient, GameView, RecipeLack, SledView, WoodpileView, WoodpileWood } from "../sim/api";
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
      return withMain([offer("letGo", strings.actions.letGo, { hud: "log" }, { type: "letGoOfSled" })], "letGo");
  }
}

/** While the player drags a sled, their hands are busy, so an action that needs them is off until they let go. */
function withHandsBusy(action: ThingAction): ThingAction {
  if (!action.enabled || action.command === undefined || !needsFreeHands(action.command)) return action;
  return { ...action, enabled: false, reason: strings.actionReasons.letGoFirst };
}

/** The target's name for the prompt title, such as "Tree", "Campfire", or "Berries". */
export function targetName(target: ActionTarget, reader: ActionReader): string {
  switch (target.kind) {
    case "backpackContent":
      return strings.backpackContents[target.content];
    case "shoulder":
      return strings.things[target.log];
    case "sled":
      return strings.things.sled;
    case "scene":
      return pickName(target.pick, reader);
  }
}

/** Convenience: the main action, or undefined. */
export function mainAction(actions: readonly ThingAction[]): ThingAction | undefined {
  return actions[0]?.isMain === true ? actions[0] : undefined;
}

/**
 * The action the cursor prompt names for a left-click, enabled or not, or undefined if it names none.
 * A left-click on a finished structure acts on the thing behind it. With only ground behind it, the click just walks, so it names none.
 */
export function leftClickAction(target: ActionTarget, reader: ActionReader): ThingAction | undefined {
  if (target.kind !== "scene" || target.pick.kind !== "structure") return mainAction(actionsFor(target, reader));
  const behind = target.pick.under;
  return behind === undefined || behind.kind === "ground" ? undefined : mainAction(actionsFor({ kind: "scene", pick: behind }, reader));
}

/**
 * Whether the target's actions include one a left-click does not do. Only then does the action menu open,
 * and only then does the cursor prompt say "More actions".
 */
export function hasMoreActions(actions: readonly ThingAction[], left: ThingAction | undefined): boolean {
  return actions.some(({ id }) => id !== left?.id);
}

function pickName(pick: ScenePick, reader: ActionReader): string {
  switch (pick.kind) {
    case "blueprint": {
      const blueprint = reader.describeBlueprint(pick.id);
      return blueprint === null ? strings.things.structure : strings.blueprint.title(strings.buildMenu.structures[blueprint.structure]);
    }
    case "workStation":
      return strings.buildMenu.structures[pick.station];
    case "structure":
      return strings.buildMenu.structures[pick.structure];
    default:
      return strings.things[pick.kind];
  }
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
  // A finished structure acts like the thing under it, and can also be taken down. Ground under it adds nothing, since a click there only walks.
  const under = pick.under === undefined || pick.under.kind === "ground" ? [] : thingActions(pick.under, reader, view);
  return [...under, { ...takeDown(pick.id), id: "takeDownStructure", isMain: false }];
}

function thingActions(pick: GroundOrThingPick, reader: ActionReader, view: GameView): readonly ThingAction[] {
  switch (pick.kind) {
    case "ground":
      return withMain([offer("walk", strings.actions.walk, { hud: "place" }, { type: "walkTo", x: pick.spot.x, z: pick.spot.z })], "walk");
    case "river":
      return withMain([offer("drink", strings.actions.drink, { hud: "droplet" }, { type: "drinkFromRiver", x: pick.spot.x, z: pick.spot.z })], "drink");
    case "tree":
      return withMain([offerUnless(needsTool(view, "axe"), "chop", strings.actions.chop, { hud: "axe" }, { type: "chopTree", treeId: pick.id })], "chop");
    case "log":
    case "debarkedLog": {
      const shoulderFull = view.carrying === null ? undefined : strings.actionReasons.shoulderFull;
      const pickUp = offerUnless(shoulderFull, "pickUp", strings.actions.pickUp, { hud: "log" }, { type: "pickUpLog", logId: pick.id });
      if (pick.kind === "debarkedLog") return withMain([pickUp], "pickUp");
      const debark = offerUnless(needsTool(view, "drawknife"), "debark", strings.actions.debark, { content: "bark" }, { type: "debarkLog", logId: pick.id });
      return withMain([pickUp, debark], "pickUp");
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
      return withMain([offer("open", strings.actions.open, { hud: "backpack" }, { type: "openChest", chestId: pick.id }), takeDown(pick.id)], "open");
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
 * Light, each fuel, the pot, then Take down. A fire with a pot on it cannot be taken down until the pot comes off.
 * Main: an unlit fire with fuel is lit. Otherwise the first fuel the player can add goes on, firewood first.
 */
function campfireActions(campfire: CampfireView, view: GameView): readonly ThingAction[] {
  const campfireId = campfire.id;
  const reasons = strings.actionReasons;
  const lightReason = campfire.fuelMinutes <= 0 ? reasons.fireEmpty : needsTool(view, "fireStriker");
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
  const light = campfire.lit ? [] : [offerUnless(lightReason, "light", strings.actions.light, { hud: "flame" }, { type: "lightCampfire", campfireId })];
  const offers = [...light, ...fuels, pot, takeDown(campfireId, campfire.pot === null ? undefined : reasons.potOnFire)];
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
  return withMain(offers, view.carrying === null ? "take:firewood" : `stack:${view.carrying}`);
}

/**
 * Put the log on the shoulder on the sled, drag it, take one of each kind the sled holds, tip out every log, then take it down.
 * Main: put the log on the shoulder on the sled, or drag it if the player carries nothing.
 * While the player drags this sled, they can only let go of it.
 */
function sledActions(sled: SledView, view: GameView): readonly ThingAction[] {
  const sledId = sled.id;
  const reasons = strings.actionReasons;
  if (view.dragging?.id === sledId) return withMain([offer("letGo", strings.actions.letGo, { hud: "log" }, { type: "letGoOfSled" })], "letGo");
  const drag = offerUnless(view.dragging === null ? undefined : reasons.letGoFirst, "drag", strings.actions.drag, { hud: "log" }, { type: "dragSled", sledId });
  const load =
    view.carrying === null
      ? []
      : [
          offerUnless(
            sled.total >= sled.capacity ? reasons.sledFull : undefined,
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
  const tipOut = offerUnless(
    sled.total <= 0 ? reasons.nothingToTake : undefined,
    "tipOut",
    strings.actions.tipOut,
    { hud: "log" },
    { type: "tipOutSled", sledId },
  );
  const offers = [...load, drag, ...take, tipOut, takeDown(sledId, sled.total > 0 ? reasons.emptyFirst : undefined)];
  return withMain(offers, view.carrying === null ? "drag" : `load:${view.carrying}`);
}

/** Main: add the carried material if the blueprint still needs it, otherwise build. Then taking it down. */
function blueprintActions(blueprintId: number, reader: ActionReader, view: GameView): readonly ThingAction[] {
  const blueprint = reader.describeBlueprint(blueprintId);
  const build = offer("build", strings.actions.build, { hud: "place" }, { type: "build", blueprintId });
  const needed = blueprint?.deliveries.find(({ material, has: delivered, needs }) => material === view.carrying && delivered < needs);
  const deliver =
    needed === undefined
      ? []
      : [offer(`deliver:${needed.material}`, strings.actions.deliver[needed.material], { hud: "log" }, { type: "deliverToBlueprint", blueprintId })];
  return withMain([...deliver, build, takeDown(blueprintId)], deliver[0]?.id ?? "build");
}

/** What using a backpack content does, if it has a use. */
function useCommand(content: BackpackContent): { readonly label: string; readonly command: Command } | undefined {
  switch (content) {
    case "berries":
    case "mushroom":
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

/** Use it, when it has a use, then drop it. With a chest open, putting it in the chest comes first. */
function backpackContentActions(content: BackpackContent, view: GameView): readonly ThingAction[] {
  const icon: ActionIcon = { content };
  const use = useCommand(content);
  const chest = view.nearby.find((thing) => thing.kind === "openChest");
  const intoChest =
    chest === undefined
      ? []
      : [
          offer("putInChest", strings.actions.putInChest, icon, { type: "putInChest", chestId: chest.view.id, content, all: false }),
          offer("putInChest:all", strings.actions.putAllInChest, icon, { type: "putInChest", chestId: chest.view.id, content, all: true }),
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
