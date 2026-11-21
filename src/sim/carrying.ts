import type { Refusal } from "./api";
import type { ApproachReach } from "./approach";
import { playerEntities, setComponent, type CarriedLog, type Entity, type EntityStore } from "./entities";
import { shoulderRefusal } from "./refusals";
import { standingHeightAt } from "./foundations";
import type { HandReach } from "./hand-reach";
import { type Valley } from "./valley";
import { groundDistance, type GroundPoint } from "./ground-point";

/** The player can pick up a log from this far away, in metres. */
const PICK_UP_REACH_METRES = 2;

export interface Carrying {
  /**
   * Where the player walks to pick up a log or debarked log on the ground: onto it, or beside it if something blocks its spot.
   * Undefined if the entity is not one of those.
   */
  pickUpReach(logId: number): ApproachReach | undefined;
  /**
   * Has the player reach down for a log or debarked log within reach and shoulder it. The approach runs it once they arrive.
   * With `thenSplit`, the player starts splitting it into firewood once it is on their shoulder, if it is a log.
   */
  pickUp(logId: number, thenSplit?: boolean): void;
  /** Why the player could not pick up a log now: one is already on their shoulder. */
  pickUpRefusal(): Refusal | undefined;
  /** Lays the carried log or debarked log on the ground at the player's feet. Does nothing if the player carries nothing. */
  drop(): void;
  /** Where the player walks to lay the carried log at a spot: to the spot itself. Undefined if the player carries nothing. */
  dropReach(spot: GroundPoint): ApproachReach | undefined;
  /** Has the player reach down and lay the carried log at a spot within reach. The approach runs it once they arrive. */
  dropAt(spot: GroundPoint): void;
}

/** Keeps track of what the player carries on their shoulder. One log or debarked log fits at a time. */
export function createCarrying(entities: EntityStore, valley: Valley, hand: Pick<HandReach, "start">): Carrying {
  const players = playerEntities(entities);

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
    pickUpReach(logId) {
      const log = entities.entity(logId);
      if (log === undefined || logKind(log) === undefined || log.position === undefined) return undefined;
      return { target: log.position, metres: PICK_UP_REACH_METRES, walk: { style: "onto", spot: log.position } };
    },
    pickUp(logId, thenSplit = false) {
      for (const picker of players) {
        const log = logInReach(logId, picker);
        if (log?.position === undefined) continue;
        hand.start("low", log.position, () => {
          const still = logInReach(logId, picker);
          const shouldered = still !== undefined && shoulderLog(entities, picker, still);
          // Splitting checks the axe and the backpack's room each step, so it stops on its own if either is missing.
          if (shouldered && thenSplit && picker.carrying === "log") setComponent(entities, picker, "splitTask", { secondsDone: 0 });
          return undefined;
        });
      }
    },
    pickUpRefusal() {
      return shoulderRefusal(players.first);
    },
    drop() {
      for (const player of players) dropFrom(player);
    },
    dropReach(spot) {
      if (players.first?.carrying === undefined) return undefined;
      const at = { x: spot.x, z: spot.z };
      return { target: at, metres: PICK_UP_REACH_METRES, walk: { style: "to", spot: at } };
    },
    dropAt(spot) {
      for (const dropper of players) {
        if (dropper.carrying === undefined || groundDistance(spot, dropper.position) > PICK_UP_REACH_METRES) continue;
        hand.start("low", { x: spot.x, z: spot.z }, () => {
          dropFrom(dropper);
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
