// Cooking fish: the player puts raw fish on a lit campfire, and they become cooked fish after a while.
import type { PlainNotice, Refusal } from "./api";
import { addToBackpack, hasInBackpack, removeFromBackpack, type Backpack } from "./backpack";
import type { Campfires } from "./campfires";
import { entityWith, type Entity, type EntityStore } from "./entities";
import { COOK_MINUTES, FISH_ON_FIRE_LIMIT, isCooked, type FishOnFire } from "./fish-on-fire";

/** A fish this close to cooked counts as cooked, so rounding errors in the clock cannot leave it a sliver short. */
const COOKED_ALLOWANCE_MINUTES = 1e-6;

export interface Cooking {
  /** Puts one raw fish from the backpack on a lit campfire within the player's reach. Does nothing if the fire holds FISH_ON_FIRE_LIMIT fish. */
  cookFish(campfireId: number): void;
  /** Why the player could not put a raw fish on the campfire, wherever they stand. */
  refusal(campfireId: number): Refusal | undefined;
  /**
   * Takes every fish off a campfire within the player's reach and puts them in the backpack, cooked fish first, as far as they fit.
   * The rest stay on the fire and keep cooking. Returns a notice if any did not fit.
   */
  takeFishOff(campfireId: number): PlainNotice | undefined;
  /**
   * Cooks every fish on a lit campfire for this many game minutes. A fish on a fire that is out keeps its progress.
   * Call it after the campfires burn, so a fire that went out does not cook.
   */
  cook(gameMinutes: number): void;
}

export function createCooking(entities: EntityStore, campfires: Campfires): Cooking {
  const players = entities.with("player", "backpack");
  const fishOnFires = entities.with("campfire", "fishOnFire");

  /** The campfire with this id, if the player stands within reach of it. */
  function campfireInReach(campfireId: number) {
    const campfire = campfires.nearby();
    return campfire !== undefined && entities.id(campfire) === campfireId ? campfire : undefined;
  }

  /** The player's backpack. */
  function backpackOf(): Backpack | undefined {
    return players.first?.backpack;
  }

  /** Why the player could not put a raw fish on the campfire: it is out, the backpack holds no raw fish, or the fire holds FISH_ON_FIRE_LIMIT fish. */
  function cookRefusal(campfire: Pick<Entity, "fishOnFire"> & { campfire: { lit: boolean } }): Refusal | undefined {
    if (!campfire.campfire.lit) return { kind: "lightFirst" };
    const backpack = backpackOf();
    if (backpack === undefined || !hasInBackpack(backpack, "rawFish")) return { kind: "noRawFish" };
    return (campfire.fishOnFire?.length ?? 0) >= FISH_ON_FIRE_LIMIT ? { kind: "fireFullOfFish" } : undefined;
  }

  return {
    refusal(campfireId) {
      const campfire = entityWith(entities, campfireId, "campfire");
      return campfire === undefined ? undefined : cookRefusal(campfire);
    },
    cookFish(campfireId) {
      const campfire = campfireInReach(campfireId);
      const backpack = backpackOf();
      if (campfire === undefined || backpack === undefined || cookRefusal(campfire) !== undefined) return;
      if (!removeFromBackpack(backpack, "rawFish", 1)) return;
      if (campfire.fishOnFire === undefined) entities.addComponent(campfire, "fishOnFire", [{ minutesCooked: 0 }]);
      else campfire.fishOnFire.push({ minutesCooked: 0 });
    },
    takeFishOff(campfireId) {
      const campfire = campfireInReach(campfireId);
      const backpack = backpackOf();
      if (campfire?.fishOnFire === undefined || backpack === undefined) return undefined;
      // Cooked fish come off first, so a full backpack leaves the raw ones cooking.
      const cookedFirst = [...campfire.fishOnFire.filter(isCooked), ...campfire.fishOnFire.filter((fish) => !isCooked(fish))];
      const left: FishOnFire[] = cookedFirst.filter((fish) => !addToBackpack(backpack, isCooked(fish) ? "cookedFish" : "rawFish", 1));
      if (left.length > 0) {
        campfire.fishOnFire = left;
        return "backpackFull";
      }
      entities.removeComponent(campfire, "fishOnFire");
      return undefined;
    },
    cook(gameMinutes) {
      for (const { campfire, fishOnFire } of fishOnFires) {
        if (!campfire.lit) continue;
        for (const fish of fishOnFire) {
          // Cooked fish stay cooked and never burn, so the count stops at COOK_MINUTES.
          const minutes = fish.minutesCooked + gameMinutes;
          fish.minutesCooked = minutes >= COOK_MINUTES - COOKED_ALLOWANCE_MINUTES ? COOK_MINUTES : minutes;
        }
      }
    },
  };
}
