// Sitting on a stool: walking to it, sitting down once the player stands beside it, and standing up again.
// While the player sits, fatigue comes back slowly (see needs.ts). Their position stays beside the stool, which blocks walking.
import { entityWith, playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import { groundDistance, type GroundPoint } from "./valley";
import { walkBeside, type Walking } from "./walking";

/** The player walks to a spot this far from a stool's middle to sit on it, in metres. */
const STOOL_STAND_METRES = 1.1;
/** The player can sit on a stool from this far from its middle, in metres. */
export const STOOL_REACH_METRES = 2;

/** A finished stool, standing somewhere. */
export type StoolEntity = Entity & Required<Pick<Entity, "furniture" | "position">>;

export interface Stools {
  /**
   * Sits the player on a finished stool now, if they stand within reach of it.
   * If it is further away, sets the player walking to it, and `step` sits them down once they arrive.
   */
  sit(stoolId: number): void;
  /** Stops the player walking to a stool. It does not stand up a player who already sits. */
  cancel(): void;
  /** Sits the player down if they have just reached a stool they were walking to. Run it after walking. */
  step(): undefined;
  /** Stands the player up, if they sit. */
  standUp(): void;
  /** The stool the player sits on, if they sit on one that still stands. */
  sittingOn(): StoolEntity | undefined;
}

/** Lets the player sit on a finished stool. `beforeSitting` runs just before they sit, so they can put down what they hold. */
export function createStools(entities: EntityStore, walking: Walking, beforeSitting: () => void): Stools {
  const players = playerEntities(entities);
  const walkers = entities.with("stoolTask", "position");

  const stoolById = (stoolId: number): StoolEntity | undefined => {
    const stool = entityWith(entities, stoolId, "furniture", "position");
    return stool?.furniture === "stool" ? stool : undefined;
  };
  const withinReach = (stool: StoolEntity, at: GroundPoint) => groundDistance(stool.position, at) <= STOOL_REACH_METRES;

  function sitDown(player: Entity, stoolId: number): void {
    beforeSitting();
    entities.removeComponent(player, "walkPath");
    setComponent(entities, player, "sitting", { stoolId });
  }

  return {
    sit(stoolId) {
      const stool = stoolById(stoolId);
      if (stool === undefined) return;
      for (const player of players) {
        if (withinReach(stool, player.position)) {
          sitDown(player, stoolId);
          continue;
        }
        walkBeside(walking, player.position, stool.position, STOOL_REACH_METRES, STOOL_STAND_METRES);
        setComponent(entities, player, "stoolTask", { stoolId });
      }
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "stoolTask");
    },
    step() {
      // Copy the list first, because players who arrive leave the query while it is being walked.
      for (const walker of [...walkers]) {
        if (walker.walkPath !== undefined) continue;
        const { stoolId } = walker.stoolTask;
        entities.removeComponent(walker, "stoolTask");
        const stool = stoolById(stoolId);
        if (stool !== undefined && withinReach(stool, walker.position)) sitDown(walker, stoolId);
      }
      // A player who starts walking, or whose stool is gone, is no longer sitting.
      for (const player of players) {
        if (player.sitting === undefined) continue;
        if (player.walkPath !== undefined || stoolById(player.sitting.stoolId) === undefined) entities.removeComponent(player, "sitting");
      }
      return undefined;
    },
    standUp() {
      for (const player of players) entities.removeComponent(player, "sitting");
    },
    sittingOn() {
      for (const player of players) {
        if (player.sitting !== undefined) return stoolById(player.sitting.stoolId);
      }
      return undefined;
    },
  };
}
