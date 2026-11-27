// The hints in the HUD's context panel while the player places a structure or plants a sapling.
import type { BuildMenuEntry, Plantable, Refusal, StructureKind } from "../sim/api";
import { placingHint, plantingHint } from "./placing-hint";

/** The hint shown while placing a structure: what to click, then the keys on a line of their own. */
export function PlacingHintText({ entries, placing, refusal }: { entries: readonly BuildMenuEntry[]; placing: StructureKind; refusal: Refusal | undefined }) {
  const { what, keys } = placingHint(entries, placing, refusal);
  return (
    <p class="hud-hint hud-placing-hint">
      {what}
      <span class="hud-placing-keys">{keys}</span>
    </p>
  );
}

/** What the planting hint shows: what the player plants, and why the game refuses the spot under the mouse, or null if it allows it. */
export interface PlantingHintState {
  readonly plant: Plantable;
  readonly refusal: Refusal | null;
}

/** The hint shown while planting a sapling or berry bush: what to click, or why the spot is not allowed, then the cancel key on a line of its own. */
export function PlantingHintText({ plant, refusal }: PlantingHintState) {
  const { what, keys } = plantingHint(plant, refusal);
  return (
    <p class="hud-hint hud-placing-hint">
      {what}
      <span class="hud-placing-keys">{keys}</span>
    </p>
  );
}
