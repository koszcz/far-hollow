import { addToBackpack, fitsInBackpack, hasInBackpack, type Backpack } from "./backpack";
import { playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import { groundDistance, type GroundPoint } from "./valley";
import type { Walking } from "./walking";

/** How long the player works at a log with the drawknife to strip its bark, in seconds. */
export const DEBARK_SECONDS = 4;

/** How far the player is through debarking, from 0 to 1, and the log they debark, or undefined if they are not debarking now. Walking there does not count. */
export function debarkingNow(player: Entity): { progress: number; targetId: number } | undefined {
  if (player.debarkTask === undefined || player.walkPath !== undefined) return undefined;
  return { progress: Math.min(1, player.debarkTask.secondsDone / DEBARK_SECONDS), targetId: player.debarkTask.logId };
}
/** How much bark one log gives. */
export const BARK_PER_LOG = 2;

/**
 * How far from the middle of a 1 m log the player stands to debark it, in metres, along the log's line.
 * That is just off its end, so the player bends over the log and each drawknife stroke runs along it.
 */
export const DEBARK_STAND_METRES = 0.55;

/** The player can debark a log from this far away, in metres. */
const DEBARK_REACH_METRES = 2;

/** Why the player could not start debarking. */
export type DebarkRefusal = "backpackFull";

export interface Debarking {
  /**
   * Sets the player walking to a log on the ground to strip its bark with the drawknife.
   * Does nothing if the entity is not a log on the ground, the player has no drawknife, or the bark would not fit.
   * Returns "backpackFull" when the backpack has no room for the bark.
   */
  start(logId: number): DebarkRefusal | undefined;
  /** Stops the player debarking, or walking to debark. The log keeps its bark. */
  cancel(): void;
  /** Moves every debarking on by one logic step. Run it after walking has moved the player. */
  step(stepSeconds: number): undefined;
}

/** Lets the player strip the bark off logs on the ground. Each log becomes a debarked log, and its bark goes in the backpack. */
export function createDebarking(entities: EntityStore, walking: Walking): Debarking {
  const players = playerEntities(entities);
  const debarkers = entities.with("debarkTask", "position", "backpack");

  return {
    start(logId) {
      const log = entities.entity(logId);
      if (log?.log === undefined || log.position === undefined) return undefined;
      let refusal: DebarkRefusal | undefined;
      for (const player of players) {
        if (player.backpack === undefined || !hasInBackpack(player.backpack, "drawknife")) continue;
        if (!barkFits(player.backpack)) {
          refusal = "backpackFull";
          continue;
        }
        walking.walkTo(standingSpot(log.position, log.log.heading, player.position));
        setComponent(entities, player, "debarkTask", { logId, secondsDone: 0 });
      }
      return refusal;
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "debarkTask");
    },
    step(stepSeconds) {
      // Copy the list first, because players who finish or give up leave the query while it is being walked.
      for (const debarker of [...debarkers]) {
        if (debarker.walkPath) continue;
        const log = entities.entity(debarker.debarkTask.logId);
        if (log?.log === undefined || log.position === undefined || !hasInBackpack(debarker.backpack, "drawknife") || !barkFits(debarker.backpack)) {
          entities.removeComponent(debarker, "debarkTask");
          continue;
        }
        if (groundDistance(log.position, debarker.position) > DEBARK_REACH_METRES) {
          // The player walked as close as they could but the log is out of reach.
          entities.removeComponent(debarker, "debarkTask");
          continue;
        }
        debarker.debarkTask.secondsDone += stepSeconds;
        if (debarker.debarkTask.secondsDone < DEBARK_SECONDS) continue;
        entities.removeComponent(debarker, "debarkTask");
        if (!addToBackpack(debarker.backpack, "bark", BARK_PER_LOG)) continue;
        // The log keeps its place, its turn, and its id. Only its bark is gone.
        const { heading } = log.log;
        entities.removeComponent(log, "log");
        entities.addComponent(log, "debarkedLog", { heading });
      }
    },
  };
}

/** The spot just off the end of the log nearer `from`, on the log's line. The log lies along its `heading` from +z. */
function standingSpot(middle: GroundPoint, heading: number, from: GroundPoint | undefined): GroundPoint {
  const along = { x: Math.sin(heading), z: Math.cos(heading) };
  const side = from === undefined || (from.x - middle.x) * along.x + (from.z - middle.z) * along.z >= 0 ? 1 : -1;
  return { x: middle.x + along.x * DEBARK_STAND_METRES * side, z: middle.z + along.z * DEBARK_STAND_METRES * side };
}

function barkFits(backpack: Backpack): boolean {
  return fitsInBackpack(backpack, "bark", BARK_PER_LOG);
}
