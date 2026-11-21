// Digging up a sapling into the backpack. The player walks into reach of the sapling, works for a few seconds with no tool,
// and puts the sapling in the backpack. Digging up the sapling on a stump removes the stump for good, so the ground is
// free to walk on and build on. See .scratch/regrowth/spec.md.
import type { PlainNotice, Refusal } from "./api";
import type { ApproachReach } from "./approach";
import { addToBackpack, fitsInBackpack } from "./backpack";
import { playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import { goneRefusal } from "./refusals";

/** How long the player works to dig up one sapling, in seconds. */
export const DIG_UP_SECONDS = 4;

/** The player digs up a sapling from this far outside the stump's edge, in metres. */
const DIG_UP_REACH_METRES = 1;

/** How far the player is through digging up a sapling, from 0 to 1, and the sapling, or undefined if they are not digging now. */
export function diggingUpNow(player: Entity): { progress: number; targetId: number } | undefined {
  if (player.digUpTask === undefined) return undefined;
  return { progress: Math.min(1, player.digUpTask.secondsDone / DIG_UP_SECONDS), targetId: player.digUpTask.saplingId };
}

export interface DiggingUp {
  /** Where the approach takes the player to dig up a sapling: within reach of it. Undefined if the entity is not a growing tree. */
  reach(saplingId: number): ApproachReach | undefined;
  /** Starts the player digging up a sapling within reach. The approach runs it once they arrive. The game calls it only once `refusal` passes. */
  start(saplingId: number): void;
  /**
   * Why the player could not dig up this sapling now: it is gone, it is a bare stump, it is a young or full tree,
   * or it does not fit in the backpack.
   */
  refusal(saplingId: number): Refusal | undefined;
  /** Stops the player digging. The sapling stays as it is. */
  cancel(): void;
  /** Moves digging on by one logic step. Returns "backpackFull" if the sapling no longer fits when the work is done. */
  step(stepSeconds: number): PlainNotice | undefined;
}

/** Lets the player dig up saplings into the backpack. */
export function createDiggingUp(entities: EntityStore): DiggingUp {
  const players = playerEntities(entities);
  const diggers = entities.with("digUpTask", "position", "backpack");

  /** Why the entity with this id cannot be dug up, wherever the player stands, leaving the backpack aside. */
  function saplingRefusal(saplingId: number): Refusal | undefined {
    const gone = goneRefusal(entities, saplingId);
    if (gone !== undefined) return gone;
    const entity = entities.entity(saplingId);
    if (entity?.tree === true || entity?.growth?.stage === "youngTree") return { kind: "tooBigToDigUp" };
    if (entity?.growth?.stage === "stump") return { kind: "noSaplingYet" };
    return undefined;
  }

  /** The sapling with this id, if it is one the player can dig up. */
  function saplingOf(saplingId: number): (Entity & { position: NonNullable<Entity["position"]> }) | undefined {
    const entity = entities.entity(saplingId);
    if (entity?.growth?.stage !== "sapling" || entity.position === undefined) return undefined;
    return entity as Entity & { position: NonNullable<Entity["position"]> };
  }

  return {
    reach(saplingId) {
      const sapling = saplingOf(saplingId);
      if (sapling === undefined) return undefined;
      return { target: sapling.position, metres: (sapling.blocksWalking?.radius ?? 0) + DIG_UP_REACH_METRES, walk: { style: "beside" } };
    },
    start(saplingId) {
      if (saplingOf(saplingId) === undefined) return;
      for (const player of players) setComponent(entities, player, "digUpTask", { saplingId, secondsDone: 0 });
    },
    refusal(saplingId) {
      const why = saplingRefusal(saplingId);
      if (why !== undefined) return why;
      const backpack = players.first?.backpack;
      return backpack === undefined || fitsInBackpack(backpack, "sapling", 1) ? undefined : { kind: "backpackFull" };
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "digUpTask");
    },
    step(stepSeconds) {
      let notice: PlainNotice | undefined;
      // Copy the list first, because players who finish or give up leave the query while it is being walked.
      for (const digger of [...diggers]) {
        const sapling = saplingOf(digger.digUpTask.saplingId);
        if (sapling === undefined) {
          entities.removeComponent(digger, "digUpTask");
          continue;
        }
        digger.digUpTask.secondsDone += stepSeconds;
        if (digger.digUpTask.secondsDone < DIG_UP_SECONDS) continue;
        entities.removeComponent(digger, "digUpTask");
        // The backpack may have filled up while the player dug.
        if (!addToBackpack(digger.backpack, "sapling", 1)) {
          notice = "backpackFull";
          continue;
        }
        // The sapling comes up with its stump, if it grew from one. Removing the entity frees the ground it blocked.
        entities.remove(sapling);
      }
      return notice;
    },
  };
}
