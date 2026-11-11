import { playerEntities, type Entity, type EntityStore } from "./entities";
import { terrainHeightAt, type Valley } from "./valley";
import type { Walking } from "./walking";

/** The player can pick up a log from this far away, in metres. */
const PICK_UP_REACH_METRES = 2;

export interface Carrying {
  /**
   * Sets the player walking to a log on the ground to shoulder it.
   * Does nothing if the entity is not a log on the ground or the player already carries a log.
   */
  pickUp(logId: number): void;
  /** Stops the player walking to pick up a log. */
  cancel(): void;
  /** Lays the carried log on the ground at the player's feet. Does nothing if the player carries nothing. */
  drop(): void;
  /** Picks up logs the player has reached. Run it after walking has moved the player. */
  step(): void;
}

/** Keeps track of what the player carries on their shoulder. One log fits at a time. */
export function createCarrying(entities: EntityStore, walking: Walking, valley: Valley): Carrying {
  const players = playerEntities(entities);
  const pickers = entities.with("pickUpTask", "position");

  return {
    pickUp(logId) {
      const log = entities.entity(logId);
      if (log?.log === undefined || log.position === undefined) return;
      for (const player of players) {
        if (player.carrying !== undefined) continue;
        walking.walkTo(log.position);
        if (player.pickUpTask) player.pickUpTask = { logId };
        else entities.addComponent(player, "pickUpTask", { logId });
      }
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "pickUpTask");
    },
    drop() {
      for (const player of players) {
        if (player.carrying !== "log") continue;
        entities.removeComponent(player, "carrying");
        const { x, z } = player.position;
        entities.add({ log: { heading: 0 }, position: { x, y: terrainHeightAt(valley.terrain, x, z), z } });
      }
    },
    step() {
      // Copy the list first, because players who finish or give up leave the query while it is being walked.
      for (const picker of [...pickers]) {
        if (picker.walkPath) continue;
        const log = entities.entity(picker.pickUpTask.logId);
        entities.removeComponent(picker, "pickUpTask");
        if (log?.position === undefined) continue;
        const distance = Math.hypot(log.position.x - picker.position.x, log.position.z - picker.position.z);
        if (distance <= PICK_UP_REACH_METRES) shoulderLog(entities, picker, log);
      }
    },
  };
}

/**
 * Takes a log off the ground onto the carrier's shoulder.
 * The carrier holds one log at a time, so this does nothing and returns false if their shoulder is full.
 */
export function shoulderLog(entities: EntityStore, carrier: Entity, log: Entity): boolean {
  if (carrier.carrying !== undefined || log.log === undefined) return false;
  entities.remove(log);
  entities.addComponent(carrier, "carrying", "log");
  return true;
}
