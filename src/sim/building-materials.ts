import type { BuildLack } from "./api-refusal";
import { countInBackpack, hasInBackpack, removeFromBackpack } from "./backpack";
import { addCount, countOf } from "./counts";
import type { Entity } from "./entities";
import { type BuildMaterial, type MaterialCost, stageMaterials } from "./structure-types";
import { type KeptMaterial, TAKEN_MATERIALS } from "./structure-kind";
import { costOf, isDelivered, isKept, structureOf } from "./structures";

export type Blueprint = NonNullable<Entity["blueprint"]>;
export type Backpack = NonNullable<Entity["backpack"]>;

/** Whether the deliverer carries something that the blueprint still needs. */
export function canDeliver(deliverer: Entity, target: Entity, blueprint: Blueprint): boolean {
  // Everything carried outside the backpack, a log, a debarked log, a plank, or a stone, is a material some structure is built from.
  return deliverer.carrying !== undefined && stillNeeded(blueprint, costOf(target, blueprint.structure), deliverer.carrying) > 0;
}

/** How many more of a material it keeps a blueprint costing `cost` needs, on top of what it has had. */
function stillNeeded(blueprint: Blueprint, cost: readonly MaterialCost[], material: KeptMaterial): number {
  const needed = cost.find((item) => item.material === material)?.count ?? 0;
  return Math.max(0, needed - countOf(blueprint.delivered, material));
}

/**
 * Moves planks and stone from the backpack to a blueprint costing `cost`, as many of each as it still needs.
 * The blueprint keeps them, so the player can bring the rest on later trips.
 */
export function takeFromBackpack(blueprint: Blueprint, cost: readonly MaterialCost[], backpack: Backpack): void {
  for (const material of TAKEN_MATERIALS) {
    const fromBackpack = Math.min(stillNeeded(blueprint, cost, material), countInBackpack(backpack, material));
    if (fromBackpack <= 0) continue;
    removeFromBackpack(backpack, material, fromBackpack);
    blueprint.delivered = addCount(blueprint.delivered, material, fromBackpack);
  }
}

/**
 * What the player lacks to build the next stage of a blueprint costing `cost`, or undefined if nothing.
 * `available` says whether the player carries a kept material or can fetch it.
 */
export function nextStageLack(
  blueprint: Blueprint,
  cost: readonly MaterialCost[],
  backpack: Backpack,
  available: (material: KeptMaterial) => boolean,
  free: boolean,
): BuildLack | undefined {
  if (free) return undefined;
  const structure = structureOf(blueprint.structure);
  if (structure.tool !== undefined && !hasInBackpack(backpack, structure.tool)) return { kind: "tool", tool: structure.tool };
  const stages = stageMaterials(cost);
  const material = stages[blueprint.materialsSpent];
  if (material === undefined) return undefined;
  if (!isKept(material)) return hasInBackpack(backpack, material) ? undefined : { kind: "material", material };
  if (keptLeft(blueprint, stages, material) > 0 || available(material)) return undefined;
  // Building takes planks and stone from the backpack too. A log or debarked log never goes in the backpack.
  return !isDelivered(material) && hasInBackpack(backpack, material) ? undefined : { kind: "material", material };
}

/** How many of a material the blueprint keeps that construction has not spent yet. */
export function keptLeft(blueprint: Blueprint, stages: readonly BuildMaterial[], material: KeptMaterial): number {
  const spent = stages.slice(0, blueprint.materialsSpent).filter((earlier) => earlier === material).length;
  return countOf(blueprint.delivered, material) - spent;
}

/** Which stage of construction a blueprint is in, from 0 to one less than its number of stages. */
export function stageOf(progress: number, stages: number): number {
  // The small allowance stops rounding errors from holding a stage back at its very end.
  return Math.min(stages - 1, Math.floor(progress * stages + 1e-9));
}
