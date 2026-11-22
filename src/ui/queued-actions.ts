// Picks the icon and name of each action in the action queue, for the row of icons beside the clock.
// The icon shows what the action works on, such as a tree, a log, or a campfire. The name is the action's, such as "Chop".
import type { ActionCommand, BackpackContent, CarriedLog, GameClient, GameView, StructureKind, ThingView } from "../sim/api";
import { strings } from "../strings";
import type { QueueThing } from "./action-queue-icons";
import type { ActionIcon } from "./thing-action";

/** The icon of a queued action: a HUD icon, a backpack content, a structure, a log or debarked log, or a thing drawn in action-queue-icons.tsx. */
export type QueueIcon = ActionIcon | { readonly structure: StructureKind } | { readonly log: CarriedLog } | { readonly thing: QueueThing };

/** One action in the queue, as the row shows it. */
export interface QueuedAction {
  readonly icon: QueueIcon;
  /** The action's name, such as "Chop". The row shows it when the player points at the icon. */
  readonly name: string;
}

/** What the module reads: the view, and what a thing in the world is. */
export type QueueReader = Pick<GameClient, "describeThing">;

/** Each action in the view's queue, with its icon and name, the action under way first. Empty when the queue is. */
export function queuedActions(view: GameView, reader: QueueReader): readonly QueuedAction[] {
  return view.actionQueue.map((command) => queuedAction(command, view, reader));
}

