import { playerEntities, setComponent, type CarriedLog, type Entity, type EntityStore } from "./entities";
import { standingHeightAt } from "./foundations";
import type { HandReach } from "./hand-reach";
import { groundDistance, type GroundPoint, type Valley } from "./valley";
import type { Walking } from "./walking";

/** The player can pick up a log from this far away, in metres. */
const PICK_UP_REACH_METRES = 2;

export interface Carrying {
  /**
   * Sets the player walking to a log or debarked log on the ground. Once there, they reach down and shoulder it.
   * Does nothing if the entity is not one of those or the player already carries one.
   * With `thenSplit`, the player starts splitting it into firewood once it is on their shoulder, if it is a log.
   */
  pickUp(logId: number, thenSplit?: boolean): void;
  /** Stops the player walking to pick up or drop a log. */
  cancel(): void;
  /** Lays the carried log or debarked log on the ground at the player's feet. Does nothing if the player carries nothing. */
  drop(): void;
  /**
   * Sets the player walking to a spot to lay the carried log there. When they stop within reach of the spot, they reach down and the log goes down.
   * Does nothing if the player carries nothing.
   */
  dropAt(spot: GroundPoint): void;
  /** Starts the player reaching to pick up logs and drop logs where they have walked to. Run it after walking has moved the player. */
  step(): undefined;
}

/** Keeps track of what the player carries on their shoulder. One log or debarked log fits at a time. */
export function createCarrying(entities: EntityStore, walking: Walking, valley: Valley, hand: Pick<HandReach, "start">): Carrying {
  const players = playerEntities(entities);
  const pickers = entities.with("logPickUpTask", "position");
  const droppers = entities.with("logDropTask", "position");

  function dropFrom(player: Entity & { position: { x: number; z: number } }): void {
    const carried = player.carrying;
    if (carried === undefined) return;
    entities.removeComponent(player, "carrying");
    const { x, z } = player.position;
    entities.add({ [carried]: { heading: 0 }, position: { x, y: standingHeightAt(entities, valley.terrain, { x, z }), z } });
  }

  /** The entity with this id, if it is within the player's reach. */
  function logInReach(logId: number, player: { position: GroundPoint }): Entity | undefined {
    const log = entities.entity(logId);
    return log?.position === undefined || groundDistance(log.position, player.position) > PICK_UP_REACH_METRES ? undefined : log;
  }

  return {
    pickUp(logId, thenSplit = false) {
      const log = entities.entity(logId);
      if (log === undefined || logKind(log) === undefined || log.position === undefined) return;
      for (const player of players) {
        if (player.carrying !== undefined) continue;
        walking.walkTo(log.position);
        setComponent(entities, player, "logPickUpTask", thenSplit ? { logId, thenSplit: true } : { logId });
      }
    },
    cancel() {
      for (const player of players) {
        entities.removeComponent(player, "logPickUpTask");
        entities.removeComponent(player, "logDropTask");
      }
    },
    drop() {
      for (const player of players) dropFrom(player);
    },
    dropAt(spot) {
      for (const player of players) {
        if (player.carrying === undefined) continue;
        walking.walkTo(spot);
        setComponent(entities, player, "logDropTask", { x: spot.x, z: spot.z });
      }
    },
    step() {
      for (const dropper of [...droppers]) {
        if (dropper.walkPath) continue;
        const spot = dropper.logDropTask;
        entities.removeComponent(dropper, "logDropTask");
        if (groundDistance(spot, dropper.position) <= PICK_UP_REACH_METRES) {
          hand.start("low", spot, () => {
            dropFrom(dropper);
            return undefined;
          });
        }
      }
      // Copy the list first, because players who finish or give up leave the query while it is being walked.
      for (const picker of [...pickers]) {
        if (picker.walkPath) continue;
        const { logId, thenSplit } = picker.logPickUpTask;
        entities.removeComponent(picker, "logPickUpTask");
        const log = logInReach(logId, picker);
        if (log?.position === undefined) continue;
        hand.start("low", log.position, () => {
          const still = logInReach(logId, picker);
          const shouldered = still !== undefined && shoulderLog(entities, picker, still);
          // Splitting checks the axe and the backpack's room each step, so it stops on its own if either is missing.
          if (shouldered && thenSplit === true && picker.carrying === "log") setComponent(entities, picker, "splitTask", { secondsDone: 0 });
          return undefined;
        });
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
