// Fishing at the river with the fishing rod. The player walks to the bank, casts there, and waits for a fish to bite.
// Each fish goes in the backpack, and the player casts again until they stop or a fish gets away.
import type { PlainNotice } from "./api-notice";
import type { Refusal } from "./api-refusal";
import type { ApproachReach } from "./approach";
import type { CommandRules } from "./command-rule";
import { addToBackpack } from "./backpack";
import { riverReach } from "./drinking";
import { setComponent, type Entity, type EntityStore } from "./entities";
import { playerEntities } from "./entity-queries";
import { createRandom, scramble } from "./random";
import { toolRefusal } from "./refusals";
import type { Valley } from "./valley";
import type { GroundPoint } from "./ground-point";
import type { WalkMap } from "./walk-map";

/** The shortest and longest wait for a fish to bite after a cast, in game minutes. */
export const FISH_MIN_WAIT_MINUTES = 15;
export const FISH_MAX_WAIT_MINUTES = 45;
/** Mixes the cast number into the seed, so each cast gets its own random wait. */
const CAST_SEED_STEP = 0x85ebca6b;

/** How long the player waits for a fish after their cast number `cast`, counting from 0, in whole game minutes. */
export function fishWaitMinutes(seed: number, cast: number): number {
  const random = createRandom(scramble(seed + Math.imul(cast + 1, CAST_SEED_STEP)));
  return Math.round(FISH_MIN_WAIT_MINUTES + random() * (FISH_MAX_WAIT_MINUTES - FISH_MIN_WAIT_MINUTES));
}

/** How far through the wait for the next fish the player is, from 0 to 1, or undefined if they are not fishing now. */
export function fishingNow(player: Entity): { progress: number } | undefined {
  if (player.fishTask === undefined) return undefined;
  return { progress: Math.min(1, player.fishTask.minutesWaited / player.fishTask.biteAfterMinutes) };
}

export interface Fishing {
  /** Where the approach takes the player to fish toward a spot on the river: the river bank nearest it. */
  reach(spot: GroundPoint): ApproachReach | undefined;
  /**
   * Casts toward a spot on the river, once the player stands on the bank, and starts the wait for a fish.
   * The approach runs it once they arrive. The game calls it only once `refusal` passes.
   */
  fish(spot: GroundPoint): void;
  /** Why the player could not fish now: without the fishing rod, while they carry a log, or while the river is frozen. */
  refusal(): Refusal | undefined;
  /** Stops the player fishing. */
  cancel(): void;
  /**
   * Whether a fish has bit on this fishing trip, the one the latest `fish` began, and the player fishes still.
   * A queued fishing trip with another action waiting stops once one has. The trip is not saved.
   */
  hasFishBitten(): boolean;
  /**
   * Moves fishing on by one logic step. A fish that bites goes in the backpack and the player casts again.
   * Returns "fishGotAway" if a fish bit while the backpack was full, which stops fishing.
   */
  step(): PlainNotice | undefined;
}

/**
 * Lets the player fish at the river. `seed` decides how long each cast waits for a fish.
 * Fish bite after a wait in game time, `stepGameMinutes` for each logic step, which a player slowed by a low need does not stretch.
 * `isRiverFrozen` says whether the river is frozen now, in winter. Nobody fishes then, and a player fishing when it freezes stops.
 */
export function createFishing(
  entities: EntityStore,
  walkMap: WalkMap,
  valley: Valley,
  seed: number,
  stepGameMinutes: number,
  isRiverFrozen: () => boolean,
): Fishing {
  const players = playerEntities(entities);
  const fishers = entities.with("player", "fishTask", "position", "backpack");
  /** How many casts each player had made once they cast at the start of their latest fishing trip. It is not saved. */
  const castsWhenTripBegan = new Map<Entity, number>();

  /** Why this player could not fish now: while the river is frozen, without the fishing rod, or while they carry a log. */
  function refusalFor(player: Entity | undefined): Refusal | undefined {
    if (isRiverFrozen()) return { kind: "riverFrozen" };
    return toolRefusal(player, "fishingRod") ?? (player?.carrying === undefined ? undefined : { kind: "putLogDownFirst" });
  }

  /** Casts the line: starts a new wait for a fish and counts the cast. */
  function cast(player: Entity, spot: GroundPoint): void {
    const casts = player.fishCasts ?? 0;
    setComponent(entities, player, "fishTask", { x: spot.x, z: spot.z, minutesWaited: 0, biteAfterMinutes: fishWaitMinutes(seed, casts) });
    setComponent(entities, player, "fishCasts", casts + 1);
  }

  return {
    reach(spot) {
      const player = players.first;
      return player === undefined ? undefined : riverReach(valley, walkMap, player.position, spot);
    },
    fish(spot) {
      for (const player of players) {
        cast(player, spot);
        castsWhenTripBegan.set(player, player.fishCasts ?? 0);
      }
    },
    refusal: () => refusalFor(players.first),
    hasFishBitten() {
      const player = players.first;
      if (player === undefined || fishingNow(player) === undefined) return false;
      // The player casts again each time a fish bites.
      return (player.fishCasts ?? 0) > (castsWhenTripBegan.get(player) ?? Infinity);
    },
    cancel() {
      for (const player of [...fishers]) entities.removeComponent(player, "fishTask");
    },
    step() {
      const gameMinutes = stepGameMinutes;
      let notice: PlainNotice | undefined;
      // Copy the list first, because players who stop fishing leave the query while it is being walked.
      for (const fisher of [...fishers]) {
        // The player stops if they could no longer fish, such as without the rod.
        if (refusalFor(fisher) !== undefined) {
          entities.removeComponent(fisher, "fishTask");
          continue;
        }
        const task = fisher.fishTask;
        task.minutesWaited += gameMinutes;
        if (task.minutesWaited < task.biteAfterMinutes) continue;
        if (!addToBackpack(fisher.backpack, "rawFish", 1)) {
          entities.removeComponent(fisher, "fishTask");
          notice = "fishGotAway";
          continue;
        }
        cast(fisher, task);
      }
      return notice;
    },
  };
}

/** The rule for fishing. */
export function fishingRules(fishing: Fishing): CommandRules<"fish"> {
  return {
    fish: {
      start: "fresh",
      needsFreeHands: true,
      refusal: () => fishing.refusal(),
      approach: {
        reach: (command) => fishing.reach(command),
        act: (command) => {
          fishing.fish({ x: command.x, z: command.z });
        },
      },
      // Fishing has no end. A queued fishing trip catches one fish when another action waits.
      canStopForNext: () => fishing.hasFishBitten(),
    },
  };
}
