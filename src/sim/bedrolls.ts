import { addToBackpack, removeFromBackpack } from "./backpack";
import { bedrollEntities, playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import { standingHeightAt } from "./foundations";
import type { HandReach } from "./hand-reach";
import { groundDistance, type GroundPoint, type Valley } from "./valley";
import type { Walking } from "./walking";

/** The player can pick up or lie down on a bedroll from this far from its middle, in metres. */
export const BEDROLL_REACH_METRES = 2;

export type BedrollEntity = Entity & { bedroll: true; position: NonNullable<Entity["position"]> };

export interface Bedrolls {
  /** Takes the bedroll out of the backpack and lays it on the ground at the player's feet. Does nothing if the backpack holds none. */
  lay(): void;
  /**
   * Puts a laid bedroll back in the backpack, walking the player to it first if it is out of reach. They reach down for it there.
   * Does nothing if the entity is not a laid bedroll. If the backpack has no room for it when the hand gets to it,
   * it stays laid and the reach gives "backpackFull".
   */
  pickUp(bedrollId: number): void;
  /**
   * Puts the player to sleep on a laid bedroll now, if it is within their reach.
   * If it is further away, sets the player walking to it, and `step` puts them to sleep once they arrive.
   */
  sleep(bedrollId: number): void;
  /** Stops the player walking to a bedroll. */
  cancel(): void;
  /** Acts on a bedroll the player has reached: picks it up, or puts them to sleep on it. Run it after walking. */
  step(): undefined;
  /** The laid bedroll nearest the player that is within their reach, if any. */
  nearby(): BedrollEntity | undefined;
}

/** Lets the player lay a bedroll on the ground, pick it up again, and go to sleep on it. `sleepOn` puts the player to sleep on a bedroll they have reached. */
export function createBedrolls(
  entities: EntityStore,
  walking: Walking,
  valley: Valley,
  hand: Pick<HandReach, "start">,
  sleepOn: (bedroll: BedrollEntity) => void,
): Bedrolls {
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

  /** Reaches down for the bedroll. When the hand gets to it, it goes back in the backpack if it is still there and fits. */
  function pickUpNow(bedrollId: number, bedroll: BedrollEntity, player: Entity & { position: GroundPoint }): void {
    hand.start("low", bedroll.position, () => {
      const still = bedrollById(bedrollId);
      if (still === undefined || !withinReach(still, player.position) || player.backpack === undefined) return undefined;
      if (!addToBackpack(player.backpack, "bedroll", 1)) return "backpackFull";
      entities.remove(still);
      return undefined;
    });
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
        if (player.backpack === undefined) continue;
        if (goTo(bedrollId, bedroll, "pickUp")) pickUpNow(bedrollId, bedroll, player);
      }
    },
    sleep(bedrollId) {
      const bedroll = bedrollById(bedrollId);
      if (bedroll !== undefined && goTo(bedrollId, bedroll, "sleep")) sleepOn(bedroll);
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "bedrollTask");
    },
    step() {
      let reached: BedrollEntity | undefined;
      // Copy the list first, because players who arrive leave the query while it is being walked.
      for (const walker of [...walkers]) {
        if (walker.walkPath !== undefined) continue;
        const { bedrollId, then } = walker.bedrollTask;
        entities.removeComponent(walker, "bedrollTask");
        const bedroll = bedrollById(bedrollId);
        if (bedroll === undefined || !withinReach(bedroll, walker.position)) continue;
        if (then === "pickUp") pickUpNow(bedrollId, bedroll, walker);
        else reached = bedroll;
      }
      // Sleep passes time, so it starts only once every walker has been handled.
      if (reached !== undefined) sleepOn(reached);
      return undefined;
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
