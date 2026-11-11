import { playerEntities, setComponent, type EntityStore } from "./entities";
import { FULL_NEED } from "./needs";
import { catchSickness } from "./sickness";
import { distanceToRiver, type GroundPoint, type Valley } from "./valley";
import { nearestWalkableSpot } from "./walk-map";
import type { Walking } from "./walking";

/** The player can drink from the river, or fill the pot, from this many metres from the water's edge. */
const RIVER_REACH_METRES = 3;

/** True if someone standing at this spot is close enough to the water to drink from the river or fill the pot. */
export function canReachRiver(valley: Valley, at: GroundPoint): boolean {
  return distanceToRiver(valley.river, at) - valley.river.width / 2 <= RIVER_REACH_METRES;
}

export interface Drinking {
  /** Walks the player to the riverbank nearest a spot on the river, then drinks there. */
  drinkFromRiver(spot: GroundPoint): void;
  /** Stops the player walking to drink. */
  cancel(): void;
  /** Drinks once the player has reached the bank. */
  step(): void;
}

/** Lets the player drink from the river. River water is not boiled, so drinking it makes the player sick. */
export function createDrinking(entities: EntityStore, walking: Walking, valley: Valley): Drinking {
  const players = playerEntities(entities);
  const drinkers = entities.with("player", "drinkTask", "position", "needs");

  return {
    drinkFromRiver(spot) {
      for (const player of players) {
        setComponent(entities, player, "drinkTask", { x: spot.x, z: spot.z });
      }
      walking.walkTo(nearestWalkableSpot(walking.walkMap, spot) ?? spot);
    },
    cancel() {
      for (const player of [...drinkers]) entities.removeComponent(player, "drinkTask");
    },
    step() {
      // Copy the list first, because players who drink leave the query while it is being walked.
      for (const player of [...drinkers]) {
        if (player.walkPath !== undefined) continue;
        entities.removeComponent(player, "drinkTask");
        if (!canReachRiver(valley, player.position)) continue;
        player.needs.thirst.level = FULL_NEED;
        player.needs.thirst.minutesWithout = 0;
        setComponent(entities, player, "sickness", catchSickness());
      }
    },
  };
}
