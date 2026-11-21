// Going to sleep in a bed: where the player walks to reach it, and handing it over to sleep in once they stand beside it.
import type { ApproachReach } from "./approach";
import { entityWith, type Entity, type EntityStore } from "./entities";
import { footprintOfEntity } from "./structures";

/** The player can lie down in a bed from this far outside its edges, in metres. */
export const BED_REACH_METRES = 1;

/** A finished bed, standing somewhere. */
export type BedEntity = Entity & Required<Pick<Entity, "furniture" | "position">>;

/** Going to sleep in beds. */
export interface Beds {
  /**
   * Where the player walks to sleep in a finished bed: within reach of its edge. The bed blocks walking, so they walk the
   * shortest way to stand beside it, on the side they come from. Undefined if the entity is not a finished bed.
   */
  reach(bedId: number): ApproachReach | undefined;
  /** Puts the player to sleep in a finished bed. The approach runs it once the player stands within reach. */
  sleep(bedId: number): void;
}

/** Lets the player go to sleep in a finished bed. `sleepIn` puts the player to sleep in a bed they have reached. */
export function createBeds(entities: EntityStore, sleepIn: (bed: BedEntity) => void): Beds {
  const bedById = (bedId: number): BedEntity | undefined => {
    const bed = entityWith(entities, bedId, "furniture", "position");
    return bed?.furniture === "bed" ? bed : undefined;
  };

  return {
    reach(bedId) {
      const bed = bedById(bedId);
      return bed === undefined ? undefined : { target: footprintOfEntity(bed), metres: BED_REACH_METRES, walk: { style: "beside" } };
    },
    sleep(bedId) {
      const bed = bedById(bedId);
      if (bed !== undefined) sleepIn(bed);
    },
  };
}
