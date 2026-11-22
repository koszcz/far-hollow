// Digging clay on the river bank. The player walks into reach of a spot on the river bank or in the river,
// digs there by hand for a few seconds, and puts one clay in the backpack. Clay never runs out and needs no tool.
import type { CommandRules } from "./command-rule";
import type { Entity, EntityStore } from "./entities";
import { createRiverBankWork, riverBankWorkNow, riverBankWorkRule, type RiverBankWork, type RiverBankWorkKind, type RiverBankWorkNow } from "./river-bank-work";
import type { Valley } from "./valley";
import type { WalkMap } from "./walk-map";

/** How long the player digs for one clay, in seconds. It is longer than gathering one stone. */
export const DIG_CLAY_SECONDS = 6;

const DIGGING_CLAY: RiverBankWorkKind = { task: "clayTask", content: "clay", seconds: DIG_CLAY_SECONDS };

/** How far the player is through digging one clay, where, and how long one takes. Undefined if they are not digging now. */
export function diggingClayNow(player: Entity): RiverBankWorkNow | undefined {
  return riverBankWorkNow(player, DIGGING_CLAY);
}

/** Lets the player dig clay on the river bank into the backpack. */
export function createClayDigging(entities: EntityStore, walkMap: WalkMap, valley: Valley): RiverBankWork {
  return createRiverBankWork(entities, walkMap, valley, DIGGING_CLAY);
}

/** The rule for digging clay. */
export function clayRules(clayDigging: RiverBankWork): CommandRules<"digClay"> {
  return { digClay: riverBankWorkRule(clayDigging) };
}
