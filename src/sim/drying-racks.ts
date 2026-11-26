// Drying racks: the player hangs berries and mushrooms from the backpack on a rack, and they dry there with no fire, so they keep
// for good. The player takes them off by hand, dried food first, as with fish on a fire. Rain does not slow drying.
// How food on a rack dries lives in rack-food.ts. Fresh food on a rack spoils in spoiling.ts, as it does everywhere else.
// A rack that holds food cannot be taken down: taking-down.ts asks `holdsSomething`.
import type { DryingRackView, PlainNotice, Refusal } from "./api";
import type { ApproachReach } from "./approach";
import { addToBackpack, fitsInBackpack, hasInBackpack, removeFromBackpack } from "./backpack";
import type { CommandRules, RuleGame } from "./command-rule";
import { entityWith, playerEntities, type Entity, type EntityStore } from "./entities";
import { KEEPS_FOR_MINUTES } from "./fresh-food";
import { DRYING_RACK_REACH_METRES, DRYING_RACK_STAND_METRES } from "./furniture/drying-rack";
import { nearestWithin } from "./ground-point";
import { DRYING_RACK_FOOD_LIMIT, driedFirst, driedFor, dryProgress, hungOnRack, isDried, takenAs, type FoodOnRack, type RackFood } from "./rack-food";
import { goneRefusal } from "./refusals";
import { putInHolder, takeFromHolder } from "./spoiling";

/** A finished drying rack, standing somewhere, with the food on it. */
type DryingRackEntity = Entity & Required<Pick<Entity, "furniture" | "position" | "dryingRack">>;

export interface DryingRacks {
  /** Where the player walks to use a finished rack: beside it, on their own side. Undefined if the entity is not one. */
  reach(rackId: number): ApproachReach | undefined;
  /** Why the player could not hang this food on the rack, wherever they stand: it is gone, the backpack holds none, or the rack is full. */
  hangRefusal(rackId: number, food: RackFood): Refusal | undefined;
  /** Why the player could not take food off the rack, wherever they stand: it is gone, or it holds no food. */
  takeOffRefusal(rackId: number): Refusal | undefined;
  /** Hangs one of this food from the backpack on the rack at game minute `now`. It keeps its spoil time. Does nothing if the refusal does not pass. */
  hang(rackId: number, food: RackFood, now: number): void;
  /**
   * Takes every food off the rack into the backpack at game minute `now`, dried food first, as far as they fit. Fresh food keeps
   * its spoil time. The rest stay on the rack and go on drying. Returns a notice if any did not fit.
   */
  takeOff(rackId: number, now: number): PlainNotice | undefined;
  /** Dries the food on every rack for this many game minutes. Drying needs no fire, and rain does not slow it. */
  dry(gameMinutes: number): void;
  /** A finished rack, near or far, as the HUD shows it, or undefined if the entity is not one. */
  describe(rackId: number): DryingRackView | undefined;
  /** The rack nearest the player that is within their reach, if any, as the HUD shows it. */
  nearby(): DryingRackView | undefined;
}

/** True if any drying rack holds food that has dried on it. The journal's last goal is done the first time one does. */
export function anyFoodDriedOnRack(entities: EntityStore): boolean {
  return entities.with("dryingRack").entities.some((rack) => rack.dryingRack.some(isDried));
}

export function createDryingRacks(entities: EntityStore): DryingRacks {
  const players = playerEntities(entities);
  const racks = entities.with("furniture", "position", "dryingRack");

  const rackById = (rackId: number): DryingRackEntity | undefined => {
    const rack = entityWith(entities, rackId, "furniture", "position", "dryingRack");
    return rack?.furniture === "dryingRack" ? rack : undefined;
  };

  function hangRefusal(rackId: number, food: RackFood): Refusal | undefined {
    const gone = goneRefusal(entities, rackId);
    if (gone !== undefined) return gone;
    const backpack = players.first?.backpack;
    if (backpack === undefined || !hasInBackpack(backpack, food)) return { kind: food === "berries" ? "noBerries" : "noMushroom" };
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
    const food = rack.dryingRack.map((item) => Object.freeze({ food: item.food, dried: isDried(item), dryProgress: dryProgress(item) }));
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
      if (rack === undefined || backpack === undefined || hangRefusal(rackId, food) !== undefined) return;
      // The oldest one goes on the rack, so the food left in the backpack is the freshest.
      const [spoilsAt] = takeFromHolder(backpack, food, 1, now);
      if (!removeFromBackpack(backpack, food, 1)) return;
      rack.dryingRack = [...rack.dryingRack, hungOnRack(food, spoilsAt ?? now + KEEPS_FOR_MINUTES[food])];
    },
    takeOff(rackId, now) {
      const rack = rackById(rackId);
      const backpack = players.first?.backpack;
      if (rack === undefined || backpack === undefined) return undefined;
      // Dried food comes off first, so a full backpack leaves the fresh food drying.
      const left: FoodOnRack[] = [];
      for (const item of driedFirst(rack.dryingRack)) {
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
    dry(gameMinutes) {
      for (const rack of racks) {
        if (rack.furniture !== "dryingRack" || rack.dryingRack.length === 0) continue;
        rack.dryingRack = rack.dryingRack.map((item) => driedFor(item, gameMinutes));
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
