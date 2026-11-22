// Rain barrels: catching rain as clean water, and the player drinking from a barrel or filling the pot from it.
// A barrel catches rain only where rain would fall on the player: under a roof it catches nothing. Its water never goes bad.
// Taking a barrel down spills its water, so taking-down.ts needs nothing from here.
import type { PlainNotice, RainBarrelView, Refusal } from "./api";
import type { ApproachReach } from "./approach";
import { addToBackpack, hasInBackpack, removeFromBackpack } from "./backpack";
import type { CommandRules, RuleGame } from "./command-rule";
import { entityWith, playerEntities, type Entity, type EntityStore } from "./entities";
import { fillBy, isEmptyFill, takeOne } from "./fill-level";
import { RAIN_BARREL_DRINK_LIMIT, RAIN_BARREL_MINUTES_PER_DRINK } from "./furniture/rain-barrel";
import { nearestWithin } from "./ground-point";
import { FULL_NEED } from "./needs";
import { goneRefusal } from "./refusals";
import { isUnderRoof } from "./roofs";

/** The player walks to a spot this far from a barrel's middle to use it, in metres. */
const RAIN_BARREL_STAND_METRES = 1.1;
/** The player can use a barrel from this far from its middle, in metres. */
const RAIN_BARREL_REACH_METRES = 2;

/** A finished rain barrel, standing somewhere, with its water. */
type RainBarrelEntity = Entity & Required<Pick<Entity, "furniture" | "position" | "rainBarrel">>;

export interface RainBarrels {
  /** Fills every barrel that rain falls on by this many game minutes of rain. Does nothing while no rain falls. */
  catchRain(gameMinutes: number, raining: boolean): void;
  /** Where the player walks to use a finished barrel: beside it, on their own side. Undefined if the entity is not one. */
  reach(barrelId: number): ApproachReach | undefined;
  /** Why the player could not drink from the barrel, wherever they stand: it is gone or empty. */
  drinkRefusal(barrelId: number): Refusal | undefined;
  /** Why the player could not fill the pot from the barrel, wherever they stand: it is gone or empty, or no empty pot is in the backpack. */
  fillPotRefusal(barrelId: number): Refusal | undefined;
  /** Drinks 1 drink from the barrel, which fills thirst completely. Does nothing if the refusal does not pass. */
  drink(barrelId: number): void;
  /** Fills the empty pot from the barrel with 1 drink of clean water. Returns a notice if the full pot does not fit in the backpack. */
  fillPot(barrelId: number): PlainNotice | undefined;
  /** The barrel nearest the player that is within their reach, if any, as the HUD shows it. */
  nearby(): RainBarrelView | undefined;
}

export function createRainBarrels(entities: EntityStore): RainBarrels {
  const players = playerEntities(entities);
  const pieces = entities.with("furniture", "position", "rainBarrel");

  const barrelById = (barrelId: number): RainBarrelEntity | undefined => {
    const barrel = entityWith(entities, barrelId, "furniture", "position", "rainBarrel");
    return barrel?.furniture === "rainBarrel" ? barrel : undefined;
  };

  function barrels(): RainBarrelEntity[] {
    return pieces.entities.filter((piece) => piece.furniture === "rainBarrel");
  }

  function drinkRefusal(barrelId: number): Refusal | undefined {
    const gone = goneRefusal(entities, barrelId);
    if (gone !== undefined) return gone;
    const barrel = barrelById(barrelId);
    return barrel !== undefined && isEmptyFill(barrel.rainBarrel) ? { kind: "barrelEmpty" } : undefined;
  }

  function fillPotRefusal(barrelId: number): Refusal | undefined {
    const refusal = drinkRefusal(barrelId);
    if (refusal !== undefined) return refusal;
    const player = players.first;
    return player?.backpack !== undefined && hasInBackpack(player.backpack, "pot") ? undefined : { kind: "noEmptyPot" };
  }

  return {
    catchRain(gameMinutes, raining) {
      if (!raining) return;
      for (const barrel of barrels()) {
        if (isUnderRoof(entities, barrel.position)) continue;
        barrel.rainBarrel = fillBy(barrel.rainBarrel, gameMinutes / RAIN_BARREL_MINUTES_PER_DRINK, RAIN_BARREL_DRINK_LIMIT);
      }
    },
    reach(barrelId) {
      const barrel = barrelById(barrelId);
      if (barrel === undefined) return undefined;
      return { target: barrel.position, metres: RAIN_BARREL_REACH_METRES, walk: { style: "beside", standMetres: RAIN_BARREL_STAND_METRES } };
    },
    drinkRefusal,
    fillPotRefusal,
    drink(barrelId) {
      const barrel = barrelById(barrelId);
      if (barrel === undefined || drinkRefusal(barrelId) !== undefined) return;
      for (const player of players) {
        if (player.needs === undefined) continue;
        player.needs.thirst.level = FULL_NEED;
        player.needs.thirst.minutesWithout = 0;
        barrel.rainBarrel = takeOne(barrel.rainBarrel);
        return;
      }
    },
    fillPot(barrelId) {
      const barrel = barrelById(barrelId);
      if (barrel === undefined || fillPotRefusal(barrelId) !== undefined) return undefined;
      for (const { backpack } of players) {
        if (backpack === undefined || !removeFromBackpack(backpack, "pot", 1)) continue;
        // Rain caught in a barrel is clean water, the same as boiled water.
        if (!addToBackpack(backpack, "potOfBoiledWater", 1)) {
          addToBackpack(backpack, "pot", 1);
          return "backpackFull";
        }
        barrel.rainBarrel = takeOne(barrel.rainBarrel);
        return undefined;
      }
      return undefined;
    },
    nearby() {
      const player = players.first;
      const nearest = player === undefined ? undefined : nearestWithin(player.position, barrels(), RAIN_BARREL_REACH_METRES);
      const id = nearest === undefined ? undefined : entities.id(nearest);
      if (nearest === undefined || id === undefined) return undefined;
      return Object.freeze({ id, drinks: nearest.rainBarrel.held, limit: RAIN_BARREL_DRINK_LIMIT, underRoof: isUnderRoof(entities, nearest.position) });
    },
  };
}

/** The rules for drinking from a rain barrel and filling the pot from one. The player reaches into the barrel to do either. */
export function rainBarrelRules(barrels: RainBarrels, { entities, hand }: RuleGame): CommandRules<"drinkFromRainBarrel" | "fillPotFromRainBarrel"> {
  const reachInto = (barrelId: number, act: () => PlainNotice | undefined): void => {
    hand.start("waist", entities.entity(barrelId)?.position, act);
  };
  return {
    drinkFromRainBarrel: {
      start: "fresh",
      refusal: (command) => barrels.drinkRefusal(command.barrelId),
      approach: {
        reach: (command) => barrels.reach(command.barrelId),
        act: (command) => {
          reachInto(command.barrelId, () => {
            barrels.drink(command.barrelId);
            return undefined;
          });
        },
      },
    },
    fillPotFromRainBarrel: {
      start: "fresh",
      refusal: (command) => barrels.fillPotRefusal(command.barrelId),
      approach: {
        reach: (command) => barrels.reach(command.barrelId),
        act: (command) => {
          reachInto(command.barrelId, () => barrels.fillPot(command.barrelId));
        },
      },
    },
  };
}
