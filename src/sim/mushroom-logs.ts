// Mushroom logs: a plain log on the ground that the player plants a mushroom on. See .scratch/garden/spec.md.
// Planting takes a few seconds of work with no tool and uses one mushroom from the backpack. The log keeps its place,
// its turn, and its id, but it is no longer a log: it cannot be picked up, put on a sled or woodpile, or built with.
// A mushroom log is also a forage spot for mushrooms, so foraging and growing back work as for a wild mushroom patch.
// It starts out growing, and bears its first mushrooms FIRST_MUSHROOMS_MINUTES after planting.
// The player can take it down. It vanishes and gives nothing back.
import type { Refusal } from "./api";
import type { ApproachReach } from "./approach";
import { hasInBackpack, removeFromBackpack } from "./backpack";
import { mushroomLogEntities, playerEntities, setComponent, type Entity, type EntityStore, type Vec3 } from "./entities";
import { addGroundPoints, scaleGroundPoint } from "./ground-point";
import { goneRefusal } from "./refusals";
import { isInRect, type GroundRect } from "./structure-kind";
import type { CommandRules } from "./command-rule";

/** How long the player works to plant a mushroom on a log, in seconds. */
export const PLANT_MUSHROOM_SECONDS = 4;

/** How long a new mushroom log takes to bear its first mushrooms, in game minutes. Two days. */
export const FIRST_MUSHROOMS_MINUTES = 2 * 24 * 60;

/** The player plants a mushroom on a log, or takes a mushroom log down, from this far away, in metres. */
const MUSHROOM_LOG_REACH_METRES = 2;

/** A mushroom log is a log, which is this long, in metres. */
const MUSHROOM_LOG_LENGTH_METRES = 1;

/**
 * Whether ground a blueprint would cover reaches a mushroom log: its middle or either end lies in `rect`.
 * A mushroom log stays where it lies for good, so nothing may be built over it.
 */
export function coversMushroomLog(entities: EntityStore, rect: GroundRect): boolean {
  return mushroomLogEntities(entities).entities.some(({ position, mushroomLog }) => {
    const toEnd = scaleGroundPoint({ x: Math.sin(mushroomLog.heading), z: Math.cos(mushroomLog.heading) }, MUSHROOM_LOG_LENGTH_METRES / 2);
    return [position, addGroundPoints(position, toEnd), addGroundPoints(position, scaleGroundPoint(toEnd, -1))].some((spot) => isInRect(rect, spot));
  });
}

/** How far the player is through planting a mushroom, from 0 to 1, and the log, or undefined if they are not planting one now. */
export function plantingMushroomNow(player: Entity): { progress: number; targetId: number } | undefined {
  if (player.plantMushroomTask === undefined) return undefined;
  return { progress: Math.min(1, player.plantMushroomTask.secondsDone / PLANT_MUSHROOM_SECONDS), targetId: player.plantMushroomTask.logId };
}

export interface MushroomLogs {
  /** Where the approach takes the player to plant a mushroom on a log: within reach of it. Undefined if the entity is not a log on the ground. */
  reach(logId: number): ApproachReach | undefined;
  /** Starts the player planting a mushroom on a log within reach. The approach runs it once they arrive. The game calls it only once `refusal` passes. */
  start(logId: number): void;
  /** Why the player could not plant a mushroom on this log now: it is gone, it is a debarked log, or the backpack holds no mushroom. */
  refusal(logId: number): Refusal | undefined;
  /** Stops the player planting. The log stays a plain log, and the mushroom stays in the backpack. */
  cancel(): void;
  /** Moves planting on by one logic step. */
  step(stepSeconds: number): undefined;
  /** Where the approach takes the player to take a mushroom log down: within reach of it. Undefined if the entity is not one. */
  takeDownReach(mushroomLogId: number): ApproachReach | undefined;
  /** Removes a mushroom log within reach. It gives nothing back. */
  takeDown(mushroomLogId: number): void;
  /** Why the player could not take this mushroom log down: it is gone. */
  takeDownRefusal(mushroomLogId: number): Refusal | undefined;
}

type Lying = Entity & { position: Vec3 };

