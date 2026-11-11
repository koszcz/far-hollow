// Opening a chest, and moving small materials, tools, and food between it and the backpack.
import type { ChestView } from "./api";
import { addToBackpack, CONTENT_WEIGHT_KG, countInBackpack, removeFromBackpack, type BackpackContent, type BackpackContents } from "./backpack";
import { playerEntities, type Entity, type EntityStore } from "./entities";
import { groundDistance } from "./valley";
import type { Walking } from "./walking";

/** The most a chest can hold, in kilograms. */
export const CHEST_WEIGHT_LIMIT_KG = 60;
/** The player walks to a spot this far from a chest's middle to open it, in metres. */
const CHEST_STAND_METRES = 1.1;
/** The player can use a chest from this far from its middle, in metres. */
const CHEST_REACH_METRES = 2;

type ChestEntity = Entity & { chest: NonNullable<Entity["chest"]>; position: NonNullable<Entity["position"]> };

export interface Chests {
  /** Walks the player beside a chest, if they are not already within reach of it, and opens it once they stand there. */
  open(chestId: number): void;
  /** Closes the open chest, or stops the player going to open one. The player does this by starting something else. */
  cancel(): void;
  /** The chest the player has open, as the HUD shows it. Undefined while none is open, or while the player walks. */
  opened(): ChestView | undefined;
  /**
   * Moves one of `content` from the backpack into the open chest, or with `all` as many as fit within its weight limit.
   * Returns `chestFull` if none of it fits.
   */
  put(chestId: number, content: BackpackContent, all: boolean): "chestFull" | undefined;
  /** Moves one of `content` from the open chest into the backpack, or with `all` as many as fit. Returns `backpackFull` if none of it fits. */
  take(chestId: number, content: BackpackContent, all: boolean): "backpackFull" | undefined;
}

/** How much everything in a chest or backpack weighs, in kilograms. */
export function contentsWeight(contents: Readonly<BackpackContents>): number {
  let total = 0;
  for (const [content, count] of Object.entries(contents) as [keyof typeof CONTENT_WEIGHT_KG, number][]) total += count * CONTENT_WEIGHT_KG[content];
  return total;
}

/** Lets the player keep small things in chests. */
export function createChests(entities: EntityStore, walking: Walking): Chests {
  const players = playerEntities(entities);
  /** The chest the player opened, or is walking to open. It is not saved: a loaded game starts with every chest closed. */
  let openId: number | undefined;

  function chestById(chestId: number): ChestEntity | undefined {
    const entity = entities.entity(chestId);
    if (entity?.chest === undefined || entity.position === undefined) return undefined;
    return entity as ChestEntity;
  }

  /** The open chest, while the player stands still within reach of it. */
  function openChest(): ChestEntity | undefined {
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
      for (const player of players) {
        const dx = player.position.x - chest.position.x;
        const dz = player.position.z - chest.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance <= CHEST_REACH_METRES) continue;
        // Stand beside the chest on the player's side, since the chest itself blocks walking.
        walking.walkTo({
          x: chest.position.x + (dx / distance) * CHEST_STAND_METRES,
          z: chest.position.z + (dz / distance) * CHEST_STAND_METRES,
        });
      }
    },
    cancel() {
      openId = undefined;
    },
    opened() {
      const chest = openChest();
      if (chest === undefined || openId === undefined) return undefined;
      const contents = Object.freeze({ ...chest.chest.contents });
      return Object.freeze({ id: openId, contents, weight: contentsWeight(contents), weightLimit: CHEST_WEIGHT_LIMIT_KG });
    },
    put(chestId, content, all) {
      const chest = openChest();
      const backpack = players.first?.backpack;
      // Only kinds the backpack can hold go in a chest, so logs and debarked logs never do.
      if (chest === undefined || chestId !== openId || backpack === undefined || !(content in CONTENT_WEIGHT_KG)) return undefined;
      const wanted = all ? countInBackpack(backpack, content) : Math.min(1, countInBackpack(backpack, content));
      if (wanted <= 0) return undefined;
      const room = CHEST_WEIGHT_LIMIT_KG - contentsWeight(chest.chest.contents);
      // The small allowance stops rounding errors in the weights from refusing the last thing that fits.
      const moved = Math.min(wanted, Math.floor((room + 1e-9) / CONTENT_WEIGHT_KG[content]));
      if (moved <= 0) return "chestFull";
      removeFromBackpack(backpack, content, moved);
      chest.chest.contents[content] = (chest.chest.contents[content] ?? 0) + moved;
      return undefined;
    },
    take(chestId, content, all) {
      const chest = openChest();
      const backpack = players.first?.backpack;
      if (chest === undefined || chestId !== openId || backpack === undefined) return undefined;
      const held = chest.chest.contents[content] ?? 0;
      const wanted = all ? held : Math.min(1, held);
      let moved = 0;
      while (moved < wanted && addToBackpack(backpack, content, 1)) moved += 1;
      if (wanted > 0 && moved === 0) return "backpackFull";
      chest.chest.contents[content] = held - moved;
      // Kinds the chest no longer holds drop out of its contents, so an emptied chest holds nothing at all.
      chest.chest.contents = Object.fromEntries(Object.entries(chest.chest.contents).filter(([, count]) => count > 0));
      return undefined;
    },
  };
}
