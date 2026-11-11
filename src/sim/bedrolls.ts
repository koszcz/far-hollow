import { addToBackpack, fitsInBackpack, removeFromBackpack } from "./backpack";
import { bedrollEntities, playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import { standingHeightAt } from "./foundations";
import { groundDistance, type GroundPoint, type Valley } from "./valley";
import type { Walking } from "./walking";

/** The player can pick up or lie down on a bedroll from this far from its middle, in metres. */
export const BEDROLL_REACH_METRES = 2;

export type BedrollEntity = Entity & { bedroll: true; position: NonNullable<Entity["position"]> };

export interface Bedrolls {
  /** Takes the bedroll out of the backpack and lays it on the ground at the player's feet. Does nothing if the backpack holds none. */
  lay(): void;
  /**
   * Puts a laid bedroll back in the backpack, walking the player to it first if it is out of reach.
   * Does nothing if the entity is not a laid bedroll or the backpack has no room for it.
   */
  pickUp(bedrollId: number): void;
  /**
   * Returns the bedroll to sleep on now, if it is within the player's reach.
   * If it is further away, sets the player walking to it, and `step` returns it once they arrive.
   */
  sleep(bedrollId: number): BedrollEntity | undefined;
  /** Stops the player walking to a bedroll. */
  cancel(): void;
  /** Acts on a bedroll the player has reached. Returns the bedroll to sleep on, if the player has reached one to sleep on. Run it after walking. */
  step(): BedrollEntity | undefined;
  /** The laid bedroll nearest the player that is within their reach, if any. */
  nearby(): BedrollEntity | undefined;
}

/** Lets the player lay a bedroll on the ground, pick it up again, and go to sleep on it. */
export function createBedrolls(entities: EntityStore, walking: Walking, valley: Valley): Bedrolls {
  const players = playerEntities(entities);
  const bedrolls = bedrollEntities(entities);
  const walkers = entities.with("bedrollTask", "position", "backpack");

  function bedrollById(bedrollId: number): BedrollEntity | undefined {
    const entity = entities.entity(bedrollId);
    if (entity?.bedroll !== true || entity.position === undefined) return undefined;
    return entity as BedrollEntity;
  }

  function withinReach(bedroll: BedrollEntity, at: GroundPoint): boolean {
    return groundDistance(bedroll.position, at) <= BEDROLL_REACH_METRES;
  }

  /** Puts the bedroll back in the backpack, if there is room. */
  function pickUpNow(bedroll: BedrollEntity, player: Entity): void {
    if (player.backpack !== undefined && addToBackpack(player.backpack, "bedroll", 1)) entities.remove(bedroll);
  }

  /** Walks the player to a bedroll out of reach, to act on it there. Returns true if the player is already within reach. */
  function goTo(bedrollId: number, bedroll: BedrollEntity, then: "pickUp" | "sleep"): boolean {
    let inReach = false;
    for (const player of players) {
      if (withinReach(bedroll, player.position)) {
        inReach = true;
        continue;
      }
      walking.walkTo(bedroll.position);
      setComponent(entities, player, "bedrollTask", { bedrollId, then });
    }
    return inReach;
  }

  return {
    lay() {
      for (const player of players) {
        if (player.backpack === undefined || !removeFromBackpack(player.backpack, "bedroll", 1)) continue;
        const { x, z } = player.position;
        entities.add({ bedroll: true, position: { x, y: standingHeightAt(entities, valley.terrain, { x, z }), z } });
      }
    },
    pickUp(bedrollId) {
      const bedroll = bedrollById(bedrollId);
      if (bedroll === undefined) return;
      for (const player of players) {
        if (player.backpack === undefined || !fitsInBackpack(player.backpack, "bedroll", 1)) continue;
        if (goTo(bedrollId, bedroll, "pickUp")) pickUpNow(bedroll, player);
      }
    },
    sleep(bedrollId) {
      const bedroll = bedrollById(bedrollId);
      if (bedroll === undefined) return undefined;
      return goTo(bedrollId, bedroll, "sleep") ? bedroll : undefined;
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "bedrollTask");
    },
    step() {
      let sleepOn: BedrollEntity | undefined;
      // Copy the list first, because players who arrive leave the query while it is being walked.
      for (const walker of [...walkers]) {
        if (walker.walkPath !== undefined) continue;
        const { bedrollId, then } = walker.bedrollTask;
        entities.removeComponent(walker, "bedrollTask");
        const bedroll = bedrollById(bedrollId);
        if (bedroll === undefined || !withinReach(bedroll, walker.position)) continue;
        if (then === "pickUp") pickUpNow(bedroll, walker);
        else sleepOn = bedroll;
      }
      return sleepOn;
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
