// Names shared by entities and the structure catalogue in structures.ts. Kept apart so neither imports the other.

/** Every structure the build menu can list. Each later shelter structure adds its name here and its entry to STRUCTURES. */
export type StructureKind = "campfire";

/** Which way a structure faces: how many quarter turns clockwise, seen from above, from 0 to 3. */
export type QuarterTurns = 0 | 1 | 2 | 3;
