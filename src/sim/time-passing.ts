import type { PlainNotice } from "./api-notice";
import type { createCampfires } from "./campfires";
import { isWarmedByCampfire } from "./campfires";
import type { createCarrying } from "./carrying";
import type { createCooking } from "./cooking";
import { clockStartMinutes, isNightAt, MINUTES_PER_DAY, MINUTES_PER_HOUR, nextMorning, readClock, type Clock } from "./clock";
import type { createDryingRacks } from "./drying-racks";
import { type EntityStore } from "./entities";
import { isRaining, rainEntities } from "./entity-queries";
import type { createFiring } from "./firing";
import type { createFishTraps } from "./fish-traps";
import type { createForaging } from "./foraging";
import type { FreshFood } from "./fresh-food";
import { standingHeightAt } from "./foundations";
import type { Player } from "./game-player";
import { seasonMorning } from "./game-start";
import { hasCollapsed, passNeedsTime, wakeFromCollapse } from "./needs";
import type { createPot } from "./pot";
import { createRain, passRainTime, type Rain } from "./rain";
import type { createRainBarrels } from "./rain-barrels";
import type { createRegrowth } from "./regrowth";
import { isUnderRoof } from "./roofs";
import { isInSnugRoom } from "./rooms";
import { nextSeasonStartDay, seasonDayOf, type SeasonDay } from "./season";
import { passSicknessTime } from "./sickness";
import type { createSleds } from "./sleds";
import { snowOn } from "./snow-cover";
import type { createSpoiling } from "./spoiling";
import type { createStickFallSystem } from "./stick-fall";
import type { createStools } from "./stools";
import type { createTorches } from "./torches";
import type { Valley } from "./valley";
import { isWalkable, nearestWalkableSpot, type WalkMap } from "./walk-map";
import type { SleepPlace } from "./sleeping";

/** Skipped time runs in slices this many game minutes long. */
const PASS_TIME_SLICE_MINUTES = 1;

export interface TimePassingDeps {
  seed: number;
  entities: EntityStore;
  player: Player;
  valley: Valley;
  walkMap: WalkMap;
  clock: Clock;
  yearStartDay: number;
  /** The game minute the first night ends at. */
  firstMorning: number;
  /** Whether the first night has already ended, in a saved game. */
  firstNightOver: boolean;
  seasonNow: () => SeasonDay;
  isWinter: () => boolean;
  isWinterAt: (minutes: number) => boolean;
  /** Whether the player is working, and whether they are resting. */
  isWorking: () => boolean;
  isResting: () => boolean;
  showNotice: (notice: PlainNotice) => void;
  /** Tells the notices that fresh food has spoiled. */
  foodSpoiled: (food: FreshFood, count: number) => void;
  cancelTasks: () => void;
  emptyActionQueue: () => void;
  stools: ReturnType<typeof createStools>;
  torches: ReturnType<typeof createTorches>;
  carrying: ReturnType<typeof createCarrying>;
  sleds: ReturnType<typeof createSleds>;
  rainBarrels: ReturnType<typeof createRainBarrels>;
  campfires: ReturnType<typeof createCampfires>;
  foraging: ReturnType<typeof createForaging>;
  regrowth: ReturnType<typeof createRegrowth>;
  stickFall: ReturnType<typeof createStickFallSystem>;
  pot: ReturnType<typeof createPot>;
  cooking: ReturnType<typeof createCooking>;
  firing: ReturnType<typeof createFiring>;
  fishTraps: ReturnType<typeof createFishTraps>;
  dryingRacks: ReturnType<typeof createDryingRacks>;
  spoiling: ReturnType<typeof createSpoiling>;
}

