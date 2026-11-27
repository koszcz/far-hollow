// Filling a parked sled with the logs lying near it. The player fetches each log or debarked log within FILL_SLED_METRES
// of the sled, nearest first by walking distance, puts it on the sled, and goes for the next one. It stops when the sled
// is full, no log is left within reach, or the player does something else.
import type { Activity } from "./activity";
import type { Refusal } from "./api-refusal";
import { addCount } from "./counts";
import { distanceOutside } from "./building";
import { shoulderLog } from "./carrying";
import type { CommandRules } from "./command-rule";
import { debarkedLogEntities, entityWith, isParked, logEntities, playerEntities, type Entity, type EntityStore } from "./entities";
import type { GroundPoint } from "./ground-point";
import type { HandReach } from "./hand-reach";
import { walkingDistancesFrom } from "./pathfinding";
import { distanceToTarget, type WalkTarget } from "./walk-target";
import { USE_REACH_METRES } from "./reach";
import { isSled, logsThatFitOnSled, type SledEntity } from "./sleds";
import { footprintOfEntity } from "./structure-queries";
import { isWalkable } from "./walk-map";
import { WALK_REACH_MARGIN_METRES, type Walking } from "./walking";
import { isCarriedLog } from "./wood-and-fuel";

/** The player fills a sled with logs lying within this many metres of its edge, measured along the walking path. */
export const FILL_SLED_METRES = 10;
/** The player picks up a log from this far from its middle, in metres. */
const PICK_UP_REACH_METRES = 2;

type Filler = Entity & Required<Pick<Entity, "fillSledTask" | "position">>;

export interface SledFilling extends Activity {
  /** Why the player could not start filling the sled now, or undefined if they could. */
  refusal(sledId: number): Refusal | undefined;
  /** Starts the player filling a parked sled. A log already on their shoulder goes on it first. */
  fill(sledId: number): void;
}

