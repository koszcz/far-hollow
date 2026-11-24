// The kinds of log the player carries, of wood a woodpile holds, and of fuel a campfire burns.
// Each list is the one source for its type, so the save check and the UI's menus cannot drift from it.

/** The kinds of log the player can carry on their shoulder. */
export const CARRIED_LOGS = ["log", "debarkedLog"] as const;
export type CarriedLog = (typeof CARRIED_LOGS)[number];

/** The kinds of wood a woodpile holds: logs and debarked logs from the shoulder, and firewood from the backpack. */
export const WOODPILE_WOODS = [...CARRIED_LOGS, "firewood"] as const;
export type WoodpileWood = (typeof WOODPILE_WOODS)[number];

/** The kinds of fuel the player can put on a campfire, in the order a lit fire takes them: firewood first, then a stick, then bark. */
export const CAMPFIRE_FUELS = ["firewood", "stick", "bark"] as const;
export type CampfireFuel = (typeof CAMPFIRE_FUELS)[number];

/** The materials the player carries in both hands, when they fetch one for a blueprint. They never go in the backpack on the way. */
export const HELD_MATERIALS = ["plank", "stone"] as const;
export type HeldMaterial = (typeof HELD_MATERIALS)[number];

/** Everything the player can carry outside the backpack, one at a time: a log on the shoulder, or a plank or stone in the hands. */
export const CARRIED_THINGS = [...CARRIED_LOGS, ...HELD_MATERIALS] as const;
export type CarriedThing = (typeof CARRIED_THINGS)[number];

/** Whether a carried thing is a log or debarked log on the shoulder, rather than a plank or stone in the hands. */
export function isCarriedLog(thing: CarriedThing): thing is CarriedLog {
  return (CARRIED_LOGS as readonly string[]).includes(thing);
}
