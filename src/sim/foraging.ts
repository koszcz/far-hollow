import type { Refusal } from "./api";
import { goneRefusal } from "./refusals";
import { addToBackpack, removeFromBackpack, type Food, type WildFood } from "./backpack";
import type { ApproachReach } from "./approach";
import { entityWith, playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import type { HandReach } from "./hand-reach";
import { fillNeed } from "./needs";
import { catchSickness } from "./sickness";
import { isAtTable, TABLE_HUNGER_FACTOR } from "./tables";
import { terrainHeightAt, type Valley } from "./valley";
import { groundDistance, type GroundPoint } from "./ground-point";
import type { CommandRules } from "./command-rule";

/** The player can forage a bush or mushroom patch from this far away, in metres. */
const FORAGE_REACH_METRES = 2;
/** How much food one bush or mushroom patch gives when foraged. */
export const FOOD_PER_FORAGE: Readonly<Record<WildFood, number>> = { berries: 3, mushroom: 2 };
/** How long a foraged bush or mushroom patch takes to grow back, in game minutes. Three days. */
export const REGROW_MINUTES = 3 * 24 * 60;
/** How much one of each food fills hunger, out of 1. */
export const HUNGER_FILLED_BY: Readonly<Record<Food, number>> = { berries: 0.1, mushroom: 0.15, rawFish: 0.15, cookedFish: 0.3 };
/** Whether eating each food makes the player sick, as unboiled river water does. */
export const MAKES_SICK: Readonly<Record<Food, boolean>> = { berries: false, mushroom: false, rawFish: true, cookedFish: false };

/** Whether an entity is a berry bush, wild or planted, with berries or growing them back. */
export function isBerryBush(entity: Entity): boolean {
  return entity.forageSpot?.food === "berries";
}

/** Why the player could not start foraging. */
export type ForageRefusal = "backpackFull";

export interface Foraging {
  /** Where the player walks to forage a bush or mushroom patch: onto it, or beside it if something blocks its spot. Undefined if the entity is not one. */
  reach(spotId: number): ApproachReach | undefined;
  /**
   * Has the player reach down to a bush or mushroom patch within reach and put its food in the backpack. The approach runs it
   * once they arrive. If the backpack has no room for all its food when the hand gets there, the food stays and the reach gives "backpackFull".
   */
  forage(spotId: number): void;
  /** Why the player could not forage a spot now: it is gone, it is winter, or it is growing back, so it has no food. */
  refusal(spotId: number): Refusal | undefined;
  /**
   * Eats one of this food from the backpack, which fills hunger, more so within reach of a finished table. Raw fish makes
   * the player sick. Does nothing if the backpack holds none. Returns whether the player ate.
   */
  eat(food: Food): boolean;
  /**
   * Grows foraged spots back by this many game minutes, which fall in winter if `winter` says so. In winter nothing grows: the time left to grow back stays as it is,
   * and food still on a spot is lost, so the spot starts to grow back from the beginning once winter ends.
   */
  grow(gameMinutes: number, winter: boolean): void;
}

/**
 * Lets the player forage wild food into the backpack and eat it. Foraged spots grow back over a few days.
 * `isWinter` says whether it is winter now, when nothing grows.
 */
export function createForaging(entities: EntityStore, hand: Pick<HandReach, "start">, isWinter: () => boolean): Foraging {
  const players = playerEntities(entities);
  const spots = entities.with("forageSpot");
  const regrowing = entities.with("forageSpot", "regrowing");

  /** The forage spot with this id, if it has food and is within the player's reach. */
  function spotInReach(spotId: number, player: { position: GroundPoint }) {
    const spot = entityWith(entities, spotId, "forageSpot", "position");
    if (spot === undefined || refusal(spotId) !== undefined || groundDistance(spot.position, player.position) > FORAGE_REACH_METRES) return undefined;
    return spot;
  }

  function refusal(spotId: number): Refusal | undefined {
    const gone = goneRefusal(entities, spotId);
    if (gone !== undefined) return gone;
    if (isWinter()) return { kind: "nothingGrowsInWinter" };
    return entities.entity(spotId)?.regrowing === undefined ? undefined : { kind: "nothingToTake" };
  }

  return {
    reach(spotId) {
      const spot = entityWith(entities, spotId, "forageSpot", "position");
      return spot === undefined ? undefined : { target: spot.position, metres: FORAGE_REACH_METRES, walk: { style: "onto", spot: spot.position } };
    },
    forage(spotId) {
      for (const forager of players) {
        const { backpack } = forager;
        const spot = spotInReach(spotId, forager);
        if (backpack === undefined || spot === undefined) continue;
        hand.start(
          "low",
          spot.position,
          (): ForageRefusal | undefined => {
            const still = spotInReach(spotId, forager);
            if (still === undefined) return undefined;
            const food = still.forageSpot.food;
            if (!addToBackpack(backpack, food, FOOD_PER_FORAGE[food])) return "backpackFull";
            entities.addComponent(still, "regrowing", { minutesLeft: REGROW_MINUTES });
            return undefined;
          },
          spot.forageSpot.food,
        );
      }
    },
    refusal,
    eat(food) {
      let ate = false;
      for (const player of players) {
        if (player.backpack === undefined || player.needs === undefined) continue;
        if (!removeFromBackpack(player.backpack, food, 1)) continue;
        // Food eaten at a finished table fills more hunger.
        const factor = isAtTable(entities, player.position) ? TABLE_HUNGER_FACTOR : 1;
        fillNeed(player.needs, "hunger", HUNGER_FILLED_BY[food] * factor);
        if (MAKES_SICK[food]) setComponent(entities, player, "sickness", catchSickness());
        ate = true;
      }
      return ate;
    },
    grow(gameMinutes, winter) {
      if (winter) {
        // Food still on a spot is lost. Copy the list first, because spots leave the query as they start to grow back.
        for (const spot of [...spots]) if (spot.regrowing === undefined) entities.addComponent(spot, "regrowing", { minutesLeft: REGROW_MINUTES });
        return;
      }
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

/** The rules for foraging wild food and eating. `onEat` runs after the player eats, for drawing to play. */
export function foragingRules(foraging: Foraging, onEat: () => void): CommandRules<"forage" | "eat"> {
  return {
    forage: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => foraging.refusal(command.spotId),
      approach: {
        reach: (command) => foraging.reach(command.spotId),
        act: (command) => {
          foraging.forage(command.spotId);
        },
      },
    },
    eat: {
      start: "alongside",
      run: (command) => {
        if (foraging.eat(command.food)) onEat();
      },
    },
  };
}