export function createSledFilling(entities: EntityStore, walking: Walking, hand: Pick<HandReach, "start">): SledFilling {
  const players = playerEntities(entities);
  const fillers = entities.with("fillSledTask", "position");

  /** The parked, finished sled with this id, if there is one. */
  function parkedSled(sledId: number): SledEntity | undefined {
    const sled = entityWith(entities, sledId, "sled", "position");
    return sled !== undefined && isSled(sled) && isParked(entities, sled) ? sled : undefined;
  }

  /** The logs and debarked logs lying within FILL_SLED_METRES of the sled, along the walking path, nearest first. */
  function logsNear(sled: SledEntity): Entity[] {
    const footprint = footprintOfEntity(sled);
    // No walk is shorter than the straight line, so a log further than that cannot count.
    const close = [...logEntities(entities), ...debarkedLogEntities(entities)].filter((log) => distanceOutside(footprint, log.position) <= FILL_SLED_METRES);
    if (close.length === 0) return [];
    const walks = walkingDistancesFrom(walking.walkMap, footprint, FILL_SLED_METRES);
    return close
      .map((log) => ({ log, distance: walks.to({ x: log.position.x, z: log.position.z }) }))
      .filter((found): found is { log: (typeof close)[number]; distance: number } => found.distance !== undefined)
      .sort((a, b) => a.distance - b.distance)
      .map(({ log }) => log);
  }

  function refusal(sledId: number): Refusal | undefined {
    const sled = parkedSled(sledId);
    if (sled === undefined) return undefined;
    const carried = players.first?.carrying;
    // A plank or stone in the hands never goes on a sled.
    if (carried !== undefined && !isCarriedLog(carried)) return { kind: "handsFull" };
    if (logsThatFitOnSled(sled.sled) <= 0) return { kind: "sledFull" };
    if (carried === undefined && logsNear(sled).length === 0) return { kind: "noLogsNearSled" };
    return undefined;
  }

  /**
   * Sets the filler walking to within `metres` of `target`: onto `spot` if it is open ground, or else the shortest way to within reach.
   * Returns false if no walk gets them within reach.
   */
  function walkWithinReach(filler: Filler, target: WalkTarget, metres: number, spot?: GroundPoint): boolean {
    const arrives = () => distanceToTarget(target, filler.walkPath?.at(-1) ?? filler.position) <= metres;
    if (spot !== undefined && isWalkable(walking.walkMap, spot)) {
      walking.walkTo(spot);
      if (arrives()) return true;
    }
    walking.walkWithin(target, metres - WALK_REACH_MARGIN_METRES);
    if (arrives()) return true;
    entities.removeComponent(filler, "walkPath");
    return false;
  }

  /** Has the filler reach for the log they walked to and shoulder it. If it is gone, they look again on the next step. */
  function pickUp(filler: Filler, logId: number): void {
    const log = entities.entity(logId);
    if (log?.position === undefined || distanceToTarget(log.position, filler.position) > PICK_UP_REACH_METRES) return;
    hand.start("low", log.position, () => {
      if (entities.has(log)) shoulderLog(entities, filler, log);
      return undefined;
    });
  }

  /** Has the filler put the log on their shoulder on the sled, once their hand gets there. */
  function load(filler: Filler, sled: SledEntity): void {
    hand.start("waist", sled.position, () => {
      const carried = filler.carrying;
      if (carried === undefined || !isCarriedLog(carried) || logsThatFitOnSled(sled.sled) <= 0) return undefined;
      sled.sled = addCount(sled.sled, carried, 1);
      entities.removeComponent(filler, "carrying");
      return undefined;
    });
  }

  /** Moves one filler on by one step. Returns false once they stop filling. */
  function workOn(filler: Filler): boolean {
    const sled = parkedSled(filler.fillSledTask.sledId);
    if (sled === undefined) return false;
    const fetchFrom = filler.fillSledTask.fetchFrom;
    if (fetchFrom !== undefined) {
      filler.fillSledTask = { sledId: filler.fillSledTask.sledId };
      if (filler.carrying === undefined) pickUp(filler, fetchFrom);
      return true;
    }
    const carried = filler.carrying;
    if (carried !== undefined) {
      // The player stops with a plank or stone in their hands, or a log the full sled has no room for.
      if (!isCarriedLog(carried) || logsThatFitOnSled(sled.sled) <= 0) return false;
      const footprint = footprintOfEntity(sled);
      if (distanceOutside(footprint, filler.position) <= USE_REACH_METRES) {
        load(filler, sled);
        return true;
      }
      return walkWithinReach(filler, footprint, USE_REACH_METRES);
    }
    if (logsThatFitOnSled(sled.sled) <= 0) return false;
    const next = logsNear(sled)[0];
    const nextId = next === undefined ? undefined : entities.id(next);
    if (next?.position === undefined || nextId === undefined) return false;
    const spot = { x: next.position.x, z: next.position.z };
    if (!walkWithinReach(filler, spot, PICK_UP_REACH_METRES, spot)) return false;
    filler.fillSledTask = { sledId: filler.fillSledTask.sledId, fetchFrom: nextId };
    return true;
  }

  return {
    refusal,
    fill(sledId) {
      if (parkedSled(sledId) === undefined) return;
      for (const player of players) entities.addComponent(player, "fillSledTask", { sledId });
    },
    cancel() {
      for (const player of [...fillers]) entities.removeComponent(player, "fillSledTask");
    },
    step() {
      // Copy the list first, because players who stop leave the query while it is being walked.
      for (const filler of [...fillers]) {
        // The filler is still walking to a log or back to the sled, or their hand is still on its way.
        if (filler.walkPath !== undefined || filler.handReach !== undefined) continue;
        if (!workOn(filler)) entities.removeComponent(filler, "fillSledTask");
      }
      return undefined;
    },
  };
}

/** The rule for filling a parked sled with the logs lying near it. */
export function sledFillingRules(filling: SledFilling): CommandRules<"fillSled"> {
  return {
    fillSled: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => filling.refusal(command.sledId),
      run: (command) => {
        filling.fill(command.sledId);
        return undefined;
      },
    },
  };
}
