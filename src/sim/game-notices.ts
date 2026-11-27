import type { Notice, PlainNotice } from "./api";
import type { Clock } from "./clock";
import { addCount, holdsNone, type Counts } from "./counts";
import { deepFreeze } from "./deep-freeze";
import type { EntityStore } from "./entities";
import type { FreshFood } from "./fresh-food";
import type { Player } from "./game-player";
import type { GameProgress } from "./game-start";
import { GOAL_NOTICE_MINUTES, goalsProvenByCamp, markGoalDone, newJournal, newlyShownGoals, type Goal, type Journal } from "./journal";
import { NOTICE_MINUTES } from "./notices";
import { isInSnugRoom } from "./rooms";
import type { Season, SeasonDay } from "./season";
import { SEASON_BANNER_MINUTES } from "./game-start";

export interface GameNoticesDeps {
  entities: EntityStore;
  player: Player;
  clock: Clock;
  freeBuilding: boolean;
  /** The saved game being carried on, if any. */
  progress: GameProgress | undefined;
  /** Whether to mark done every journal goal the saved camp proves. */
  journalFromCamp: boolean;
  seasonNow: () => SeasonDay;
}

/** The notice, season banner, and journal goal notices the player sees, and the journal behind them. */
export function createGameNotices({ entities, player, clock, freeBuilding, progress, journalFromCamp, seasonNow }: GameNoticesDeps) {
  /** The season the banner last said had started, or the season the game began in. It is not saved. */
  let announcedSeason = seasonNow().season;
  /** The season that has just started, with the game minute its banner stops showing at, or null. It is not saved. */
  let seasonBanner: { season: Season; untilMinutes: number } | null = null;
  let snugRoomNoticeShown = progress?.snugRoomNoticeShown ?? false;
  const journal: Journal = progress?.journal === undefined ? newJournal() : structuredClone(progress.journal);
  if (journalFromCamp && !freeBuilding) for (const goal of goalsProvenByCamp(entities, player)) markGoalDone(journal, goal);
  /** Goals done that no notice has said so yet, oldest first. Each waits for the one before to go. It is not saved. */
  const goalsToAnnounce: Goal[] = [];
  /** The goal the journal's notice says is done now, with the game minute it stops showing at, or null. It is not saved. */
  let goalNotice: { goal: Goal; untilMinutes: number } | null = null;
  let notice: (Notice & { untilMinutes: number }) | null = progress?.notice ? structuredClone(progress.notice) : null;
  /** Fresh food that has spoiled since a notice last said so, by kind. It waits while another notice shows. It is not saved. */
  let spoiledToTell: Counts<FreshFood> = {};

  /** Shows a notice for as long as its kind shows. A plain notice can be given by its kind alone. */
  function show(shown: Notice | PlainNotice): void {
    const full: Notice = typeof shown === "string" ? { kind: shown } : shown;
    notice = { ...structuredClone(full), untilMinutes: clock.minutes + NOTICE_MINUTES[full.kind] };
  }

  /** Shows the notice if what the player tried was refused. */
  function refuseWith(refusal: Notice | PlainNotice | undefined): void {
    if (refusal !== undefined) show(refusal);
  }

  /** Whether a notice shows on screen now. */
  function isOnScreen(): boolean {
    return notice !== null && clock.minutes < notice.untilMinutes;
  }

  /** The notice as the view shows it: without the minute it stops showing at. Null if none shows. */
  function shownNotice(): Notice | null {
    if (notice === null || !isOnScreen()) return null;
    const fields = Object.entries(structuredClone(notice)).filter(([key]) => key !== "untilMinutes");
    return deepFreeze(Object.fromEntries(fields) as Notice);
  }

  /** The goal the journal's notice says is done now, or null if it shows none. */
  function goalNoticeShown(): Goal | null {
    return goalNotice !== null && clock.minutes < goalNotice.untilMinutes ? goalNotice.goal : null;
  }

  /**
   * Marks a journal goal done, the first time the player does it, and queues a notice saying so unless the journal is hidden.
   * The playground has no journal, so nothing is marked there.
   */
  function reachGoal(goal: Goal): void {
    if (freeBuilding || !markGoalDone(journal, goal)) return;
    if (!journal.hidden) goalsToAnnounce.push(goal);
  }

  return {
    show,
    refuseWith,
    isOnScreen,
    shownNotice,

    /** The journal as the view shows it. The playground has no journal. */
    journalView() {
      return freeBuilding ? null : deepFreeze({ ...structuredClone(journal), justDone: goalNoticeShown() });
    },

    /** The season whose banner shows now, or null. */
    seasonBannerShown(): Season | null {
      return seasonBanner !== null && clock.minutes < seasonBanner.untilMinutes ? seasonBanner.season : null;
    },

    /** The part of a game's progress that notices and the journal keep. */
    saved() {
      return { snugRoomNoticeShown, journal, notice };
    },

    reachGoal,

    /** Hides or shows the journal. Goals done while the journal is hidden are never announced. */
    hideJournal(hidden: boolean): void {
      journal.hidden = hidden;
      if (!hidden) return;
      goalsToAnnounce.splice(0);
      goalNotice = null;
    },

    /** Notes that fresh food has spoiled, so a notice can say so. */
    foodSpoiled(food: FreshFood, count: number): void {
      spoiledToTell = addCount(spoiledToTell, food, count);
    },

    /** Marks done every journal goal the valley shows the player has done, then says so for the oldest waiting, once the last such notice has gone. */
    noteGoals(): void {
      if (freeBuilding) return;
      for (const goal of newlyShownGoals(journal, entities, player)) reachGoal(goal);
      if (goalNoticeShown() !== null) return;
      const goal = goalsToAnnounce.shift();
      goalNotice = goal === undefined ? null : { goal, untilMinutes: clock.minutes + GOAL_NOTICE_MINUTES };
    },

    /**
     * Says what fresh food has spoiled since the last such notice. It waits until no other notice is on screen, so neither hides
     * the other. Food that spoils while the notice shows joins it.
     */
    noticeSpoiledFood(): void {
      if (holdsNone(spoiledToTell)) return;
      const showing = notice !== null && isOnScreen() ? notice : null;
      if (showing !== null && showing.kind !== "foodSpoiled") return;
      let spoiled = spoiledToTell;
      if (showing?.kind === "foodSpoiled")
        for (const [food, count] of Object.entries(showing.spoiled) as [FreshFood, number][]) spoiled = addCount(spoiled, food, count);
      spoiledToTell = {};
      show({ kind: "foodSpoiled", spoiled });
    },

    /**
     * Shows the banner that a snug room keeps out the cold, the first time in this game the player stands in one.
     * It waits until no other notice is on screen, so neither notice hides the other. The step calls it last,
     * so nothing later in the step can replace the banner before the player sees it.
     */
    noticeSnugRoom(): void {
      if (snugRoomNoticeShown || isOnScreen() || !isInSnugRoom(entities, player.position)) return;
      snugRoomNoticeShown = true;
      show("snugRoomKeepsOutCold");
    },

    /** Shows the banner for a season that has started since the last one shown. The step calls it once time has passed. */
    noticeSeasonStart(): void {
      const { season } = seasonNow();
      if (season === announcedSeason) return;
      announcedSeason = season;
      seasonBanner = { season, untilMinutes: clock.minutes + SEASON_BANNER_MINUTES };
    },
  };
}

export type GameNotices = ReturnType<typeof createGameNotices>;
