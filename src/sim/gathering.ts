import { addToBackpack, fitsInBackpack, hasInBackpack, type Backpack } from "./backpack";
import { playerEntities, type EntityStore } from "./entities";
import { groundDistance } from "./valley";
import type { Walking } from "./walking";

/** The player can pick up a stick from this far away, in metres. */
const PICK_UP_REACH_METRES = 2;

/** How long the player takes to split a log into firewood, in seconds. */
export const SPLIT_SECONDS = 3;
/** How many pieces of firewood one log splits into. */
export const FIREWOOD_PER_LOG = 4;

export interface Gathering {
  /**
   * Sets the player walking to a stick on the ground to put it in the backpack.
   * Does nothing if the entity is not a stick on the ground or the backpack has no room for it.
   */
  pickUpStick(stickId: number): void;
  /**
   * Starts the player splitting the log on their shoulder into firewood with the axe.
   * Does nothing if the player carries no log, has no axe, or the backpack has no room for all the firewood.
   */
  splitLog(): void;
  /** Stops the player walking to pick up a stick, or splitting a log. */
  cancel(): void;
  /** Picks up sticks the player has reached and moves splitting on by one logic step. Run it after walking has moved the player. */
  step(stepSeconds: number): void;
}

/** Lets the player gather fuel into the backpack: sticks from the forest floor, and firewood split from logs. */
export function createGathering(entities: EntityStore, walking: Walking): Gathering {
  const players = playerEntities(entities);
  const gatherers = entities.with("stickPickUpTask", "position", "backpack");
  const splitters = entities.with("splitTask", "backpack");

  return {
    pickUpStick(stickId) {
      const stick = entities.entity(stickId);
      if (stick?.stick !== true || stick.position === undefined) return;
      for (const player of players) {
        if (player.backpack === undefined || !fitsInBackpack(player.backpack, "stick", 1)) continue;
        walking.walkTo(stick.position);
        if (player.stickPickUpTask) player.stickPickUpTask = { stickId };
        else entities.addComponent(player, "stickPickUpTask", { stickId });
      }
    },
    splitLog() {
      for (const player of players) {
        if (player.carrying !== "log" || player.backpack === undefined || !canSplitInto(player.backpack)) continue;
        entities.removeComponent(player, "walkPath");
        if (player.splitTask) player.splitTask = { secondsDone: 0 };
        else entities.addComponent(player, "splitTask", { secondsDone: 0 });
      }
    },
    cancel() {
      for (const player of players) {
        entities.removeComponent(player, "stickPickUpTask");
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
      for (const gatherer of [...gatherers]) {
        if (gatherer.walkPath) continue;
        const stick = entities.entity(gatherer.stickPickUpTask.stickId);
        entities.removeComponent(gatherer, "stickPickUpTask");
        if (stick?.stick !== true || stick.position === undefined) continue;
        const distance = groundDistance(stick.position, gatherer.position);
        if (distance > PICK_UP_REACH_METRES) continue;
        if (addToBackpack(gatherer.backpack, "stick", 1)) entities.remove(stick);
      }
    },
  };
}

/** True if the backpack has the axe and room for all the firewood from one log. */
function canSplitInto(backpack: Backpack): boolean {
  return hasInBackpack(backpack, "axe") && fitsInBackpack(backpack, "firewood", FIREWOOD_PER_LOG);
}
