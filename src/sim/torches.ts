// Lit torches: the one in the player's hand, and the ones planted in the ground.
// A torch is lit from the backpack with the steel and flint. It burns for a fixed time, in the hand or planted, then is gone.
// The player can plant the torch in their hand at their feet, and pick a planted torch up again with the time it has left.
// Unlit torches are an ordinary backpack content. A lit torch is not, so it uses no backpack weight.
// A planted torch is its own entity. It does not block walking.
import type { PlantedTorchView, Refusal } from "./api";
import type { ApproachReach } from "./approach";
import { hasInBackpack, removeFromBackpack } from "./backpack";
import { burnDown, freshBurnTime, type BurnTime } from "./burn-time";
import { plantedTorchEntities, playerEntities, setComponent, type Entity, type EntityStore, type Vec3 } from "./entities";
import { standingHeightAt } from "./foundations";
import { groundDistance, type GroundPoint } from "./ground-point";
import type { HandReach } from "./hand-reach";
import { toolRefusal } from "./refusals";
import type { Valley } from "./valley";

/** The player cannot plant a torch this close to another planted torch, in metres. */
export const PLANTED_TORCH_SPACING_METRES = 1;
/** The player can pick up a planted torch from this far away, in metres. */
export const PLANTED_TORCH_REACH_METRES = 2;

export type PlantedTorchEntity = Entity & { plantedTorch: BurnTime; position: Vec3 };

export interface Torches {
  /**
   * Takes one torch out of the backpack and puts it in the player's hand, lit for TORCH_BURN_MINUTES.
   * Does nothing if the backpack holds no torch. The game calls it only once `lightRefusal` passes.
   */
  light(): void;
  /** Why the player cannot light a torch now: they lack the steel and flint, or already hold a lit torch. */
  lightRefusal(): Refusal | undefined;
  /** Throws the lit torch in the player's hand away. A torch is never lit twice, so nothing goes back in the backpack. */
  putOut(): void;
  /**
   * Stands the lit torch in the player's hand in the ground at their feet, or on the foundation they stand on, with the time it
   * has left. Their hand is then empty. Does nothing if they hold no lit torch, or if `plantRefusal` gives a reason.
   */
  plant(): void;
  /** Why the player cannot plant a torch: they hold no lit torch, or another planted torch stands within PLANTED_TORCH_SPACING_METRES. */
  plantRefusal(): Refusal | undefined;
  /**
   * Where the player walks to pick up a planted torch: onto its spot, or beside it if something blocks it. A player within reach
   * picks it up from where they stand. Undefined if the entity is not a planted torch.
   */
  pickUpReach(torchId: number): ApproachReach | undefined;
  /**
   * Has the player reach down for a planted torch within reach, given by its entity id. It goes in their hand with the time it
   * has left. The approach runs it once they arrive. Does nothing if `pickUpRefusal` gives a reason.
   */
  pickUp(torchId: number): void;
  /** Why the player cannot pick up a planted torch: they already hold a lit torch. */
  pickUpRefusal(): Refusal | undefined;
  /**
   * Burns every lit torch down by this many game minutes, in the hand and planted. When none are left, the torch is gone.
   * Rain does not change it.
   */
  burn(minutes: number): void;
  /** How long the lit torch in the player's hand still burns, if they hold one. */
  held(): BurnTime | undefined;
  /** Every planted torch, in no set order. */
  planted(): readonly PlantedTorchView[];
}

export function createTorches(entities: EntityStore, valley: Valley, hand: Pick<HandReach, "start">): Torches {
  const players = playerEntities(entities);
  const plantedTorches = plantedTorchEntities(entities);

  function lightRefusal(): Refusal | undefined {
    const player = players.first;
    if (player?.litTorch !== undefined) return { kind: "torchAlreadyLit" };
    return toolRefusal(player, "steelAndFlint");
  }

  function plantRefusal(): Refusal | undefined {
    const player = players.first;
    if (player === undefined) return undefined;
    if (player.litTorch === undefined) return { kind: "noLitTorch" };
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

  /** Starts the hand reaching down for the planted torch. When the hand gets to it, it goes in the hand if it still burns there and the hand is free. */
  function startPickUpReach(torchId: number, at: GroundPoint): void {
    hand.start("low", at, () => {
      const player = players.first;
      const torch = torchById(torchId);
      if (player === undefined || torch === undefined || !withinReach(torch, player.position) || pickUpRefusal() !== undefined) return undefined;
      setComponent(entities, player, "litTorch", torch.plantedTorch);
      entities.remove(torch);
      return undefined;
    });
  }

  return {
    light() {
      const player = players.first;
      if (player?.backpack === undefined || !hasInBackpack(player.backpack, "torch")) return;
      removeFromBackpack(player.backpack, "torch", 1);
      setComponent(entities, player, "litTorch", freshBurnTime());
    },
    lightRefusal,
    putOut() {
      for (const player of players) entities.removeComponent(player, "litTorch");
    },
    plant() {
      const player = players.first;
      if (player?.litTorch === undefined || plantRefusal() !== undefined) return;
      const { x, z } = player.position;
      entities.add({
        plantedTorch: player.litTorch,
        position: { x, y: standingHeightAt(entities, valley.terrain, { x, z }), z },
      });
      entities.removeComponent(player, "litTorch");
    },
    plantRefusal,
    pickUpReach(torchId) {
      const torch = torchById(torchId);
      if (torch === undefined) return undefined;
      return { target: torch.position, metres: PLANTED_TORCH_REACH_METRES, walk: { style: "onto", spot: torch.position, atOnceInReach: true } };
    },
    pickUp(torchId) {
      const torch = torchById(torchId);
      if (torch !== undefined && pickUpRefusal() === undefined) startPickUpReach(torchId, torch.position);
    },
    pickUpRefusal,
    burn(minutes) {
      for (const player of [...players]) {
        if (player.litTorch === undefined) continue;
        const left = burnDown(player.litTorch, minutes);
        if (left === undefined) entities.removeComponent(player, "litTorch");
        else player.litTorch = left;
      }
      // Copy the list first, because burnt-out torches leave the query while it is being walked.
      for (const torch of [...plantedTorches]) {
        const left = burnDown(torch.plantedTorch, minutes);
        if (left === undefined) entities.remove(torch);
        else torch.plantedTorch = left;
      }
    },
    held() {
      const torch = players.first?.litTorch;
      return torch === undefined ? undefined : { ...torch };
    },
    planted() {
      return plantedTorches.entities.flatMap((torch) => {
        const id = entities.id(torch);
        if (id === undefined) return [];
        return [{ ...torch.plantedTorch, id, position: { ...torch.position } }];
      });
    },
  };
}
