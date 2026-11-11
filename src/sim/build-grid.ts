// The square grid that building pieces snap to (ADR 0002).
import type { GroundPoint } from "./valley";

/** Building pieces snap to a square grid this wide, in metres. */
export const BUILD_GRID_METRES = 1;

/** The grid point, where grid lines cross, nearest to a spot. A campfire sits on one. */
export function snapToGridPoint(at: GroundPoint): GroundPoint {
  return { x: Math.round(at.x / BUILD_GRID_METRES) * BUILD_GRID_METRES, z: Math.round(at.z / BUILD_GRID_METRES) * BUILD_GRID_METRES };
}

/** The middle of the grid square that holds a spot. A foundation covers one square. */
export function snapToGridSquare(at: GroundPoint): GroundPoint {
  const middle = (value: number) => (Math.floor(value / BUILD_GRID_METRES) + 0.5) * BUILD_GRID_METRES;
  return { x: middle(at.x), z: middle(at.z) };
}

/** Whether a spot lies on the grid square with this middle, or within `margin` metres of its edge. */
export function isOnGridSquare(middle: GroundPoint, spot: GroundPoint, margin = 0): boolean {
  const reach = BUILD_GRID_METRES / 2 + margin;
  return Math.abs(spot.x - middle.x) <= reach && Math.abs(spot.z - middle.z) <= reach;
}
