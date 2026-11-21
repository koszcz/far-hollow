// The pot: the player fills it at the river, boils the water on a lit campfire or fireplace, and drinks from it.
import type { PlainNotice, Refusal } from "./api";
import { addToBackpack, hasInBackpack, removeFromBackpack, type Backpack, type PotContent } from "./backpack";
import type { Campfires } from "./campfires";
import { canReachRiver } from "./drinking";
import { heldFireOf, heldFires, playerEntities, setComponent, type EntityStore, type HeldFire } from "./entities";
import type { HandReach } from "./hand-reach";
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
  /** Walks the player to the riverbank nearest them, then reaches down and fills the empty pot there. */
  fill(): void;
  /** Stops the player walking to fill the pot. */
  cancel(): void;
  /** Starts the player reaching down to fill the pot once they have walked to the bank. Run it after walking has moved the player. */
  step(): undefined;
  /** Puts the full pot from the backpack on a lit campfire or fireplace within the player's reach. */
  putOnFire(campfireId: number): void;
  /**
   * Why the player could not put a full pot on the campfire or fireplace, wherever they stand: it is out, or the backpack holds
   * no full pot.
   */
  putOnRefusal(campfireId: number): Refusal | undefined;
  /** Takes the pot off a campfire or fireplace within the player's reach and puts it in the backpack. Returns a notice if it does not fit. */
  takeOffFire(campfireId: number): PlainNotice | undefined;
  /**
   * Heats every pot on a lit campfire or fireplace for this many game minutes. River water boils after BOIL_MINUTES.
   * Call it after the fires burn, so a fire that went out does not heat the pot.
   */
  heat(gameMinutes: number): void;
  /** Drinks the water in the full pot, which fills thirst. Unboiled river water makes the player sick. Returns whether the player drank. */
  drink(): boolean;
}

export function createPot(entities: EntityStore, walking: Walking, valley: Valley, campfires: Campfires, hand: Pick<HandReach, "start">): Pot {
  const players = playerEntities(entities);
  const fillers = entities.with("player", "fillPotTask", "position", "backpack");
  const backpacks = entities.with("player", "backpack");

  /** Why the player could not put a full pot on the fire: it is out, or the backpack holds no full pot. */
  function putOnRefusal({ fire }: HeldFire): Refusal | undefined {
    if (!fire.lit) return { kind: "lightFirst" };
    const hasFullPot = [...backpacks].some(({ backpack }) => hasInBackpack(backpack, FULL_POT.river) || hasInBackpack(backpack, FULL_POT.boiled));
    return hasFullPot ? undefined : { kind: "noPotOfWater" };
  }

  return {
    putOnRefusal(campfireId) {
      const held = heldFireOf(entities.entity(campfireId));
      return held === undefined ? undefined : putOnRefusal(held);
    },
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
      // Copy the list first, because players who fill the pot leave the query while it is being walked.
      for (const player of [...fillers]) {
        if (player.walkPath !== undefined) continue;
        const river = player.fillPotTask;
        entities.removeComponent(player, "fillPotTask");
        if (!canReachRiver(valley, player.position) || !hasInBackpack(player.backpack, "pot")) continue;
        hand.start(
          "low",
          river,
          (): PlainNotice | undefined => {
            if (!hasInBackpack(player.backpack, "pot")) return undefined;
            return swapPot(player.backpack, "pot", "potOfRiverWater") ? undefined : "backpackFull";
          },
          "riverWater",
        );
      }
      return undefined;
    },
    putOnFire(campfireId) {
      const held = campfires.nearestInReach(campfireId);
      if (held === undefined || held.entity.potOnFire !== undefined || putOnRefusal(held) !== undefined) return;
      for (const { backpack } of backpacks) {
        for (const water of ["river", "boiled"] as const) {
          if (!removeFromBackpack(backpack, FULL_POT[water], 1)) continue;
          entities.addComponent(held.entity, "potOnFire", { water, minutesBoiling: 0 });
          return;
        }
      }
    },
    takeOffFire(campfireId) {
      const entity = campfires.nearestInReach(campfireId)?.entity;
      if (entity?.potOnFire === undefined) return undefined;
      for (const { backpack } of backpacks) {
        if (!addToBackpack(backpack, FULL_POT[entity.potOnFire.water], 1)) return "backpackFull";
        entities.removeComponent(entity, "potOnFire");
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
          return true;
        }
      }
      return false;
    },
    heat(gameMinutes) {
      for (const { entity, fire } of heldFires(entities)) {
        const { potOnFire } = entity;
        if (potOnFire === undefined || potOnFire.water === "boiled") continue;
        // Water on a fire that has gone out cools down again, so boiling starts over when it is relit.
        potOnFire.minutesBoiling = fire.lit ? potOnFire.minutesBoiling + gameMinutes : 0;
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
