import type { Refusal } from "./api";
import type { ApproachReach } from "./approach";
import { addToBackpack, fitsInBackpack, hasInBackpack, type Backpack } from "./backpack";
import { playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import { toolRefusal } from "./refusals";
import { groundDistance, stepAlongHeading, type GroundPoint } from "./ground-point";
import type { CommandRules, RuleGame } from "./command-rule";

/** How long the player works at a log with the drawknife to strip its bark, in seconds. */
export const DEBARK_SECONDS = 4;

/** How far the player is through debarking, from 0 to 1, and the log they debark, or undefined if they are not debarking now. */
export function debarkingNow(player: Entity): { progress: number; targetId: number } | undefined {
  if (player.debarkTask === undefined) return undefined;
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
   * Where the approach takes the player to debark a log: onto the spot just off the log's end nearer them, or within reach of it.
   * Undefined if the entity is not a log on the ground.
   */
  reach(logId: number): ApproachReach | undefined;
  /**
   * Starts the player stripping the bark off a log on the ground within reach, with the drawknife. The approach runs it once they arrive.
   * Does nothing if the entity is not a log on the ground, or the bark would not fit. The game calls it only once `refusal` passes.
   * Returns "backpackFull" when the backpack has no room for the bark.
   */
  start(logId: number): DebarkRefusal | undefined;
  /** Why the player could not debark a log now: without the drawknife. */
  refusal(): Refusal | undefined;
  /** "backpackFull" if the backpack has no room for a log's bark now, so the player does not set off to debark one. */
  roomRefusal(): DebarkRefusal | undefined;
  /** Stops the player debarking. The log keeps its bark. */
  cancel(): void;
  /** Moves every debarking on by one logic step. Run it after walking has moved the player. */
  step(stepSeconds: number): undefined;
}

/** Lets the player strip the bark off logs on the ground. Each log becomes a debarked log, and its bark goes in the backpack. */
export function createDebarking(entities: EntityStore): Debarking {
  const players = playerEntities(entities);
  const debarkers = entities.with("debarkTask", "position", "backpack");

  return {
    reach(logId) {
      const log = entities.entity(logId);
      if (log?.log === undefined || log.position === undefined) return undefined;
      return {
        target: log.position,
        metres: DEBARK_REACH_METRES,
        walk: { style: "onto", spot: standingSpot(log.position, log.log.heading, players.first?.position) },
      };
    },
    start(logId) {
      const log = entities.entity(logId);
      if (log?.log === undefined || log.position === undefined) return undefined;
      let refusal: DebarkRefusal | undefined;
      for (const player of players) {
        if (player.backpack === undefined) continue;
        if (!barkFits(player.backpack)) {
          refusal = "backpackFull";
          continue;
        }
        setComponent(entities, player, "debarkTask", { logId, secondsDone: 0 });
      }
      return refusal;
    },
    refusal() {
      return toolRefusal(players.first, "drawknife");
    },
    roomRefusal() {
      const backpack = players.first?.backpack;
      return backpack === undefined || barkFits(backpack) ? undefined : "backpackFull";
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "debarkTask");
    },
    step(stepSeconds) {
      // Copy the list first, because players who finish or give up leave the query while it is being walked.
      for (const debarker of [...debarkers]) {
        const log = entities.entity(debarker.debarkTask.logId);
        if (log?.log === undefined || log.position === undefined || !hasInBackpack(debarker.backpack, "drawknife") || !barkFits(debarker.backpack)) {
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
  const ahead = stepAlongHeading(middle, heading, DEBARK_STAND_METRES);
  const behind = stepAlongHeading(middle, heading, -DEBARK_STAND_METRES);
  return from === undefined || groundDistance(ahead, from) <= groundDistance(behind, from) ? ahead : behind;
}

function barkFits(backpack: Backpack): boolean {
  return fitsInBackpack(backpack, "bark", BARK_PER_LOG);
}

/** The rule for debarking a log. */
export function debarkingRules(debarking: Debarking, { startApproach }: RuleGame): CommandRules<"debarkLog"> {
  return {
    debarkLog: {
      start: "fresh",
      needsFreeHands: true,
      refusal: () => debarking.refusal(),
      // A full backpack turns the player away before they set off.
      run: (command) => debarking.roomRefusal() ?? startApproach(command),
      approach: {
        reach: (command) => debarking.reach(command.logId),
        act: (command) => debarking.start(command.logId),
      },
    },
  };
}
