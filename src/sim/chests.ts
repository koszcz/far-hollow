// Opening a piece of furniture that stores things, and moving small materials, tools, and food between it and the backpack.
// Every such piece works the same way and opens in the chest panel. Its definition in src/sim/furniture/ says how much it holds.
import type { ChestView, ChestOrShelf, PlainNotice, Refusal } from "./api";
import {
  addToBackpack,
  CONTENT_WEIGHT_KG,
  countInBackpack,
  fitsInBackpack,
  howManyFit,
  removeFromBackpack,
  type BackpackContent,
  type BackpackContents,
} from "./backpack";
import { addCount, countOf, takeCount, weightedTotal, withoutEmptyKinds } from "./counts";
import { playerEntities, type Entity, type EntityStore, type ReachHeight, type Vec3 } from "./entities";
import { furnitureOf, type FurnitureStorage } from "./furniture";
import { groundDistance } from "./ground-point";
import type { ApproachReach } from "./approach";
import type { CommandRules, RuleGame } from "./command-rule";
import { reachToward } from "./hand-reach";
import { moveSpoilTimes, viewFreshness } from "./spoiling";

/** The player walks to a spot this far from a chest's middle to open it, in metres. */
const CHEST_STAND_METRES = 1.1;
/** The player can use a chest from this far from its middle, in metres. */
const CHEST_REACH_METRES = 2;

/** A finished piece of furniture that stores things: which piece it is, where it stands, what it holds, and how much it can hold. */
interface ChestOrShelfEntity {
  readonly furniture: ChestOrShelf;
  readonly position: Vec3;
  readonly holding: NonNullable<Entity["storage"]>;
  readonly rule: FurnitureStorage;
}

/** The finished piece of furniture that stores things an entity is, if it is one. */
export function chestOrShelfOf(entity: Entity | undefined): ChestOrShelfEntity | undefined {
  const rule = furnitureOf(entity)?.storage;
  if (entity?.position === undefined || entity.furniture === undefined || entity.storage === undefined || rule === undefined) return undefined;
  // Only the pieces that store things have a storage rule, and ChestOrShelf names each of them.
  return { furniture: entity.furniture as ChestOrShelf, position: entity.position, holding: entity.storage, rule };
}

export interface Chests {
  /**
   * Where the player walks to open a chest or shelf: beside it, on their own side, since the piece blocks walking.
   * Undefined if the entity is not a finished piece of furniture that stores things.
   */
  reach(chestId: number): ApproachReach | undefined;
  /** Opens a chest or shelf. The approach runs it once the player stands within reach. */
  open(chestId: number): void;
  /** Closes the open chest. The player does this by starting something else. */
  cancel(): void;
  /**
   * Closes the open chest once the player is out of its reach: after they have stood at it and left,
   * or when they stop walking without reaching it. Run it after walking has moved the player.
   */
  step(): undefined;
  /** The chest or shelf the player has open, as the HUD shows it. Undefined while none is open, or while the player walks. */
  opened(): ChestView | undefined;
  /** Why the player could not put things in or take things from this chest or shelf now: it is not the one they have open. */
  refusal(chestId: number): Refusal | undefined;
  /**
   * Moves one of `content` from the backpack into the open chest or shelf, or with `all` as many as fit within its weight limit.
   * Returns the piece's notice that it is full if none of it fits.
   */
  put(chestId: number, content: BackpackContent, all: boolean): PlainNotice | undefined;
  /** Moves one of `content` from the open chest or shelf into the backpack, or with `all` as many as fit. Returns `backpackFull` if none of it fits. */
  take(chestId: number, content: BackpackContent, all: boolean): "backpackFull" | undefined;
  /** Why taking `content` from a chest or shelf would be turned away, wherever the player stands: it holds none, or not one fits in the backpack. */
  takeRefusal(chestId: number, content: BackpackContent): "nothingToTake" | "backpackFull" | undefined;
}

/** How much everything in a chest or backpack weighs, in kilograms. */
export function contentsWeight(contents: Readonly<BackpackContents>): number {
  return weightedTotal(contents, CONTENT_WEIGHT_KG);
}

