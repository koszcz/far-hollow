// Constants that more than one animation showcase uses. A constant that one showcase uses lives in that showcase's file.
import { WALK_SPEED_METRES_PER_SECOND } from "../../../sim/walking";
import { DRAG_SPEED } from "../../../sim/sleds";

/** How fast the player walks while dragging a sled, in metres a second. The "sled-drag-animation" and "sled-rope" use it. */
export const DRAG_WALK_METRES_PER_SECOND = WALK_SPEED_METRES_PER_SECOND * DRAG_SPEED;
