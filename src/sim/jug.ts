// The jug's fill level: how many drinks of clean water a jug holds. Each fill level is its own backpack content.
// It imports only types, so the backpack can take its weights from here. See ADR 0009.
import type { Refusal } from "./api-refusal";
import type { BackpackContent, BackpackContents } from "./backpack";

/** The most drinks a jug holds. */
export const JUG_DRINK_LIMIT = 3;

/** The jug by fill level: index 0 is the empty jug, then 1, 2, and 3 drinks. */
export const JUG_CONTENTS = ["jug", "jugWith1Drink", "jugWith2Drinks", "jugWith3Drinks"] as const;

/** The jug, by how many drinks it holds. `jug` is empty. */
export type JugContent = (typeof JUG_CONTENTS)[number];

/** A table with one entry for each jug fill level, so a new fill level needs no edit in the tables built from it. */
export function byJug<T>(value: (jug: JugContent) => T): Record<JugContent, T> {
  return Object.fromEntries(JUG_CONTENTS.map((jug) => [jug, value(jug)])) as Record<JugContent, T>;
}

/** An empty jug weighs this much, in kilograms. */
const EMPTY_JUG_KG = 1;
/** One drink of water weighs this much, in kilograms. */
const DRINK_KG = 2;

/** True if `content` is a jug, empty or not. */
export function isJug(content: BackpackContent): content is JugContent {
  return (JUG_CONTENTS as readonly BackpackContent[]).includes(content);
}

/** How many drinks a jug holds. */
export function drinksIn(jug: JugContent): number {
  return JUG_CONTENTS.indexOf(jug);
}

/** The jug that holds `drinks` drinks, from 0 up to JUG_DRINK_LIMIT. */
export function jugHolding(drinks: number): JugContent {
  const jug = JUG_CONTENTS[Math.min(JUG_DRINK_LIMIT, Math.max(0, Math.round(drinks)))];
  if (jug === undefined) throw new Error(`No jug holds ${drinks} drinks`);
  return jug;
}

/** The jug as it is after 1 more drink is poured in. A full jug stays full. */
export function withOneMoreDrink(jug: JugContent): JugContent {
  return jugHolding(drinksIn(jug) + 1);
}

/** The jug as it is after 1 drink is taken out. An empty jug stays empty. */
export function withOneLessDrink(jug: JugContent): JugContent {
  return jugHolding(drinksIn(jug) - 1);
}

/** How much a jug weighs: 1 kg, plus 2 kg for each drink, so a full jug weighs 7 kg. */
export function jugWeightKg(jug: JugContent): number {
  return EMPTY_JUG_KG + DRINK_KG * drinksIn(jug);
}

/** True if a jug holds fewer drinks than it can. */
export function hasRoom(jug: JugContent): boolean {
  return drinksIn(jug) < JUG_DRINK_LIMIT;
}

/** True if a jug holds at least one drink. */
export function holdsWater(jug: JugContent): boolean {
  return drinksIn(jug) > 0;
}

/** The jug that water is poured into: the fullest one in `contents` that still has room. Undefined if none has room. */
export function jugToPourInto(contents: Readonly<BackpackContents>): JugContent | undefined {
  return [...JUG_CONTENTS].reverse().find((jug) => hasRoom(jug) && (contents[jug] ?? 0) > 0);
}

/** The jug that the player drinks from: the emptiest one in `contents` that holds water. Undefined if none holds water. */
export function jugToDrinkFrom(contents: Readonly<BackpackContents>): JugContent | undefined {
  return JUG_CONTENTS.find((jug) => holdsWater(jug) && (contents[jug] ?? 0) > 0);
}

/** Why no water can be poured into a jug in `contents`: it holds no jug, or every jug it holds is full. */
export function pourIntoJugRefusal(contents: Readonly<BackpackContents>): Refusal | undefined {
  if (!JUG_CONTENTS.some((jug) => (contents[jug] ?? 0) > 0)) return { kind: "noJug" };
  return jugToPourInto(contents) === undefined ? { kind: "noJugWithRoom" } : undefined;
}
