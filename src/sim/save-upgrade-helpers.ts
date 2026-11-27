// Small steps that several save upgrades share.
import type { BackpackContent } from "./api";
import { addCount, countOf } from "./counts";
import type { Entity } from "./entities";

/**
 * For a version that added something older saves never hold, such as a new kind of structure. The save carries over unchanged.
 * Versions 10, 11, 12, 17, 19, 23, 26, 29, 30, 31, and 32 did this. New kinds no longer need a version of their own.
 */
export function nothingToUpgrade(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return { ...save };
}

/** Puts `count` of a material into the saved player's backpack, on top of what they hold. */
export function giveBack(save: Record<string, unknown>, material: "bark", count: number): Record<string, unknown> {
  if (count === 0 || !Array.isArray(save.entities)) return save;
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Entity } | null)?.components;
    const contents = components?.backpack?.contents;
    if (components?.player !== true || typeof contents !== "object") return entity;
    return {
      ...(entity as object),
      components: { ...components, backpack: { ...components.backpack, contents: addCount(contents, material, count) } },
    };
  });
  return { ...save, entities };
}

/**
 * Puts one of an item a new game starts with into the saved player's backpack,
 * unless they already have one, or hold anything listed in `madeFrom`, which are things made from it.
 */
export function giveStartingItem(
  save: Readonly<Record<string, unknown>>,
  item: "bedroll" | "pot" | "drawknife" | "sawBlade" | "fishingLine",
  madeFrom: readonly BackpackContent[] = [],
): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Entity } | null)?.components;
    const contents = components?.backpack?.contents;
    if (components?.player !== true || typeof contents !== "object") return entity;
    if ([item, ...madeFrom].some((held) => countOf(contents, held) > 0)) return entity;
    return { ...(entity as object), components: { ...components, backpack: { ...components.backpack, contents: { ...contents, [item]: 1 } } } };
  });
  return { ...save, entities };
}
