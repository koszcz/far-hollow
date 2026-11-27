// Stacking logs, debarked logs, and firewood on a woodpile, and taking them off again.
import type { Command } from "./api-commands";
import type { Refusal } from "./api-refusal";
import type { WoodpileView } from "./api-nearby";
import { addToBackpack, countInBackpack, removeFromBackpack } from "./backpack";
import { addCount, takeCount, totalCount } from "./counts";
import { entityWith, playerEntities, woodpileEntities, type Entity, type EntityStore, type WoodpileWood } from "./entities";
import { shoulderRefusal } from "./refusals";
import { groundDistance, nearestWithin } from "./ground-point";
import type { ApproachReach } from "./approach";
import type { CommandRules, RuleGame } from "./command-rule";
import { reachToward } from "./hand-reach";
import { tendApproach } from "./tending";

/** A woodpile holds up to this many logs, debarked logs, and pieces of firewood in all, in any mix. */
export const WOODPILE_CAPACITY = 20;
/** The player walks to a spot this far from a woodpile's centre to use it, in metres. */
const WOODPILE_STAND_METRES = 1.3;
/** The player can use a woodpile from this far from its centre, in metres. */
const WOODPILE_REACH_METRES = 2.5;

type WoodpileEntity = Entity & Required<Pick<Entity, "woodpile" | "position">>;

export interface Woodpiles {
  /**
   * Where the player walks to use a woodpile: beside it, on their own side, since the woodpile blocks walking.
   * Undefined if the entity is not a finished woodpile.
   */
  reach(woodpileId: number): ApproachReach | undefined;
  /** Why the player could not stack this wood on the woodpile, or take it off, wherever they stand. */
  refusal(command: Extract<Command, { type: "stackOnWoodpile" | "takeFromWoodpile" }>): Refusal | undefined;
  /**
   * Stacks wood on a woodpile within the player's reach. A log or debarked log comes off the player's shoulder, one at a time.
   * Firewood comes out of the backpack: one piece, or with `all` as many as the woodpile has room for.
   * Does nothing if the woodpile is full or the player has none of that wood.
   */
  stack(woodpileId: number, wood: WoodpileWood, all: boolean): void;
  /**
   * Takes wood off a woodpile within the player's reach. A log or debarked log goes on the player's shoulder, if it is free.
   * Firewood goes in the backpack, as much as fits. Returns `backpackFull` if none of it fits.
   */
  take(woodpileId: number, wood: WoodpileWood): "backpackFull" | undefined;
  /** The woodpile as the HUD shows it, near or far, or undefined if the entity is not a finished woodpile. */
  describe(woodpileId: number): WoodpileView | undefined;
  /** The woodpile nearest the player that is within their reach, if any, as the HUD shows it. */
  nearby(): WoodpileView | undefined;
}

/** How many pieces of wood a woodpile holds in all. */
export function woodpileTotal(contents: Readonly<Record<WoodpileWood, number>>): number {
  return totalCount(contents);
}

/** Stacks up to `count` of one wood on a woodpile, as far as it has room. Returns how many it stacked. */
export function stackOnWoodpile(woodpile: Pick<WoodpileEntity, "woodpile">, wood: WoodpileWood, count: number): number {
  const stacked = Math.max(0, Math.min(count, WOODPILE_CAPACITY - woodpileTotal(woodpile.woodpile)));
  woodpile.woodpile = addCount(woodpile.woodpile, wood, stacked);
  return stacked;
}

