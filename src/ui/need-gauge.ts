// What a need gauge in the HUD shows: how much of its ring fills, and whether it pulses to warn the player.
// Also the hint above the gauges that tells the player how low needs affect them.

import { LOW_NEED as SLOWING_NEED, type NeedKind } from "../sim/api";
import { strings } from "../strings";

/** At or below this level a need's gauge pulses, to warn the player. */
export const LOW_NEED = 0.25;

/** The share of a need's ring that fills at `level`, from 0 (empty) to 1 (full). Levels outside that range stay at the nearest end. */
export function needRingShare(level: number): number {
  return Math.min(1, Math.max(0, level));
}

/** Whether a need's gauge pulses at `level`, because the need is low. */
export function needPulses(level: number): boolean {
  return level <= LOW_NEED;
}

/** The order the HUD shows the needs in, left to right. The hint lists low needs in the same order. */
const HUD_NEED_ORDER: readonly NeedKind[] = ["warmth", "hunger", "thirst", "fatigue"];

/**
 * The hint above the need gauges, or null when no need is low.
 * It names the needs low enough to slow the player, says how they slow them, and says how to fill them.
 * When a need is empty, it also warns that the player will collapse.
 */
export function lowNeedsHint(needs: Readonly<Record<NeedKind, number>>): string | null {
  const low = HUD_NEED_ORDER.filter((kind) => needs[kind] < SLOWING_NEED);
  if (low.length === 0) return null;
  const text = strings.lowNeeds;
  const slowed = text.slowed(
    low.map((kind) => text.feeling[kind]),
    low.map((kind) => text.remedy[kind]),
  );
  return low.some((kind) => needs[kind] <= 0) ? `${slowed} ${text.collapseSoon}` : slowed;
}
