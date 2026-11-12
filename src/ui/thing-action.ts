// The shape of one action the player can do to a thing. src/app/thing-actions.ts works out the actions.
// The action menu draws them. Both import the types from here, because the UI may not import the app.
import type { BackpackContent, CampfireFuel, CarriedLog, Command, DeliveredMaterial, RecipeKind, WoodpileWood } from "../sim/api";
import type { HudIconName } from "./hud-icons";

/** The icon an action shows: a HUD icon or a backpack content icon. */
export type ActionIcon = { readonly hud: HudIconName } | { readonly content: BackpackContent };

/** Every action's stable id. Code compares ids by this type, so a misspelt id does not compile. */
export type ActionId =
  | "walk"
  | "drink"
  | "chop"
  | "pickUp"
  | "debark"
  | "forage"
  | "light"
  | `addFuel:${CampfireFuel}`
  | "putPotOn"
  | "takePotOff"
  | `stack:${WoodpileWood}`
  | "stack:firewood:all"
  | `take:${WoodpileWood}`
  | `load:${CarriedLog}`
  | "tipOut"
  | "open"
  | "sleep"
  | "build"
  | `deliver:${DeliveredMaterial}`
  | "openMenu"
  | `craft:${RecipeKind}`
  | "takeDown"
  | "takeDownStructure"
  | "putInChest"
  | "putInChest:all"
  | "use"
  | "drop"
  | "split";

export interface ThingAction {
  /** Stable id for code and tests, such as "chop", "addFuel:firewood", or "stack:firewood:all". */
  readonly id: ActionId;
  /** The action's name, from strings.ts, such as "Chop" or "Add bark". */
  readonly label: string;
  readonly icon: ActionIcon;
  readonly enabled: boolean;
  /** Why it is disabled, such as "needs the axe" or "no bark". Present only when enabled is false. */
  readonly reason?: string;
  /** True for the left-click action. At most one per list, and always first. */
  readonly isMain: boolean;
  /** What to send. The sim walks the player there first when needed. Undefined only for UI-only actions such as "open menu" on a work station. */
  readonly command: Command | undefined;
}
