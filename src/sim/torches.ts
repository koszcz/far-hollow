// The torch in the player's hand: lit from the backpack with the steel and flint, it burns for a fixed time, then is gone.
// Unlit torches are an ordinary backpack content. A lit torch is not, so it uses no backpack weight.
import type { Refusal } from "./api";
import { hasInBackpack, removeFromBackpack } from "./backpack";
import { playerEntities, setComponent, type EntityStore } from "./entities";
import { toolRefusal } from "./refusals";

/** How long a lit torch burns, in game minutes: 3 game hours. */
export const TORCH_BURN_MINUTES = 180;

/** The lit torch in the player's hand, with how long it still burns. */
export interface LitTorch {
  /** How many more game minutes the torch burns. */
  readonly minutesLeft: number;
  /** How much of its burning time is left, from 1 (just lit) to 0 (burnt out). */
  readonly burnLeft: number;
}

export interface Torches {
  /**
   * Takes one torch out of the backpack and puts it in the player's hand, lit for TORCH_BURN_MINUTES.
   * Does nothing if the backpack holds no torch, or if `refusal` gives a reason.
   */
  light(): void;
  /** Why the player cannot light a torch now: they lack the steel and flint, or already hold a lit torch. */
  refusal(): Refusal | undefined;
  /** Throws the lit torch in the player's hand away. A torch is never lit twice, so nothing goes back in the backpack. */
  putOut(): void;
  /** Burns the lit torch down by this many game minutes. When none are left, the torch is gone. Rain does not change it. */
  burn(minutes: number): void;
  /** The lit torch in the player's hand, if any. */
  held(): LitTorch | undefined;
}

export function createTorches(entities: EntityStore): Torches {
  const players = playerEntities(entities);

  function refusal(): Refusal | undefined {
    const player = players.first;
    if (player?.litTorch !== undefined) return { kind: "torchAlreadyLit" };
    return toolRefusal(player, "steelAndFlint");
  }

  return {
    light() {
      const player = players.first;
      if (player?.backpack === undefined || refusal() !== undefined || !hasInBackpack(player.backpack, "torch")) return;
      removeFromBackpack(player.backpack, "torch", 1);
      setComponent(entities, player, "litTorch", { minutesLeft: TORCH_BURN_MINUTES });
    },
    refusal,
    putOut() {
      for (const player of players) entities.removeComponent(player, "litTorch");
    },
    burn(minutes) {
      for (const player of [...players]) {
        if (player.litTorch === undefined) continue;
        player.litTorch.minutesLeft -= minutes;
        if (player.litTorch.minutesLeft <= 0) entities.removeComponent(player, "litTorch");
      }
    },
    held() {
      const torch = players.first?.litTorch;
      if (torch === undefined) return undefined;
      return { minutesLeft: torch.minutesLeft, burnLeft: Math.max(0, Math.min(1, torch.minutesLeft / TORCH_BURN_MINUTES)) };
    },
  };
}
