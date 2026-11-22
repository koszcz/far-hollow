// Filling and drinking from jugs: the player pours a pot of clean water into a jug, and drinks from a jug later.
import type { Refusal } from "./api";
import { addToBackpack, removeFromBackpack, type Backpack, type BackpackContent } from "./backpack";
import type { CommandRules } from "./command-rule";
import type { EntityStore } from "./entities";
import { jugToDrinkFrom, jugToPourInto, withOneLessDrink, withOneMoreDrink } from "./jug";
import { quenchThirst } from "./needs";

export interface Jugs {
  /** Why the player could not pour a pot of clean water into a jug: they have no pot of clean water, or no jug has room. */
  pourRefusal(): Refusal | undefined;
  /** Pours the pot of clean water into the fullest jug that still has room. The jug gains 1 drink and the pot is left empty. */
  pour(): void;
  /** Why the player could not drink from a jug: no jug holds water. */
  drinkRefusal(): Refusal | undefined;
  /** Drinks 1 drink from the emptiest jug that holds water, which fills thirst. Returns whether the player drank. */
  drink(): boolean;
}

export function createJugs(entities: EntityStore): Jugs {
  const players = entities.with("player", "backpack");

  function pourRefusal(): Refusal | undefined {
    const backpack = players.first?.backpack;
    if (backpack === undefined || (backpack.contents.potOfBoiledWater ?? 0) <= 0) return { kind: "noPotOfCleanWater" };
    return jugToPourInto(backpack.contents) === undefined ? { kind: "noJugWithRoom" } : undefined;
  }

  function drinkRefusal(): Refusal | undefined {
    const backpack = players.first?.backpack;
    return backpack === undefined || jugToDrinkFrom(backpack.contents) === undefined ? { kind: "noWaterInJug" } : undefined;
  }

  return {
    pourRefusal,
    drinkRefusal,
    pour() {
      const backpack = players.first?.backpack;
      if (backpack === undefined || pourRefusal() !== undefined) return;
      const jug = jugToPourInto(backpack.contents);
      if (jug === undefined) return;
      // The water moves from the pot to the jug, so the backpack weighs the same after.
      swap(backpack, "potOfBoiledWater", "pot");
      swap(backpack, jug, withOneMoreDrink(jug));
    },
    drink() {
      for (const player of players) {
        const jug = jugToDrinkFrom(player.backpack.contents);
        if (player.needs === undefined || jug === undefined) continue;
        swap(player.backpack, jug, withOneLessDrink(jug));
        quenchThirst(player.needs);
        return true;
      }
      return false;
    },
  };
}

/** Swaps one `from` in the backpack for one `to`. The caller checks that the backpack holds `from` and that `to` weighs no more. */
function swap(backpack: Backpack, from: BackpackContent, to: BackpackContent): void {
  removeFromBackpack(backpack, from, 1);
  addToBackpack(backpack, to, 1);
}

/** The rules for pouring clean water into a jug and drinking from one. `onDrink` runs after the player drinks, for drawing to play. */
export function jugRules(jugs: Jugs, onDrink: () => void): CommandRules<"pourIntoJug" | "drinkFromJug"> {
  return {
    pourIntoJug: {
      start: "alongside",
      refusal: () => jugs.pourRefusal(),
      run: () => {
        jugs.pour();
      },
    },
    drinkFromJug: {
      start: "alongside",
      refusal: () => jugs.drinkRefusal(),
      run: () => {
        if (jugs.drink()) onDrink();
      },
    },
  };
}
