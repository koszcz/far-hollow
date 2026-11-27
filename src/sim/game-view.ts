import type { createActionQueue } from "./action-queue";
import type { EatOrDrinkView, GameView, PlayerAction } from "./api-game-view";
import { BACKPACK_WEIGHT_LIMIT_KG, backpackWeight } from "./backpack";
import { buildMenuFor } from "./build-menu";
import { isNightAt, nightHoursAt, readClock, type Clock } from "./clock";
import { RECIPES } from "./crafting";
import { deepFreeze } from "./deep-freeze";
import { isRaining, isSnowing, snowCoverDepth } from "./entity-queries";
import type { GameNotices } from "./game-notices";
import type { Player } from "./game-player";
import { nearbyThings, type NearbySources } from "./nearby-things";
import { isAfterFirstWinter, type SeasonDay } from "./season";
import type { Sleeping } from "./sleeping";
import type { createSleds } from "./sleds";
import { viewFreshness } from "./spoiling";
import type { createTorches } from "./torches";

/** Everything a view of the game is read from. */
export interface ViewSource extends NearbySources {
  seed: number;
  player: Player;
  clock: Clock;
  yearStartDay: number;
  instantBuilding: boolean;
  /** The season now, and what the player is doing now. */
  season: SeasonDay;
  action: PlayerAction | null;
  paused: boolean;
  stepCount: number;
  lastEatOrDrink: EatOrDrinkView | null;
  notices: GameNotices;
  sleeping: Sleeping;
  sleds: ReturnType<typeof createSleds>;
  torches: ReturnType<typeof createTorches>;
  actionQueue: ReturnType<typeof createActionQueue>;
}

/** Every recipe. The HUD asks `refusal` what the player lacks to follow one now. */
function craftMenu(): GameView["craftMenu"] {
  return deepFreeze(RECIPES.map((recipe) => structuredClone(recipe)));
}

/** What the UI reads of the game now: a frozen copy, so nothing that reads it can change the game. */
export function snapshotOf(source: ViewSource): GameView {
  const { seed, player, clock, yearStartDay, entities, notices, sleds, torches } = source;
  return Object.freeze({
    seed,
    paused: source.paused,
    stepCount: source.stepCount,
    entityCount: entities.entities.length,
    playerPosition: Object.freeze({ ...player.position }),
    time: readClock(clock.minutes),
    night: isNightAt(clock.minutes, yearStartDay),
    nightHours: nightHoursAt(clock.minutes, yearStartDay),
    season: Object.freeze(source.season),
    afterFirstWinter: isAfterFirstWinter(readClock(clock.minutes).day, yearStartDay),
    seasonBanner: notices.seasonBannerShown(),
    backpack: Object.freeze({ ...player.backpack.contents }),
    backpackFreshness: viewFreshness(player.backpack, clock.minutes),
    backpackWeight: backpackWeight(player.backpack),
    backpackWeightLimit: BACKPACK_WEIGHT_LIMIT_KG,
    buildMenu: buildMenuFor(source.instantBuilding),
    craftMenu: craftMenu(),
    action: source.action,
    carrying: player.carrying ?? null,
    dragging: sleds.dragged() ?? null,
    litTorch: deepFreeze(torches.held() ?? null),
    plantedTorches: deepFreeze(torches.planted()),
    nearby: nearbyThings(source),
    needs: Object.freeze({
      hunger: player.needs.hunger.level,
      thirst: player.needs.thirst.level,
      warmth: player.needs.warmth.level,
      fatigue: player.needs.fatigue.level,
    }),
    warmth: player.needs.warmth.level,
    sick: player.sickness !== undefined,
    raining: isRaining(entities),
    snowing: isSnowing(entities),
    snowCover: snowCoverDepth(entities),
    notice: notices.shownNotice(),
    lastSleep: source.sleeping.last(),
    lastEatOrDrink: source.lastEatOrDrink,
    sittingOn: player.sitting?.stoolId ?? null,
    reach: player.handReach === undefined ? null : Object.freeze({ height: player.handReach.height, seconds: player.handReach.seconds }),
    actionQueue: deepFreeze(structuredClone(source.actionQueue.actions())),
    // The playground has no journal.
    journal: notices.journalView(),
  });
}
