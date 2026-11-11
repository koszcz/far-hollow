// The pot: the player fills it at the river, boils the water on a lit campfire, and drinks from it.
import type { PlainNotice } from "./api";
import { addToBackpack, hasInBackpack, removeFromBackpack, type Backpack, type PotContent } from "./backpack";
import type { Campfires } from "./campfires";
import { canReachRiver } from "./drinking";
import { playerEntities, setComponent, type EntityStore } from "./entities";
import { FULL_NEED } from "./needs";
import { BOIL_MINUTES, type PotWater } from "./pot-state";
import { catchSickness } from "./sickness";
import { nearestRiverPoint, type Valley } from "./valley";
import { nearestWalkableSpot } from "./walk-map";
import type { Walking } from "./walking";


/** The backpack content for a full pot of each kind of water. */
const FULL_POT: Readonly<Record<PotWater, PotContent>> = {
  river: "potOfRiverWater",
  boiled: "potOfBoiledWater",
};

export interface Pot {
  /** Walks the player to the riverbank nearest them, then fills the empty pot there. */
  fill(): void;
  /** Stops the player walking to fill the pot. */
  cancel(): void;
  /** Fills the pot once the player has reached the bank. Returns a notice if the backpack had no room for the water. */
  step(): PlainNotice | undefined;
  /** Puts the full pot from the backpack on a lit campfire within the player's reach. */
  putOnFire(campfireId: number): void;
  /** Takes the pot off a campfire within the player's reach and puts it in the backpack. Returns a notice if it does not fit. */
  takeOffFire(campfireId: number): PlainNotice | undefined;
  /**
   * Heats every pot on a lit campfire for this many game minutes. River water boils after BOIL_MINUTES.
   * Call it after the campfires burn, so a fire that went out does not heat the pot.
   */
  heat(gameMinutes: number): void;
  /** Drinks the water in the full pot, which fills thirst. Unboiled river water makes the player sick. */
  drink(): void;
}

export function createPot(entities: EntityStore, walking: Walking, valley: Valley, campfires: Campfires): Pot {
  const players = playerEntities(entities);
  const fillers = entities.with("player", "fillPotTask", "position", "backpack");
  const backpacks = entities.with("player", "backpack");
  const potsOnFire = entities.with("campfire", "potOnFire");

  /** The campfire with this id, if the player stands within reach of it. */
  function campfireInReach(campfireId: number) {
    const campfire = campfires.nearby();
    return campfire !== undefined && entities.id(campfire) === campfireId ? campfire : undefined;
  }

  return {
    fill() {
      for (const player of players) {
        const river = nearestRiverPoint(valley.river, player.position);
        setComponent(entities, player, "fillPotTask", river);
        walking.walkTo(nearestWalkableSpot(walking.walkMap, river) ?? river);
      }
    },
    cancel() {
      for (const player of [...fillers]) entities.removeComponent(player, "fillPotTask");
    },
    step() {
      let notice: PlainNotice | undefined;
      // Copy the list first, because players who fill the pot leave the query while it is being walked.
      for (const player of [...fillers]) {
        if (player.walkPath !== undefined) continue;
        entities.removeComponent(player, "fillPotTask");
        if (!canReachRiver(valley, player.position) || !hasInBackpack(player.backpack, "pot")) continue;
        if (!swapPot(player.backpack, "pot", "potOfRiverWater")) notice = "backpackFull";
      }
      return notice;
    },
    putOnFire(campfireId) {
      const campfire = campfireInReach(campfireId);
      if (campfire === undefined || !campfire.campfire.lit || campfire.potOnFire !== undefined) return;
      for (const { backpack } of backpacks) {
        for (const water of ["river", "boiled"] as const) {
          if (!removeFromBackpack(backpack, FULL_POT[water], 1)) continue;
          entities.addComponent(campfire, "potOnFire", { water, minutesBoiling: 0 });
          return;
        }
      }
    },
    takeOffFire(campfireId) {
      const campfire = campfireInReach(campfireId);
      if (campfire?.potOnFire === undefined) return undefined;
      for (const { backpack } of backpacks) {
        if (!addToBackpack(backpack, FULL_POT[campfire.potOnFire.water], 1)) return "backpackFull";
        entities.removeComponent(campfire, "potOnFire");
      }
      return undefined;
    },
    drink() {
      for (const player of backpacks) {
        if (player.needs === undefined) continue;
        for (const water of ["boiled", "river"] as const) {
          if (!swapPot(player.backpack, FULL_POT[water], "pot")) continue;
          player.needs.thirst.level = FULL_NEED;
          player.needs.thirst.minutesWithout = 0;
          if (water === "river") setComponent(entities, player, "sickness", catchSickness());
          return;
        }
      }
    },
    heat(gameMinutes) {
      for (const { campfire, potOnFire } of potsOnFire) {
        if (potOnFire.water === "boiled") continue;
        // Water on a fire that has gone out cools down again, so boiling starts over when it is relit.
        potOnFire.minutesBoiling = campfire.lit ? potOnFire.minutesBoiling + gameMinutes : 0;
        if (potOnFire.minutesBoiling >= BOIL_MINUTES - 1e-6) potOnFire.water = "boiled";
      }
    },
  };
}

/**
 * Swaps the pot in the backpack for the same pot holding something else, if the backpack holds `from` and has room for `to`.
 * Returns false, and changes nothing, if it does not.
 */
function swapPot(backpack: Backpack, from: PotContent, to: PotContent): boolean {
  if (!hasInBackpack(backpack, from)) return false;
  removeFromBackpack(backpack, from, 1);
  if (addToBackpack(backpack, to, 1)) return true;
  addToBackpack(backpack, from, 1);
  return false;
}
