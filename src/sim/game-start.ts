import type { Notice, PlainNotice } from "./api-notice";
import type { ClockStart } from "./clock";
import type { SavedEntity } from "./entities";
import type { Journal } from "./journal";
import { firstDayOfSeason, NEW_GAME_YEAR_START_DAY, nightHoursOf, type Season } from "./season";

/** A new game starts on the morning of day 1. */
export const GAME_START: ClockStart = { day: 1, hour: 8 };

export interface GameOptions {
  /** Decides how the valley is laid out. The same seed always makes the same valley. */
  seed: number;
  /** Carries on a saved game instead of starting a new one. It must have been saved from a game with the same seed. */
  progress?: GameProgress;
  /** A notice to show the player as soon as the game starts. */
  startNotice?: PlainNotice;
  /** Lets the player build anything without spending materials or needing tools. The playground turns it on. It is never saved. */
  freeBuilding?: boolean;
  /**
   * Finishes every blueprint the moment it is placed, so nobody builds it. It also turns on free building.
   * The instant playground, `?playground&instant`, turns it on, so developers can put up a cabin fast. It is never saved.
   */
  instantBuilding?: boolean;
  /**
   * Marks done, with no notice, every journal goal the saved camp proves the player once did.
   * Loading a save made before the journal existed turns it on. It is never saved, so it runs only once for each save.
   */
  journalFromCamp?: boolean;
  /**
   * Starts a new game at the morning hour on day 1 of this season, instead of at GAME_START.
   * The playground's `&season=` sets it. It is ignored when carrying on a saved game.
   */
  startSeason?: Season;
}

/** How many game minutes the banner shows for when a season starts. One game minute is one real second. */
export const SEASON_BANNER_MINUTES = 30;

/** The morning of this day, which falls in this season: the season's morning hour, so winter mornings start at daylight. */
export function seasonMorning(season: Season, day: number): ClockStart {
  return { day, hour: nightHoursOf(season).morningHour };
}

/** Where a new game's clock starts: at GAME_START, or on the morning of day 1 of `startSeason` if given. */
export function newGameStart(startSeason: Season | undefined): ClockStart {
  if (startSeason === undefined) return GAME_START;
  return seasonMorning(startSeason, firstDayOfSeason(startSeason, NEW_GAME_YEAR_START_DAY));
}

/**
 * Everything about a game in progress that its seed does not decide. It is plain data, so it can be stored.
 * State kept in entity components is included without any change here.
 */
export interface GameProgress {
  /** Game minutes since midnight at the start of day 1. */
  clockMinutes: number;
  /** The day the year started on, which day 1 of spring falls on. The season follows from it and the day (see season.ts). */
  yearStartDay: number;
  stepCount: number;
  firstNightOver: boolean;
  /** Whether the banner saying a snug room keeps out the cold has shown. It shows once in each game. */
  snugRoomNoticeShown: boolean;
  /** The journal's goals done and whether the player hid it. A playground game keeps it as a new game has it. */
  journal: Journal;
  /** The notice showing now, with the game minute it stops showing at, or null if none shows. */
  notice: (Notice & { untilMinutes: number }) | null;
  /** Every entity, with the id that tasks and commands know it by. */
  entities: SavedEntity[];
}
