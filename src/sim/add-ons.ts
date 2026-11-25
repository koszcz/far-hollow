// Add-ons: the building pieces the player builds from the finished piece they go on, their host, not from the build menu.
// A door goes in a door frame, shutters in a window, a roof section on a roof frame, and a chimney on a fireplace.
// Building one places its blueprint on the host and starts building it, as the build command does.
import type { Refusal } from "./api";
import { isOnGridSquare } from "./build-grid";
import type { Building } from "./building";
import { hasChimney } from "./chimneys";
import type { CommandRules, RuleGame } from "./command-rule";
import { hasDoor } from "./doors";
import { blueprintEntities, type Entity, type EntityStore } from "./entities";
import type { GroundPoint } from "./ground-point";
import { refusedNotice } from "./notices";
import { cabinRoofOn } from "./roofs";
import { ADD_ON_OF_HOST, isHost, type HostKind } from "./structure-kind";
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

/** The finished host with this id, with its kind, or undefined if the entity is gone, is no host, or is still a blueprint. */
function finishedHost(entities: EntityStore, hostId: number): { host: Entity & { position: GroundPoint }; kind: HostKind } | undefined {
  const host = entities.entity(hostId);
  const kind = host === undefined ? undefined : structureKindOf(host);
  if (host?.position === undefined || host.blueprint !== undefined || kind === undefined || !isHost(kind)) return undefined;
  return { host: { ...host, position: host.position }, kind };
}

/** The rule for building an add-on from its host. */
export function addOnRules(building: Building, { entities, startApproach, stopOtherWork }: RuleGame): CommandRules<"buildAddOn"> {
  /** Why the add-on cannot be placed on the host, or undefined if it can, with where its blueprint goes. */
  function check(hostId: number): { refusal: Refusal } | { refusal?: undefined; place: () => number | undefined } {
    const host = entities.entity(hostId);
    if (host === undefined) return { refusal: { kind: "gone" } };
    const found = finishedHost(entities, hostId);
    if (found === undefined) return { refusal: { kind: "finishHostFirst" } };
    const { position, facing } = found.host;
    if (holdsAddOn(entities, found.kind, position)) return { refusal: { kind: "holdsAddOn" } };
    const addOn = ADD_ON_OF_HOST[found.kind];
    const at = { x: position.x, z: position.z };
    const turns = facing?.turns ?? 0;
    const placement = building.checkPlacement(addOn, at, turns);
    if (placement.refusal !== undefined) return { refusal: placement.refusal };
    if (!placement.allowed) return { refusal: { kind: "addOnInTheWay" } };
    return { place: () => building.place(addOn, at, turns) };
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
        const id = checked.place();
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
