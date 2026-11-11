// Names shared by entities and the structure catalogue in structures.ts. Kept apart so neither imports the other.

/** Every structure the build menu can list. Each later shelter structure adds its name here and its entry to STRUCTURES. */
export type StructureKind = "campfire" | "foundation";

/** Which way a structure faces: how many quarter turns clockwise, seen from above, from 0 to 3. */
export type QuarterTurns = 0 | 1 | 2 | 3;

/**
 * A material a structure costs.
 * Construction takes a backpack material, such as a stick, from the backpack as it goes.
 * A delivered material, such as a debarked log, is too big for the backpack, so the player carries it to the blueprint first.
 */
export type BuildMaterial = "stick" | DeliveredMaterial;

/** The materials the player carries to a blueprint on their shoulder, one at a time. */
export type DeliveredMaterial = "debarkedLog";

/** How many of each material a blueprint holds or has used. Materials it has none of are missing. */
export type MaterialCounts = Partial<Record<BuildMaterial, number>>;