/** Lets the player keep logs and firewood on woodpiles. */
export function createWoodpiles(entities: EntityStore): Woodpiles {
  const players = playerEntities(entities);
  const woodpiles = woodpileEntities(entities);

  const woodpileById = (woodpileId: number): WoodpileEntity | undefined => entityWith(entities, woodpileId, "woodpile", "position");

  /** The player, if they stand still within reach of the woodpile. */
  function userOf(woodpile: WoodpileEntity) {
    for (const player of players) {
      if (player.walkPath === undefined && groundDistance(woodpile.position, player.position) <= WOODPILE_REACH_METRES) return player;
    }
    return undefined;
  }

  function describe(woodpile: WoodpileEntity): WoodpileView | undefined {
    const id = entities.id(woodpile);
    if (id === undefined) return undefined;
    const contents = Object.freeze({ ...woodpile.woodpile });
    return Object.freeze({ id, contents, total: woodpileTotal(contents), capacity: WOODPILE_CAPACITY });
  }

  /**
   * Why the player could not stack this wood on the woodpile: a log they do not carry, a full woodpile, or no firewood in the backpack.
   * A log the player does not carry comes first, so a full woodpile shows only for wood they could stack.
   */
  function stackRefusal(woodpile: WoodpileEntity, wood: WoodpileWood): Refusal | undefined {
    const player = players.first;
    if (wood !== "firewood" && player?.carrying !== wood) return { kind: "noLogCarried" };
    if (woodpileTotal(woodpile.woodpile) >= WOODPILE_CAPACITY) return { kind: "woodpileFull" };
    if (wood === "firewood" && (player?.backpack === undefined || countInBackpack(player.backpack, "firewood") <= 0))
      return { kind: "noContent", content: "firewood" };
    return undefined;
  }

  /** Why the player could not take this wood off the woodpile: it holds none, or a log would go on a shoulder that is full. */
  function takeRefusal(woodpile: WoodpileEntity, wood: WoodpileWood): Refusal | undefined {
    if (woodpile.woodpile[wood] <= 0) return { kind: "nothingToTake" };
    return wood === "firewood" ? undefined : shoulderRefusal(players.first);
  }

  return {
    reach(woodpileId) {
      const woodpile = woodpileById(woodpileId);
      if (woodpile === undefined) return undefined;
      return { target: woodpile.position, metres: WOODPILE_REACH_METRES, walk: { style: "beside", standMetres: WOODPILE_STAND_METRES } };
    },
    refusal(command) {
      const woodpile = woodpileById(command.woodpileId);
      if (woodpile === undefined) return undefined;
      return command.type === "stackOnWoodpile" ? stackRefusal(woodpile, command.wood) : takeRefusal(woodpile, command.wood);
    },
    stack(woodpileId, wood, all) {
      const woodpile = woodpileById(woodpileId);
      const player = woodpile === undefined ? undefined : userOf(woodpile);
      if (woodpile === undefined || player === undefined || stackRefusal(woodpile, wood) !== undefined) return;
      const room = WOODPILE_CAPACITY - woodpileTotal(woodpile.woodpile);
      if (wood === "firewood") {
        if (player.backpack === undefined) return;
        const moved = Math.min(all ? countInBackpack(player.backpack, "firewood") : 1, room);
        if (moved <= 0 || !removeFromBackpack(player.backpack, "firewood", moved)) return;
        woodpile.woodpile = addCount(woodpile.woodpile, "firewood", moved);
        return;
      }
      entities.removeComponent(player, "carrying");
      woodpile.woodpile = addCount(woodpile.woodpile, wood, 1);
    },
    take(woodpileId, wood) {
      const woodpile = woodpileById(woodpileId);
      const player = woodpile === undefined ? undefined : userOf(woodpile);
      if (woodpile === undefined || player === undefined || takeRefusal(woodpile, wood) !== undefined) return undefined;
      if (wood === "firewood") {
        if (player.backpack === undefined) return undefined;
        let moved = 0;
        while (moved < woodpile.woodpile.firewood && addToBackpack(player.backpack, "firewood", 1)) moved += 1;
        if (moved === 0) return "backpackFull";
        woodpile.woodpile = takeCount(woodpile.woodpile, "firewood", moved);
        return undefined;
      }
      woodpile.woodpile = takeCount(woodpile.woodpile, wood, 1);
      entities.addComponent(player, "carrying", wood);
      return undefined;
    },
    describe(woodpileId) {
      const woodpile = woodpileById(woodpileId);
      return woodpile === undefined ? undefined : describe(woodpile);
    },
    nearby() {
      const player = players.first;
      const nearest = player === undefined ? undefined : nearestWithin(player.position, woodpiles, WOODPILE_REACH_METRES);
      return nearest === undefined ? undefined : describe(nearest);
    },
  };
}

/** The rules for tending a woodpile: coming to it, stacking wood on it, and taking wood from it. */
export function woodpileRules(woodpiles: Woodpiles, game: RuleGame): CommandRules<"tendWoodpile" | "stackOnWoodpile" | "takeFromWoodpile"> {
  const reach = (command: { woodpileId: number }) => woodpiles.reach(command.woodpileId);
  return {
    tendWoodpile: {
      start: "fresh",
      approach: {
        reach,
        act: (command) => {
          reachToward(game.hand, game.entities, "waist", command.woodpileId);
        },
      },
    },
    stackOnWoodpile: {
      start: "alongside",
      refusal: (command) => woodpiles.refusal(command),
      approach: tendApproach(game, reach, (command) => {
        woodpiles.stack(command.woodpileId, command.wood, command.all);
        return undefined;
      }),
    },
    takeFromWoodpile: {
      start: "alongside",
      // Firewood goes in the backpack, so taking it does not need free hands. A log goes on the shoulder.
      needsFreeHands: (command) => command.wood !== "firewood",
      refusal: (command) => woodpiles.refusal(command),
      approach: tendApproach(game, reach, (command) => woodpiles.take(command.woodpileId, command.wood)),
    },
  };
}
