// Going to sleep in a bed: walking to it, and handing it over to sleep in once the player stands beside it.
import { distanceOutside } from "./building";
import { entityWith, playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import { footprintOfEntity } from "./structures";
import type { GroundPoint } from "./valley";
import type { Walking } from "./walking";

/** The player can lie down in a bed from this far outside its edges, in metres. */
export const BED_REACH_METRES = 1;

/** A finished bed, standing somewhere. */
export type BedEntity = Entity & Required<Pick<Entity, "bed" | "position">>;

/** Going to sleep in beds. */
export interface Beds {
  /**
   * Returns the bed to sleep in now, if the player stands within reach of it.
   * If it is further away, sets the player walking to it, and `step` returns it once they arrive.
   */
  sleep(bedId: number): BedEntity | undefined;
  /** Stops the player walking to a bed. */
  cancel(): void;
  /** Returns the bed to sleep in, if the player has just reached one they were walking to. Run it after walking. */
  step(): BedEntity | undefined;
}

/** Lets the player go to sleep in a finished bed. */
export function createBeds(entities: EntityStore, walking: Walking): Beds {
  const players = playerEntities(entities);
  const walkers = entities.with("bedTask", "position");

  const bedById = (bedId: number): BedEntity | undefined => entityWith(entities, bedId, "bed", "position");
  const withinReach = (bed: BedEntity, at: GroundPoint) => distanceOutside(footprintOfEntity(bed), at) <= BED_REACH_METRES;

  return {
    sleep(bedId) {
      const bed = bedById(bedId);
      if (bed === undefined) return undefined;
      let inReach = false;
      for (const player of players) {
        if (withinReach(bed, player.position)) {
          inReach = true;
          continue;
        }
        // The bed blocks walking, so the walk ends on the open ground nearest its middle, beside it.
        walking.walkTo(bed.position);
        setComponent(entities, player, "bedTask", { bedId });
      }
      return inReach ? bed : undefined;
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "bedTask");
    },
    step() {
      let sleepIn: BedEntity | undefined;
      // Copy the list first, because players who arrive leave the query while it is being walked.
      for (const walker of [...walkers]) {
        if (walker.walkPath !== undefined) continue;
        const { bedId } = walker.bedTask;
        entities.removeComponent(walker, "bedTask");
        const bed = bedById(bedId);
        if (bed !== undefined && withinReach(bed, walker.position)) sleepIn = bed;
      }
      return sleepIn;
    },
  };
}
