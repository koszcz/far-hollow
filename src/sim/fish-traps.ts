// Fish traps: the player sets a fish trap from the backpack in the river's water at the bank. Some hours later it holds a fish,
// which the player comes back to take. A set trap holds one fish at a time, and stays set when its fish is taken.
// Setting a trap, taking its fish, and picking it up are quick reaches, not timed work. The catch rule is in trap-catch.ts.
import type { Refusal } from "./api";
import type { ApproachReach } from "./approach";
import { addToBackpack, fitsInBackpack, hasInBackpack, removeFromBackpack } from "./backpack";
import type { CommandRules, RuleGame } from "./command-rule";
import { entityWith, fishTrapEntities, playerEntities, type Entity, type EntityStore, type Vec3 } from "./entities";
import { groundDistance, type GroundPoint } from "./ground-point";
import { scramble } from "./random";
import { goneRefusal } from "./refusals";
import { firstCatch, isHolding, passCatchTime, takeCatch, type CatchRange, type TrapCatch } from "./trap-catch";
import { riverEdgeSpot, terrainHeightAt, type Valley } from "./valley";
import { nearestWalkableSpot, type WalkMap } from "./walk-map";

/** A set fish trap catches a fish after a wait drawn from this range, in game minutes: 6 to 12 hours. */
export const FISH_TRAP_CATCH_RANGE: CatchRange = { minMinutes: 6 * 60, maxMinutes: 12 * 60 };
/** The player cannot set a fish trap this close to another set fish trap, in metres. */
export const FISH_TRAP_SPACING_METRES = 10;
/** A set trap sits this far inside the water's edge, in metres, so it is half in the water. */
const FISH_TRAP_INSET_METRES = 0.25;
/** The player reaches a set trap, or the spot to set one, from this far away, in metres. The bank is open ground 1 m from the water. */
const FISH_TRAP_REACH_METRES = 3;

/** A fish trap set in the river. */
type FishTrapEntity = Entity & { fishTrap: TrapCatch; position: Vec3 };

/** The seed a trap at this spot draws its waits from. It mixes the spot into the game's seed, so each trap has its own waits. */
function trapSeed(gameSeed: number, spot: GroundPoint): number {
  return scramble(gameSeed ^ Math.imul(Math.round(spot.x * 100), 73_856_093) ^ Math.imul(Math.round(spot.z * 100), 19_349_663));
}

export interface FishTraps {
  /** Where a trap set toward a spot on the river goes: in the water at the edge on the player's side, nearest the spot. */
  trapSpot(spot: GroundPoint): GroundPoint | undefined;
  /** Where the approach takes the player to set a trap toward a spot on the river: to the bank beside where it goes. */
  setReach(spot: GroundPoint): ApproachReach | undefined;
  /** Why the player could not set a trap toward this spot: no trap in the backpack, a log carried, or another set trap too close. */
  setRefusal(spot: GroundPoint): Refusal | undefined;
  /** Sets a trap from the backpack toward a spot on the river. Does nothing if `setRefusal` gives a reason. */
  set(spot: GroundPoint): void;
  /** Where a set trap sits, given by its entity id. Undefined if the entity is not one. */
  positionOf(trapId: number): GroundPoint | undefined;
  /** Where the approach takes the player to reach a set trap: to the bank beside it. Undefined if the entity is not one. */
  reach(trapId: number): ApproachReach | undefined;
  /** Why the player could not take the fish from a set trap: it is gone, holds no fish, or the fish does not fit in the backpack. */
  takeFishRefusal(trapId: number): Refusal | undefined;
  /** Puts the fish a set trap holds in the backpack. The trap stays set. Does nothing if `takeFishRefusal` gives a reason. */
  takeFish(trapId: number): void;
  /** Why the player could not pick up a set trap: it is gone, holds a fish, or does not fit in the backpack. */
  pickUpRefusal(trapId: number): Refusal | undefined;
  /** Puts an empty set trap back in the backpack. Does nothing if `pickUpRefusal` gives a reason. */
  pickUp(trapId: number): void;
  /** Moves every set trap on by this many game minutes. An empty trap whose wait runs out catches a fish. */
  pass(minutes: number): void;
}

