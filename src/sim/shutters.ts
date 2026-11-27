// Opening and closing shutters by hand. The player walks within reach first, then opens or closes them at once.
// Nothing else opens or closes them. See windows.ts for where shutters hang.
import type { Refusal } from "./api";
import type { ApproachReach } from "./approach";
import { structureReach } from "./building";
import type { CommandRules } from "./command-rule";
import { playerEntities, type EntityStore } from "./entities";
import { isPlacedStructure } from "./structure-queries";

/** Opening and closing shutters by hand. */
export interface Shutters {
  /** Where the approach takes the player to reach the shutters with this id: just outside the window's edge, on their side. */
  reach(shuttersId: number): ApproachReach | undefined;
  /** Opens or closes the shutters with this id. It takes no time. */
  set(shuttersId: number, open: boolean): void;
  /** Why the player could not open or close the shutters with this id: they are gone. */
  refusal(shuttersId: number): Refusal | undefined;
}

export function createShutters(entities: EntityStore): Shutters {
  const players = playerEntities(entities);
  const finished = (shuttersId: number) => {
    const entity = entities.entity(shuttersId);
    return entity?.shutters !== undefined && isPlacedStructure(entity) ? { entity, shutters: entity.shutters } : undefined;
  };
  return {
    reach(shuttersId) {
      const found = finished(shuttersId);
      const player = players.first;
      return found === undefined || player === undefined ? undefined : structureReach(found.entity, player.position);
    },
    set(shuttersId, open) {
      const found = finished(shuttersId);
      if (found !== undefined) found.shutters.open = open;
    },
    refusal(shuttersId) {
      return finished(shuttersId) === undefined ? { kind: "gone" } : undefined;
    },
  };
}

/** The rule for opening and closing shutters. The player walks within reach first. It is quick, not timed work. */
export function shuttersRules(shutters: Shutters): CommandRules<"setShutters"> {
  return {
    setShutters: {
      start: "fresh",
      refusal: (command) => shutters.refusal(command.shuttersId),
      approach: {
        reach: (command) => shutters.reach(command.shuttersId),
        act: (command) => {
          shutters.set(command.shuttersId, command.open);
          return undefined;
        },
      },
    },
  };
}
