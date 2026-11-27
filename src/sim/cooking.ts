// Cooking fish: the player puts raw fish on a lit campfire or fireplace, and they become cooked fish after a while.
import type { PlainNotice } from "./api-notice";
import type { Refusal } from "./api-refusal";
import { addToBackpack, hasInBackpack, removeFromBackpack, type Backpack } from "./backpack";
import type { Campfires } from "./campfires";
import { heldFireOf, heldFires, type EntityStore, type HeldFire } from "./entities";
import { COOK_MINUTES, FISH_ON_FIRE_LIMIT, isCooked, type FishOnFire } from "./fish-on-fire";
import type { CommandRules, RuleGame } from "./command-rule";
import { tendApproach } from "./tending";

/** A fish this close to cooked counts as cooked, so rounding errors in the clock cannot leave it a sliver short. */
const COOKED_ALLOWANCE_MINUTES = 1e-6;

/** Each command names the fire by the entity id of its campfire or fireplace. */
export interface Cooking {
  /**
   * Puts one raw fish from the backpack on a lit campfire or fireplace within the player's reach.
   * Does nothing if the fire holds FISH_ON_FIRE_LIMIT fish.
   */
  cookFish(campfireId: number): void;
  /** Why the player could not put a raw fish on the campfire or fireplace, wherever they stand. */
  refusal(campfireId: number): Refusal | undefined;
  /**
   * Takes every fish off a campfire or fireplace within the player's reach and puts them in the backpack, cooked fish first,
   * as far as they fit. The rest stay on the fire and keep cooking. Returns a notice if any did not fit.
   */
  takeFishOff(campfireId: number): PlainNotice | undefined;
  /**
   * Cooks every fish on a lit campfire or fireplace for this many game minutes. A fish on a fire that is out keeps its progress.
   * Call it after the fires burn, so a fire that went out does not cook.
   */
  cook(gameMinutes: number): void;
}

export function createCooking(entities: EntityStore, campfires: Campfires): Cooking {
  const players = entities.with("player", "backpack");

  /** The player's backpack. */
  function backpackOf(): Backpack | undefined {
    return players.first?.backpack;
  }

  /** Why the player could not put a raw fish on the fire: it is out, the backpack holds no raw fish, or the fire holds FISH_ON_FIRE_LIMIT fish. */
  function cookRefusal({ entity, fire }: HeldFire): Refusal | undefined {
    if (!fire.lit) return { kind: "lightFirst" };
    const backpack = backpackOf();
    if (backpack === undefined || !hasInBackpack(backpack, "rawFish")) return { kind: "noRawFish" };
    return (entity.fishOnFire?.length ?? 0) >= FISH_ON_FIRE_LIMIT ? { kind: "fireFullOfFish" } : undefined;
  }

  return {
    refusal(campfireId) {
      const held = heldFireOf(entities.entity(campfireId));
      return held === undefined ? undefined : cookRefusal(held);
    },
    cookFish(campfireId) {
      const held = campfires.nearestInReach(campfireId);
      const backpack = backpackOf();
      if (held === undefined || backpack === undefined || cookRefusal(held) !== undefined) return;
      if (!removeFromBackpack(backpack, "rawFish", 1)) return;
      if (held.entity.fishOnFire === undefined) entities.addComponent(held.entity, "fishOnFire", [{ minutesCooked: 0 }]);
      else held.entity.fishOnFire.push({ minutesCooked: 0 });
    },
    takeFishOff(campfireId) {
      const entity = campfires.nearestInReach(campfireId)?.entity;
      const backpack = backpackOf();
      if (entity?.fishOnFire === undefined || backpack === undefined) return undefined;
      // Cooked fish come off first, so a full backpack leaves the raw ones cooking.
      const cookedFirst = [...entity.fishOnFire.filter(isCooked), ...entity.fishOnFire.filter((fish) => !isCooked(fish))];
      const left: FishOnFire[] = cookedFirst.filter((fish) => !addToBackpack(backpack, isCooked(fish) ? "cookedFish" : "rawFish", 1));
      if (left.length > 0) {
        entity.fishOnFire = left;
        return "backpackFull";
      }
      entities.removeComponent(entity, "fishOnFire");
      return undefined;
    },
    cook(gameMinutes) {
      for (const { entity, fire } of heldFires(entities)) {
        if (!fire.lit || entity.fishOnFire === undefined) continue;
        for (const fish of entity.fishOnFire) {
          // Cooked fish stay cooked and never burn, so the count stops at COOK_MINUTES.
          const minutes = fish.minutesCooked + gameMinutes;
          fish.minutesCooked = minutes >= COOK_MINUTES - COOKED_ALLOWANCE_MINUTES ? COOK_MINUTES : minutes;
        }
      }
    },
  };
}

/** The rules for cooking a fish on a campfire and taking it off. */
export function cookingRules(cooking: Cooking, campfires: Campfires, game: RuleGame): CommandRules<"cookFish" | "takeFishOff"> {
  const reach = (command: { campfireId: number }) => campfires.reach(command.campfireId);
  return {
    cookFish: {
      start: "alongside",
      refusal: (command) => cooking.refusal(command.campfireId),
      approach: tendApproach(game, reach, (command) => {
        cooking.cookFish(command.campfireId);
        return undefined;
      }),
    },
    takeFishOff: { start: "alongside", approach: tendApproach(game, reach, (command) => cooking.takeFishOff(command.campfireId)) },
  };
}
