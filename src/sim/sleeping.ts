import type { SleepView } from "./api-game-view";
import type { BedEntity } from "./beds";
import type { BedrollEntity } from "./bedrolls";
import type { createCarrying } from "./carrying";
import type { Clock } from "./clock";
import { isNightAt, nextMorning } from "./clock";
import type { EntityStore } from "./entities";
import type { Player } from "./game-player";
import type { GroundPoint } from "./ground-point";
import type { Goal } from "./journal";
import { minutesToRestFully } from "./needs";
import { isUnderRoof } from "./roofs";
import type { createSleds } from "./sleds";
import type { createTorches } from "./torches";

/** What the player sleeps on. */
export type SleepPlace = "bedroll" | "bed";

export interface SleepingDeps {
  entities: EntityStore;
  player: Player;
  clock: Clock;
  yearStartDay: number;
  torches: ReturnType<typeof createTorches>;
  carrying: ReturnType<typeof createCarrying>;
  sleds: ReturnType<typeof createSleds>;
  /** Moves the clock on, with the player asleep on this. Returns false if a collapse cut it short. */
  passTime: (gameMinutes: number, asleepIn: SleepPlace) => boolean;
  reachGoal: (goal: Goal) => void;
}

/** The player lying down and sleeping, on a bedroll or in a bed. */
export function createSleeping({ entities, player, clock, yearStartDay, torches, carrying, sleds, passTime, reachGoal }: SleepingDeps) {
  /** The player's last sleep since the game was loaded. It is not saved. */
  let lastSleep: SleepView | null = null;

  /**
   * The player puts down what they hold to lie down at `spot`, which becomes their respawn point.
   * The game puts out the lit torch in their hand, which is then gone, as after putting it out.
   */
  function lieDown(spot: GroundPoint): void {
    torches.putOut();
    carrying.drop();
    sleds.letGo();
    entities.removeComponent(player, "walkPath");
    player.respawnPoint = { x: spot.x, z: spot.z };
  }

  /**
   * The player sleeps where they lie. At night they sleep until morning. By day they sleep until fatigue is restored.
   * If that would wake them in the night, such as after lying down in the evening, they sleep on until morning.
   * Returns false if a collapse cut sleep short.
   */
  function sleep(asleepIn: SleepPlace): boolean {
    const untilMorning = nextMorning(clock.minutes, yearStartDay) - clock.minutes;
    const toRestFully = minutesToRestFully(player.needs, isUnderRoof(entities, player.position), asleepIn === "bed");
    const wakesAtNight = isNightAt(clock.minutes + toRestFully, yearStartDay);
    return passTime(wakesAtNight ? untilMorning : Math.min(untilMorning, toRestFully), asleepIn);
  }

  /**
   * Records a sleep at `spot` for drawing to play. `bed` says which way the bed faces, for a sleep in a bed.
   * `bedroll` says which way a turned bedroll faces, for a sleep on one.
   */
  function reportSleep(spot: GroundPoint, bed?: SleepView["bed"], bedroll?: SleepView["bedroll"]): void {
    const at = Object.freeze({ x: spot.x, z: spot.z });
    const count = (lastSleep?.count ?? 0) + 1;
    lastSleep = Object.freeze({
      count,
      at,
      ...(bed === undefined ? {} : { bed: Object.freeze({ ...bed }) }),
      ...(bedroll === undefined ? {} : { bedroll: Object.freeze({ ...bedroll }) }),
    });
  }

  return {
    /** The player's last sleep since the game was loaded, or null. */
    last: (): SleepView | null => lastSleep,

    /**
     * The player lies down on a bedroll and sleeps. The bedroll becomes their respawn point.
     * At night they sleep until morning. By day they sleep until fatigue is restored. If that would wake them in the night, they sleep on until morning.
     */
    sleepOn(bedroll: BedrollEntity): void {
      lieDown(bedroll.position);
      Object.assign(player.position, bedroll.position);
      Object.assign(player.previousPosition, player.position);
      sleep("bedroll");
      reachGoal("sleepOnBedroll");
      reportSleep(bedroll.position, undefined, bedroll.facing === undefined ? undefined : { turns: bedroll.facing.turns });
    },

    /**
     * The player lies down in a bed and sleeps, by the same rules as on a bedroll, but regains fatigue twice as fast.
     * The spot where the bed stands becomes their respawn point. They lie in the bed while they sleep, so a roof over the bed counts.
     * The bed blocks walking, so they wake standing where they were beside it, unless a collapse cut sleep short.
     */
    sleepIn(bed: BedEntity): void {
      lieDown(bed.position);
      const standing = { ...player.position };
      Object.assign(player.position, bed.position);
      if (sleep("bed")) Object.assign(player.position, standing);
      Object.assign(player.previousPosition, player.position);
      reportSleep(bed.position, { turns: bed.facing?.turns ?? 0 });
    },
  };
}

export type Sleeping = ReturnType<typeof createSleeping>;
