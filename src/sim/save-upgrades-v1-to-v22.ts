// The save upgrades from version 1 to version 22, one function for each version.
import type { Entity, SavedEntity } from "./entities";
import { valleyForageSpots } from "./foraging";
import { droppedStickSpot } from "./piles";
import { generateValley } from "./valley";
import { giveBack, giveStartingItem, nothingToUpgrade } from "./save-upgrade-helpers";

/**
 * Version 1 to 2: berry bushes and mushrooms grow in the valley. A save from before then gets the valley's spots, all with food.
 * A save that is not plain data is passed on unchanged, so the shape check turns it away.
 */
export function addForageSpots(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const { seed, entities } = save;
  if (!Number.isSafeInteger(seed) || !Array.isArray(entities)) return { ...save };
  const saved = entities as unknown[];
  const idOf = (entity: unknown): number => {
    const id = (entity as Partial<SavedEntity> | null)?.id;
    return typeof id === "number" ? id : -1;
  };
  const lastId = saved.reduce<number>((last, entity) => Math.max(last, idOf(entity)), -1);
  const spots = valleyForageSpots(generateValley(seed as number)).map((components, index) => ({ id: lastId + 1 + index, components }));
  return { ...save, entities: [...saved, ...spots] };
}

/** Version 2 to 3: a new game now starts with a bedroll, so a player saved before bedrolls existed gets one too. */
export function giveBedroll(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return giveStartingItem(save, "bedroll");
}

/** Version 3 to 4: a new game now starts with a pot, so a player saved before pots existed gets one too. */
export function givePot(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return giveStartingItem(save, "pot");
}

/** Version 4 to 5: a new game now starts with a drawknife, so a player saved before drawknives existed gets one too. */
export function giveDrawknife(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return giveStartingItem(save, "drawknife");
}

/**
 * Version 5 to 6: structures can cost more than sticks, so a blueprint counts the materials spent on it, not the sticks.
 * Until then only sticks were spent, so the count carries over.
 */
export function countMaterialsSpent(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Record<string, unknown> } | null)?.components;
    const blueprint = components?.blueprint;
    if (typeof blueprint !== "object" || blueprint === null || !("sticksSpent" in blueprint)) return entity;
    const { sticksSpent, ...rest } = blueprint;
    return { ...(entity as object), components: { ...components, blueprint: { ...rest, materialsSpent: sticksSpent } } };
  });
  return { ...save, entities };
}

/**
 * Version 6 to 7: the player can carry materials, such as debarked logs, to a blueprint, and the blueprint counts them.
 * Nothing was carried to a blueprint saved before then.
 */
export function addDeliveredMaterials(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Record<string, unknown> } | null)?.components;
    const blueprint = components?.blueprint;
    if (typeof blueprint !== "object" || blueprint === null || "delivered" in blueprint) return entity;
    return { ...(entity as object), components: { ...components, blueprint: { ...blueprint, delivered: {} } } };
  });
  return { ...save, entities };
}

/**
 * Version 7 to 8: a blueprint names the structure it is a blueprint of in `structure`, not `piece`,
 * since a campfire or a lean-to is a structure, not a building piece.
 */
export function nameBlueprintStructure(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Record<string, unknown> } | null)?.components;
    const blueprint = components?.blueprint;
    if (typeof blueprint !== "object" || blueprint === null || !("piece" in blueprint)) return entity;
    const { piece, ...rest } = blueprint;
    return { ...(entity as object), components: { ...components, blueprint: { structure: piece, ...rest } } };
  });
  return { ...save, entities };
}

/**
 * Version 8 to 9: turns every roof section, finished or as a blueprint, to slope down to +z. Before roofs faced a direction, every roof
 * sloped that way, whatever turn the player gave its blueprint, so an older save keeps the roofs it showed.
 */
export function faceRoofsForward(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Entity } | null)?.components;
    const isRoof = components?.cabinRoof === true || components?.blueprint?.structure === "roof";
    if (!isRoof) return entity;
    return { ...(entity as object), components: { ...components, facing: { turns: 0 } } };
  });
  return { ...save, entities };
}

/** Version 9 to 10: the player can build woodpiles. A save from before then has none, so it carries over unchanged. */
export function addWoodpiles(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/** Version 10 to 11: the player can build chests. A save from before then has none, so it carries over unchanged. */
export function addChests(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/** Version 11 to 12: the player can drop things in piles. A save from before then has none, so it carries over unchanged. */
export function addPiles(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/**
 * Version 12 to 13: a chest holds small materials, tools, and food. A chest saved before then held nothing, so it becomes an empty chest.
 */
export function fillChests(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Record<string, unknown> } | null)?.components;
    const chest = components?.chest;
    if (typeof chest !== "object" || chest === null || "contents" in chest) return entity;
    return { ...(entity as object), components: { ...components, chest: { ...chest, contents: {} } } };
  });
  return { ...save, entities };
}

/**
 * Version 13 to 14: dropped sticks lie on the ground one by one, the same as sticks on the forest floor.
 * Each pile of sticks becomes that many sticks, spread round where the pile lay.
 */
