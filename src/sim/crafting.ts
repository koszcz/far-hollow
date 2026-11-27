// Crafting: timed work that turns materials into something new that goes in the backpack.
// Every recipe is listed in RECIPES. A new recipe needs only a new entry there, with its name in the strings file.
// The recipes themselves are in crafting-recipes.ts.
import { BACKPACK_WEIGHT_LIMIT_KG, backpackWeight, CONTENT_WEIGHT_KG, howManyFit, type Backpack, type BackpackContent } from "./backpack";
import { distanceOutside } from "./building-reach";
import { addCount, takeCount } from "./counts";
import { setComponent, type CarriedLog, type Entity, type EntityStore } from "./entities";
import { debarkedLogEntities, isParked, logEntities, playerEntities, sledEntities, workStationEntities } from "./entity-queries";
import type { Refusal } from "./api-refusal";
import type { ApproachReach } from "./approach";
import { recipeLacks, recipeOf, STATION_GROUND_METRES, type Recipe, type RecipeLack } from "./crafting-recipes";
import type { RecipeKind } from "./recipe-kind";
import { addToPileAt } from "./piles";
import { putPlanksOnSled, takeOffSled, type SledEntity } from "./sleds";
import type { WorkStationKind } from "./structure-kind";
import { footprintOfEntity } from "./structure-queries";
import { type Terrain } from "./valley";
import { groundDistance, type GroundPoint } from "./ground-point";
import type { CommandRules, RuleGame } from "./command-rule";

/** The player works at a station from this far from its centre, in metres. */
const STATION_REACH_METRES = 2;
/** The player walks to stand this far from a station's centre, in metres. A sawhorse blocks walking within 0.75 m. */
const STATION_STAND_METRES = 1.2;

/**
 * How far the player is through crafting, from 0 to 1, and the work station they craft at, if any.
 * Undefined if they are not crafting now.
 */
export function craftingNow(player: Entity): { progress: number; targetId?: number } | undefined {
  if (player.craftTask === undefined) return undefined;
  const { recipe, secondsDone, stationId } = player.craftTask;
  return { progress: Math.min(1, secondsDone / recipeOf(recipe).seconds), ...(stationId === undefined ? {} : { targetId: stationId }) };
}
/**
 * True if the result fits in the backpack once the materials the recipe uses are taken out,
 * or if the recipe drops what does not fit beside its station.
 * The small allowance stops rounding errors in the weights from refusing a result that fits.
 */
function resultFits(recipe: Recipe, backpack: Backpack): boolean {
  if (recipe.dropsWhatDoesNotFit === true) return true;
  const freed = recipe.materials.reduce((total, { material, count }) => total + count * CONTENT_WEIGHT_KG[material], 0);
  const added = recipe.result.count * CONTENT_WEIGHT_KG[recipe.result.content];
  return backpackWeight(backpack) - freed + added <= BACKPACK_WEIGHT_LIMIT_KG + 1e-9;
}

/**
 * Why the player could not start crafting, or had to stop.
 * `cannotCraftYet`: they lack the tool, work station, or materials, listed in `lacks`.
 * `putLogDownFirst`: they carry a log on their shoulder. `backpackFull`: the result would not fit.
 * `noLogBesideStation`: a station recipe needs a log or debarked log lying beside the station, and none is there.
 */
export type CraftRefusal =
  | { readonly kind: "cannotCraftYet"; readonly lacks: readonly RecipeLack[] }
  | { readonly kind: "putLogDownFirst" }
  | { readonly kind: "backpackFull" }
  | { readonly kind: "noLogBesideStation"; readonly station: WorkStationKind };

/** What finished crafting dropped in a pile beside the `station`, because it did not fit in the backpack. */
export interface DroppedBesideStation {
  readonly kind: "droppedBesideStation";
  readonly content: BackpackContent;
  readonly count: number;
  readonly station: WorkStationKind;
}

