import type { BuildMenuEntry, CraftMenuEntry } from "./api-build-menu";
import type { ActionCommand } from "./api-commands";
import type { FreshnessViews, NearbyThing, NearbyViews, SledView } from "./api-nearby";
import type { Notice } from "./api-notice";
import type { BackpackContents } from "./backpack";
import type { BurnTime } from "./burn-time";
import type { TimeOfDay } from "./clock";
import type { Vec3 } from "./entities";
import type { GroundPoint } from "./ground-point";
import type { Goal } from "./journal";
import type { QuarterTurns } from "./quarter-turns";
import type { NightHours, Season, SeasonDay } from "./season";
import type { CarriedThing } from "./wood-and-fuel";

export interface GameView {
  /** The seed the valley was laid out from. */
  readonly seed: number;
  readonly paused: boolean;
  /** Logic steps run since the game started. */
  readonly stepCount: number;
  readonly entityCount: number;
  /** Where the player stands after the latest logic step, in metres. */
  readonly playerPosition: Readonly<Vec3>;
  /** The valley's clock: which day it is and the time of day. */
  readonly time: TimeOfDay;
  /** Whether it is night now, by the game's own hours. The HUD shows the moon instead of the sun. */
  readonly night: boolean;
  /** When night starts and morning arrives today. They follow today's season. The sky, daylight, and HUD words follow them. */
  readonly nightHours: NightHours;
  /** The season today, which day of it today is, and how many days it lasts. */
  readonly season: SeasonDay;
  /** Whether a winter has come before today. A new game's first spring has none, so it has no snow to melt and its leaves are green. */
  readonly afterFirstWinter: boolean;
  /** The season that has just started, while the HUD's banner says so, or else null. It is not saved. */
  readonly seasonBanner: Season | null;
  /** How many of each tool and material the player's backpack holds. */
  readonly backpack: Readonly<BackpackContents>;
  /**
   * How fresh the oldest of each fresh food in the backpack is: how long it has left before it spoils, and that as a share
   * of its whole keeping time. A kind the backpack holds none of is missing. The hotbar shows it.
   */
  readonly backpackFreshness: FreshnessViews;
  /** How much the backpack's contents weigh, in kilograms. */
  readonly backpackWeight: number;
  /** The most the backpack can hold, in kilograms. */
  readonly backpackWeightLimit: number;
  /** Every structure the player can build from the build menu, with its cost, in the order it lists them. Add-ons are not among them. */
  readonly buildMenu: readonly BuildMenuEntry[];
  /** Every recipe, in the order the craft menu lists them, with what the player lacks to follow each one now. */
  readonly craftMenu: readonly CraftMenuEntry[];
  /** The timed work the player is doing right now, or null if none. Walking to the work does not count. */
  readonly action: PlayerAction | null;
  /** What the player carries outside the backpack, or null if nothing: a log on the shoulder, or a plank or stone in the hands. */
  readonly carrying: CarriedThing | null;
  /** The sled the player drags behind them, or null if none. */
  readonly dragging: SledView | null;
  /**
   * The lit torch in the player's hand, or null if they hold none: how long it still burns. `burnShare` gives that as a share
   * of its whole burning time. It lights the ground within TORCH_LIGHT_METRES of the player.
   */
  readonly litTorch: BurnTime | null;
  /** Every torch planted in the ground, in no set order. Each burns down as the one in the hand does, sleep included. */
  readonly plantedTorches: readonly PlantedTorchView[];
  /**
   * The things within the player's reach that the HUD shows a panel for, at most one of each kind, in the order the HUD shows them.
   * `nearbyOf` finds one kind.
   */
  readonly nearby: readonly NearbyThing[];
  /** How full each of the player's needs is, from 0 (empty) to 1 (full). */
  readonly needs: Readonly<Record<"hunger" | "thirst" | "warmth" | "fatigue", number>>;
  /** How warm the player is, from 0 (frozen) to 1 (fully warm). The same as `needs.warmth`. The HUD shows it. */
  readonly warmth: number;
  /** Whether the player is sick, so their needs drain faster. */
  readonly sick: boolean;
  /** Whether rain is falling in the valley. False while snow falls in its place. */
  readonly raining: boolean;
  /** Whether snow is falling in the valley, as rain does in every other season. */
  readonly snowing: boolean;
  /** How deep the snow cover lies, from 0 (none) to 1 (full). It follows the calendar, not the snowfall. */
  readonly snowCover: number;
  /** A short message to show the player about something that just happened, or null if there is none. */
  readonly notice: Notice | null;
  /**
   * The player's last sleep on a bedroll or in a bed since the game was loaded, or null if none. `count` goes up by one with each
   * sleep, so drawing can tell a new one. `at` is the middle of the bedroll or bed. Drawing plays the sleep animation from it.
   */
  readonly lastSleep: SleepView | null;
  /**
   * The player's last bite of food or drink of water since the game was loaded, or null if none. `count` goes up by one
   * with each, so drawing can tell a new one and play its motion once. It is not saved.
   */
  readonly lastEatOrDrink: EatOrDrinkView | null;
  /** The entity id of the stool the player sits on, or null if they are not sitting. */
  readonly sittingOn: number | null;
  /**
   * The player's reach to pick something up or put something down, or null if they are not reaching.
   * `height` is "low" for the ground and "waist" for a woodpile, chest, or sled. The hand gets to the thing, and the
   * command is carried out, `seconds` = HAND_AT_SECONDS into the reach. See hand-reach.ts.
   */
  readonly reach: ReachView | null;
  /**
   * The action queue: the action under way first, then the actions waiting their turn, in order. Empty when the player
   * is doing nothing they were asked to do. It holds at most ACTION_QUEUE_LIMIT actions. It is not saved.
   */
  readonly actionQueue: readonly ActionCommand[];
  /** The journal, or null in the playground, which has no journal. See JournalView. */
  readonly journal: JournalView | null;
}

