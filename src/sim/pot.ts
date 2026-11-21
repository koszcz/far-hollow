// The pot: the player fills it at the river, boils the water on a lit campfire or fireplace, and drinks from it.
import type { PlainNotice, Refusal } from "./api";
import type { ApproachReach } from "./approach";
import { addToBackpack, hasInBackpack, removeFromBackpack, type Backpack, type PotContent } from "./backpack";
import type { Campfires } from "./campfires";
import { riverReach } from "./drinking";
import { heldFireOf, heldFires, playerEntities, setComponent, type EntityStore, type HeldFire } from "./entities";
import type { HandReach } from "./hand-reach";
import { FULL_NEED } from "./needs";
import { BOIL_MINUTES, type PotWater } from "./pot-state";
import { catchSickness } from "./sickness";
import { nearestRiverPoint, type Valley } from "./valley";
import type { WalkMap } from "./walk-map";

/** The backpack content for a full pot of each kind of water. */
const FULL_POT: Readonly<Record<PotWater, PotContent>> = {
  river: "potOfRiverWater",
  boiled: "potOfBoiledWater",
};

export interface Pot {
  /** Where the approach takes the player to fill the pot: the riverbank nearest them. */
  fillReach(): ApproachReach | undefined;
  /**
   * Starts the player reaching down to fill the empty pot at the river, once they stand on the bank. The approach runs it once they arrive.
   * Does nothing if the backpack holds no empty pot.
   */
  fill(): void;
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

export function createPot(entities: EntityStore, walkMap: WalkMap, valley: Valley, campfires: Campfires, hand: Pick<HandReach, "start">): Pot {
  const players = playerEntities(entities);
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
    fillReach() {
      const player = players.first;
      return player === undefined ? undefined : riverReach(valley, walkMap, player.position, nearestRiverPoint(valley.river, player.position));
    },
    fill() {
      for (const player of backpacks) {
        if (player.position === undefined || !hasInBackpack(player.backpack, "pot")) continue;
        const river = nearestRiverPoint(valley.river, player.position);
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
