import type { CommandRules, RuleGame } from "./command-rule";
import { refusedNotice } from "./notices";
import type { Building } from "./building";

/** The rules for placing blueprints, bringing materials to them, and building them. */
export function buildingRules(
  building: Building,
  { startApproach, stopOtherWork }: RuleGame,
): CommandRules<"placeBlueprint" | "build" | "deliverToBlueprint" | "stopBuilding"> {
  return {
    placeBlueprint: {
      // Placing alone leaves the player doing what they were doing. Building it at once starts afresh.
      start: "alongside",
      refusal: (command) => building.checkPlacement(command.structure, { x: command.x, z: command.z }, command.turns).refusal,
      queue: "apart",
      needsFreeHands: (command) => command.thenBuild === true,
      run: (command) => {
        const id = building.place(command.structure, { x: command.x, z: command.z }, command.turns);
        if (command.thenBuild !== true || id === undefined) return undefined;
        // Full hands stop building at once, and the game says why. A blueprint that lacks a material just stays placed.
        const refusal = building.refusal(id);
        if (refusal?.kind === "handsFull") return refusedNotice(refusal);
        if (!building.canStartBuilding(id)) return undefined;
        stopOtherWork();
        return startApproach({ type: "build", blueprintId: id });
      },
    },
    build: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => building.refusal(command.blueprintId),
      approach: {
        reach: (command) => building.reach(command.blueprintId),
        act: (command) => {
          building.build(command.blueprintId);
        },
      },
    },
    deliverToBlueprint: {
      start: "fresh",
      needsFreeHands: true,
      approach: {
        reach: (command) => building.reach(command.blueprintId),
        act: (command) => {
          building.deliver(command.blueprintId);
        },
      },
    },
    stopBuilding: {
      start: "alongside",
      queue: "apart",
      run: () => {
        building.cancel();
      },
    },
  };
}
