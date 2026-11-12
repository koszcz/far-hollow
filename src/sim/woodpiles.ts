// Stacking logs, debarked logs, and firewood on a woodpile, and taking them off again.
import type { WoodpileView } from "./api";
import { addToBackpack, countInBackpack, removeFromBackpack } from "./backpack";
import { entityWith, playerEntities, woodpileEntities, type Entity, type EntityStore, type WoodpileWood } from "./entities";
import { groundDistance, nearestWithin } from "./valley";
import { walkBeside, type Walking } from "./walking";

/** A woodpile holds up to this many logs, debarked logs, and pieces of firewood in all, in any mix. */
export const WOODPILE_CAPACITY = 20;
/** The player walks to a spot this far from a woodpile's centre to use it, in metres. */
const WOODPILE_STAND_METRES = 1.3;
/** The player can use a woodpile from this far from its centre, in metres. */
const WOODPILE_REACH_METRES = 2.5;

type WoodpileEntity = Entity & Required<Pick<Entity, "woodpile" | "position">>;

export interface Woodpiles {
  /** Walks the player beside a woodpile, if they are not already within reach of it. */
  tend(woodpileId: number): void;
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
  /** True if the player stands still within reach of the woodpile, so they can use it now. */
  inReach(woodpileId: number): boolean;
  /** The woodpile nearest the player that is within their reach, if any, as the HUD shows it. */
  nearby(): WoodpileView | undefined;
}

/** How many pieces of wood a woodpile holds in all. */
export function woodpileTotal(contents: Readonly<Record<WoodpileWood, number>>): number {
  return contents.log + contents.debarkedLog + contents.firewood;
}

/** Lets the player keep logs and firewood on woodpiles. */
export function createWoodpiles(entities: EntityStore, walking: Walking): Woodpiles {
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

  return {
    tend(woodpileId) {
      const woodpile = woodpileById(woodpileId);
      if (woodpile === undefined) return;
      // The player stands beside the woodpile on the player's side, since the woodpile itself blocks walking.
      for (const player of players) walkBeside(walking, player.position, woodpile.position, WOODPILE_REACH_METRES, WOODPILE_STAND_METRES);
    },
    stack(woodpileId, wood, all) {
      const woodpile = woodpileById(woodpileId);
      const player = woodpile === undefined ? undefined : userOf(woodpile);
      if (woodpile === undefined || player === undefined) return;
      const room = WOODPILE_CAPACITY - woodpileTotal(woodpile.woodpile);
      if (room <= 0) return;
      if (wood === "firewood") {
        if (player.backpack === undefined) return;
        const moved = Math.min(all ? countInBackpack(player.backpack, "firewood") : 1, room);
        if (moved <= 0 || !removeFromBackpack(player.backpack, "firewood", moved)) return;
        woodpile.woodpile.firewood += moved;
        return;
      }
      if (player.carrying !== wood) return;
      entities.removeComponent(player, "carrying");
      woodpile.woodpile[wood] += 1;
    },
    take(woodpileId, wood) {
      const woodpile = woodpileById(woodpileId);
      const player = woodpile === undefined ? undefined : userOf(woodpile);
      if (woodpile === undefined || player === undefined || woodpile.woodpile[wood] <= 0) return undefined;
      if (wood === "firewood") {
        if (player.backpack === undefined) return undefined;
        let moved = 0;
        while (moved < woodpile.woodpile.firewood && addToBackpack(player.backpack, "firewood", 1)) moved += 1;
        if (moved === 0) return "backpackFull";
        woodpile.woodpile.firewood -= moved;
        return undefined;
      }
      if (player.carrying !== undefined) return undefined;
      woodpile.woodpile[wood] -= 1;
      entities.addComponent(player, "carrying", wood);
      return undefined;
    },
    describe(woodpileId) {
      const woodpile = woodpileById(woodpileId);
      return woodpile === undefined ? undefined : describe(woodpile);
    },
    inReach(woodpileId) {
      const woodpile = woodpileById(woodpileId);
      return woodpile !== undefined && userOf(woodpile) !== undefined;
    },
    nearby() {
      const player = players.first;
      const nearest = player === undefined ? undefined : nearestWithin(player.position, woodpiles, WOODPILE_REACH_METRES);
      return nearest === undefined ? undefined : describe(nearest);
    },
  };
}
