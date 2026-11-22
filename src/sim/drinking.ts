import type { ApproachReach } from "./approach";
import { playerEntities, setComponent, type EntityStore } from "./entities";
import { quenchThirst } from "./needs";
import { catchSickness } from "./sickness";
import { distanceToRiver, nearestRiverPoint, type Valley } from "./valley";
import { type GroundPoint } from "./ground-point";
import { nearestWalkableSpot, type WalkMap } from "./walk-map";
import type { CommandRules } from "./command-rule";

/** The player can drink from the river, or fill the pot, from this many metres from the water's edge. */
const RIVER_REACH_METRES = 3;

/** True if someone standing at this spot is close enough to the water to drink from the river or fill the pot. */
export function canReachRiver(valley: Valley, at: GroundPoint): boolean {
  return distanceToRiver(valley.river, at) - valley.river.width / 2 <= RIVER_REACH_METRES;
}

/**
 * Where the approach takes a player at `from` to reach the water toward `spot` on the river, such as to drink or fish:
 * to the open ground nearest `spot`, and within reach of the water, as `canReachRiver` measures it.
 */
export function riverReach(valley: Valley, walkMap: WalkMap, from: GroundPoint, spot: GroundPoint): ApproachReach {
  return {
    // The river is the same width all along, so the reach to its middle line nearest the player is the reach to the water.
    target: nearestRiverPoint(valley.river, from),
    metres: RIVER_REACH_METRES + valley.river.width / 2,
    walk: { style: "to", spot: nearestWalkableSpot(walkMap, spot) ?? spot },
  };
}

export interface Drinking {
  /** Where the approach takes the player to drink toward a spot on the river: the riverbank nearest it. */
  reach(spot: GroundPoint): ApproachReach | undefined;
  /** Drinks from the river toward a spot on it, once the player stands on the bank. The approach runs it once they arrive. */
  drinkFromRiver(spot: GroundPoint): void;
}

/**
 * Lets the player drink from the river. River water is not boiled, so drinking it makes the player sick.
 * `onDrink` hears of each drink, with the spot on the river the player drank toward.
 */
export function createDrinking(entities: EntityStore, walkMap: WalkMap, valley: Valley, onDrink: (river: GroundPoint) => void): Drinking {
  const players = playerEntities(entities);
  // Every player has needs: a new game gives them needs, and the save check turns away a saved player without them.
  // So drinking needs no refusal for a player without needs.
  const drinkers = entities.with("player", "needs");

  return {
    reach(spot) {
      const player = players.first;
      return player === undefined ? undefined : riverReach(valley, walkMap, player.position, spot);
    },
    drinkFromRiver(spot) {
      for (const player of drinkers) {
        quenchThirst(player.needs);
        setComponent(entities, player, "sickness", catchSickness());
        onDrink({ x: spot.x, z: spot.z });
      }
    },
  };
}

/** The rule for drinking from the river. */
export function drinkingRules(drinking: Drinking): CommandRules<"drinkFromRiver"> {
  return {
    drinkFromRiver: {
      start: "fresh",
      approach: {
        reach: (command) => drinking.reach(command),
        act: (command) => {
          drinking.drinkFromRiver(command);
        },
      },
    },
  };
}
