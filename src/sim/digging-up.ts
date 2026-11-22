// Digging up a sapling or a berry bush into the backpack. The player walks into reach of it, works for a few seconds with no tool,
// and puts it in the backpack. Digging up the sapling on a stump removes the stump for good, so the ground is free to walk on
// and build on. A berry bush comes up with its berries, if it has any, and its spot stays empty for good.
// See .scratch/regrowth/spec.md and .scratch/garden/spec.md.
import type { PlainNotice, Refusal } from "./api";
import type { ApproachReach } from "./approach";
import { addAllToBackpack, allFitInBackpack, type BackpackContents } from "./backpack";
import { playerEntities, setComponent, type Entity, type EntityStore, type Vec3 } from "./entities";
import { FOOD_PER_FORAGE, isBerryBush } from "./foraging";
import { goneRefusal } from "./refusals";
import type { CommandRules } from "./command-rule";
import { isBareStump, isSapling, isYoungTree } from "./tree-growth";

/** How long the player works to dig up one sapling or berry bush, in seconds. */
export const DIG_UP_SECONDS = 4;

/** How far from each thing the player digs it up, in metres: a sapling from 1 m outside its stump's edge, a berry bush from 1.5 m from its middle. */
const DIG_UP_REACH_METRES: Readonly<Record<DugUp, (thing: Entity) => number>> = {
  sapling: (thing) => (thing.blocksWalking?.radius ?? 0) + 1,
  berryBush: () => 1.5,
};

/** How far the player is through digging up a sapling or berry bush, from 0 to 1, and what they dig up, or undefined if they are not digging now. */
export function diggingUpNow(player: Entity): { progress: number; targetId: number } | undefined {
  if (player.digUpTask === undefined) return undefined;
  return { progress: Math.min(1, player.digUpTask.secondsDone / DIG_UP_SECONDS), targetId: player.digUpTask.thingId };
}

/** What the player digs up: a sapling or a berry bush. */
export type DugUp = "sapling" | "berryBush";

export interface DiggingUp {
  /** Where the approach takes the player to dig up a sapling or berry bush: within reach of it. Undefined if the entity is not one of `kind`. */
  reach(kind: DugUp, thingId: number): ApproachReach | undefined;
  /** Starts the player digging up a sapling or berry bush within reach. The approach runs it once they arrive. The game calls it only once `refusal` passes. */
  start(kind: DugUp, thingId: number): void;
  /**
   * Why the player could not dig this up now: it is gone or not one of `kind`, it is a bare stump, it is a young or full tree,
   * or it does not fit in the backpack. A berry bush must fit with its berries.
   */
  refusal(kind: DugUp, thingId: number): Refusal | undefined;
  /** Stops the player digging. The sapling or bush stays as it is. */
  cancel(): void;
  /** Moves digging on by one logic step. Returns "backpackFull" if what was dug up no longer fits when the work is done. */
  step(stepSeconds: number): PlainNotice | undefined;
}

/** Lets the player dig up saplings and berry bushes into the backpack. */
export function createDiggingUp(entities: EntityStore): DiggingUp {
  const players = playerEntities(entities);
  const diggers = entities.with("digUpTask", "position", "backpack");

  /** Why the entity with this id cannot be dug up as `kind`, wherever the player stands, leaving the backpack aside. */
  function thingRefusal(kind: DugUp, thingId: number): Refusal | undefined {
    const gone = goneRefusal(entities, thingId);
    if (gone !== undefined) return gone;
    const entity = entities.entity(thingId);
    if (kind === "berryBush") return entity !== undefined && isBerryBush(entity) ? undefined : { kind: "gone" };
    if (entity?.tree === true || isYoungTree(entity?.growth)) return { kind: "tooBigToDigUp" };
    if (isBareStump(entity?.growth)) return { kind: "noSaplingYet" };
    return undefined;
  }

  /** The sapling or berry bush with this id, if it is one the player can dig up, and what it puts in the backpack. */
  function diggable(thingId: number): { entity: Entity & { position: Vec3 }; kind: DugUp; yields: BackpackContents } | undefined {
    const entity = entities.entity(thingId);
    if (entity?.position === undefined) return undefined;
    const placed = entity as Entity & { position: Vec3 };
    if (isSapling(entity.growth)) return { entity: placed, kind: "sapling", yields: { sapling: 1 } };
    if (!isBerryBush(entity)) return undefined;
    // A bush growing its berries back has none to give.
    const yields: BackpackContents = entity.regrowing === undefined ? { berryBush: 1, berries: FOOD_PER_FORAGE.berries } : { berryBush: 1 };
    return { entity: placed, kind: "berryBush", yields };
  }

  function diggableAs(kind: DugUp, thingId: number) {
    const thing = diggable(thingId);
    return thing?.kind === kind ? thing : undefined;
  }

  return {
    reach(kind, thingId) {
      const thing = diggableAs(kind, thingId);
      if (thing === undefined) return undefined;
      return { target: thing.entity.position, metres: DIG_UP_REACH_METRES[kind](thing.entity), walk: { style: "beside" } };
    },
    start(kind, thingId) {
      if (diggableAs(kind, thingId) === undefined) return;
      for (const player of players) setComponent(entities, player, "digUpTask", { thingId, secondsDone: 0 });
    },
    refusal(kind, thingId) {
      const why = thingRefusal(kind, thingId);
      if (why !== undefined) return why;
      const backpack = players.first?.backpack;
      const thing = diggableAs(kind, thingId);
      if (backpack === undefined || thing === undefined) return undefined;
      return allFitInBackpack(backpack, thing.yields) ? undefined : { kind: "backpackFull" };
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "digUpTask");
    },
    step(stepSeconds) {
      let notice: PlainNotice | undefined;
      // Copy the list first, because players who finish or give up leave the query while it is being walked.
      for (const digger of [...diggers]) {
        const thing = diggable(digger.digUpTask.thingId);
        if (thing === undefined) {
          entities.removeComponent(digger, "digUpTask");
          continue;
        }
        digger.digUpTask.secondsDone += stepSeconds;
        if (digger.digUpTask.secondsDone < DIG_UP_SECONDS) continue;
        entities.removeComponent(digger, "digUpTask");
        // The backpack may have filled up while the player dug.
        if (!addAllToBackpack(digger.backpack, thing.yields)) {
          notice = "backpackFull";
          continue;
        }
        // A sapling comes up with its stump, if it grew from one. Removing the entity frees the ground it blocked.
        entities.remove(thing.entity);
      }
      return notice;
    },
  };
}

/** The rules for digging up a sapling and a berry bush. */
export function diggingUpRules(diggingUp: DiggingUp): CommandRules<"digUpSapling" | "digUpBerryBush"> {
  return {
    digUpSapling: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => diggingUp.refusal("sapling", command.saplingId),
      approach: {
        reach: (command) => diggingUp.reach("sapling", command.saplingId),
        act: (command) => {
          diggingUp.start("sapling", command.saplingId);
        },
      },
    },
    digUpBerryBush: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => diggingUp.refusal("berryBush", command.bushId),
      approach: {
        reach: (command) => diggingUp.reach("berryBush", command.bushId),
        act: (command) => {
          diggingUp.start("berryBush", command.bushId);
        },
      },
    },
  };
}
