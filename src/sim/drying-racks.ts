// Drying racks: the player hangs berries, mushrooms, and raw fish from the backpack on a rack, so they keep for good. Berries and
// mushrooms dry there with no fire. Raw fish smokes only while a lit campfire or fireplace is close by, and keeps its progress
// while there is none. The player takes food off by hand, preserved food first, as with fish on a fire. Rain does not slow it.
// How food on a rack dries and smokes lives in rack-food.ts. Fresh food on a rack spoils in spoiling.ts, as it does everywhere else.
// A rack that holds food cannot be taken down: taking-down.ts asks `holdsSomething`.
import type { DryingRackView } from "./api-nearby";
import type { PlainNotice } from "./api-notice";
import type { Refusal } from "./api-refusal";
import type { ApproachReach } from "./approach";
import { addToBackpack, fitsInBackpack, hasInBackpack, removeFromBackpack } from "./backpack";
import type { CommandRules, RuleGame } from "./command-rule";
import { entityWith, type Entity, type EntityStore } from "./entities";
import { heldFires, playerEntities } from "./entity-queries";
import { KEEPS_FOR_MINUTES } from "./fresh-food";
import { DRYING_RACK_REACH_METRES, DRYING_RACK_STAND_METRES } from "./furniture/drying-rack";
import { groundDistance, nearestWithin, type GroundPoint } from "./ground-point";
import {
  DRYING_RACK_FOOD_LIMIT,
  hungOnRack,
  isPreserved,
  isRackFood,
  preservedFirst,
  preservedFor,
  preserveProgress,
  SMOKING_FIRE_METRES,
  takenAs,
  waitsForFire,
  type FoodOnRack,
  type FoodToHang,
  type RackFood,
} from "./rack-food";
import { goneRefusal } from "./refusals";
import { putInHolder, takeFromHolder } from "./spoiling";

/** A finished drying rack, standing somewhere, with the food on it. */
type DryingRackEntity = Entity & Required<Pick<Entity, "furniture" | "position" | "dryingRack">>;

export interface DryingRacks {
  /** Where the player walks to use a finished rack: beside it, on their own side. Undefined if the entity is not one. */
  reach(rackId: number): ApproachReach | undefined;
  /**
   * Why the player could not hang this food on the rack, wherever they stand: it is gone, the food is cooked fish, which cannot
   * be smoked, the backpack holds none, or the rack is full.
   */
  hangRefusal(rackId: number, food: FoodToHang): Refusal | undefined;
  /** Why the player could not take food off the rack, wherever they stand: it is gone, or it holds no food. */
  takeOffRefusal(rackId: number): Refusal | undefined;
  /** Hangs one of this food from the backpack on the rack at game minute `now`. It keeps its spoil time. Does nothing if the refusal does not pass. */
  hang(rackId: number, food: FoodToHang, now: number): void;
  /**
   * Takes every food off the rack into the backpack at game minute `now`, preserved food first, as far as they fit. Fresh food
   * keeps its spoil time. The rest stay on the rack and go on drying or smoking. Returns a notice if any did not fit.
   */
  takeOff(rackId: number, now: number): PlainNotice | undefined;
  /**
   * Dries and smokes the food on every rack for this many game minutes. Drying needs no fire. Raw fish smokes only while a lit
   * campfire or fireplace stands within SMOKING_FIRE_METRES of the rack. Rain slows neither. Call it after the fires burn,
   * so a fire that went out does not smoke.
   */
  preserve(gameMinutes: number): void;
  /** A finished rack, near or far, as the HUD shows it, or undefined if the entity is not one. */
  describe(rackId: number): DryingRackView | undefined;
  /** The rack nearest the player that is within their reach, if any, as the HUD shows it. */
  nearby(): DryingRackView | undefined;
}

/** True if any drying rack holds food that has dried or smoked on it. The journal's last goal is done the first time one does. */
export function anyFoodPreservedOnRack(entities: EntityStore): boolean {
  return entities.with("dryingRack").entities.some((rack) => rack.dryingRack.some(isPreserved));
}

/** True if a lit campfire or fireplace stands within SMOKING_FIRE_METRES of this spot, so raw fish on a rack there smokes. */
function litFireCloseBy(entities: EntityStore, at: GroundPoint): boolean {
  return heldFires(entities).some(({ entity, fire }) => fire.lit && groundDistance(entity.position, at) <= SMOKING_FIRE_METRES);
}

/** The refusal for a food the backpack holds none of. */
const NONE_IN_BACKPACK: Readonly<Record<RackFood, Refusal>> = {
  berries: { kind: "noBerries" },
  mushroom: { kind: "noMushroom" },
  rawFish: { kind: "noRawFish" },
};

