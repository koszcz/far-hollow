// The structures the player can build, as the build menu lists them.
// Each later shelter structure, such as a log wall, adds one entry to STRUCTURE_BY_KIND with its cost, placement rule, and finished form.
// A piece of furniture comes from its definition in furniture.ts instead. freelyPlaced turns it into a structure.
import type { Entity } from "./entities";
import { campfire, leanTo, sawhorse, woodpile } from "./structure-camp";
import { chimney, door, fireplace, shutters } from "./structure-cabin-fittings";
import { doorFrame, floor, foundation, logWall, roof, roofFrame, windowPiece } from "./structure-cabin-shell";
import { FURNITURE_STRUCTURES, sled } from "./structure-freely-placed";
import { TAKEN_MATERIALS, type DeliveredMaterial, type KeptMaterial, type StructureKind, type TakenMaterial } from "./structure-kind";
import type { BuildMaterial, MaterialCost, StructureDefinition } from "./structure-types";

/** Each structure by its kind. TypeScript reports a kind with no entry. The build menu lists them in this order. */
const STRUCTURE_BY_KIND: { readonly [Kind in StructureKind]: StructureDefinition & { readonly kind: Kind } } = {
  campfire,
  leanTo,
  foundation,
  floor,
  logWall,
  doorFrame,
  window: windowPiece,
  roofFrame,
  roof,
  door,
  shutters,
  fireplace,
  chimney,
  woodpile,
  ...FURNITURE_STRUCTURES,
  sawhorse,
  sled,
};

/** Every structure the player can build, in the order the build menu lists them. */
export const STRUCTURES: readonly StructureDefinition[] = Object.values(STRUCTURE_BY_KIND);

/** The structure of this kind. */
export function structureOf(kind: StructureKind): StructureDefinition {
  return STRUCTURE_BY_KIND[kind];
}

/** Whether a material is carried to a blueprint on the player's shoulder, rather than taken from the backpack. */
export function isDelivered(material: BuildMaterial): material is DeliveredMaterial {
  return material === "log" || material === "debarkedLog";
}

/** Whether a blueprint keeps a material once it has it: one carried to it on the shoulder, planks, or stone. See KeptMaterial. */
export function isKept(material: BuildMaterial): material is KeptMaterial {
  return isDelivered(material) || isTaken(material);
}

/** Whether a blueprint takes a material from the backpack and from piles near it: planks or stone. See TakenMaterial. */
export function isTaken(material: BuildMaterial): material is TakenMaterial {
  return (TAKEN_MATERIALS as readonly BuildMaterial[]).includes(material);
}

/**
 * What a blueprint or finished structure of `kind` costs: the cost it was placed with, if that differs from its structure's cost now,
 * or else its structure's cost. A swap blueprint costs nothing, because the logs of the wall it replaces pay for it.
 */
export function costOf(entity: Entity, kind: StructureKind): readonly MaterialCost[] {
  if (entity.swapsWall === true) return [];
  return entity.builtCost ?? structureOf(kind).cost;
}