export interface Crafting {
  /**
   * The work station the player follows a station recipe at: the finished one given by `stationId`, or else the nearest
   * finished one of the right kind. Undefined for a hand recipe, or if no such station stands.
   */
  stationFor(kind: RecipeKind, stationId?: number): number | undefined;
  /** Where the approach takes the player to follow a station recipe: beside the station. Undefined for a hand recipe, or a station that is gone. */
  reach(kind: RecipeKind, stationId: number | undefined): ApproachReach | undefined;
  /**
   * Why the player could not start crafting now, at the station given by `stationId` for a station recipe:
   * they carry a log, the result would not fit, or the logs a station recipe uses do not lie beside the station.
   */
  startRefusal(kind: RecipeKind, stationId?: number): CraftRefusal | undefined;
  /**
   * Starts the player crafting. A hand recipe is crafted where the player stands.
   * A station recipe is followed at the station given by `stationId`, or else the nearest finished one of the right kind.
   * The approach runs it once the player stands beside the station.
   * The game calls it only once `refusal` passes, so the player has the recipe's tool, station, and materials.
   * Refuses as `startRefusal` does. Does nothing if the station given by `stationId` is not a finished one of the right kind.
   */
  start(kind: RecipeKind, stationId?: number): CraftRefusal | undefined;
  /** Stops the player crafting. Nothing is used up, and the work starts again from the beginning next time. */
  cancel(): void;
  /**
   * Moves crafting on by one logic step.
   * When the work finishes, the materials are used up and the result goes in the backpack.
   * For a recipe that drops what does not fit, the rest of the result goes on a sled parked beside the station, if planks,
   * and what is left after that drops in a pile at the player's feet.
   * Returns why crafting stopped, if the logs a station recipe uses no longer lie beside the station.
   * Returns what dropped, if some of the result did not fit.
   */
  step(stepSeconds: number): CraftRefusal | DroppedBesideStation | undefined;
  /** Everything the player lacks to follow a recipe now. Empty when they can follow it. */
  lacks(kind: RecipeKind): readonly RecipeLack[];
  /**
   * Why the player could not follow a recipe now, wherever they stand: everything it lacks, then a log on their shoulder,
   * then a result that would not fit in the backpack. Whether logs lie beside the station is checked only at the station.
   */
  refusal(kind: RecipeKind): Refusal | undefined;
}

/** An entity with a place in the world, such as a work station or a log lying on the ground. */
type PlacedEntity = Entity & Required<Pick<Entity, "position">>;

/** True if `entity` is a finished work station of this kind. A blueprint is not. */
function isStation(entity: Entity | undefined, station: WorkStationKind): entity is PlacedEntity {
  return entity?.position !== undefined && entity.workStation === station;
}

/** The logs in `logs` lying within STATION_GROUND_METRES of `station`, nearest first. A station recipe uses them in this order. */
function groundLogsBeside(logs: readonly PlacedEntity[], station: PlacedEntity): PlacedEntity[] {
  return logs
    .filter((log) => groundDistance(log.position, station.position) <= STATION_GROUND_METRES)
    .sort((a, b) => groundDistance(a.position, station.position) - groundDistance(b.position, station.position));
}

/**
 * The log or debarked log lying on the ground that the player works on now at a work station, with the station.
 * It is the one the recipe uses up first when the work finishes.
 * Undefined if the player is not working at a station now, or the recipe takes its log from a sled.
 */
export function logWorkedNow(entities: EntityStore, player: Entity): { log: PlacedEntity; station: PlacedEntity } | undefined {
  const task = player.craftTask;
  if (task === undefined || task.stationId === undefined) return undefined;
  const recipe = recipeOf(task.recipe);
  const station = entities.entity(task.stationId);
  const material = recipe.besideStation?.[0]?.material;
  if (material === undefined || recipe.station === undefined || !isStation(station, recipe.station)) return undefined;
  const logs = material === "log" ? logEntities(entities).entities : debarkedLogEntities(entities).entities;
  const log = groundLogsBeside(logs, station)[0];
  return log === undefined ? undefined : { log, station };
}

