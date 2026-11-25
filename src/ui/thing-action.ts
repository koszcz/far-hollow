// The shape of one action the player can do to a thing. src/app/thing-actions.ts works out the actions.
// The action menu draws them. Both import the types from here, because the UI may not import the app.
import type { BackpackContent, CampfireFuel, CarriedLog, CarriedThing, Command, Plantable, RecipeKind, WoodpileWood } from "../sim/api";
import type { HudIconName } from "./hud-icons";

/** The icon an action shows: a HUD icon or a backpack content icon. */
export type ActionIcon = { readonly hud: HudIconName } | { readonly content: BackpackContent };

/** Every action's stable id. Code compares ids by this type, so a misspelt id does not compile. */
export type ActionId =
  | "walk"
  | "drink"
  | "fish"
  | "setFishTrap"
  | "takeFish"
  | "gatherStone"
  | "digClay"
  | "digUp"
  | "chop"
  | "pickUp"
  | "debark"
  | "forage"
  | "light"
  | `addFuel:${CampfireFuel}`
  | "putPotOn"
  | "takePotOff"
  | "cookFish"
  | "takeFishOff"
  | "fireJug"
  | "takeJugOff"
  | `stack:${WoodpileWood}`
  | "stack:firewood:all"
  | `take:${WoodpileWood}`
  | `load:${CarriedLog}`
  | "load:plank"
  | "take:plank"
  | "tipOut"
  | "drag"
  | "letGo"
  | "open"
  | "sleep"
  | "layBedroll"
  | "sit"
  | "build"
  | "addOn"
  | `deliver:${CarriedThing}`
  | "openMenu"
  | `craft:${RecipeKind}`
  | "takeDown"
  | "takeDownStructure"
  | "putInChest"
  | "putInChest:all"
  | "use"
  | "drop"
  | "dropHere"
  | "split"
  | "fillPot"
  | "fillJug"
  | "pourIntoJug"
  | "drinkFromJug"
  | "putOut"
  | "plant"
  | "plantMushroom"
  | "openShutters"
  | "closeShutters";

export interface ThingAction {
  /** Stable id for code and tests, such as "chop", "addFuel:firewood", or "stack:firewood:all". */
  readonly id: ActionId;
  /** The action's name, from strings.ts, such as "Chop" or "Add bark". */
  readonly label: string;
  readonly icon: ActionIcon;
  readonly enabled: boolean;
  /** Why it is disabled, such as "needs the axe" or "no bark". Present only when enabled is false. */
  readonly reason?: string;
  /** True for the main action, which tops the action menu and which E and the number keys do. At most one per list, and always first. */
  readonly isMain: boolean;
  /**
   * What to send. The sim walks the player there first when needed. Undefined for actions the UI carries out itself:
   * "open menu" on a work station, and planting a sapling or berry bush, which sends its command only once the player clicks the ground.
   */
  readonly command: Command | undefined;
  /**
   * What planting from the backpack plants: a sapling or a berry bush. It sends no command itself. It puts a see-through sapling or
   * bush under the mouse instead, and a click on the ground sends the command that plants it there. Missing for every other action.
   */
  readonly startsPlanting?: Plantable;
}

/** Whether the action menu lists an action: it sends a command, or it starts planting a sapling or berry bush. */
export function isListed({ command, startsPlanting }: ThingAction): boolean {
  return command !== undefined || startsPlanting !== undefined;
}
