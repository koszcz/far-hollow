import type { ApproachReach } from "./approach";
import { addToBackpack, countInBackpack, removeFromBackpack } from "./backpack";
import { type Entity, type EntityStore } from "./entities";
import { bedrollEntities, playerEntities } from "./entity-queries";
import { standingHeightAt } from "./foundations";
import type { HandReach } from "./hand-reach";
import { leanToBedrollSpot } from "./structure-camp";
import { type Valley } from "./valley";
import { groundDistance, type GroundPoint } from "./ground-point";
import type { CommandRules, RuleGame } from "./command-rule";
import { putDown } from "./hand-reach";
import { goneRefusal } from "./refusals";

/** The player can pick up or lie down on a bedroll from this far from its middle, in metres. */
export const BEDROLL_REACH_METRES = 2;

export type BedrollEntity = Entity & { bedroll: true; position: NonNullable<Entity["position"]> };

export interface Bedrolls {
  /** Takes the bedroll out of the backpack and lays it on the ground at the player's feet. Does nothing if the backpack holds none. */
  lay(): void;
  /**
   * Where the player walks to lay the bedroll in a finished lean-to: into it, to the spot across its open front, even from
   * close by, so they never lay it through the lean-to's back or sides. Undefined if the entity is not a finished lean-to
   * or the backpack holds no bedroll.
   */
  layInLeanToReach(leanToId: number): ApproachReach | undefined;
  /**
   * Has the player reach down and lay the bedroll from the backpack across a finished lean-to's open front, under the roof.
   * The approach runs it once they stand there.
   */
  layInLeanTo(leanToId: number): void;
  /**
   * Where the player walks to pick up or sleep on a laid bedroll: onto it, or beside it if something blocks its spot.
   * A player within reach acts from where they stand. Undefined if the entity is not a laid bedroll.
   */
  reach(bedrollId: number): ApproachReach | undefined;
  /**
   * Has the player reach down for a laid bedroll within reach, to put it back in the backpack. The approach runs it once they arrive.
   * If the backpack has no room for it when the hand gets to it, it stays laid and the reach gives "backpackFull".
   */
  pickUp(bedrollId: number): void;
  /** Puts the player to sleep on a laid bedroll. The approach runs it once they stand within reach. */
  sleep(bedrollId: number): void;
  /** The laid bedroll nearest the player that is within their reach, if any. */
  nearby(): BedrollEntity | undefined;
}