/** Lets the player craft: turn materials into something new that goes in the backpack, by timed work. */
export function createCrafting(entities: EntityStore, terrain: Terrain): Crafting {
  const players = playerEntities(entities);
  const crafters = entities.with("craftTask", "backpack", "position");
  const groundLogs: { readonly [Material in CarriedLog]: { readonly entities: readonly PlacedEntity[] } } = {
    log: logEntities(entities),
    debarkedLog: debarkedLogEntities(entities),
  };

  function hasStation(station: WorkStationKind): boolean {
    return workStationEntities(entities).entities.some((entity) => isStation(entity, station));
  }

  /** The finished station of this kind nearest to `from`, if any stands. */
  function nearestStation(station: WorkStationKind, from: GroundPoint): PlacedEntity | undefined {
    let nearest: PlacedEntity | undefined;
    for (const entity of workStationEntities(entities)) {
      if (!isStation(entity, station)) continue;
      if (nearest === undefined || groundDistance(entity.position, from) < groundDistance(nearest.position, from)) nearest = entity;
    }
    return nearest;
  }

  /** The sleds parked within STATION_GROUND_METRES of `station`, measured to the sled's edge, nearest first. */
  function sledsBeside(station: PlacedEntity): SledEntity[] {
    return sledEntities(entities)
      .entities.filter((sled) => isParked(entities, sled))
      .map((sled) => ({ sled, distance: distanceOutside(footprintOfEntity(sled), station.position) }))
      .filter(({ distance }) => distance <= STATION_GROUND_METRES)
      .sort((a, b) => a.distance - b.distance)
      .map(({ sled }) => sled);
  }

  /**
   * The logs or debarked logs a recipe would use from beside `station`, or undefined if too few are there.
   * Each one is a function that uses it up. Logs lying on the ground come first, nearest first.
   * Then come logs on sleds parked within STATION_GROUND_METRES of the station, measured to the sled's edge, nearest sled first.
   */
  function logsBeside(recipe: Recipe, station: PlacedEntity): (() => void)[] | undefined {
    const used: (() => void)[] = [];
    const sleds = sledsBeside(station);
    for (const { material, count } of recipe.besideStation ?? []) {
      const near = groundLogsBeside(groundLogs[material].entities, station).map((log) => () => entities.remove(log));
      const onSleds = sleds.flatMap((sled) =>
        Array.from({ length: sled.sled[material] }, () => () => {
          takeOffSled(sled, material);
        }),
      );
      const available = [...near, ...onSleds];
      if (available.length < count) return undefined;
      used.push(...available.slice(0, count));
    }
    return used;
  }

  /** The station a crafter works at, if their recipe needs one and it still stands finished. */
  function stationOf(recipe: Recipe, stationId: number | undefined): PlacedEntity | undefined {
    if (recipe.station === undefined || stationId === undefined) return undefined;
    const station = entities.entity(stationId);
    return isStation(station, recipe.station) ? station : undefined;
  }

  /** Everything the player lacks to follow a recipe now. */
  function lacks(kind: RecipeKind): readonly RecipeLack[] {
    const player = players.first;
    return player?.backpack === undefined ? [] : recipeLacks(recipeOf(kind), player.backpack, hasStation);
  }

  /** The station a player at `from` follows a recipe at: the one given by `stationId`, or else the nearest. Undefined for a hand recipe. */
  function stationAt(recipe: Recipe, stationId: number | undefined, from: GroundPoint): PlacedEntity | undefined {
    if (recipe.station === undefined) return undefined;
    return stationId === undefined ? nearestStation(recipe.station, from) : stationOf(recipe, stationId);
  }

  /** Why this player could not start following a recipe at `station` now. */
  function startRefusalFor(player: Entity, backpack: Backpack, recipe: Recipe, station: PlacedEntity | undefined): CraftRefusal | undefined {
    if (player.carrying !== undefined) return { kind: "putLogDownFirst" };
    if (recipe.station !== undefined && station !== undefined && logsBeside(recipe, station) === undefined) {
      return { kind: "noLogBesideStation", station: recipe.station };
    }
    return resultFits(recipe, backpack) ? undefined : { kind: "backpackFull" };
  }

  return {
    stationFor(kind, stationId) {
      const player = players.first;
      const station = player === undefined ? undefined : stationAt(recipeOf(kind), stationId, player.position);
      return station === undefined ? undefined : entities.id(station);
    },
    reach(kind, stationId) {
      const recipe = recipeOf(kind);
      const station = stationOf(recipe, stationId);
      if (station === undefined) return undefined;
      return { target: station.position, metres: STATION_REACH_METRES, walk: { style: "beside", standMetres: STATION_STAND_METRES } };
    },
    startRefusal(kind, stationId) {
      const player = players.first;
      if (player?.backpack === undefined) return undefined;
      const recipe = recipeOf(kind);
      return startRefusalFor(player, player.backpack, recipe, stationAt(recipe, stationId, player.position));
    },
    start(kind, stationId) {
      const recipe = recipeOf(kind);
      let refusal: CraftRefusal | undefined;
      for (const player of players) {
        if (player.backpack === undefined) continue;
        const station = stationAt(recipe, stationId, player.position);
        if (recipe.station !== undefined && station === undefined) continue;
        const why = startRefusalFor(player, player.backpack, recipe, station);
        if (why !== undefined) {
          refusal = why;
          continue;
        }
        entities.removeComponent(player, "walkPath");
        const id = station === undefined ? undefined : entities.id(station);
        setComponent(entities, player, "craftTask", { recipe: kind, secondsDone: 0, ...(id === undefined ? {} : { stationId: id }) });
      }
      return refusal;
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "craftTask");
    },
    step(stepSeconds) {
      let refusal: CraftRefusal | DroppedBesideStation | undefined;
      // Copy the list first, because players who finish or give up leave the query while it is being walked.
      for (const crafter of [...crafters]) {
        const recipe = recipeOf(crafter.craftTask.recipe);
        const station = stationOf(recipe, crafter.craftTask.stationId);
        const stationStands = recipe.station === undefined || station !== undefined;
        const logs = station === undefined ? [] : logsBeside(recipe, station);
        if (
          !stationStands ||
          logs === undefined ||
          crafter.carrying !== undefined ||
          recipeLacks(recipe, crafter.backpack, hasStation).length > 0 ||
          !resultFits(recipe, crafter.backpack)
        ) {
          entities.removeComponent(crafter, "craftTask");
          // The logs the station uses no longer lie beside it.
          if (logs === undefined && recipe.station !== undefined) refusal = { kind: "noLogBesideStation", station: recipe.station };
          continue;
        }
        crafter.craftTask.secondsDone += stepSeconds;
        if (crafter.craftTask.secondsDone < recipe.seconds) continue;
        entities.removeComponent(crafter, "craftTask");
        for (const useUp of logs) useUp();
        for (const { material, count } of recipe.materials) crafter.backpack.contents = takeCount(crafter.backpack.contents, material, count);
        const { content, count } = recipe.result;
        const fit = howManyFit(crafter.backpack, content, count);
        if (fit > 0) crafter.backpack.contents = addCount(crafter.backpack.contents, content, fit);
        let left = count - fit;
        if (left > 0 && content === "plank" && station !== undefined) {
          for (const sled of sledsBeside(station)) left -= putPlanksOnSled(sled, left);
        }
        if (left > 0 && recipe.station !== undefined) {
          addToPileAt(entities, terrain, content, left, crafter.position);
          refusal = { kind: "droppedBesideStation", content, count: left, station: recipe.station };
        }
      }
      return refusal;
    },
    lacks,
    refusal(kind) {
      const lacking = lacks(kind);
      if (lacking.length > 0) return { kind: "cannotCraftYet", lacks: lacking };
      const player = players.first;
      if (player?.carrying !== undefined) return { kind: "putLogDownFirst" };
      if (player?.backpack !== undefined && !resultFits(recipeOf(kind), player.backpack)) return { kind: "backpackFull" };
      return undefined;
    },
  };
}

/** The rule for crafting a recipe. */
export function craftingRules(crafting: Crafting, { startApproach }: RuleGame): CommandRules<"craft"> {
  return {
    craft: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => crafting.refusal(command.recipe),
      // A hand recipe is crafted where the player stands. A station recipe is followed beside the station, so the player
      // walks there first, unless they could not start it anyway. The approach holds the station the player walks to.
      run: (command) => {
        const stationId = crafting.stationFor(command.recipe, command.stationId);
        if (stationId === undefined) return crafting.start(command.recipe, command.stationId);
        return crafting.startRefusal(command.recipe, stationId) ?? startApproach({ type: "craft", recipe: command.recipe, stationId });
      },
      approach: {
        reach: (command) => crafting.reach(command.recipe, command.stationId),
        act: (command) => crafting.start(command.recipe, command.stationId),
      },
    },
  };
}
