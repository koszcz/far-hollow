import type { Refusal } from "./api";
import { addToBackpack, fitsInBackpack, hasInBackpack, type Backpack } from "./backpack";
import { playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import { shoulderRefusal, toolRefusal } from "./refusals";
import type { HandReach } from "./hand-reach";
import { groundDistance, type GroundPoint } from "./valley";
import { walkOntoOrWithinReach, type Walking } from "./walking";

/** The player can pick up a stick from this far away, in metres. */
const PICK_UP_REACH_METRES = 2;

/** How long the player takes to split a log into firewood, in seconds. */
export const SPLIT_SECONDS = 3;

/** How far the player is through splitting the log on their shoulder, from 0 to 1, or undefined if they are not splitting now. */
export function splittingNow(player: Entity): { progress: number } | undefined {
  if (player.splitTask === undefined) return undefined;
  return { progress: Math.min(1, player.splitTask.secondsDone / SPLIT_SECONDS) };
}
/** How many pieces of firewood one log splits into. */
export const FIREWOOD_PER_LOG = 4;

/** Why the player could not start gathering. */
export type GatherRefusal = "backpackFull";

export interface Gathering {
  /**
   * Sets the player walking to a stick on the ground to put it in the backpack. Once there, they reach down for it.
   * Does nothing if the entity is not a stick on the ground. If the backpack has no room for it when the hand gets
   * to it, the stick stays on the ground and the reach gives the "backpackFull" notice.
   */
  pickUpStick(stickId: number): void;
  /** Like `pickUpStick`, for a piece of bark on the ground, such as one given back by taking down a building piece. */
  pickUpBark(barkId: number): void;
  /**
   * Starts the player splitting the log on their shoulder into firewood with the axe.
   * Does nothing if the player carries no log, has no axe, or the backpack has no room for all the firewood.
   * Returns "backpackFull" when the backpack has no room for the firewood.
   */
  splitLog(): GatherRefusal | undefined;
  /**
   * Why the player could not split a log now: without the axe, or, for a log on the ground, with a log already on their shoulder,
   * since splitting picks it up first. The game greys out splitting for these.
   */
  refusal(fromGround: boolean): Refusal | undefined;
  /**
   * Whether the backpack has no room for all the firewood, checked before the player picks up a log to split.
   * The game shows this as a notice when the player tries.
   */
  splitRefusal(): GatherRefusal | undefined;
  /** Stops the player walking to pick up a stick or piece of bark, or splitting a log. */
  cancel(): void;
  /** Starts the player reaching for sticks and bark they have walked to, and moves splitting on by one logic step. Run it after walking has moved the player. */
  step(stepSeconds: number): undefined;
}

/** A material that lies on the ground as its own entity, and that the player picks up into the backpack. */
type GroundMaterial = "stick" | "bark";

/** Lets the player gather fuel into the backpack: sticks and bark from the ground, and firewood split from logs. */
export function createGathering(entities: EntityStore, walking: Walking, hand: Pick<HandReach, "start">): Gathering {
  const players = playerEntities(entities);
  const stickGatherers = entities.with("stickPickUpTask", "position", "backpack");
  const barkGatherers = entities.with("barkPickUpTask", "position", "backpack");
  const splitters = entities.with("splitTask", "backpack");

  /**
   * Sets the player walking to a stick or piece of bark on the ground. `setTask` gives them the task that picks it up there.
   * Does nothing if the entity is not that material on the ground.
   */
  function startPickUp(id: number, material: GroundMaterial, setTask: (player: Entity) => void): void {
    const lying = entities.entity(id);
    if (lying?.[material] !== true || lying.position === undefined) return;
    for (const player of players) {
      if (player.backpack === undefined) continue;
      walkOntoOrWithinReach(walking, lying.position, lying.position, PICK_UP_REACH_METRES);
      setTask(player);
    }
  }

  /** The stick or piece of bark with this id, if it still lies within the gatherer's reach. */
  function lyingInReach(gatherer: { position: GroundPoint }, id: number, material: GroundMaterial): (Entity & { position: GroundPoint }) | undefined {
    const lying = entities.entity(id);
    if (lying?.[material] !== true || lying.position === undefined) return undefined;
    if (groundDistance(lying.position, gatherer.position) > PICK_UP_REACH_METRES) return undefined;
    return lying as Entity & { position: GroundPoint };
  }

  /**
   * Has the gatherer reach down for a stick or piece of bark they have walked to. When the hand gets to it, it goes in
   * the backpack if it still lies there and fits. If it does not fit, it stays on the ground and the reach refuses.
   */
  function reachFor(gatherer: Entity & { position: GroundPoint; backpack: Backpack }, id: number, material: GroundMaterial): void {
    const lying = lyingInReach(gatherer, id, material);
    if (lying === undefined) return;
    hand.start("low", lying.position, () => {
      const still = lyingInReach(gatherer, id, material);
      if (still === undefined) return undefined;
      if (!addToBackpack(gatherer.backpack, material, 1)) return "backpackFull";
      entities.remove(still);
      return undefined;
    });
  }

  return {
    pickUpStick(stickId) {
      startPickUp(stickId, "stick", (player) => {
        setComponent(entities, player, "stickPickUpTask", { stickId });
      });
    },
    pickUpBark(barkId) {
      startPickUp(barkId, "bark", (player) => {
        setComponent(entities, player, "barkPickUpTask", { barkId });
      });
    },
    splitLog() {
      let refusal: GatherRefusal | undefined;
      for (const player of players) {
        if (player.carrying !== "log" || player.backpack === undefined) continue;
        if (!canSplitInto(player.backpack)) {
          if (hasInBackpack(player.backpack, "axe")) refusal = "backpackFull";
          continue;
        }
        entities.removeComponent(player, "walkPath");
        setComponent(entities, player, "splitTask", { secondsDone: 0 });
      }
      return refusal;
    },
    refusal(fromGround) {
      const player = players.first;
      return toolRefusal(player, "axe") ?? (fromGround ? shoulderRefusal(player) : undefined);
    },
    splitRefusal() {
      for (const player of players) {
        if (player.backpack !== undefined && !canSplitInto(player.backpack)) return "backpackFull";
      }
      return undefined;
    },
    cancel() {
      for (const player of players) {
        entities.removeComponent(player, "stickPickUpTask");
        entities.removeComponent(player, "barkPickUpTask");
        entities.removeComponent(player, "splitTask");
      }
    },
    step(stepSeconds) {
      // Copy each list first, because players who finish or give up leave the query while it is being walked.
      for (const splitter of [...splitters]) {
        if (splitter.carrying !== "log" || !canSplitInto(splitter.backpack)) {
          entities.removeComponent(splitter, "splitTask");
          continue;
        }
        splitter.splitTask.secondsDone += stepSeconds;
        if (splitter.splitTask.secondsDone < SPLIT_SECONDS) continue;
        entities.removeComponent(splitter, "splitTask");
        if (addToBackpack(splitter.backpack, "firewood", FIREWOOD_PER_LOG)) entities.removeComponent(splitter, "carrying");
      }
      for (const gatherer of [...stickGatherers]) {
        if (gatherer.walkPath) continue;
        const { stickId } = gatherer.stickPickUpTask;
        entities.removeComponent(gatherer, "stickPickUpTask");
        reachFor(gatherer, stickId, "stick");
      }
      for (const gatherer of [...barkGatherers]) {
        if (gatherer.walkPath) continue;
        const { barkId } = gatherer.barkPickUpTask;
        entities.removeComponent(gatherer, "barkPickUpTask");
        reachFor(gatherer, barkId, "bark");
      }
    },
  };
}

/** True if the backpack has the axe and room for all the firewood from one log. */
function canSplitInto(backpack: Backpack): boolean {
  return hasInBackpack(backpack, "axe") && fitsInBackpack(backpack, "firewood", FIREWOOD_PER_LOG);
}