export function createDryingRacks(entities: EntityStore): DryingRacks {
  const players = playerEntities(entities);
  const racks = entities.with("furniture", "position", "dryingRack");

  const rackById = (rackId: number): DryingRackEntity | undefined => {
    const rack = entityWith(entities, rackId, "furniture", "position", "dryingRack");
    return rack?.furniture === "dryingRack" ? rack : undefined;
  };

  function hangRefusal(rackId: number, food: FoodToHang): Refusal | undefined {
    const gone = goneRefusal(entities, rackId);
    if (gone !== undefined) return gone;
    if (!isRackFood(food)) return { kind: "onlyRawFishSmokes" };
    const backpack = players.first?.backpack;
    if (backpack === undefined || !hasInBackpack(backpack, food)) return NONE_IN_BACKPACK[food];
    const rack = rackById(rackId);
    return rack !== undefined && rack.dryingRack.length >= DRYING_RACK_FOOD_LIMIT ? { kind: "rackFull" } : undefined;
  }

  function takeOffRefusal(rackId: number): Refusal | undefined {
    const gone = goneRefusal(entities, rackId);
    if (gone !== undefined) return gone;
    const rack = rackById(rackId);
    return rack !== undefined && rack.dryingRack.length === 0 ? { kind: "nothingToTake" } : undefined;
  }

  function viewOf(rack: DryingRackEntity): DryingRackView | undefined {
    const id = entities.id(rack);
    if (id === undefined) return undefined;
    const fireCloseBy = litFireCloseBy(entities, rack.position);
    const food = rack.dryingRack.map((item) =>
      Object.freeze({
        food: item.food,
        content: takenAs(item),
        preserved: isPreserved(item),
        progress: preserveProgress(item),
        waitsForFire: waitsForFire(item, fireCloseBy),
      }),
    );
    return Object.freeze({ id, food: Object.freeze(food), limit: DRYING_RACK_FOOD_LIMIT });
  }

  return {
    reach(rackId) {
      const rack = rackById(rackId);
      if (rack === undefined) return undefined;
      return { target: rack.position, metres: DRYING_RACK_REACH_METRES, walk: { style: "beside", standMetres: DRYING_RACK_STAND_METRES } };
    },
    hangRefusal,
    takeOffRefusal,
    hang(rackId, food, now) {
      const rack = rackById(rackId);
      const backpack = players.first?.backpack;
      if (rack === undefined || backpack === undefined || !isRackFood(food) || hangRefusal(rackId, food) !== undefined) return;
      // The oldest one goes on the rack, so the food left in the backpack is the freshest.
      const [spoilsAt] = takeFromHolder(backpack, food, 1, now);
      if (!removeFromBackpack(backpack, food, 1)) return;
      rack.dryingRack = [...rack.dryingRack, hungOnRack(food, spoilsAt ?? now + KEEPS_FOR_MINUTES[food])];
    },
    takeOff(rackId, now) {
      const rack = rackById(rackId);
      const backpack = players.first?.backpack;
      if (rack === undefined || backpack === undefined) return undefined;
      // Preserved food comes off first, so a full backpack leaves the fresh food drying or smoking.
      const left: FoodOnRack[] = [];
      for (const item of preservedFirst(rack.dryingRack)) {
        const content = takenAs(item);
        if (!fitsInBackpack(backpack, content, 1)) {
          left.push(item);
          continue;
        }
        if (item.spoilsAt !== undefined) putInHolder(backpack, content, [item.spoilsAt], now);
        addToBackpack(backpack, content, 1);
      }
      // What stays on the rack keeps the order it was hung in.
      rack.dryingRack = rack.dryingRack.filter((item) => left.includes(item));
      return left.length > 0 ? "backpackFull" : undefined;
    },
    preserve(gameMinutes) {
      for (const rack of racks) {
        if (rack.furniture !== "dryingRack" || rack.dryingRack.length === 0) continue;
        const fireCloseBy = litFireCloseBy(entities, rack.position);
        rack.dryingRack = rack.dryingRack.map((item) => preservedFor(item, gameMinutes, fireCloseBy));
      }
    },
    describe(rackId) {
      const rack = rackById(rackId);
      return rack === undefined ? undefined : viewOf(rack);
    },
    nearby() {
      const player = players.first;
      const all = racks.entities.filter((rack) => rack.furniture === "dryingRack");
      const nearest = player === undefined ? undefined : nearestWithin(player.position, all, DRYING_RACK_REACH_METRES);
      return nearest === undefined ? undefined : viewOf(nearest);
    },
  };
}

/** The rules for hanging food on a drying rack and taking it off. The player reaches out to the rack to do either. */
export function dryingRackRules(racks: DryingRacks, { entities, hand }: RuleGame, now: () => number): CommandRules<"hangOnRack" | "takeFoodOffRack"> {
  const reachTo = (rackId: number, act: () => PlainNotice | undefined): void => {
    hand.start("waist", entities.entity(rackId)?.position, act);
  };
  return {
    hangOnRack: {
      start: "fresh",
      refusal: (command) => racks.hangRefusal(command.rackId, command.food),
      approach: {
        reach: (command) => racks.reach(command.rackId),
        act: (command) => {
          reachTo(command.rackId, () => {
            racks.hang(command.rackId, command.food, now());
            return undefined;
          });
        },
      },
    },
    takeFoodOffRack: {
      start: "fresh",
      refusal: (command) => racks.takeOffRefusal(command.rackId),
      approach: {
        reach: (command) => racks.reach(command.rackId),
        act: (command) => {
          reachTo(command.rackId, () => racks.takeOff(command.rackId, now()));
        },
      },
    },
  };
}