/** The icon and name of one queued action. TypeScript reports a command with neither. */
export function queuedAction(command: ActionCommand, view: GameView, reader: QueueReader): QueuedAction {
  const { actions } = strings;
  const thing = (id: number): ThingView | null => reader.describeThing(id);
  const structure = (id: number, otherwise: StructureKind): QueueIcon => {
    const found = thing(id);
    return { structure: found?.kind === "structure" ? found.structure : otherwise };
  };
  const carried: CarriedLog = view.carrying ?? "log";
  switch (command.type) {
    case "walkTo":
      return { icon: { thing: "ground" }, name: actions.walk };
    case "chopTree":
      return { icon: { thing: "tree" }, name: actions.chop };
    case "digUpSapling":
      return { icon: { content: "sapling" }, name: actions.digUp };
    case "plantSapling":
      return { icon: { content: "sapling" }, name: actions.plant };
    case "pickUpLog":
      return { icon: logIcon(thing(command.logId)?.kind === "debarkedLog" ? "debarkedLog" : "log"), name: actions.pickUp };
    case "debarkLog":
      return { icon: logIcon("log"), name: actions.debark };
    case "plantMushroom":
      return { icon: { content: "mushroom" }, name: actions.plantMushroom };
    case "takeDownMushroomLog":
      return { icon: { content: "mushroom" }, name: actions.takeDown };
    case "splitLog":
      return { icon: logIcon(command.logId === undefined ? carried : "log"), name: actions.split };
    case "dropLog":
      return { icon: logIcon(carried), name: actions.drop };
    case "dropLogAt":
      return { icon: logIcon(carried), name: actions.dropHere[carried] };
    case "pickUpStick":
      return { icon: { content: "stick" }, name: actions.pickUp };
    case "pickUpBark":
      return { icon: { content: "bark" }, name: actions.pickUp };
    case "forage": {
      const spot = thing(command.spotId);
      return { icon: { content: spot?.kind === "forage" ? spot.food : "berries" }, name: actions.forage };
    }
    case "pickUpPile": {
      const pile = thing(command.pileId);
      return { icon: pile?.kind === "pile" ? { content: pile.content } : { hud: "backpack" }, name: actions.pickUp };
    }
    case "eat":
      return { icon: { content: command.food }, name: actions.eat };
    case "dropFromBackpack":
      return { icon: { content: command.content }, name: actions.drop };
    case "placeBlueprint":
      return { icon: { structure: command.structure }, name: actions.build };
    case "build":
      return { icon: structure(command.blueprintId, "campfire"), name: actions.build };
    case "deliverToBlueprint":
      return { icon: structure(command.blueprintId, "foundation"), name: actions.deliver[carried] };
    case "takeDown": {
      const piece = thing(command.pieceId);
      return { icon: piece?.kind === "structure" ? { structure: piece.structure } : { hud: "backpack" }, name: actions.takeDown };
    }
    case "stopBuilding":
      return { icon: { hud: "place" }, name: strings.actionQueue.stopBuilding };
    case "tendCampfire":
      return { icon: { structure: "campfire" }, name: strings.actionQueue.tend };
    case "addFuel":
      return { icon: { structure: "campfire" }, name: actions.addFuel[command.fuel] };
    case "lightCampfire":
      return { icon: { structure: "campfire" }, name: actions.light };
    case "putPotOnFire":
      return { icon: { structure: "campfire" }, name: actions.putPotOn };
    case "takePotOffFire":
      return { icon: { structure: "campfire" }, name: actions.takePotOff };
    case "cookFish":
      return { icon: { structure: "campfire" }, name: actions.cookFish };
    case "takeFishOff":
      return { icon: { structure: "campfire" }, name: actions.takeFishOff };
    case "tendWoodpile":
      return { icon: { structure: "woodpile" }, name: strings.actionQueue.tend };
    case "stackOnWoodpile":
      return { icon: { structure: "woodpile" }, name: command.all && command.wood === "firewood" ? actions.stackAllFirewood : actions.stack[command.wood] };
    case "takeFromWoodpile":
      return { icon: { structure: "woodpile" }, name: actions.take[command.wood] };
    case "loadSled":
      return { icon: { structure: "sled" }, name: actions.loadSled[carried] };
    case "takeFromSled":
      return { icon: { structure: "sled" }, name: actions.take[command.log] };
    case "loadPlanksOnSled":
      return { icon: { structure: "sled" }, name: actions.loadPlanks };
    case "takePlanksFromSled":
      return { icon: { structure: "sled" }, name: actions.takePlanks };
    case "tipOutSled":
      return { icon: { structure: "sled" }, name: actions.tipOut };
    case "dragSled":
      return { icon: { structure: "sled" }, name: actions.drag };
    case "letGoOfSled":
      return { icon: { structure: "sled" }, name: actions.letGo };
    case "openChest":
      return { icon: structure(command.chestId, "chest"), name: actions.open };
    case "putInChest": {
      const icon = structure(command.chestId, "chest");
      const furniture = "structure" in icon && icon.structure === "shelf" ? "shelf" : "chest";
      return { icon, name: command.all ? actions.putAllInChest[furniture] : actions.putInChest[furniture] };
    }
    case "takeFromChest": {
      const icon = structure(command.chestId, "chest");
      const take = "structure" in icon && icon.structure === "shelf" ? strings.shelf.take : strings.chest.take;
      return { icon, name: take(strings.backpackContents[command.content]) };
    }
    case "lightTorch":
      return { icon: { content: "torch" }, name: actions.light };
    case "putOutTorch":
      return { icon: { content: "torch" }, name: actions.putOut };
    case "plantTorch":
      return { icon: { content: "torch" }, name: actions.plant };
    case "pickUpTorch":
      return { icon: { content: "torch" }, name: actions.pickUp };
    case "layBedroll":
      return { icon: { content: "bedroll" }, name: actions.layOut };
    case "layBedrollInLeanTo":
      return { icon: { structure: "leanTo" }, name: actions.layBedrollHere };
    case "pickUpBedroll":
      return { icon: { content: "bedroll" }, name: actions.pickUp };
    case "sleep":
      return { icon: { content: "bedroll" }, name: actions.sleep };
    case "sleepInBed":
      return { icon: { structure: "bed" }, name: actions.sleep };
    case "sitOnStool":
      return { icon: { structure: "stool" }, name: actions.sit };
    case "drinkFromRiver":
      return { icon: { thing: "river" }, name: actions.drink };
    case "fish":
      return { icon: { thing: "river" }, name: actions.fish };
    case "gatherStone":
      return { icon: { content: "stone" }, name: actions.gatherStone };
    case "fillPot":
      return { icon: { thing: "river" }, name: actions.fillPot };
    case "drinkFromPot":
      return { icon: { content: potHeld(view) }, name: actions.drinkFromPot };
    case "craft": {
      const recipe = view.craftMenu.find(({ kind }) => kind === command.recipe);
      return { icon: recipe === undefined ? { hud: "backpack" } : { content: recipe.result.content }, name: strings.craftMenu.recipes[command.recipe] };
    }
    // Pausing and skipping time never wait in the queue. They have an icon and name all the same, so every command has one.
    case "setPaused":
      return { icon: { hud: command.paused ? "pause" : "play" }, name: command.paused ? strings.pause : strings.resume };
    case "skipTime":
      return { icon: { hud: "moon" }, name: strings.debugSkipHours(command.hours) };
    case "skipToRainChange":
      return { icon: { hud: "droplet" }, name: strings.debugSkipToRainChange(view.raining) };
  }
}

/** A log with its bark on or a debarked log, drawn with their approved build material icons. */
function logIcon(log: CarriedLog): QueueIcon {
  return { log };
}

/** The pot of water the player would drink from: boiled water if the backpack holds it, or else river water. */
function potHeld(view: GameView): BackpackContent {
  return (view.backpack.potOfBoiledWater ?? 0) > 0 ? "potOfBoiledWater" : "potOfRiverWater";
}