/**
 * The journal of suggested goals. `done` lists the goals done, in the order the player did them. `nextGoal` gives the first
 * goal not yet done. `hidden` says whether the player hid the journal's next-goal line and its notices.
 * `justDone` is the goal the player has just done for the first time, while the notice banner says so, or else null.
 * It has its own place in the view, so it never hides another notice or waits behind one. It is never set while the journal is hidden.
 */
export interface JournalView {
  readonly done: readonly Goal[];
  readonly hidden: boolean;
  readonly justDone: Goal | null;
}

/** A torch planted in the ground, given by its entity id: where it stands and how long it still burns. See `GameView.plantedTorches`. */
export interface PlantedTorchView extends BurnTime {
  readonly id: number;
  readonly position: Readonly<Vec3>;
}

/** How far a lit torch lights the ground around it, in metres. Drawing uses it for the torch's light. */
export const TORCH_LIGHT_METRES = 6;

/** A reach in progress. See `GameView.reach`. */
export interface ReachView {
  readonly height: "low" | "waist";
  readonly seconds: number;
}

/**
 * One bite of food or drink of water. See `GameView.lastEatOrDrink`. `kind` says which: eating from the backpack,
 * drinking from the river, or drinking from the pot. `toward` is the spot on the river, for a drink from the river.
 */
export interface EatOrDrinkView {
  readonly count: number;
  readonly kind: "eat" | "drinkFromRiver" | "drinkFromPot" | "drinkFromJug";
  readonly toward?: Readonly<GroundPoint>;
}

/** One sleep on a bedroll or in a bed. See `GameView.lastSleep`. */
export interface SleepView {
  readonly count: number;
  readonly at: Readonly<GroundPoint>;
  /** Present for a sleep in a bed, with which way the bed faces. Missing for a sleep on a bedroll. */
  readonly bed?: { readonly turns: QuarterTurns };
  /** Present for a sleep on a bedroll laid turned, such as in a lean-to, with which way it faces. Missing for a bed or a bedroll laid along z. */
  readonly bedroll?: { readonly turns: QuarterTurns };
}

export interface PlayerAction {
  /**
   * Chopping a tree, splitting a log into firewood, debarking a log, building a blueprint, taking down a finished piece, crafting,
   * fishing, gathering stone, digging clay, digging up a sapling, planting one, or planting a mushroom on a log.
   */
  readonly kind: "chop" | "split" | "debark" | "build" | "takeDown" | "craft" | "fish" | "gatherStone" | "digClay" | "digUp" | "plant" | "plantMushroom";
  /** How far along the work is, from 0 to 1. While fishing, how far through the wait for the next fish. */
  readonly progress: number;
}

/** The thing of this kind within the player's reach, or null if none is. */
export function nearbyOf<Kind extends keyof NearbyViews>(view: GameView, kind: Kind): NearbyViews[Kind] | null {
  const found = view.nearby.find((thing) => thing.kind === kind);
  return found === undefined ? null : (found.view as NearbyViews[Kind]);
}
