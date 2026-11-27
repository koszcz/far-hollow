import { snapToGridSquare } from "./build-grid";
import type { EntityStore } from "./entities";
import { finishedFloorOn } from "./floors";
import type { GroundPoint } from "./ground-point";
import { roomAround } from "./rooms";
import { NO_SNOW_COVER, snowWalkingSpeed, type Snow } from "./snow-cover";

/** How fast the player walks where they stand: deep snow slows them outdoors, but not on a floor or inside a room. */
export function snowSpeedWhereStanding(entities: EntityStore, position: GroundPoint, snow: Snow | undefined): number {
  const square = snapToGridSquare(position);
  if (finishedFloorOn(entities, square) !== undefined || roomAround(entities, square) !== undefined) return 1;
  return snowWalkingSpeed(snow?.cover ?? NO_SNOW_COVER);
}