/** Lets the player lay a bedroll on the ground, pick it up again, and go to sleep on it. `sleepOn` puts the player to sleep on a bedroll they have reached. */
export function createBedrolls(entities: EntityStore, valley: Valley, hand: Pick<HandReach, "start">, sleepOn: (bedroll: BedrollEntity) => void): Bedrolls {
  const players = playerEntities(entities);
  const bedrolls = bedrollEntities(entities);

  /** Where a bedroll laid in the lean-to would lie, and which way it would face, if the entity is a finished lean-to. */
  function spotInLeanTo(leanToId: number): ReturnType<typeof leanToBedrollSpot> | undefined {
    const leanTo = entities.entity(leanToId);
    if (leanTo?.leanTo !== true || leanTo.position === undefined) return undefined;
    return leanToBedrollSpot(leanTo.position, leanTo.facing?.turns ?? 0);
  }

  function bedrollById(bedrollId: number): BedrollEntity | undefined {
    const entity = entities.entity(bedrollId);
    if (entity?.bedroll !== true || entity.position === undefined) return undefined;
    return entity as BedrollEntity;
  }

  function withinReach(bedroll: BedrollEntity, at: GroundPoint): boolean {
    return groundDistance(bedroll.position, at) <= BEDROLL_REACH_METRES;
  }

  return {
    lay() {
      for (const player of players) {
        if (player.backpack === undefined || !removeFromBackpack(player.backpack, "bedroll", 1)) continue;
        const { x, z } = player.position;
        entities.add({ bedroll: true, position: { x, y: standingHeightAt(entities, valley.terrain, { x, z }), z } });
      }
    },
    layInLeanToReach(leanToId) {
      const place = spotInLeanTo(leanToId);
      const backpack = players.first?.backpack;
      if (place === undefined || backpack === undefined || countInBackpack(backpack, "bedroll") === 0) return undefined;
      return { target: place.spot, metres: BEDROLL_REACH_METRES, walk: { style: "to", spot: place.spot } };
    },
    layInLeanTo(leanToId) {
      const at = spotInLeanTo(leanToId)?.spot;
      if (at === undefined) return;
      // The hand reaches when it gets there, so it checks again that the lean-to still stands and the backpack still holds a bedroll.
      hand.start("low", at, () => {
        const place = spotInLeanTo(leanToId);
        const player = players.first;
        if (place === undefined || player?.backpack === undefined || !removeFromBackpack(player.backpack, "bedroll", 1)) return undefined;
        const { x, z } = place.spot;
        entities.add({ bedroll: true, position: { x, y: standingHeightAt(entities, valley.terrain, { x, z }), z }, facing: { turns: place.turns } });
        return undefined;
      });
    },
    reach(bedrollId) {
      const bedroll = bedrollById(bedrollId);
      if (bedroll === undefined) return undefined;
      return { target: bedroll.position, metres: BEDROLL_REACH_METRES, walk: { style: "onto", spot: bedroll.position, atOnceInReach: true } };
    },
    pickUp(bedrollId) {
      const bedroll = bedrollById(bedrollId);
      if (bedroll === undefined) return;
      for (const player of players) {
        if (player.backpack === undefined) continue;
        // The hand gets there a moment later, so it checks again that the bedroll still lies within reach.
        hand.start("low", bedroll.position, () => {
          const still = bedrollById(bedrollId);
          if (still === undefined || !withinReach(still, player.position) || player.backpack === undefined) return undefined;
          if (!addToBackpack(player.backpack, "bedroll", 1)) return "backpackFull";
          entities.remove(still);
          return undefined;
        });
      }
    },
    sleep(bedrollId) {
      const bedroll = bedrollById(bedrollId);
      if (bedroll !== undefined) sleepOn(bedroll);
    },
    nearby() {
      let nearest: BedrollEntity | undefined;
      let nearestDistance = Infinity;
      for (const player of players) {
        for (const bedroll of bedrolls) {
          const distance = groundDistance(bedroll.position, player.position);
          if (distance <= BEDROLL_REACH_METRES && distance < nearestDistance) {
            nearest = bedroll;
            nearestDistance = distance;
          }
        }
      }
      return nearest;
    },
  };
}

/** The rules for laying out, picking up, and sleeping on a bedroll. */
export function bedrollRules(
  bedrolls: Bedrolls,
  { entities, player, hand }: RuleGame,
): CommandRules<"layBedroll" | "layBedrollInLeanTo" | "pickUpBedroll" | "sleep"> {
  return {
    layBedroll: {
      start: "alongside",
      run: () => {
        if (countInBackpack(player.backpack, "bedroll") > 0)
          putDown(hand, () => {
            bedrolls.lay();
          });
      },
    },
    layBedrollInLeanTo: {
      start: "fresh",
      approach: {
        reach: (command) => bedrolls.layInLeanToReach(command.leanToId),
        act: (command) => {
          bedrolls.layInLeanTo(command.leanToId);
        },
      },
    },
    pickUpBedroll: {
      start: "fresh",
      approach: {
        reach: (command) => bedrolls.reach(command.bedrollId),
        act: (command) => {
          bedrolls.pickUp(command.bedrollId);
        },
      },
    },
    sleep: {
      start: "fresh",
      refusal: (command) => goneRefusal(entities, command.bedrollId),
      approach: {
        reach: (command) => bedrolls.reach(command.bedrollId),
        act: (command) => {
          bedrolls.sleep(command.bedrollId);
        },
      },
    },
  };
}
