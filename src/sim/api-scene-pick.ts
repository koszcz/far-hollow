import type { BackpackContent, WildFood } from "./backpack";
import type { GroundPoint } from "./ground-point";
import type { HostKind } from "./structure-kind";
import type { FurnitureKind, StructureKind, WorkStationKind } from "./structures";

/**
 * A thing in the world the player can act on with E, given by its entity id, with its kind.
 * What the scene reports under the cursor is built from this type, so the app can treat both the same way.
 * A `mushroomLog` is a log the player planted a mushroom on, with mushrooms or growing them back.
 * A `youngTree` is a tree growing back, too young to chop. A `sapling` grows on a stump, or where the player planted it. A `stump` is a bare stump:
 * the player can click it, but E never reaches it, so it does not hide the logs lying beside it.
 */
export type ThingInReach =
  | {
      readonly kind:
        | "tree"
        | "youngTree"
        | "sapling"
        | "stump"
        | "log"
        | "debarkedLog"
        | "stick"
        | "bark"
        | "forage"
        | "mushroomLog"
        | "blueprint"
        | "campfire"
        | "fireplace"
        | "woodpile"
        | "bedroll"
        | "pile"
        | "sled"
        | "plantedTorch"
        | "fishTrap"
        | "shutters";
      readonly id: number;
    }
  | { readonly kind: "workStation"; readonly id: number; readonly station: WorkStationKind }
  /** A finished piece of furniture. `furniture` names the piece. */
  | { readonly kind: "furniture"; readonly id: number; readonly furniture: FurnitureKind };

/**
 * What is under a point on the screen, as the scene reports it. Everything but the ground and the river is given by its entity id.
 * A finished lean-to, foundation, log wall, door frame, window, roof frame, or roof section is a `structure`.
 * Most clicks act on what is `under` it, as if it were not there, so the player can still walk onto a foundation or place a wall on it.
 * Every other thing is a ThingInReach, so the app treats a click and the E key the same way.
 */
export type ScenePick =
  | { kind: "structure"; id: number; structure: StructureKind; under: GroundOrThingPick | undefined }
  /** Open ground. `riverBank` is true on river bank ground, where the player can gather stone and dig clay. */
  | { kind: "ground"; spot: GroundPoint; riverBank?: true }
  | { kind: "river"; spot: GroundPoint }
  | ThingInReach;

/** A pick that landed on anything but a finished structure. */
export type GroundOrThingPick = Exclude<ScenePick, { kind: "structure" }>;

/**
 * What a thing in the world is, given by its entity id. The action queue shows it as the icon of an action on it.
 * A blueprint or finished structure gives its structure, a forage spot its food, and a pile what it holds.
 * Shutters have a variant of their own: finished shutters also say whether they are `open`. A shutters blueprint does not.
 * A finished host also says whether it `holdsAddOn`, finished or as a blueprint. A host blueprint does not.
 */
export type ThingView =
  | { readonly kind: "structure"; readonly structure: Exclude<StructureKind, "shutters" | HostKind> }
  | { readonly kind: "structure"; readonly structure: HostKind; readonly holdsAddOn?: boolean }
  | { readonly kind: "structure"; readonly structure: "shutters"; readonly open?: boolean }
  | { readonly kind: "forage"; readonly food: WildFood }
  | { readonly kind: "pile"; readonly content: BackpackContent }
  /** A set fish trap, with whether it holds a fish. */
  | { readonly kind: "fishTrap"; readonly holdsFish: boolean }
  | { readonly kind: "tree" | "sapling" | "stump" | "log" | "debarkedLog" | "stick" | "bark" | "bedroll" };
