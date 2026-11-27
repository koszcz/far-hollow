// The actions of a thing in the world: ground, trees, logs, structures, blueprints, the river, and the other single things the player points at.
import { isCarriedLog, isHost } from "../sim/api";
import type { ScenePick, GroundOrThingPick } from "../sim/api-scene-pick";
import { actionsText } from "../strings/actions";
import { workText } from "../strings/work";
import type { ActionIcon, ThingAction } from "../ui/thing-action";
import { has, notMain, takeDown, withMain, type Context, type Offer } from "./thing-actions-context";
import { campfireActions, dryingRackActions, furnitureActions, sledActions, woodpileActions } from "./thing-actions-structures";

function chop({ offer }: Context, treeId: number): Offer {
  return offer("chop", actionsText.actions.chop, { hud: "axe" }, { type: "chopTree", treeId });
}

function digUp({ offer }: Context, saplingId: number): Offer {
  return offer("digUp", actionsText.actions.digUp, { content: "sapling" }, { type: "digUpSapling", saplingId });
}

export function sceneActions(pick: ScenePick, context: Context): readonly ThingAction[] {
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
  return [offer("addOn", actionsText.actions.addOn[host.structure], { hud: "place" }, { type: "buildAddOn", hostId })];
}

/** What a finished structure itself offers, besides being taken down. A lean-to offers to lay the bedroll in it while the backpack holds one. */
function structureOffers(pick: Extract<ScenePick, { kind: "structure" }>, { view, offer }: Context): readonly Offer[] {
  if (pick.structure !== "leanTo" || !has(view, "bedroll")) return [];
  return [offer("layBedroll", actionsText.actions.layBedrollHere, { content: "bedroll" }, { type: "layBedrollInLeanTo", leanToId: pick.id })];
}