/** Lets the player keep small things in the furniture that stores them. `now` reads the game minute on the clock. */
export function createChests(entities: EntityStore, now: () => number): Chests {
  const players = playerEntities(entities);
  /** The chest or shelf the player opened. It is not saved: a loaded game starts with every chest closed. */
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
    reach(chestId) {
      const chest = chestById(chestId);
      if (chest === undefined) return undefined;
      return { target: chest.position, metres: CHEST_REACH_METRES, walk: { style: "beside", standMetres: CHEST_STAND_METRES } };
    },
    open(chestId) {
      if (chestById(chestId) === undefined) return;
      openId = chestId;
      reached = false;
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
    refusal(chestId) {
      return openId === chestId && openChest() !== undefined ? undefined : { kind: "openFirst" };
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
        weightLimit: chest.rule.weightLimitKg,
        freshness: viewFreshness(chest.holding, now()),
      });
    },
    put(chestId, content, all) {
      const chest = openChest();
      const backpack = players.first?.backpack;
      // Only kinds the backpack can hold go in a chest or on a shelf, so logs and debarked logs never do.
      if (chest === undefined || chestId !== openId || backpack === undefined || !(content in CONTENT_WEIGHT_KG)) return undefined;
      const wanted = all ? countInBackpack(backpack, content) : Math.min(1, countInBackpack(backpack, content));
      if (wanted <= 0) return undefined;
      const room = chest.rule.weightLimitKg - contentsWeight(chest.holding.contents);
      // The small allowance stops rounding errors in the weights from refusing the last thing that fits.
      const moved = Math.min(wanted, Math.floor((room + 1e-9) / CONTENT_WEIGHT_KG[content]));
      if (moved <= 0) return chest.rule.fullNotice;
      moveSpoilTimes(backpack, chest.holding, content, moved, now());
      removeFromBackpack(backpack, content, moved);
      chest.holding.contents = addCount(chest.holding.contents, content, moved);
      return undefined;
    },
    take(chestId, content, all) {
      const chest = openChest();
      const backpack = players.first?.backpack;
      if (chest === undefined || chestId !== openId || backpack === undefined) return undefined;
      const held = countOf(chest.holding.contents, content);
      const wanted = all ? held : Math.min(1, held);
      const moved = howManyFit(backpack, content, wanted);
      if (wanted > 0 && moved === 0) return "backpackFull";
      moveSpoilTimes(chest.holding, backpack, content, moved, now());
      addToBackpack(backpack, content, moved);
      // Kinds the chest no longer holds drop out of its contents, so an emptied chest holds nothing at all.
      chest.holding.contents = withoutEmptyKinds(takeCount(chest.holding.contents, content, moved));
      return undefined;
    },
    takeRefusal(chestId, content) {
      const chest = chestById(chestId);
      const backpack = players.first?.backpack;
      if (chest === undefined || backpack === undefined) return undefined;
      if (countOf(chest.holding.contents, content) <= 0) return "nothingToTake";
      return fitsInBackpack(backpack, content, 1) ? undefined : "backpackFull";
    },
  };
}

/** The rules for opening a chest or shelf, and putting things in and taking them out. */
export function chestRules(chests: Chests, { entities, hand }: RuleGame): CommandRules<"openChest" | "putInChest" | "takeFromChest"> {
  /** How high the player reaches into a piece of furniture that stores things. A piece whose definition gives no height is reached at the waist. */
  const storageReach = (chestId: number): ReachHeight => furnitureOf(entities.entity(chestId))?.reachHeight ?? "waist";
  return {
    openChest: {
      start: "fresh",
      // Opening a chest opens its panel, a menu, so it is never queued.
      queue: "plainOnly",
      approach: {
        reach: (command) => chests.reach(command.chestId),
        act: (command) => {
          chests.open(command.chestId);
          reachToward(hand, entities, storageReach(command.chestId), command.chestId);
        },
      },
    },
    putInChest: {
      start: "alongside",
      queue: "apart",
      refusal: (command) => chests.refusal(command.chestId),
      run: (command) => {
        hand.start(storageReach(command.chestId), entities.entity(command.chestId)?.position, () => chests.put(command.chestId, command.content, command.all));
      },
    },
    takeFromChest: {
      start: "alongside",
      queue: "apart",
      refusal: (command) => {
        const kind = chests.takeRefusal(command.chestId, command.content);
        return chests.refusal(command.chestId) ?? (kind === undefined ? undefined : { kind });
      },
      run: (command) => {
        hand.start(storageReach(command.chestId), entities.entity(command.chestId)?.position, () => chests.take(command.chestId, command.content, command.all));
      },
    },
  };
}
