import { playerEntities, setComponent, type CarriedLog, type Entity, type EntityStore } from "./entities";
import { standingHeightAt } from "./foundations";
import { groundDistance, type Valley } from "./valley";
import type { Walking } from "./walking";

/** The player can pick up a log from this far away, in metres. */
const PICK_UP_REACH_METRES = 2;

export interface Carrying {
  /**
   * Sets the player walking to a log or debarked log on the ground to shoulder it.
   * Does nothing if the entity is not one of those or the player already carries one.
   */
  pickUp(logId: number): void;
  /** Stops the player walking to pick up a log. */
  cancel(): void;
  /** Lays the carried log or debarked log on the ground at the player's feet. Does nothing if the player carries nothing. */
  drop(): void;
  /** Picks up logs the player has reached. Run it after walking has moved the player. */
  step(): undefined;
}

/** Keeps track of what the player carries on their shoulder. One log or debarked log fits at a time. */
export function createCarrying(entities: EntityStore, walking: Walking, valley: Valley): Carrying {
  const players = playerEntities(entities);
  const pickers = entities.with("logPickUpTask", "position");

  return {
    pickUp(logId) {
      const log = entities.entity(logId);
      if (log === undefined || logKind(log) === undefined || log.position === undefined) return;
      for (const player of players) {
        if (player.carrying !== undefined) continue;
        walking.walkTo(log.position);
        setComponent(entities, player, "logPickUpTask", { logId });
      }
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "logPickUpTask");
    },
    drop() {
      for (const player of players) {
        const carried = player.carrying;
        if (carried === undefined) continue;
        entities.removeComponent(player, "carrying");
        const { x, z } = player.position;
        entities.add({ [carried]: { heading: 0 }, position: { x, y: standingHeightAt(entities, valley.terrain, { x, z }), z } });
      }
    },
    step() {
      // Copy the list first, because players who finish or give up leave the query while it is being walked.
      for (const picker of [...pickers]) {
        if (picker.walkPath) continue;
        const log = entities.entity(picker.logPickUpTask.logId);
        entities.removeComponent(picker, "logPickUpTask");
        if (log?.position === undefined) continue;
        const distance = groundDistance(log.position, picker.position);
        if (distance <= PICK_UP_REACH_METRES) shoulderLog(entities, picker, log);
      }
    },
  };
}

/**
 * Takes a log or debarked log off the ground onto the carrier's shoulder.
 * The carrier holds one at a time, so this does nothing and returns false if their shoulder is full.
 */
export function shoulderLog(entities: EntityStore, carrier: Entity, log: Entity): boolean {
  const kind = logKind(log);
  if (carrier.carrying !== undefined || kind === undefined) return false;
  entities.remove(log);
  entities.addComponent(carrier, "carrying", kind);
  return true;
}

/** Whether the entity is a log or a debarked log, or neither. */
function logKind(entity: Entity): CarriedLog | undefined {
  if (entity.log !== undefined) return "log";
  if (entity.debarkedLog !== undefined) return "debarkedLog";
  return undefined;
}
