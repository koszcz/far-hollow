// Every piece of furniture, by its kind. Each piece's data and rules live in its own definition file under src/sim/furniture/.
// Code that works the same way for every piece loops over FURNITURE and names no piece.
//
// A new piece adds these files:
// - src/sim/furniture/<piece>.ts, its definition: cost, build time, size, how it blocks walking, what it stores, and how the player uses it.
// - a behaviour file under src/sim/, if the piece does something of its own, such as stools.ts for sitting.
// - src/render/<piece>-meshes.ts, its model.
// - src/render/showcases/furniture/<piece>.ts, its asset showcase.
//
// It adds one line to each of these records. The type checker names each record that lacks it:
// - FURNITURE_KINDS in src/sim/structure-kind.ts, its name.
// - FURNITURE, below.
// - FURNITURE_MESHES in src/render/furniture-meshes.ts.
// - FURNITURE_SHOWCASES in src/render/showcases/furniture/index.ts.
// - FURNITURE_DRAWINGS in src/ui/furniture-icons.tsx, its build menu icon.
// - strings.buildMenu.structures in src/strings.ts, its name.
//
// It needs no save upgrade. Older saves hold none of it, and older code turns away a save that holds a name it does not know.
// Keep definition files apart from behaviour files. structures.ts imports the definitions, so a definition that imports
// structures.ts, or a file that imports it, makes an import loop that fails when the game loads.
import type { Command, PlainNotice } from "./api";
import type { BackpackContent } from "./backpack";
import type { Entity, ReachHeight } from "./entities";
import { BED } from "./furniture/bed";
import { CHEST } from "./furniture/chest";
import { SHELF } from "./furniture/shelf";
import { STOOL } from "./furniture/stool";
import { TABLE } from "./furniture/table";
import type { FurnitureKind } from "./structure-kind";
import type { MaterialCost } from "./structures";

/** What a piece of furniture that stores things can hold. */
export interface FurnitureStorage {
  /** The most it can hold, in kilograms. */
  readonly weightLimitKg: number;
  /** The notice that it has no room left. */
  readonly fullNotice: PlainNotice;
}

/**
 * How the player uses a finished piece of furniture: the use's name, and the command that does it for the piece with entity id `id`.
 * The action menu turns the name into its label and icon.
 */
export interface FurnitureUse {
  readonly name: "open" | "sleep" | "sit";
  readonly command: (id: number) => Command;
}

/**
 * One piece of furniture: its data and its own rules. `freelyPlaced` in structures.ts turns it into a structure for the build menu.
 * Every piece is placed freely, wherever the mouse points, and R turns it. It stands on the ground or on a foundation's deck,
 * never half on and half off one.
 */
export interface FurnitureDefinition<Kind extends FurnitureKind = FurnitureKind> {
  readonly kind: Kind;
  /** Everything building it costs, in the order the build menu shows it and construction spends it. */
  readonly cost: readonly MaterialCost[];
  /** The tool the player needs in the backpack to build it, if any. Building does not use it up. */
  readonly tool?: BackpackContent;
  /** How long the player holds the build action to build it, in seconds. */
  readonly buildSeconds: number;
  /** How far it reaches along x and along z when it faces the default way, in metres. */
  readonly size: { readonly x: number; readonly z: number };
  /**
   * How a finished piece blocks walking: within `radius` metres of its middle, or on every walk-map cell under it.
   * A radius of 0.71 m reaches the centre of every 1 m walk-map cell a small piece covers, even where four cells meet.
   */
  readonly blocks: { readonly radius: number } | "cellsUnder";
  /** What it can hold, if it stores small materials, tools, and food. A finished piece that stores things gets the `storage` part. */
  readonly storage?: FurnitureStorage;
  /** How high the player reaches to put things in it or take them out, if they do. */
  readonly reachHeight?: ReachHeight;
  /** How the player uses a finished piece, if they can. Every finished piece can also be taken down. */
  readonly use?: FurnitureUse;
}

/** Each piece of furniture by its kind. */
export const FURNITURE: { readonly [Kind in FurnitureKind]: FurnitureDefinition<Kind> } = {
  chest: CHEST,
  shelf: SHELF,
  bed: BED,
  table: TABLE,
  stool: STOOL,
};

/** The definition of the finished piece of furniture an entity is, if it is one. */
export function furnitureOf(entity: Entity | undefined): FurnitureDefinition | undefined {
  return entity?.furniture === undefined ? undefined : FURNITURE[entity.furniture];
}