export function scatterDroppedSticks(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const saved = save.entities as unknown[];
  const ids = saved.map((entity) => (entity as { id?: unknown } | null)?.id).filter((id): id is number => typeof id === "number");
  let nextId = Math.max(-1, ...ids) + 1;
  const entities: unknown[] = [];
  for (const entity of saved) {
    const components = (entity as { components?: Record<string, unknown> } | null)?.components;
    const pile = components?.pile as { content?: unknown; count?: unknown } | undefined;
    const position = components?.position as { x: number; y: number; z: number } | undefined;
    if (pile?.content !== "stick" || typeof pile.count !== "number" || position === undefined) {
      entities.push(entity);
      continue;
    }
    for (let index = 0; index < pile.count; index += 1) {
      const id = index === 0 ? (entity as { id: number }).id : nextId++;
      entities.push({ id, components: { stick: true, position: { ...droppedStickSpot(position, index), y: position.y } } });
    }
  }
  return { ...save, entities };
}

/**
 * Version 14 to 15: a finished chest blocks walking, and a finished woodpile blocks the ground it covers.
 * Before then a chest blocked nothing, and a woodpile's reach was too short to block any walk-map cell.
 * The reaches are the ones version 15 gave them, kept here so a later change to the game's rules does not change this upgrade.
 */
export function blockWalkingAtChestsAndWoodpiles(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const CHEST_REACH_METRES = 0.71;
  const WOODPILE_REACH_METRES = 0.75;
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Record<string, unknown> } | null)?.components;
    if (components?.chest !== undefined) return { ...(entity as object), components: { ...components, blocksWalking: { radius: CHEST_REACH_METRES } } };
    if (components?.woodpile !== undefined) return { ...(entity as object), components: { ...components, blocksWalking: { radius: WOODPILE_REACH_METRES } } };
    return entity;
  });
  return { ...save, entities };
}

/** Version 15 to 16: the notice that a chest or woodpile still holds something is renamed to `stillHoldsSomething`. */
export function renameNotEmptyNotice(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const notice = save.notice as { kind?: unknown } | null | undefined;
  if (notice?.kind !== "storageNotEmpty") return { ...save };
  return { ...save, notice: { ...notice, kind: "stillHoldsSomething" } };
}

/** Version 16 to 17: the player can build sawhorses. A save from before then has none, so it carries over unchanged. */
export function addSawhorses(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/**
 * Version 17 to 18: a new game now starts with a saw blade, for crafting the saw. A player saved before then gets one too,
 * unless they already hold a saw.
 */
export function giveSawBlade(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return giveStartingItem(save, "sawBlade", ["saw"]);
}

/** Version 18 to 19: the player can cut planks. A save from before then has none, so it carries over unchanged. */
export function addPlanks(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/** Before roof frames, a roof section cost this many debarked logs, spent first, then its bark. */
const OLD_ROOF_LOG_COST = 3;
/** Before roof frames, a roof section had this many stages: one per debarked log, then one per piece of bark. */
const OLD_ROOF_STAGES = 7;
/** When roof frames came in, a roof frame cost this many debarked logs, one per stage. */
const FIRST_ROOF_FRAME_LOG_COST = 5;

/**
 * Version 20 to 21: a roof section is laid on a roof frame, which holds the rafters, so the roof is only bark.
 * Every finished roof gets a finished frame under it, with the roof's turn, for free.
 * Every roof blueprint becomes a frame blueprint with the same turn, keeping its delivered logs and the work done with them.
 * Any bark already spent on it goes back in the player's backpack, so nothing is lost.
 */
export function addRoofFrames(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const saved = save.entities as unknown[];
  const ids = saved.map((entity) => (entity as { id?: unknown } | null)?.id).filter((id): id is number => typeof id === "number");
  let nextId = Math.max(-1, ...ids) + 1;
  let barkBack = 0;
  const entities: unknown[] = [];
  for (const entity of saved) {
    const components = (entity as { components?: Entity } | null)?.components;
    const blueprint = components?.blueprint;
    if (components?.cabinRoof === true && components.position !== undefined) {
      entities.push(entity, { id: nextId++, components: { roofFrame: true, facing: components.facing ?? { turns: 0 }, position: { ...components.position } } });
    } else if (blueprint?.structure === "roof" && typeof blueprint.materialsSpent === "number" && typeof blueprint.progress === "number") {
      const logsSpent = Math.min(blueprint.materialsSpent, OLD_ROOF_LOG_COST);
      barkBack += blueprint.materialsSpent - logsSpent;
      const stagesDone = Math.min(blueprint.progress * OLD_ROOF_STAGES, OLD_ROOF_LOG_COST);
      const frame = { ...blueprint, structure: "roofFrame", progress: stagesDone / FIRST_ROOF_FRAME_LOG_COST, materialsSpent: logsSpent };
      entities.push({ ...(entity as object), components: { ...components, blueprint: frame } });
    } else {
      entities.push(entity);
    }
  }
  return giveBack({ ...save, entities }, "bark", barkBack);
}

/**
 * Version 19 to 20: the notice that no log lies beside a work station now names the station.
 * The sawhorse was the only work station before then, so an older notice names it.
 */
export function nameStationInNotice(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const notice = save.notice as { kind?: unknown } | null | undefined;
  if (notice?.kind !== "noLogBesideStation") return { ...save };
  return { ...save, notice: { ...notice, station: "sawhorse" } };
}

/**
 * Version 21 to 22: the valley shrank from 1 km to 300 m on each side, with denser forest. An older save holds trees,
 * sticks, and buildings where the new valley has other ground, or none at all, so it cannot be carried over.
 * This upgrade empties the save, so the shape check turns it away and its slot shows as broken.
 */
export function turnAwayLargeValley(): Record<string, unknown> {
  return {};
}
