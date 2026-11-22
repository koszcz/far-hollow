// The ground a log lying on the ground covers: the line between its two ends. See docs/adr/0009.
import { blendGroundPoints, groundDistance, stepAlongHeading, subtractGroundPoints, type GroundPoint } from "./ground-point";
import type { GroundRect } from "./structure-kind";

/** How long a log is, in metres. */
export const LOG_LENGTH_METRES = 1;

/** A log lying on the ground, as the line from one end to the other. */
export interface LogBody {
  readonly from: GroundPoint;
  readonly to: GroundPoint;
}

/** The body of a log whose middle lies at `middle`, lying along `heading`, in radians about the vertical axis from +z toward +x. */
export function logBody(middle: GroundPoint, heading: number): LogBody {
  const half = LOG_LENGTH_METRES / 2;
  return { from: stepAlongHeading(middle, heading, -half), to: stepAlongHeading(middle, heading, half) };
}

/** How far `spot` lies from the nearest point of the log's body, in metres. */
export function distanceToLogBody(body: LogBody, spot: GroundPoint): number {
  const along = subtractGroundPoints(body.to, body.from);
  const toSpot = subtractGroundPoints(spot, body.from);
  const lengthSquared = along.x * along.x + along.z * along.z;
  const share = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, (toSpot.x * along.x + toSpot.z * along.z) / lengthSquared));
  return groundDistance(blendGroundPoints(body.from, body.to, share), spot);
}

/** Whether any part of the log's body lies in `rect`, edges included. */
export function logBodyMeetsRect(body: LogBody, rect: GroundRect): boolean {
  // Clips the line to the rectangle one side at a time. Some part is left only if the line enters before it leaves.
  let enter = 0;
  let leave = 1;
  const along = subtractGroundPoints(body.to, body.from);
  const sides: readonly (readonly [number, number])[] = [
    [-along.x, body.from.x - rect.min.x],
    [along.x, rect.max.x - body.from.x],
    [-along.z, body.from.z - rect.min.z],
    [along.z, rect.max.z - body.from.z],
  ];
  for (const [towardOutside, room] of sides) {
    if (towardOutside === 0) {
      if (room < 0) return false;
      continue;
    }
    const share = room / towardOutside;
    if (towardOutside < 0) enter = Math.max(enter, share);
    else leave = Math.min(leave, share);
    if (enter > leave) return false;
  }
  return true;
}
