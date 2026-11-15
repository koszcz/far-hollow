// Opening a chest or shelf, and moving small materials, tools, and food between it and the backpack.
// A shelf works the same way as a chest and uses the same panel. It only holds less.
import type { ChestView, ChestOrShelf } from "./api";
import { addToBackpack, CONTENT_WEIGHT_KG, countInBackpack, removeFromBackpack, type BackpackContent, type BackpackContents } from "./backpack";
import { playerEntities, type Entity, type EntityStore, type Vec3 } from "./entities";
import { groundDistance } from "./valley";
import { walkBeside, type Walking } from "./walking";

/** The most a chest can hold, in kilograms. */
export const CHEST_WEIGHT_LIMIT_KG = 60;
/** The most a shelf can hold, in kilograms. */
export const SHELF_WEIGHT_LIMIT_KG = 30;
/** The most a chest and a shelf can hold, in kilograms. */
const WEIGHT_LIMIT_KG: Readonly<Record<ChestOrShelf, number>> = { chest: CHEST_WEIGHT_LIMIT_KG, shelf: SHELF_WEIGHT_LIMIT_KG };
/** The notice that a chest or shelf has no room left. */
const FULL_NOTICE = { chest: "chestFull", shelf: "shelfFull" } as const satisfies Record<ChestOrShelf, string>;
/** The player walks to a spot this far from a chest's middle to open it, in metres. */
const CHEST_STAND_METRES = 1.1;
/** The player can use a chest from this far from its middle, in metres. */
const CHEST_REACH_METRES = 2;

/** A finished chest or shelf: the piece of furniture it is, where it stands, and what it holds. */
interface ChestOrShelfEntity {
  readonly furniture: ChestOrShelf;
  readonly position: Vec3;
  readonly holding: { contents: BackpackContents };
}

/** The finished chest or shelf an entity is, if it is one. */
export function chestOrShelfOf(entity: Entity | undefined): ChestOrShelfEntity | undefined {
  if (entity?.position === undefined) return undefined;
  if (entity.chest !== undefined) return { furniture: "chest", position: entity.position, holding: entity.chest };
  if (entity.shelf !== undefined) return { furniture: "shelf", position: entity.position, holding: entity.shelf };
  return undefined;
}

export interface Chests {
  /** Walks the player beside a chest or shelf, if they are not already within reach of it, and opens it once they stand there. */
  open(chestId: number): void;
  /** Closes the open chest, or stops the player going to open one. The player does this by starting something else. */
  cancel(): void;
  /**
   * Closes the open chest once the player is out of its reach: after they have stood at it and left,
   * or when they stop walking without reaching it. Run it after walking has moved the player.
   */
  step(): undefined;
  /** The chest or shelf the player has open, as the HUD shows it. Undefined while none is open, or while the player walks. */
  opened(): ChestView | undefined;
  /**
   * Moves one of `content` from the backpack into the open chest or shelf, or with `all` as many as fit within its weight limit.
   * Returns `chestFull` or `shelfFull` if none of it fits.
   */
  put(chestId: number, content: BackpackContent, all: boolean): "chestFull" | "shelfFull" | undefined;
  /** Moves one of `content` from the open chest or shelf into the backpack, or with `all` as many as fit. Returns `backpackFull` if none of it fits. */
  take(chestId: number, content: BackpackContent, all: boolean): "backpackFull" | undefined;
}

/** How much everything in a chest or backpack weighs, in kilograms. */
export function contentsWeight(contents: Readonly<BackpackContents>): number {
  let total = 0;
  for (const [content, count] of Object.entries(contents) as [keyof typeof CONTENT_WEIGHT_KG, number][]) total += count * CONTENT_WEIGHT_KG[content];
  return total;
}

/** Lets the player keep small things in chests and on shelves. */
export function createChests(entities: EntityStore, walking: Walking): Chests {
  const players = playerEntities(entities);
  /** The chest or shelf the player opened, or is walking to open. It is not saved: a loaded game starts with every chest closed. */
  let openId: number | undefined;
  /** Whether the player has stood within reach of the open chest since opening it. */
  let reached = false;

  const chestById = (chestId: number): ChestOrShelfEntity | undefined => chestOrShelfOf(entities.entity(chestId));

  /** The open chest or shelf, while the player stands still within reach of it. */
  function openChest(): ChestOrShelfEntity | undefined {
    const chest = openId === undefined ? undefined : chestById(openId);
    if (chest === undefined) return undefined;
    for (const player of players) {
      if (player.walkPath === undefined && groundDistance(chest.position, player.position) <= CHEST_REACH_METRES) return chest;
    }
    return undefined;
  }

  return {
    open(chestId) {
      const chest = chestById(chestId);
      if (chest === undefined) return;
      openId = chestId;
      reached = false;
      // The player stands beside the chest on the player's side, since the chest itself blocks walking.
      for (const player of players) walkBeside(walking, player.position, chest.position, CHEST_REACH_METRES, CHEST_STAND_METRES);
    },
    cancel() {
      openId = undefined;
    },
    step() {
      const chest = openId === undefined ? undefined : chestById(openId);
      if (chest === undefined) {
        openId = undefined;
        return;
      }
      for (const player of players) {
        const inReach = groundDistance(chest.position, player.position) <= CHEST_REACH_METRES;
        if (inReach && player.walkPath === undefined) reached = true;
        if (!inReach && (reached || player.walkPath === undefined)) openId = undefined;
      }
    },
    opened() {
      const chest = openChest();
      if (chest === undefined || openId === undefined) return undefined;
      const contents = Object.freeze({ ...chest.holding.contents });
      return Object.freeze({
        id: openId,
        furniture: chest.furniture,
        contents,
        weight: contentsWeight(contents),
        weightLimit: WEIGHT_LIMIT_KG[chest.furniture],
      });
    },
    put(chestId, content, all) {
      const chest = openChest();
      const backpack = players.first?.backpack;
      // Only kinds the backpack can hold go in a chest or on a shelf, so logs and debarked logs never do.
      if (chest === undefined || chestId !== openId || backpack === undefined || !(content in CONTENT_WEIGHT_KG)) return undefined;
      const wanted = all ? countInBackpack(backpack, content) : Math.min(1, countInBackpack(backpack, content));
      if (wanted <= 0) return undefined;
      const room = WEIGHT_LIMIT_KG[chest.furniture] - contentsWeight(chest.holding.contents);
      // The small allowance stops rounding errors in the weights from refusing the last thing that fits.
      const moved = Math.min(wanted, Math.floor((room + 1e-9) / CONTENT_WEIGHT_KG[content]));
      if (moved <= 0) return FULL_NOTICE[chest.furniture];
      removeFromBackpack(backpack, content, moved);
      chest.holding.contents[content] = (chest.holding.contents[content] ?? 0) + moved;
      return undefined;
    },
    take(chestId, content, all) {
      const chest = openChest();
      const backpack = players.first?.backpack;
      if (chest === undefined || chestId !== openId || backpack === undefined) return undefined;
      const held = chest.holding.contents[content] ?? 0;
      const wanted = all ? held : Math.min(1, held);
      let moved = 0;
      while (moved < wanted && addToBackpack(backpack, content, 1)) moved += 1;
      if (wanted > 0 && moved === 0) return "backpackFull";
      chest.holding.contents[content] = held - moved;
      // Kinds the chest no longer holds drop out of its contents, so an emptied chest holds nothing at all.
      chest.holding.contents = Object.fromEntries(Object.entries(chest.holding.contents).filter(([, count]) => count > 0));
      return undefined;
    },
  };
}
