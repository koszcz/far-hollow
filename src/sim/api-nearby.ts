import type { BuildLack } from "./api-refusal";
import type { BackpackContent, BackpackContents } from "./backpack";
import type { FreshFood, Freshness } from "./fresh-food";
import type { PotWater } from "./pot-state";
import type { RackFood } from "./rack-food";
import type { KeptMaterial, StructureKind } from "./structure-kind";
import type { CarriedLog, WoodpileWood } from "./wood-and-fuel";

export interface CampfireView {
  /** The entity id of the campfire or fireplace. */
  readonly id: number;
  /** Whether the fire is a campfire or in a fireplace. */
  readonly kind: "campfire" | "fireplace";
  readonly lit: boolean;
  /** How full of fuel the campfire is, from 0 (empty) to 1 (it holds no more). */
  readonly fuelLeft: number;
  /** How many more game minutes the campfire's fuel can burn. */
  readonly fuelMinutes: number;
  /**
   * The pot on the campfire, or null if there is none. `water` says whether its water has boiled yet.
   * `boilProgress` runs from 0 to 1 while the water boils on the lit fire.
   */
  readonly pot: { readonly water: PotWater; readonly boilProgress: number } | null;
  /**
   * The fish on the campfire, in the order they went on. `cookProgress` runs from 0 to 1 while a fish cooks on the lit fire.
   * At 1 it is `cooked`, and it never burns.
   */
  readonly fish: readonly { readonly cooked: boolean; readonly cookProgress: number }[];
  /**
   * The jug on the campfire, or null if there is none. `fireProgress` runs from 0 to 1 while it fires on the lit fire.
   * At 1 it is `fired`, and it never breaks.
   */
  readonly jug: { readonly fired: boolean; readonly fireProgress: number } | null;
}

/** A blueprint, with how far it has been built and the materials carried to it. */
export interface BlueprintView {
  /** The blueprint's entity id. */
  readonly id: number;
  readonly structure: StructureKind;
  /** How far construction has gone, from 0 to 1. */
  readonly progress: number;
  /** For each material it keeps, such as debarked logs carried to it or planks: how many it has had and how many it needs. */
  readonly deliveries: readonly { readonly material: KeptMaterial; readonly has: number; readonly needs: number }[];
  /** What the player lacks to build the next stage, or null if they can build it now. */
  readonly lacks: BuildLack | null;
}

/** A woodpile, with how much of each kind of wood is stacked on it. */
export interface WoodpileView {
  /** The woodpile's entity id. */
  readonly id: number;
  /** How many of each kind of wood are stacked on it. */
  readonly contents: Readonly<Record<WoodpileWood, number>>;
  /** How many pieces of wood it holds in all. */
  readonly total: number;
  /** The most pieces of wood it holds in all, in any mix. */
  readonly capacity: number;
}

/** A chest or a shelf: the furniture that holds small materials, tools, and food, and opens in the chest panel. */
export type ChestOrShelf = "chest" | "shelf";

/**
 * An open chest or shelf, with what it holds. It holds small materials, tools, and food, grouped by kind like the backpack.
 * A shelf opens in the same panel as a chest.
 */
export interface ChestView {
  /** The chest's or shelf's entity id. */
  readonly id: number;
  /** Whether it is a chest or a shelf. */
  readonly furniture: ChestOrShelf;
  /** How many of each kind of thing it holds. Kinds it does not hold are missing. */
  readonly contents: Readonly<BackpackContents>;
  /** How much its contents weigh, in kilograms. */
  readonly weight: number;
  /** The most it can hold, in kilograms. */
  readonly weightLimit: number;
  /** How fresh the oldest of each fresh food in it is. A kind it holds none of is missing. See `GameView.backpackFreshness`. */
  readonly freshness: FreshnessViews;
}

/** How fresh the oldest of each fresh food in a holder is, by kind. A kind the holder holds none of is missing. */
export type FreshnessViews = Readonly<Partial<Record<FreshFood, Freshness>>>;

export interface BedrollView {
  /** The bedroll's entity id. */
  readonly id: number;
}

/** A parked sled, with how many logs, debarked logs, and planks lie on it. */
export interface SledView {
  /** The sled's entity id. */
  readonly id: number;
  /** How many logs, debarked logs, and planks lie on it. */
  readonly contents: Readonly<Record<CarriedLog | "plank", number>>;
  /** How many of its log spaces are full. Each plank fills a quarter of a log space, so it can be a fraction, such as 1.5. */
  readonly total: number;
  /** How many log spaces it has. Each holds one log, one debarked log, or four planks. */
  readonly capacity: number;
  /** How many more logs or debarked logs fit on it. */
  readonly logsThatFit: number;
  /** How many more planks fit on it. */
  readonly planksThatFit: number;
}

/** A finished rain barrel, with the clean water it holds. */
export interface RainBarrelView {
  /** The barrel's entity id. */
  readonly id: number;
  /** How many drinks of clean water it holds. */
  readonly drinks: number;
  /** The most drinks it holds. */
  readonly limit: number;
  /** Whether it stands under a roof, so it catches no rain. */
  readonly underRoof: boolean;
}

/** One food on a drying rack, as the rack's panel shows it. */
export interface FoodOnRackView {
  /** What was hung on the rack. */
  readonly food: RackFood;
  /** What it goes into the backpack as if taken off now: its preserved form once preserved, or else the fresh food. */
  readonly content: BackpackContent;
  /** True once it has dried or smoked, so it never spoils. */
  readonly preserved: boolean;
  /** How far it is through drying or smoking, from 0 to 1. */
  readonly progress: number;
  /** True if it is raw fish that is not smoking, because no lit campfire or fireplace stands close to the rack. */
  readonly waitsForFire: boolean;
}

/** A finished drying rack, with the food hanging on it. */
export interface DryingRackView {
  /** The rack's entity id. */
  readonly id: number;
  /** The food on the rack, in the order it was hung. */
  readonly food: readonly FoodOnRackView[];
  /** The most foods it holds. */
  readonly limit: number;
}

/** A finished wood box, with the firewood it holds. */
export interface WoodBoxView {
  /** The wood box's entity id. */
  readonly id: number;
  /** How many pieces of firewood it holds. */
  readonly firewood: number;
  /** The most firewood it holds. */
  readonly limit: number;
}

/** A pile of things the player dropped on the ground. */
export interface PileView {
  /** The pile's entity id. */
  readonly id: number;
  /** What kind of thing the pile holds. */
  readonly content: BackpackContent;
  /** How many things the pile holds. */
  readonly count: number;
}

/**
 * What the HUD shows for each kind of thing within the player's reach:
 * the campfire, the laid bedroll, the nearest pile, the woodpile, the chest the player has open, the nearest blueprint,
 * the nearest rain barrel, the nearest drying rack, and the nearest wood box.
 * A chest closes when the player walks away.
 */
export interface NearbyViews {
  readonly campfire: CampfireView;
  readonly bedroll: BedrollView;
  readonly pile: PileView;
  readonly woodpile: WoodpileView;
  readonly openChest: ChestView;
  readonly blueprint: BlueprintView;
  readonly rainBarrel: RainBarrelView;
  readonly dryingRack: DryingRackView;
  readonly woodBox: WoodBoxView;
}

/** One thing within the player's reach, with its kind. */
export type NearbyThing = { readonly [Kind in keyof NearbyViews]: { readonly kind: Kind; readonly view: NearbyViews[Kind] } }[keyof NearbyViews];
