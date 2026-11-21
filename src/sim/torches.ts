// Lit torches: the one in the player's hand, and the ones planted in the ground.
// A torch is lit from the backpack with the steel and flint. It burns for a fixed time, in the hand or planted, then is gone.
// The player can plant the torch in their hand at their feet, and pick a planted torch up again with the time it has left.
// Unlit torches are an ordinary backpack content. A lit torch is not, so it uses no backpack weight.
// A planted torch is its own entity. It does not block walking.
import type { Activity } from "./activity";
import type { Refusal } from "./api";
import { hasInBackpack, removeFromBackpack } from "./backpack";
import { plantedTorchEntities, playerEntities, setComponent, type Entity, type EntityStore, type Vec3 } from "./entities";
import { standingHeightAt } from "./foundations";
import { groundDistance, type GroundPoint } from "./ground-point";
import type { HandReach } from "./hand-reach";
import { toolRefusal } from "./refusals";
import type { Valley } from "./valley";
import { walkOntoOrWithinReach, type Walking } from "./walking";

/** How long a lit torch burns, in game minutes: 3 game hours. */
export const TORCH_BURN_MINUTES = 180;
/** The player cannot plant a torch this close to another planted torch, in metres. */
export const PLANTED_TORCH_SPACING_METRES = 1;
/** The player can pick up a planted torch from this far away, in metres. */
export const PLANTED_TORCH_REACH_METRES = 2;

/** A lit torch, with how long it still burns. */
export interface LitTorch {
  /** How many more game minutes the torch burns. */
  readonly minutesLeft: number;
  /** How much of its burning time is left, from 1 (just lit) to 0 (burnt out). */
  readonly burnLeft: number;
}

/** A torch planted in the ground: its entity id, where it stands, and how long it still burns. */
export interface PlantedTorch extends LitTorch {
  readonly id: number;
  readonly position: Readonly<Vec3>;
}

export type PlantedTorchEntity = Entity & { plantedTorch: { minutesLeft: number }; position: Vec3 };

export interface Torches extends Activity {
  /**
   * Takes one torch out of the backpack and puts it in the player's hand, lit for TORCH_BURN_MINUTES.
   * Does nothing if the backpack holds no torch, or if `refusal` gives a reason.
   */
  light(): void;
  /** Why the player cannot light a torch now: they lack the steel and flint, or already hold a lit torch. */
  refusal(): Refusal | undefined;
  /** Throws the lit torch in the player's hand away. A torch is never lit twice, so nothing goes back in the backpack. */
  putOut(): void;
  /**
   * Stands the lit torch in the player's hand in the ground at their feet, or on the foundation they stand on, with the time it
   * has left. Their hand is then empty. Does nothing if they hold no lit torch, or if `plantRefusal` gives a reason.
   */
  plant(): void;
  /** Why the player cannot plant their torch here: another planted torch stands within PLANTED_TORCH_SPACING_METRES. */
  plantRefusal(): Refusal | undefined;
  /**
   * Walks the player to a planted torch, given by its entity id, if it is out of reach. They reach down for it there, and it goes
   * in their hand with the time it has left. Does nothing if the entity is not a planted torch, or if `pickUpRefusal` gives a reason.
   */
  pickUp(torchId: number): void;
  /** Why the player cannot pick up a planted torch: they already hold a lit torch. */
  pickUpRefusal(): Refusal | undefined;
  /**
   * Burns every lit torch down by this many game minutes, in the hand and planted. When none are left, the torch is gone.
   * Rain does not change it.
   */
  burn(minutes: number): void;
  /** The lit torch in the player's hand, if any. */
  held(): LitTorch | undefined;
  /** Every planted torch, in no set order. */
  planted(): readonly PlantedTorch[];
}