/** Lets the player plant mushrooms on logs, and take mushroom logs down. */
export function createMushroomLogs(entities: EntityStore): MushroomLogs {
  const players = playerEntities(entities);
  const planters = entities.with("plantMushroomTask", "position", "backpack");

  /** The plain log on the ground with this id, if it is one. */
  function logOf(logId: number): (Lying & { log: { heading: number } }) | undefined {
    const entity = entities.entity(logId);
    if (entity?.log === undefined || entity.position === undefined) return undefined;
    return entity as Lying & { log: { heading: number } };
  }

  /** The mushroom log with this id, if it is one. */
  function mushroomLogOf(id: number): Lying | undefined {
    const entity = entities.entity(id);
    if (entity?.mushroomLog === undefined || entity.position === undefined) return undefined;
    return entity as Lying;
  }

  const within = (thing: Lying): ApproachReach => ({ target: thing.position, metres: MUSHROOM_LOG_REACH_METRES, walk: { style: "beside" } });

  return {
    reach(logId) {
      const log = logOf(logId);
      return log === undefined ? undefined : within(log);
    },
    start(logId) {
      if (logOf(logId) === undefined) return;
      for (const player of players) setComponent(entities, player, "plantMushroomTask", { logId, secondsDone: 0 });
    },
    refusal(logId) {
      const gone = goneRefusal(entities, logId);
      if (gone !== undefined) return gone;
      if (logOf(logId) === undefined) return { kind: "needsPlainLog" };
      const backpack = players.first?.backpack;
      return backpack === undefined || hasInBackpack(backpack, "mushroom") ? undefined : { kind: "noMushroom" };
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "plantMushroomTask");
    },
    step(stepSeconds) {
      // Copy the list first, because players who finish or give up leave the query while it is being walked.
      for (const planter of [...planters]) {
        const log = logOf(planter.plantMushroomTask.logId);
        if (log === undefined || !hasInBackpack(planter.backpack, "mushroom")) {
          entities.removeComponent(planter, "plantMushroomTask");
          continue;
        }
        planter.plantMushroomTask.secondsDone += stepSeconds;
        if (planter.plantMushroomTask.secondsDone < PLANT_MUSHROOM_SECONDS) continue;
        entities.removeComponent(planter, "plantMushroomTask");
        if (!removeFromBackpack(planter.backpack, "mushroom", 1)) continue;
        // The log keeps its place, its turn, and its id. It is a log no more, so nothing that takes logs finds it.
        const { heading } = log.log;
        entities.removeComponent(log, "log");
        entities.addComponent(log, "mushroomLog", { heading });
        entities.addComponent(log, "forageSpot", { food: "mushroom" });
        entities.addComponent(log, "regrowing", { minutesLeft: FIRST_MUSHROOMS_MINUTES });
      }
      return undefined;
    },
    takeDownReach(mushroomLogId) {
      const mushroomLog = mushroomLogOf(mushroomLogId);
      return mushroomLog === undefined ? undefined : within(mushroomLog);
    },
    takeDown(mushroomLogId) {
      const mushroomLog = mushroomLogOf(mushroomLogId);
      if (mushroomLog !== undefined) entities.remove(mushroomLog);
    },
    takeDownRefusal(mushroomLogId) {
      return goneRefusal(entities, mushroomLogId) ?? (mushroomLogOf(mushroomLogId) === undefined ? { kind: "gone" } : undefined);
    },
  };
}

/** The rules for planting a mushroom on a log and taking a mushroom log down. */
export function mushroomLogRules(mushroomLogs: MushroomLogs): CommandRules<"plantMushroom" | "takeDownMushroomLog"> {
  return {
    plantMushroom: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => mushroomLogs.refusal(command.logId),
      approach: {
        reach: (command) => mushroomLogs.reach(command.logId),
        act: (command) => {
          mushroomLogs.start(command.logId);
        },
      },
    },
    takeDownMushroomLog: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => mushroomLogs.takeDownRefusal(command.mushroomLogId),
      approach: {
        reach: (command) => mushroomLogs.takeDownReach(command.mushroomLogId),
        act: (command) => {
          mushroomLogs.takeDown(command.mushroomLogId);
        },
      },
    },
  };
}
