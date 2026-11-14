import { addToBackpack, removeFromBackpack, type Food, type WildFood } from "./backpack";
import { entityWith, playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import type { HandReach } from "./hand-reach";
import { fillNeed } from "./needs";
import { catchSickness } from "./sickness";
import { groundDistance, terrainHeightAt, type GroundPoint, type Valley } from "./valley";
import type { Walking } from "./walking";

/** The player can forage a bush or mushroom patch from this far away, in metres. */
const FORAGE_REACH_METRES = 2;
/** How much food one bush or mushroom patch gives when foraged. */
export const FOOD_PER_FORAGE: Readonly<Record<WildFood, number>> = { berries: 3, mushroom: 2 };
/** How long a foraged bush or mushroom patch takes to grow back, in game minutes. Three days. */
export const REGROW_MINUTES = 3 * 24 * 60;
/** How much one of each food fills hunger, out of 1. */
export const HUNGER_FILLED_BY: Readonly<Record<Food, number>> = { berries: 0.1, mushroom: 0.15, rawFish: 0.15 };
/** Whether eating each food makes the player sick, as unboiled river water does. */
export const MAKES_SICK: Readonly<Record<Food, boolean>> = { berries: false, mushroom: false, rawFish: true };

/** Why the player could not start foraging. */
export type ForageRefusal = "backpackFull";

export interface Foraging {
  /**
   * Sets the player walking to a bush or mushroom patch. Once there, they reach down and put its food in the backpack.
   * Does nothing if the entity is not a forage spot. If the backpack has no room for all its food when the hand gets
   * there, the food stays and the reach gives "backpackFull".
   */
  forage(spotId: number): void;
  /** Eats one of this food from the backpack, which fills hunger. Raw fish makes the player sick. Does nothing if the backpack holds none. */
  eat(food: Food): void;
  /** Stops the player walking to forage. */
  cancel(): void;
  /** Starts the player reaching to forage the spots they have walked to. Run it after walking has moved the player. */
  step(): undefined;
  /** Grows foraged spots back by this many game minutes. */
  grow(gameMinutes: number): void;
}

/** Lets the player forage wild food into the backpack and eat it. Foraged spots grow back over a few days. */
export function createForaging(entities: EntityStore, walking: Walking, hand: Pick<HandReach, "start">): Foraging {
  const players = playerEntities(entities);
  const foragers = entities.with("forageTask", "position", "backpack");
  const regrowing = entities.with("forageSpot", "regrowing");

  /** The forage spot with this id, if it has food and is within the player's reach. */
  function spotInReach(spotId: number, player: { position: GroundPoint }) {
    const spot = entityWith(entities, spotId, "forageSpot", "position");
    if (spot === undefined || spot.regrowing !== undefined || groundDistance(spot.position, player.position) > FORAGE_REACH_METRES) return undefined;
    return spot;
  }

  return {
    forage(spotId) {
      const spot = entities.entity(spotId);
      if (spot?.forageSpot === undefined || spot.position === undefined) return;
      for (const player of players) {
        if (player.backpack === undefined) continue;
        walking.walkTo(spot.position);
        setComponent(entities, player, "forageTask", { spotId });
      }
    },
    eat(food) {
      for (const player of players) {
        if (player.backpack === undefined || player.needs === undefined) continue;
        if (!removeFromBackpack(player.backpack, food, 1)) continue;
        fillNeed(player.needs, "hunger", HUNGER_FILLED_BY[food]);
        if (MAKES_SICK[food]) setComponent(entities, player, "sickness", catchSickness());
      }
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "forageTask");
    },
    step() {
      // Copy the list first, because players who finish leave the query while it is being walked.
      for (const forager of [...foragers]) {
        if (forager.walkPath) continue;
        const { spotId } = forager.forageTask;
        entities.removeComponent(forager, "forageTask");
        const spot = spotInReach(spotId, forager);
        if (spot === undefined) continue;
        hand.start("low", spot.position, (): ForageRefusal | undefined => {
          const still = spotInReach(spotId, forager);
          if (still === undefined) return undefined;
          const food = still.forageSpot.food;
          if (!addToBackpack(forager.backpack, food, FOOD_PER_FORAGE[food])) return "backpackFull";
          entities.addComponent(still, "regrowing", { minutesLeft: REGROW_MINUTES });
          return undefined;
        });
      }
    },
    grow(gameMinutes) {
      // Copy the list first, because spots that have grown back leave the query while it is being walked.
      for (const spot of [...regrowing]) {
        spot.regrowing.minutesLeft -= gameMinutes;
        if (spot.regrowing.minutesLeft <= 0) entities.removeComponent(spot, "regrowing");
      }
    },
  };
}

/** The berry bushes and mushroom patches a valley starts with, all with food on them. */
export function valleyForageSpots(valley: Valley): Entity[] {
  const spot = (food: WildFood, { x, z }: { x: number; z: number }): Entity => ({
    forageSpot: { food },
    position: { x, y: terrainHeightAt(valley.terrain, x, z), z },
  });
  return [...valley.berryBushes.map((at) => spot("berries", at)), ...valley.mushrooms.map((at) => spot("mushroom", at))];
}