/** Lets the player set fish traps in the river. `seed` is the game's seed, which each trap's waits are drawn from. */
export function createFishTraps(entities: EntityStore, walkMap: WalkMap, valley: Valley, seed: number): FishTraps {
  const players = playerEntities(entities);
  const traps = fishTrapEntities(entities);

  const trapById = (trapId: number): FishTrapEntity | undefined => entityWith(entities, trapId, "fishTrap", "position");

  function trapSpot(spot: GroundPoint): GroundPoint | undefined {
    const player = players.first;
    return player === undefined ? undefined : riverEdgeSpot(valley.river, spot, player.position, FISH_TRAP_INSET_METRES);
  }

  /** The reach to a spot in the water at the edge: onto the open bank nearest it, acting at once when already within reach. */
  function reachTo(target: GroundPoint): ApproachReach {
    const spot = nearestWalkableSpot(walkMap, target) ?? target;
    return { target: { x: target.x, z: target.z }, metres: FISH_TRAP_REACH_METRES, walk: { style: "onto", spot, atOnceInReach: true } };
  }

  function setRefusal(spot: GroundPoint): Refusal | undefined {
    const player = players.first;
    if (player?.backpack === undefined) return undefined;
    if (!hasInBackpack(player.backpack, "fishTrap")) return { kind: "noFishTrap" };
    if (player.carrying !== undefined) return { kind: "putLogDownFirst" };
    const at = trapSpot(spot);
    const tooClose = at !== undefined && traps.entities.some((trap) => groundDistance(trap.position, at) < FISH_TRAP_SPACING_METRES);
    return tooClose ? { kind: "fishTrapTooClose" } : undefined;
  }

  function takeFishRefusal(trapId: number): Refusal | undefined {
    const gone = goneRefusal(entities, trapId);
    if (gone !== undefined) return gone;
    const trap = trapById(trapId);
    if (trap === undefined || !isHolding(trap.fishTrap)) return { kind: "nothingToTake" };
    const backpack = players.first?.backpack;
    return backpack === undefined || fitsInBackpack(backpack, "rawFish", 1) ? undefined : { kind: "backpackFull" };
  }

  function pickUpRefusal(trapId: number): Refusal | undefined {
    const gone = goneRefusal(entities, trapId);
    if (gone !== undefined) return gone;
    const trap = trapById(trapId);
    if (trap !== undefined && isHolding(trap.fishTrap)) return { kind: "takeFishFirst" };
    const backpack = players.first?.backpack;
    return backpack === undefined || fitsInBackpack(backpack, "fishTrap", 1) ? undefined : { kind: "backpackFull" };
  }

  return {
    trapSpot,
    setReach(spot) {
      const at = trapSpot(spot);
      return at === undefined ? undefined : reachTo(at);
    },
    setRefusal,
    set(spot) {
      const player = players.first;
      const at = trapSpot(spot);
      if (player?.backpack === undefined || at === undefined || setRefusal(spot) !== undefined) return;
      removeFromBackpack(player.backpack, "fishTrap", 1);
      entities.add({
        fishTrap: firstCatch(FISH_TRAP_CATCH_RANGE, trapSeed(seed, at)),
        position: { x: at.x, y: terrainHeightAt(valley.terrain, at.x, at.z), z: at.z },
      });
    },
    positionOf(trapId) {
      const trap = trapById(trapId);
      return trap === undefined ? undefined : { x: trap.position.x, z: trap.position.z };
    },
    reach(trapId) {
      const trap = trapById(trapId);
      return trap === undefined ? undefined : reachTo(trap.position);
    },
    takeFishRefusal,
    takeFish(trapId) {
      const trap = trapById(trapId);
      const backpack = players.first?.backpack;
      if (trap === undefined || backpack === undefined || takeFishRefusal(trapId) !== undefined) return;
      if (addToBackpack(backpack, "rawFish", 1)) trap.fishTrap = takeCatch(trap.fishTrap);
    },
    pickUpRefusal,
    pickUp(trapId) {
      const trap = trapById(trapId);
      const backpack = players.first?.backpack;
      if (trap === undefined || backpack === undefined || pickUpRefusal(trapId) !== undefined) return;
      if (addToBackpack(backpack, "fishTrap", 1)) entities.remove(trap);
    },
    pass(minutes) {
      for (const trap of traps) trap.fishTrap = passCatchTime(trap.fishTrap, minutes, FISH_TRAP_CATCH_RANGE, trapSeed(seed, trap.position));
    },
  };
}

/**
 * The rules for fish traps. The player walks to the bank, then reaches down to the water: to set a trap, take its fish,
 * or pick it up. Each is a quick reach with free hands.
 */
export function fishTrapRules(traps: FishTraps, { hand }: RuleGame): CommandRules<"setFishTrap" | "takeFishFromTrap" | "pickUpFishTrap"> {
  const reachDown = (toward: GroundPoint | undefined, act: () => void): void => {
    hand.start("low", toward, () => {
      act();
      return undefined;
    });
  };
  const trapAt = (trapId: number): GroundPoint | undefined => traps.positionOf(trapId);
  return {
    setFishTrap: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => traps.setRefusal(command),
      approach: {
        reach: (command) => traps.setReach(command),
        act: (command) => {
          const spot = { x: command.x, z: command.z };
          reachDown(traps.trapSpot(spot), () => {
            traps.set(spot);
          });
          return undefined;
        },
      },
    },
    takeFishFromTrap: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => traps.takeFishRefusal(command.trapId),
      approach: {
        reach: (command) => traps.reach(command.trapId),
        act: (command) => {
          reachDown(trapAt(command.trapId), () => {
            traps.takeFish(command.trapId);
          });
          return undefined;
        },
      },
    },
    pickUpFishTrap: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => traps.pickUpRefusal(command.trapId),
      approach: {
        reach: (command) => traps.reach(command.trapId),
        act: (command) => {
          reachDown(trapAt(command.trapId), () => {
            traps.pickUp(command.trapId);
          });
          return undefined;
        },
      },
    },
  };
}
