// Add-ons: the building pieces the player builds from the finished piece they go on, their host, not from the build menu.
// A door goes in a door frame, shutters in a window, a roof section on a roof frame, and a chimney on a fireplace.
// Building one places its blueprint on the host and starts building it, as the build command does.
import type { Refusal } from "./api";
import { isOnGridSquare } from "./build-grid";
import type { Building } from "./building";
import { hasChimney } from "./chimneys";
import type { CommandRules, RuleGame } from "./command-rule";
import { hasDoor } from "./doors";
import { blueprintEntities, type EntityStore } from "./entities";
import type { GroundPoint } from "./ground-point";
import { refusedNotice } from "./notices";
import type { QuarterTurns } from "./quarter-turns";
import { cabinRoofOn } from "./roofs";
import { ADD_ON_OF_HOST, isHost, type AddOnKind, type HostKind } from "./structure-kind";
import { structureKindOf } from "./structures";
import { hasShutters } from "./windows";

/** Whether the host of this kind at `at` holds its add-on, finished or as a blueprint. */
export function holdsAddOn(entities: EntityStore, host: HostKind, at: GroundPoint): boolean {
  switch (host) {
    case "doorFrame":
      return hasDoor(entities, at);
    case "window":
      return hasShutters(entities, at);
    case "fireplace":
      return hasChimney(entities, at);
    case "roofFrame":
      return (
        cabinRoofOn(entities, at) !== undefined ||
        blueprintEntities(entities).entities.some(({ blueprint, position }) => blueprint.structure === "roof" && isOnGridSquare(at, position))
      );
  }
}

/** The finished host with this id and its kind, or why it cannot take an add-on: it is gone, or it is no finished host. */
function finishedHost(
  entities: EntityStore,
  hostId: number,
): { refusal: Refusal } | { refusal?: undefined; position: GroundPoint; turns: QuarterTurns; kind: HostKind } {
  const host = entities.entity(hostId);
  if (host === undefined) return { refusal: { kind: "gone" } };
  const kind = structureKindOf(host);
  if (host.position === undefined || host.blueprint !== undefined || kind === undefined || !isHost(kind)) return { refusal: { kind: "finishHostFirst" } };
  return { position: host.position, turns: host.facing?.turns ?? 0, kind };
}

/** The rule for building an add-on from its host. */
export function addOnRules(building: Building, { entities, startApproach, stopOtherWork }: RuleGame): CommandRules<"buildAddOn"> {
  /** Why the add-on cannot be placed on the host, or undefined if it can, with which add-on goes where. */
  function check(hostId: number): { refusal: Refusal } | { refusal?: undefined; addOn: AddOnKind; at: GroundPoint; turns: QuarterTurns } {
    const host = finishedHost(entities, hostId);
    if (host.refusal !== undefined) return host;
    if (holdsAddOn(entities, host.kind, host.position)) return { refusal: { kind: "holdsAddOn" } };
    const addOn = ADD_ON_OF_HOST[host.kind];
    const at = { x: host.position.x, z: host.position.z };
    const placement = building.checkPlacement(addOn, at, host.turns);
    if (placement.refusal !== undefined) return { refusal: placement.refusal };
    if (!placement.allowed) return { refusal: { kind: "addOnInTheWay" } };
    return { addOn, at, turns: host.turns };
  }

  return {
    buildAddOn: {
      // Building it starts afresh, so the rule stops what the player was doing itself once it can start.
      start: "alongside",
      needsFreeHands: true,
      refusal: (command) => check(command.hostId).refusal,
      run: (command) => {
        const checked = check(command.hostId);
        if (checked.refusal !== undefined) return refusedNotice(checked.refusal);
        const id = building.place(checked.addOn, checked.at, checked.turns);
        if (id === undefined) return refusedNotice({ kind: "addOnInTheWay" });
        // The blueprint stays even when the player cannot start building it, and the game says why, as it does for build.
        const refusal = building.refusal(id);
        if (refusal !== undefined) return refusedNotice(refusal);
        stopOtherWork();
        return startApproach({ type: "build", blueprintId: id });
      },
    },
  };
}
