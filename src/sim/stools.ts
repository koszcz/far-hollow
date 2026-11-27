// Sitting on a stool: where the player walks to reach it, sitting down once they stand beside it, and standing up again.
// While the player sits, fatigue comes back slowly (see needs.ts). Their position stays beside the stool, which blocks walking.
import type { Activity } from "./activity";
import type { ApproachReach } from "./approach";
import { entityWith, setComponent, type Entity, type EntityStore } from "./entities";
import { playerEntities } from "./entity-queries";
import type { CommandRules, RuleGame } from "./command-rule";
import { goneRefusal } from "./refusals";

/** The player walks to a spot this far from a stool's middle to sit on it, in metres. */
const STOOL_STAND_METRES = 1.1;
/** The player can sit on a stool from this far from its middle, in metres. */
export const STOOL_REACH_METRES = 2;

/** A finished stool, standing somewhere. */
export type StoolEntity = Entity & Required<Pick<Entity, "furniture" | "position">>;

export interface Stools extends Activity {
  /** Where the player walks to sit on a finished stool: beside it, on their own side. Undefined if the entity is not a finished stool. */
  reach(stoolId: number): ApproachReach | undefined;
  /** Sits the player on a finished stool. The approach runs it once the player stands within reach. */
  sit(stoolId: number): void;
  /** Does nothing: a new command stands the player up through `standUp`, not through cancelling. */
  cancel(): void;
  /** Stands the player up if they have started walking, or if their stool is gone. */
  step(): undefined;
  /** Stands the player up, if they sit. */
  standUp(): void;
  /** The stool the player sits on, if they sit on one that still stands. */
  sittingOn(): StoolEntity | undefined;
}

/** Lets the player sit on a finished stool. `beforeSitting` runs just before they sit, so they can put down what they hold. */
export function createStools(entities: EntityStore, beforeSitting: () => void): Stools {
  const players = playerEntities(entities);

  const stoolById = (stoolId: number): StoolEntity | undefined => {
    const stool = entityWith(entities, stoolId, "furniture", "position");
    return stool?.furniture === "stool" ? stool : undefined;
  };

  return {
    reach(stoolId) {
      const stool = stoolById(stoolId);
      if (stool === undefined) return undefined;
      return { target: stool.position, metres: STOOL_REACH_METRES, walk: { style: "beside", standMetres: STOOL_STAND_METRES } };
    },
    sit(stoolId) {
      if (stoolById(stoolId) === undefined) return;
      beforeSitting();
      for (const player of players) {
        entities.removeComponent(player, "walkPath");
        setComponent(entities, player, "sitting", { stoolId });
      }
    },
    cancel() {},
    step() {
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

/** The rule for sitting on a stool. */
export function stoolRules(stools: Stools, { entities, player }: RuleGame): CommandRules<"sitOnStool"> {
  return {
    sitOnStool: {
      start: "fresh",
      // Once seated, the player sits on with nothing to end it, so they stand up at once for a queued action.
      canStopForNext: () => player.sitting !== undefined,
      refusal: (command) => goneRefusal(entities, command.stoolId),
      approach: {
        reach: (command) => stools.reach(command.stoolId),
        act: (command) => {
          stools.sit(command.stoolId);
        },
      },
    },
  };
}
