import { addToBackpack, fitsInBackpack, removeFromBackpack, type Food } from "./backpack";
import { playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import { fillNeed } from "./needs";
import { groundDistance, terrainHeightAt, type Valley } from "./valley";
import type { Walking } from "./walking";

/** The player can forage a bush or mushroom patch from this far away, in metres. */
const FORAGE_REACH_METRES = 2;
/** How much food one bush or mushroom patch gives when foraged. */
export const FOOD_PER_FORAGE: Readonly<Record<Food, number>> = { berries: 3, mushroom: 2 };
/** How long a foraged bush or mushroom patch takes to grow back, in game minutes. Three days. */
export const REGROW_MINUTES = 3 * 24 * 60;
/** How much one of each food fills hunger, out of 1. Neither food makes the player sick. */
export const HUNGER_FILLED_BY: Readonly<Record<Food, number>> = { berries: 0.1, mushroom: 0.15 };

/** Why the player could not start foraging. */
export type ForageRefusal = "backpackFull";

export interface Foraging {
  /**
   * Sets the player walking to a bush or mushroom patch to put its food in the backpack.
   * Does nothing if the entity is not a forage spot, or the backpack has no room for all its food.
   * Returns "backpackFull" when the backpack has no room.
   */
  forage(spotId: number): ForageRefusal | undefined;
  /** Eats one of this food from the backpack, which fills hunger. Does nothing if the backpack holds none. */
  eat(food: Food): void;
  /** Stops the player walking to forage. */
  cancel(): void;
  /** Forages the spots the player has reached. Run it after walking has moved the player. */
  step(): undefined;
  /** Grows foraged spots back by this many game minutes. */
  grow(gameMinutes: number): void;
}

/** Lets the player forage wild food into the backpack and eat it. Foraged spots grow back over a few days. */
export function createForaging(entities: EntityStore, walking: Walking): Foraging {
  const players = playerEntities(entities);
  const foragers = entities.with("forageTask", "position", "backpack");
  const regrowing = entities.with("forageSpot", "regrowing");

  return {
    forage(spotId) {
      const spot = entities.entity(spotId);
      if (spot?.forageSpot === undefined || spot.position === undefined) return undefined;
      const food = spot.forageSpot.food;
      let refusal: ForageRefusal | undefined;
      for (const player of players) {
        if (player.backpack === undefined) continue;
        if (spot.regrowing === undefined && !fitsInBackpack(player.backpack, food, FOOD_PER_FORAGE[food])) {
          refusal = "backpackFull";
          continue;
        }
        walking.walkTo(spot.position);
        setComponent(entities, player, "forageTask", { spotId });
      }
      return refusal;
    },
    eat(food) {
      for (const player of players) {
        if (player.backpack === undefined || player.needs === undefined) continue;
        if (removeFromBackpack(player.backpack, food, 1)) fillNeed(player.needs, "hunger", HUNGER_FILLED_BY[food]);
      }
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "forageTask");
    },
    step() {
      // Copy the list first, because players who finish leave the query while it is being walked.
      for (const forager of [...foragers]) {
        if (forager.walkPath) continue;
        const spot = entities.entity(forager.forageTask.spotId);
        entities.removeComponent(forager, "forageTask");
        if (spot?.forageSpot === undefined || spot.position === undefined || spot.regrowing !== undefined) continue;
        if (groundDistance(spot.position, forager.position) > FORAGE_REACH_METRES) continue;
        const food = spot.forageSpot.food;
        if (addToBackpack(forager.backpack, food, FOOD_PER_FORAGE[food])) {
          entities.addComponent(spot, "regrowing", { minutesLeft: REGROW_MINUTES });
        }
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
  const spot = (food: Food, { x, z }: { x: number; z: number }): Entity => ({
    forageSpot: { food },
    position: { x, y: terrainHeightAt(valley.terrain, x, z), z },
  });
  return [...valley.berryBushes.map((at) => spot("berries", at)), ...valley.mushrooms.map((at) => spot("mushroom", at))];
}
