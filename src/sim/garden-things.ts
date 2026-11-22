// Garden things: berry bushes, wild or planted, and mushroom logs. Nothing is built over one. See .scratch/garden/spec.md.
import type { Refusal } from "./api";
import { forageSpotEntities, mushroomLogEntities, type EntityStore } from "./entities";
import { logBody, logBodyMeetsRect } from "./log-body";
import { isInRect, type GroundRect } from "./structure-kind";

/**
 * Why nothing can be built on `rect`: it covers a berry bush, or any part of a mushroom log. Undefined if it covers neither.
 * The game checks this for every blueprint and foundation before the structure's own placement rule, so it always says which one is in the way.
 */
export function gardenThingInTheWay(entities: EntityStore, rect: GroundRect): Refusal | undefined {
  // Checks the food by hand, not with isBerryBush, because foraging leads back to building, which calls this.
  const bushes = forageSpotEntities(entities).entities.filter((spot) => spot.forageSpot.food === "berries");
  if (bushes.some((bush) => isInRect(rect, bush.position))) return { kind: "berryBushInTheWay" };
  const logs = mushroomLogEntities(entities).entities;
  if (logs.some(({ position, mushroomLog }) => logBodyMeetsRect(logBody(position, mushroomLog.heading), rect))) return { kind: "mushroomLogInTheWay" };
  return undefined;
}
