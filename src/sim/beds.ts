// Going to sleep in a bed: walking to it, and handing it over to sleep in once the player stands beside it.
import { distanceOutside } from "./building";
import { entityWith, playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import { footprintOfEntity } from "./structures";
import type { GroundPoint } from "./valley";
import { WALK_REACH_MARGIN_METRES, type Walking } from "./walking";

/** The player can lie down in a bed from this far outside its edges, in metres. */
export const BED_REACH_METRES = 1;

/** A finished bed, standing somewhere. */
export type BedEntity = Entity & Required<Pick<Entity, "furniture" | "position">>;

/** Going to sleep in beds. */
export interface Beds {
  /**
   * Puts the player to sleep in a finished bed now, if they stand within reach of it.
   * If it is further away, sets the player walking to it, and `step` puts them to sleep once they arrive.
   */
  sleep(bedId: number): void;
  /** Stops the player walking to a bed. */
  cancel(): void;
  /** Puts the player to sleep, if they have just reached a bed they were walking to. Run it after walking. */
  step(): undefined;
}

/** Lets the player go to sleep in a finished bed. `sleepIn` puts the player to sleep in a bed they have reached. */
export function createBeds(entities: EntityStore, walking: Walking, sleepIn: (bed: BedEntity) => void): Beds {
  const players = playerEntities(entities);
  const walkers = entities.with("bedTask", "position");

  const bedById = (bedId: number): BedEntity | undefined => {
    const bed = entityWith(entities, bedId, "furniture", "position");
    return bed?.furniture === "bed" ? bed : undefined;
  };
  const withinReach = (bed: BedEntity, at: GroundPoint) => distanceOutside(footprintOfEntity(bed), at) <= BED_REACH_METRES;

  return {
    sleep(bedId) {
      const bed = bedById(bedId);
      if (bed === undefined) return;
      let inReach = false;
      for (const player of players) {
        if (withinReach(bed, player.position)) {
          inReach = true;
          continue;
        }
        // The bed blocks walking, so the player walks the shortest way to stand within reach of its edge, on the side they come from.
        walking.walkWithin(footprintOfEntity(bed), BED_REACH_METRES - WALK_REACH_MARGIN_METRES);
        setComponent(entities, player, "bedTask", { bedId });
      }
      if (inReach) sleepIn(bed);
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "bedTask");
    },
    step() {
      let reached: BedEntity | undefined;
      // Copy the list first, because players who arrive leave the query while it is being walked.
      for (const walker of [...walkers]) {
        if (walker.walkPath !== undefined) continue;
        const { bedId } = walker.bedTask;
        entities.removeComponent(walker, "bedTask");
        const bed = bedById(bedId);
        if (bed !== undefined && withinReach(bed, walker.position)) reached = bed;
      }
      // Sleep passes time, so it starts only once every walker has been handled.
      if (reached !== undefined) sleepIn(reached);
      return undefined;
    },
  };
}
