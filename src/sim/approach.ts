// The approach: the walk the player makes to get within reach of a thing or a spot, so they can act on it there.
// A command that walks first starts an approach. The player's pending approach stores that command, as plain data, so a
// save made mid-walk loads and the player carries on (ADR 0010). When the walk ends, the game checks the command's
// refusal again. If it passes and the player stands within reach, the command's act step runs. It is not sent again.
import type { Activity } from "./activity";
import type { ActionCommand, Notice, PlainNotice, Refusal } from "./api";
import { playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import type { GroundPoint } from "./ground-point";
import { refusedNotice } from "./notices";
import { distanceToTarget, type WalkTarget } from "./pathfinding";
import { isWalkable } from "./walk-map";
import { WALK_REACH_MARGIN_METRES, type Walking } from "./walking";

/**
 * How the player walks to get within reach.
 * - "beside": the shortest way to stand `standMetres` from the target, on the side they come from. Without `standMetres`,
 *   they stop WALK_REACH_MARGIN_METRES inside the reach. A player already within reach acts at once, without walking.
 *   Use it for things that block walking, such as a bed or a campfire.
 * - "onto": onto `spot` if it is open ground, or else beside the target. Use it for things lying on the ground, such as a stick.
 *   The player walks onto the spot even from within reach, unless `atOnceInReach` is set.
 * - "to": always to `spot` itself, even from within reach, such as into a lean-to.
 */
export type ApproachWalk =
  | { readonly style: "beside"; readonly standMetres?: number }
  | { readonly style: "onto"; readonly spot: GroundPoint; readonly atOnceInReach?: true }
  | { readonly style: "to"; readonly spot: GroundPoint };

/** Where a command's approach takes the player: within `metres` of a target, measured to a point or to a rectangle's edge. */
export interface ApproachReach {
  readonly target: WalkTarget;
  readonly metres: number;
  readonly walk: ApproachWalk;
}

/** What the approach asks the game about each command. */
export interface ApproachRules {
  /** Where the command's approach takes the player, or undefined if it has nothing to walk to, such as a thing of the wrong kind. */
  reach(command: ActionCommand): ApproachReach | undefined;
  /** Why the game would turn the command away now, or null if it would not. */
  refusal(command: ActionCommand): Refusal | null;
  /** Carries the command out, once the player stands within reach. It may return a notice, such as a full backpack. */
  act(command: ActionCommand): Notice | PlainNotice | undefined;
  /** Stops whatever else the player was doing, just before they set off on an approach. */
  stopOtherWork(): void;
}

export interface Approach extends Activity {
  /**
   * Carries a command out now if the player stands within its reach, or else starts the approach for it.
   * Does nothing if the command has nothing to walk to. Returns the act step's notice, if it ran now.
   */
  start(command: ActionCommand): Notice | PlainNotice | undefined;
  /** Ends the pending approach. The player keeps walking, but nothing happens when they arrive. */
  cancel(): void;
  /** Acts for a player whose approach walk has just ended. Run it after walking. */
  step(): Notice | PlainNotice | undefined;
}

export function createApproach(entities: EntityStore, walking: Walking, rules: ApproachRules): Approach {
  const players = playerEntities(entities);
  const approachers = entities.with("approach", "position");

  const withinReach = (reach: ApproachReach, at: GroundPoint) => distanceToTarget(reach.target, at) <= reach.metres;

  function walk(reach: ApproachReach): void {
    const { walk: how } = reach;
    if (how.style === "to") walking.walkTo(how.spot);
    else if (how.style === "onto" && isWalkable(walking.walkMap, how.spot)) walking.walkTo(how.spot);
    else walking.walkWithin(reach.target, how.style === "beside" && how.standMetres !== undefined ? how.standMetres : reach.metres - WALK_REACH_MARGIN_METRES);
  }

  const actsAtOnce = ({ walk: how }: ApproachReach) => how.style === "beside" || (how.style === "onto" && how.atOnceInReach === true);

  function stopApproach(player: Entity): void {
    entities.removeComponent(player, "approach");
  }

  return {
    start(command) {
      const reach = rules.reach(command);
      const player = players.first;
      if (reach === undefined || player === undefined) return undefined;
      if (actsAtOnce(reach) && withinReach(reach, player.position)) {
        // A player already within reach but still walking stops here, so they act without walking past.
        entities.removeComponent(player, "walkPath");
        return rules.act(command);
      }
      rules.stopOtherWork();
      walk(reach);
      setComponent(entities, player, "approach", { command: structuredClone(command) });
      return undefined;
    },
    cancel() {
      for (const player of players) stopApproach(player);
    },
    step() {
      let notice: Notice | PlainNotice | undefined;
      // Copy the list first, because players who arrive leave the query while it is being walked.
      for (const player of [...approachers]) {
        if (player.walkPath !== undefined) continue;
        const { command } = player.approach;
        stopApproach(player);
        const refusal = rules.refusal(command);
        if (refusal !== null) {
          notice = refusedNotice(refusal);
          continue;
        }
        const reach = rules.reach(command);
        if (reach !== undefined && withinReach(reach, player.position)) notice = rules.act(command) ?? notice;
      }
      return notice;
    },
  };
}
