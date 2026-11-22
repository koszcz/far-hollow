// Firing a jug: the player puts an unfired jug on a lit campfire or fireplace, and it becomes a jug after a while.
import type { PlainNotice, Refusal } from "./api";
import { addToBackpack, hasInBackpack, removeFromBackpack, type Backpack } from "./backpack";
import type { Campfires } from "./campfires";
import { heldFireOf, heldFires, type EntityStore, type HeldFire } from "./entities";
import { FIRE_JUG_MINUTES, isFired } from "./jug-on-fire";
import type { CommandRules, RuleGame } from "./command-rule";
import { tendApproach } from "./tending";

/** A jug this close to fired counts as fired, so rounding errors in the clock cannot leave it a sliver short. */
const FIRED_ALLOWANCE_MINUTES = 1e-6;

/** Each command names the fire by the entity id of its campfire or fireplace. */
export interface Firing {
  /** Puts one unfired jug from the backpack on a lit campfire or fireplace within the player's reach. Does nothing if it holds a jug. */
  fireJug(campfireId: number): void;
  /** Why the player could not put an unfired jug on the campfire or fireplace, wherever they stand. */
  refusal(campfireId: number): Refusal | undefined;
  /**
   * Takes the jug off a campfire or fireplace within the player's reach and puts it in the backpack: an empty jug once fired,
   * or else an unfired jug, which loses its progress. Returns a notice if it did not fit, and then it stays on the fire.
   */
  takeJugOff(campfireId: number): PlainNotice | undefined;
  /**
   * Fires the jug on every lit campfire or fireplace for this many game minutes. A jug on a fire that is out keeps its progress.
   * Call it after the fires burn, so a fire that went out does not fire.
   */
  fire(gameMinutes: number): void;
}

export function createFiring(entities: EntityStore, campfires: Campfires): Firing {
  const players = entities.with("player", "backpack");

  function backpackOf(): Backpack | undefined {
    return players.first?.backpack;
  }

  /** Why the player could not put an unfired jug on the fire: it is out, the backpack holds no unfired jug, or the fire holds a jug. */
  function fireJugRefusal({ entity, fire }: HeldFire): Refusal | undefined {
    if (!fire.lit) return { kind: "lightFirst" };
    const backpack = backpackOf();
    if (backpack === undefined || !hasInBackpack(backpack, "unfiredJug")) return { kind: "noUnfiredJug" };
    return entity.jugOnFire === undefined ? undefined : { kind: "fireHoldsJug" };
  }

  return {
    refusal(campfireId) {
      const held = heldFireOf(entities.entity(campfireId));
      return held === undefined ? undefined : fireJugRefusal(held);
    },
    fireJug(campfireId) {
      const held = campfires.nearestInReach(campfireId);
      const backpack = backpackOf();
      if (held === undefined || backpack === undefined || fireJugRefusal(held) !== undefined) return;
      if (!removeFromBackpack(backpack, "unfiredJug", 1)) return;
      entities.addComponent(held.entity, "jugOnFire", { minutesFired: 0 });
    },
    takeJugOff(campfireId) {
      const entity = campfires.nearestInReach(campfireId)?.entity;
      const backpack = backpackOf();
      if (entity?.jugOnFire === undefined || backpack === undefined) return undefined;
      if (!addToBackpack(backpack, isFired(entity.jugOnFire) ? "jug" : "unfiredJug", 1)) return "backpackFull";
      entities.removeComponent(entity, "jugOnFire");
      return undefined;
    },
    fire(gameMinutes) {
      for (const { entity, fire } of heldFires(entities)) {
        const jug = entity.jugOnFire;
        if (!fire.lit || jug === undefined) continue;
        // A fired jug never breaks, so the count stops at FIRE_JUG_MINUTES.
        const minutes = jug.minutesFired + gameMinutes;
        jug.minutesFired = minutes >= FIRE_JUG_MINUTES - FIRED_ALLOWANCE_MINUTES ? FIRE_JUG_MINUTES : minutes;
      }
    },
  };
}

/** The rules for firing a jug on a campfire or fireplace and taking it off. */
export function firingRules(firing: Firing, campfires: Campfires, game: RuleGame): CommandRules<"fireJug" | "takeJugOff"> {
  const reach = (command: { campfireId: number }) => campfires.reach(command.campfireId);
  return {
    fireJug: {
      start: "alongside",
      refusal: (command) => firing.refusal(command.campfireId),
      approach: tendApproach(game, reach, (command) => {
        firing.fireJug(command.campfireId);
        return undefined;
      }),
    },
    takeJugOff: { start: "alongside", approach: tendApproach(game, reach, (command) => firing.takeJugOff(command.campfireId)) },
  };
}
