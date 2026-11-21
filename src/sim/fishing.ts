// Fishing at the river with the fishing rod. The player walks to the bank, casts, and waits for a fish to bite.
// Each fish goes in the backpack, and the player casts again until they stop or a fish gets away.
import type { PlainNotice, Refusal } from "./api";
import { addToBackpack } from "./backpack";
import { canReachRiver } from "./drinking";
import { playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import { createRandom, scramble } from "./random";
import { toolRefusal } from "./refusals";
import type { Valley } from "./valley";
import type { GroundPoint } from "./ground-point";
import { nearestWalkableSpot } from "./walk-map";
import type { Walking } from "./walking";

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

/** How far through the wait for the next fish the player is, from 0 to 1, or undefined if they are not fishing now. Walking there does not count. */
export function fishingNow(player: Entity): { progress: number } | undefined {
  if (player.fishTask === undefined || player.walkPath !== undefined) return undefined;
  return { progress: Math.min(1, player.fishTask.minutesWaited / player.fishTask.biteAfterMinutes) };
}

export interface Fishing {
  /** Walks the player to the river bank nearest a spot on the river, then fishes there. The game calls it only once `refusal` passes. */
  fish(spot: GroundPoint): void;
  /** Why the player could not fish now: without the fishing rod, or while they carry a log. */
  refusal(): Refusal | undefined;
  /** Stops the player fishing, or walking to fish. */
  cancel(): void;
  /**
   * Moves fishing on by one logic step. A fish that bites goes in the backpack and the player casts again.
   * Returns "fishGotAway" if a fish bit while the backpack was full, which stops fishing.
   */
  step(): PlainNotice | undefined;
}

/**
 * Lets the player fish at the river. `seed` decides how long each cast waits for a fish.
 * Fish bite after a wait in game time, `stepGameMinutes` for each logic step, which a player slowed by a low need does not stretch.
 */
export function createFishing(entities: EntityStore, walking: Walking, valley: Valley, seed: number, stepGameMinutes: number): Fishing {
  const players = playerEntities(entities);
  const fishers = entities.with("player", "fishTask", "position", "backpack");

  /** Why this player could not fish now: without the fishing rod, or while they carry a log. */
  function refusalFor(player: Entity | undefined): Refusal | undefined {
    return toolRefusal(player, "fishingRod") ?? (player?.carrying === undefined ? undefined : { kind: "putLogDownFirst" });
  }

  /** Casts the line: starts a new wait for a fish and counts the cast. */
  function cast(player: Entity, spot: GroundPoint): void {
    const casts = player.fishCasts ?? 0;
    setComponent(entities, player, "fishTask", { x: spot.x, z: spot.z, minutesWaited: 0, biteAfterMinutes: fishWaitMinutes(seed, casts) });
    setComponent(entities, player, "fishCasts", casts + 1);
  }

  return {
    fish(spot) {
      for (const player of players) {
        cast(player, spot);
        walking.walkTo(nearestWalkableSpot(walking.walkMap, spot) ?? spot);
      }
    },
    refusal: () => refusalFor(players.first),
    cancel() {
      for (const player of [...fishers]) entities.removeComponent(player, "fishTask");
    },
    step() {
      const gameMinutes = stepGameMinutes;
      let notice: PlainNotice | undefined;
      // Copy the list first, because players who stop fishing leave the query while it is being walked.
      for (const fisher of [...fishers]) {
        if (fisher.walkPath !== undefined) continue;
        // The player stops if they could not get near enough to the water, or could no longer fish, such as without the rod.
        if (!canReachRiver(valley, fisher.position) || refusalFor(fisher) !== undefined) {
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
