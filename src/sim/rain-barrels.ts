// Rain barrels: catching rain as clean water, and the player drinking from a barrel or filling the pot or a jug from it.
// A barrel catches rain only where rain would fall on the player: under a roof it catches nothing. Its water never goes bad.
// Taking a barrel down spills its water, so taking-down.ts needs nothing from here.
import type { PlainNotice } from "./api-notice";
import type { RainBarrelView } from "./api-nearby";
import type { Refusal } from "./api-refusal";
import type { ApproachReach } from "./approach";
import { hasInBackpack, swapInBackpack, type Backpack, type BackpackContent } from "./backpack";
import type { CommandRules, RuleGame } from "./command-rule";
import { entityWith, type Entity, type EntityStore } from "./entities";
import { playerEntities } from "./entity-queries";
import { fillBy, isEmptyFill, takeOne } from "./fill-level";
import { RAIN_BARREL_DRINK_LIMIT, RAIN_BARREL_MINUTES_PER_DRINK, RAIN_BARREL_REACH_METRES, RAIN_BARREL_STAND_METRES } from "./furniture/rain-barrel";
import { nearestWithin } from "./ground-point";
import { jugToPourInto, pourIntoJugRefusal, withOneMoreDrink } from "./jug";
import { quenchThirst } from "./needs";
import { goneRefusal } from "./refusals";
import { isUnderRoof } from "./roofs";

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
  /** Why the player could not fill a jug from the barrel, wherever they stand: it is gone or empty, or the backpack holds no jug with room. */
  fillJugRefusal(barrelId: number): Refusal | undefined;
  /** Drinks 1 drink from the barrel, which fills thirst completely. Does nothing if the refusal does not pass. */
  drink(barrelId: number): void;
  /** Fills the empty pot from the barrel with 1 drink of clean water. Returns a notice if the full pot does not fit in the backpack. */
  fillPot(barrelId: number): PlainNotice | undefined;
  /**
   * Pours 1 drink from the barrel into the fullest jug that still has room. Returns a notice if the heavier jug does not fit in the
   * backpack, and then changes nothing.
   */
  fillJug(barrelId: number): PlainNotice | undefined;
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

  /** Why the player could not use the barrel at all: it is gone or holds no drink. */
  function barrelUsableRefusal(barrelId: number): Refusal | undefined {
    const gone = goneRefusal(entities, barrelId);
    if (gone !== undefined) return gone;
    const barrel = barrelById(barrelId);
    return barrel !== undefined && isEmptyFill(barrel.rainBarrel) ? { kind: "barrelEmpty" } : undefined;
  }

  /** Why the player could not fill something in their backpack from the barrel: the barrel is unusable, or `backpackRefusal` says why. */
  function fillRefusal(barrelId: number, backpackRefusal: (backpack: Backpack) => Refusal | undefined): Refusal | undefined {
    // A player with no backpack is refused as one whose backpack holds nothing.
    return barrelUsableRefusal(barrelId) ?? backpackRefusal(players.first?.backpack ?? { contents: {} });
  }

  const fillPotRefusal = (barrelId: number): Refusal | undefined =>
    fillRefusal(barrelId, (backpack) => (hasInBackpack(backpack, "pot") ? undefined : { kind: "noEmptyPot" }));

  const fillJugRefusal = (barrelId: number): Refusal | undefined => fillRefusal(barrelId, (backpack) => pourIntoJugRefusal(backpack.contents));

  /**
   * Takes 1 drink out of the barrel into the backpack by swapping one `from` for one `to`, if `refusal` passes.
   * Returns a notice if `to` does not fit in the backpack, and then changes nothing.
   */
  function fill(
    barrelId: number,
    refusal: (barrelId: number) => Refusal | undefined,
    swap: (backpack: Backpack) => readonly [from: BackpackContent, to: BackpackContent] | undefined,
  ): PlainNotice | undefined {
    const barrel = barrelById(barrelId);
    const backpack = players.first?.backpack;
    if (barrel === undefined || backpack === undefined || refusal(barrelId) !== undefined) return undefined;
    const fromTo = swap(backpack);
    if (fromTo === undefined) return undefined;
    if (!swapInBackpack(backpack, ...fromTo)) return "backpackFull";
    barrel.rainBarrel = takeOne(barrel.rainBarrel);
    return undefined;
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
    drinkRefusal: barrelUsableRefusal,
    fillPotRefusal,
    fillJugRefusal,
    drink(barrelId) {
      const barrel = barrelById(barrelId);
      if (barrel === undefined || barrelUsableRefusal(barrelId) !== undefined) return;
      for (const player of players) {
        if (player.needs === undefined) continue;
        quenchThirst(player.needs);
        barrel.rainBarrel = takeOne(barrel.rainBarrel);
        return;
      }
    },
    fillPot(barrelId) {
      // Rain caught in a barrel is clean water, the same as boiled water.
      return fill(barrelId, fillPotRefusal, () => ["pot", "potOfBoiledWater"]);
    },
    fillJug(barrelId) {
      // The jug gains a drink, so it weighs more and may not fit.
      return fill(barrelId, fillJugRefusal, (backpack) => {
        const jug = jugToPourInto(backpack.contents);
        return jug === undefined ? undefined : [jug, withOneMoreDrink(jug)];
      });
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

/** The rules for drinking from a rain barrel and filling the pot or a jug from one. The player reaches into the barrel to do either. */
export function rainBarrelRules(
  barrels: RainBarrels,
  { entities, hand }: RuleGame,
): CommandRules<"drinkFromRainBarrel" | "fillPotFromRainBarrel" | "fillJugFromRainBarrel"> {
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
    fillJugFromRainBarrel: {
      start: "fresh",
      refusal: (command) => barrels.fillJugRefusal(command.barrelId),
      approach: {
        reach: (command) => barrels.reach(command.barrelId),
        act: (command) => {
          reachInto(command.barrelId, () => barrels.fillJug(command.barrelId));
        },
      },
    },
  };
}