/** The valley and the player moving on through game time: the clock, the weather, the player's needs, and a collapse. */
export function createTimePassing(deps: TimePassingDeps) {
  const { seed, entities, player, valley, walkMap, clock, yearStartDay, firstMorning, isWinter, isWinterAt } = deps;
  const { stools, torches, carrying, sleds } = deps;
  // A save made before rain existed has no weather, so it starts dry from here.
  const weather = rainEntities(entities).first ?? entities.add({ rain: createRain(seed, clock.minutes, yearStartDay) });
  entities.addComponent(weather, "snow", snowOn(readClock(clock.minutes), yearStartDay));
  const rain: Rain = weather.rain;
  /** Whether the first night has ended, by morning coming or by a collapse. */
  let firstNightOver = deps.firstNightOver;

  /**
   * Moves the valley on by this many game minutes: fires and torches burn, in the hand and planted, food and trees grow back,
   * sticks fall, pots and fish heat, rain barrels catch the rain falling now, set fish traps catch fish, food on drying racks dries
   * and smokes, and fresh food spoils.
   * `winter` says whether these minutes fall in winter, when food and trees do not grow and fish traps catch nothing.
   */
  function passWorldTime(minutes: number, winter: boolean): void {
    // Snow does not fill rain barrels.
    deps.rainBarrels.catchRain(minutes, isRaining(entities));
    deps.campfires.burn(minutes);
    torches.burn(minutes);
    deps.foraging.grow(minutes, winter);
    if (!winter) deps.regrowth.grow(minutes);
    deps.stickFall.pass(minutes);
    deps.pot.heat(minutes);
    deps.cooking.cook(minutes);
    deps.firing.fire(minutes);
    deps.fishTraps.pass(minutes, winter);
    // Food dries and smokes before it spoils, so food preserved in the same minute it would spoil keeps.
    // It comes after the fires burn, so a fire that went out does not smoke fish.
    deps.dryingRacks.preserve(minutes);
    for (const [food, count] of Object.entries(deps.spoiling.pass(clock.minutes)) as [FreshFood, number][]) deps.foodSpoiled(food, count);
  }

  /**
   * The player collapses from a neglected need. They drop what is on their shoulder and lose the rest of the day.
   * The lit torch in their hand goes out and is gone, as when they lie down to sleep.
   * They wake the next morning at their respawn point with that need low, keeping everything in their backpack.
   */
  function collapse(): void {
    // A collapse before the first morning means the player did not survive the first night.
    firstNightOver = true;
    deps.cancelTasks();
    deps.emptyActionQueue();
    stools.standUp();
    torches.putOut();
    carrying.drop();
    // The sled stays where the player fell, with its load.
    sleds.letGo();
    entities.removeComponent(player, "walkPath");
    // The valley moves on in two parts when midnight falls before morning, so a season that starts at midnight counts from then.
    const morning = nextMorning(clock.minutes, yearStartDay);
    const midnight = (Math.floor(clock.minutes / MINUTES_PER_DAY) + 1) * MINUTES_PER_DAY;
    let from = clock.minutes;
    for (const until of midnight < morning ? [midnight, morning] : [morning]) {
      clock.skip((until - from) / MINUTES_PER_HOUR);
      passWorldTime(until - from, isWinterAt(from));
      from = until;
    }
    // A bed blocks walking, so a player whose respawn point is a bed wakes on the open ground nearest it.
    const { x, z } = isWalkable(walkMap, player.respawnPoint)
      ? player.respawnPoint
      : (nearestWalkableSpot(walkMap, player.respawnPoint) ?? player.respawnPoint);
    Object.assign(player.position, { x, y: standingHeightAt(entities, valley.terrain, { x, z }), z });
    Object.assign(player.previousPosition, player.position);
    wakeFromCollapse(player.needs);
    deps.showNotice("collapsed");
  }

  /**
   * Moves the clock on by this many game minutes. Campfires burn and the player's needs change as it goes.
   * A long stretch, such as skipped time, runs in short slices, so night falling or a fire going out partway counts.
   * Rain starts and stops as it goes. A collapse ends the stretch early, and then this returns false.
   * `asleepIn` says what the player sleeps on through it, if they sleep.
   */
  function passTime(gameMinutes: number, asleepIn?: SleepPlace): boolean {
    for (let left = gameMinutes; left > 0; left -= PASS_TIME_SLICE_MINUTES) {
      const minutes = Math.min(PASS_TIME_SLICE_MINUTES, left);
      const winter = isWinter();
      clock.skip(minutes / MINUTES_PER_HOUR);
      passRainTime(rain, seed, clock.minutes);
      weather.snow = snowOn(readClock(clock.minutes), yearStartDay);
      // Rain does not put out campfires.
      passWorldTime(minutes, winter);
      const underRoof = isUnderRoof(entities, player.position);
      passNeedsTime(player.needs, minutes, {
        night: isNightAt(clock.minutes, yearStartDay),
        season: deps.seasonNow().season,
        warmedByCampfire: isWarmedByCampfire(entities, player.position),
        working: deps.isWorking(),
        asleep: asleepIn !== undefined,
        inBed: asleepIn === "bed",
        sitting: asleepIn === undefined && player.sitting !== undefined,
        sick: player.sickness !== undefined,
        // Snow chills the player as rain does.
        inRain: rain.falling && !underRoof,
        underRoof,
        inSnugRoom: isInSnugRoom(entities, player.position),
      });
      if (player.sickness !== undefined && passSicknessTime(player.sickness, minutes, { resting: deps.isResting() })) {
        entities.removeComponent(player, "sickness");
      }
      if (hasCollapsed(player.needs)) {
        collapse();
        return false;
      }
      if (!firstNightOver && clock.minutes >= firstMorning) {
        firstNightOver = true;
        deps.showNotice("survivedFirstNight");
      }
    }
    return true;
  }

  return {
    passTime,

    /** The snow lying on the valley now, if any. */
    snow: () => weather.snow,

    /** Whether the first night has ended, by morning coming or by a collapse. */
    firstNightOver: (): boolean => firstNightOver,

    /** Moves the clock on until rain starts or stops, slice by slice, so the skip stops on that minute, or at a collapse. */
    skipToRainChange(): void {
      const wasFalling = rain.falling;
      while (rain.falling === wasFalling) {
        if (!passTime(PASS_TIME_SLICE_MINUTES)) return;
      }
    },

    /**
     * Moves the clock on to the morning hour on day 1 of the next season. A collapse on the way does not stop it:
     * the player wakes the next morning and time passes on, so the skip always gets there.
     */
    skipToSeason(): void {
      const day = nextSeasonStartDay(readClock(clock.minutes).day, yearStartDay);
      const target = clockStartMinutes(seasonMorning(seasonDayOf(day, yearStartDay).season, day));
      while (clock.minutes < target) passTime(target - clock.minutes);
    },
  };
}

export type TimePassing = ReturnType<typeof createTimePassing>;