function thingActions(pick: GroundOrThingPick, context: Context): readonly ThingAction[] {
  const { view, reader, offer } = context;
  switch (pick.kind) {
    case "ground": {
      const { x, z } = pick.spot;
      const walk = offer("walk", actionsText.actions.walk, { hud: "place" }, { type: "walkTo", x, z });
      // With a log on the shoulder, the player can also carry it to the spot and drop it there.
      const dropHere =
        view.carrying === null ? [] : [offer("dropHere", actionsText.actions.dropHere[view.carrying], { hud: "log" }, { type: "dropLogAt", x, z })];
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
      const pickUp = offer("pickUp", actionsText.actions.pickUp, { hud: "log" }, { type: "pickUpLog", logId: pick.id });
      if (pick.kind === "debarkedLog") return withMain([pickUp], "pickUp");
      const split = offer("split", actionsText.actions.split, { content: "firewood" }, { type: "splitLog", logId: pick.id });
      const debark = offer("debark", actionsText.actions.debark, { content: "bark" }, { type: "debarkLog", logId: pick.id });
      // Planting a mushroom shows only while the backpack holds one.
      const plantMushroom = has(view, "mushroom")
        ? [offer("plantMushroom", actionsText.actions.plantMushroom, { content: "mushroom" }, { type: "plantMushroom", logId: pick.id })]
        : [];
      return withMain([pickUp, split, debark, ...plantMushroom], "pickUp");
    }
    case "stick":
      return withMain([offer("pickUp", actionsText.actions.pickUp, { content: "stick" }, { type: "pickUpStick", stickId: pick.id })], "pickUp");
    case "bark":
      return withMain([offer("pickUp", actionsText.actions.pickUp, { content: "bark" }, { type: "pickUpBark", barkId: pick.id })], "pickUp");
    case "pile":
      return withMain([offer("pickUp", actionsText.actions.pickUp, { hud: "backpack" }, { type: "pickUpPile", pileId: pick.id })], "pickUp");
    case "plantedTorch":
      return withMain([offer("pickUp", actionsText.actions.pickUp, { content: "torch" }, { type: "pickUpTorch", torchId: pick.id })], "pickUp");
    case "fishTrap":
      return fishTrapActions(pick.id, context);
    case "shutters":
      return shuttersActions(pick.id, context);
    case "forage":
      return forageActions(pick.id, context);
    case "mushroomLog":
      return withMain(
        [
          offer("forage", actionsText.actions.forage, { content: "mushroom" }, { type: "forage", spotId: pick.id }),
          offer("takeDown", actionsText.actions.takeDown, { hud: "backpack" }, { type: "takeDownMushroomLog", mushroomLogId: pick.id }),
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
          offer("sleep", actionsText.actions.sleep, { hud: "moon" }, { type: "sleep", bedrollId: pick.id }),
          offer("pickUp", actionsText.actions.pickUp, { content: "bedroll" }, { type: "pickUpBedroll", bedrollId: pick.id }),
        ],
        "sleep",
      );
    case "blueprint":
      return blueprintActions(pick.id, context);
    case "workStation":
      return withMain(
        [
          // Opening the menu sends no command, so the game has nothing to refuse.
          { id: "openMenu", label: actionsText.actions.openMenu, icon: { hud: "place" }, enabled: true, command: undefined },
          ...view.craftMenu
            .filter(({ station }) => station === pick.station)
            .map(({ kind, result }) =>
              offer(`craft:${kind}`, workText.craftMenu.recipes[kind], { content: result.content }, { type: "craft", recipe: kind, stationId: pick.id }),
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
    ? offer("closeShutters", actionsText.actions.closeShutters, { hud: "flame" }, { type: "setShutters", shuttersId, open: false })
    : offer("openShutters", actionsText.actions.openShutters, { hud: "sun" }, { type: "setShutters", shuttersId, open: true });
  return withMain([toggle, takeDown(context, shuttersId)], toggle.id);
}

/**
 * Forage, then, for a berry bush, dig it up. Foraging is the main action while the bush has berries, and digging it up while it grows them back.
 * A mushroom patch cannot be dug up.
 */
function forageActions(spotId: number, { reader, offer }: Context): readonly ThingAction[] {
  const forage = offer("forage", actionsText.actions.forage, { hud: "berry" }, { type: "forage", spotId });
  const thing = reader.describeThing(spotId);
  if (thing?.kind !== "forage" || thing.food !== "berries") return withMain([forage], "forage");
  const digUpBush = offer("digUp", actionsText.actions.digUp, { content: "berryBush" }, { type: "digUpBerryBush", bushId: spotId });
  return withMain([forage, digUpBush], forage.enabled ? "forage" : "digUp");
}

/** Gathering one stone, then digging one clay, at a spot on the river bank or in the river. */
function riverBankOffers({ x, z }: { readonly x: number; readonly z: number }, { offer }: Context): readonly Offer[] {
  return [
    offer("gatherStone", actionsText.actions.gatherStone, { content: "stone" }, { type: "gatherStone", x, z }),
    offer("digClay", actionsText.actions.digClay, { content: "clay" }, { type: "digClay", x, z }),
  ];
}

/**
 * Take fish, then pick the trap up. Taking the fish is the main action while the trap holds one, and picking it up while it does not.
 * Take fish shows only while the trap holds a fish.
 */
function fishTrapActions(trapId: number, { reader, offer }: Context): readonly ThingAction[] {
  const pickUp = offer("pickUp", actionsText.actions.pickUp, { content: "fishTrap" }, { type: "pickUpFishTrap", trapId });
  const thing = reader.describeThing(trapId);
  if (thing?.kind !== "fishTrap" || !thing.holdsFish) return withMain([pickUp], "pickUp");
  const takeFish = offer("takeFish", actionsText.actions.takeFish, { content: "rawFish" }, { type: "takeFishFromTrap", trapId });
  return withMain([takeFish, pickUp], "takeFish");
}

/**
 * Drink, fill the empty pot, fish, set a fish trap, gather stone, then dig clay. Drinking is the main action.
 * Filling the pot shows only when the backpack holds the empty pot.
 */
function riverActions({ x, z }: { readonly x: number; readonly z: number }, context: Context): readonly ThingAction[] {
  const { view, offer } = context;
  const fillPot = has(view, "pot") ? [offer("fillPot", actionsText.actions.fillPotHere, { content: "potOfRiverWater" }, { type: "fillPot" })] : [];
  return withMain(
    [
      offer("drink", actionsText.actions.drink, { hud: "droplet" }, { type: "drinkFromRiver", x, z }),
      ...fillPot,
      offer("fish", actionsText.actions.fish, { content: "fishingRod" }, { type: "fish", x, z }),
      offer("setFishTrap", actionsText.actions.setFishTrap, { content: "fishTrap" }, { type: "setFishTrap", x, z }),
      ...riverBankOffers({ x, z }, context),
    ],
    "drink",
  );
}

/** Main: add the carried material if the blueprint still needs it, otherwise build. Then taking it down. */
function blueprintActions(blueprintId: number, context: Context): readonly ThingAction[] {
  const { view, reader, offer } = context;
  const blueprint = reader.describeBlueprint(blueprintId);
  const build = offer("build", actionsText.actions.build, { hud: "place" }, { type: "build", blueprintId });
  const carried = view.carrying;
  const needed = carried !== null && blueprint?.deliveries.some(({ material, has: delivered, needs }) => material === carried && delivered < needs);
  const icon: ActionIcon = carried === null || isCarriedLog(carried) ? { hud: "log" } : { content: carried };
  const deliver = needed ? [offer(`deliver:${carried}`, actionsText.actions.deliver[carried], icon, { type: "deliverToBlueprint", blueprintId })] : [];
  return withMain([...deliver, build, takeDown(context, blueprintId)], deliver[0]?.id ?? "build");
}