export function createTorches(entities: EntityStore, walking: Walking, valley: Valley, hand: Pick<HandReach, "start">): Torches {
  const players = playerEntities(entities);
  const plantedTorches = plantedTorchEntities(entities);
  const walkers = entities.with("torchPickUpTask", "position");

  function refusal(): Refusal | undefined {
    const player = players.first;
    if (player?.litTorch !== undefined) return { kind: "torchAlreadyLit" };
    return toolRefusal(player, "steelAndFlint");
  }

  function plantRefusal(): Refusal | undefined {
    const player = players.first;
    if (player === undefined) return undefined;
    const tooClose = plantedTorches.entities.some((torch) => groundDistance(torch.position, player.position) < PLANTED_TORCH_SPACING_METRES);
    return tooClose ? { kind: "torchTooClose" } : undefined;
  }

  function pickUpRefusal(): Refusal | undefined {
    return players.first?.litTorch === undefined ? undefined : { kind: "torchAlreadyLit" };
  }

  function torchById(torchId: number): PlantedTorchEntity | undefined {
    const entity = entities.entity(torchId);
    if (entity?.plantedTorch === undefined || entity.position === undefined) return undefined;
    return entity as PlantedTorchEntity;
  }

  function withinReach(torch: PlantedTorchEntity, at: GroundPoint): boolean {
    return groundDistance(torch.position, at) <= PLANTED_TORCH_REACH_METRES;
  }

  /** Reaches down for the planted torch. When the hand gets to it, it goes in the hand if it still burns there and the hand is free. */
  function pickUpNow(torchId: number, at: GroundPoint): void {
    hand.start("low", at, () => {
      const player = players.first;
      const still = torchById(torchId);
      if (player === undefined || still === undefined || !withinReach(still, player.position) || pickUpRefusal() !== undefined) return undefined;
      setComponent(entities, player, "litTorch", { minutesLeft: still.plantedTorch.minutesLeft });
      entities.remove(still);
      return undefined;
    });
  }

  function minutesShare(minutesLeft: number): number {
    return Math.max(0, Math.min(1, minutesLeft / TORCH_BURN_MINUTES));
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
    plant() {
      const player = players.first;
      if (player?.litTorch === undefined || plantRefusal() !== undefined) return;
      const { x, z } = player.position;
      entities.add({
        plantedTorch: { minutesLeft: player.litTorch.minutesLeft },
        position: { x, y: standingHeightAt(entities, valley.terrain, { x, z }), z },
      });
      entities.removeComponent(player, "litTorch");
    },
    plantRefusal,
    pickUp(torchId) {
      const torch = torchById(torchId);
      if (torch === undefined || pickUpRefusal() !== undefined) return;
      for (const player of players) {
        if (withinReach(torch, player.position)) {
          pickUpNow(torchId, torch.position);
          continue;
        }
        walkOntoOrWithinReach(walking, torch.position, torch.position, PLANTED_TORCH_REACH_METRES);
        setComponent(entities, player, "torchPickUpTask", { torchId });
      }
    },
    pickUpRefusal,
    burn(minutes) {
      for (const player of [...players]) {
        if (player.litTorch === undefined) continue;
        player.litTorch.minutesLeft -= minutes;
        if (player.litTorch.minutesLeft <= 0) entities.removeComponent(player, "litTorch");
      }
      // Copy the list first, because burnt-out torches leave the query while it is being walked.
      for (const torch of [...plantedTorches]) {
        torch.plantedTorch.minutesLeft -= minutes;
        if (torch.plantedTorch.minutesLeft <= 0) entities.remove(torch);
      }
    },
    held() {
      const torch = players.first?.litTorch;
      if (torch === undefined) return undefined;
      return { minutesLeft: torch.minutesLeft, burnLeft: minutesShare(torch.minutesLeft) };
    },
    planted() {
      return plantedTorches.entities.flatMap((torch) => {
        const id = entities.id(torch);
        if (id === undefined) return [];
        const { minutesLeft } = torch.plantedTorch;
        return [{ id, position: { ...torch.position }, minutesLeft, burnLeft: minutesShare(minutesLeft) }];
      });
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "torchPickUpTask");
    },
    step() {
      // Copy the list first, because players who arrive leave the query while it is being walked.
      for (const walker of [...walkers]) {
        if (walker.walkPath !== undefined) continue;
        const { torchId } = walker.torchPickUpTask;
        entities.removeComponent(walker, "torchPickUpTask");
        const torch = torchById(torchId);
        if (torch !== undefined && withinReach(torch, walker.position)) pickUpNow(torchId, torch.position);
      }
      return undefined;
    },
  };
}
