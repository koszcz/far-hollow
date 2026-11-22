// Gathering stone on the river bank. The player walks into reach of a spot on the river bank or in the river,
// works there for a few seconds, and puts one stone in the backpack. Stone never runs out and needs no tool.
import type { CommandRules } from "./command-rule";
import type { Entity, EntityStore } from "./entities";
import { createRiverBankWork, riverBankWorkNow, riverBankWorkRule, type RiverBankWork, type RiverBankWorkKind } from "./river-bank-work";
import type { Valley } from "./valley";
import type { WalkMap } from "./walk-map";

/** How long the player works to gather one stone, in seconds. */
export const GATHER_STONE_SECONDS = 4;

const GATHERING_STONE: RiverBankWorkKind = { task: "stoneTask", content: "stone", seconds: GATHER_STONE_SECONDS };

/** How far the player is through gathering one stone, from 0 to 1, or undefined if they are not gathering now. */
export function gatheringStoneNow(player: Entity): { progress: number } | undefined {
  return riverBankWorkNow(player, GATHERING_STONE);
}

/** Lets the player gather stone on the river bank into the backpack. */
export function createStoneGathering(entities: EntityStore, walkMap: WalkMap, valley: Valley): RiverBankWork {
  return createRiverBankWork(entities, walkMap, valley, GATHERING_STONE);
}

/** The rule for gathering stone. */
export function stoneRules(stoneGathering: RiverBankWork): CommandRules<"gatherStone"> {
  return { gatherStone: riverBankWorkRule(stoneGathering) };
}
