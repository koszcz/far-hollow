import type { Vec3 } from "../sim/entities";

/**
 * Blends from the previous logic position to the current one.
 * `alpha` is how far the frame is between the two logic steps: 0 is the previous step, 1 is the current one.
 */
export function blendPosition(previous: Vec3, current: Vec3, alpha: number, out: Vec3): Vec3 {
  out.x = previous.x + (current.x - previous.x) * alpha;
  out.y = previous.y + (current.y - previous.y) * alpha;
  out.z = previous.z + (current.z - previous.z) * alpha;
  return out;
}
