// The player's reach: they bend or reach out with their hands to pick something up or put something down.
// A command that hands a thing over does not happen at once. Its system calls `start` once the player stands
// within reach, and the hand reach carries the command out when the hand gets to the thing, HAND_AT_SECONDS in.
// A new command before then cancels the reach, and the command is never carried out.
// The reach is not saved, so a game loaded from a save made mid-reach has the command either done or not done.
import type { Activity } from "./activity";
import type { Notice, PlainNotice } from "./api";
import { playerEntities, setComponent, type EntityStore, type ReachHeight } from "./entities";
import type { GroundPoint } from "./valley";

/** How long the whole reach takes, from standing to standing again, in seconds. */
export const REACH_SECONDS = 0.9;
/** How far into the reach the hand gets to the thing, in seconds. The command is carried out then. */
export const HAND_AT_SECONDS = 0.4;

/** What the hand does when it gets to the thing. It may return a notice, such as a full backpack. */
export type HandAct = () => Notice | PlainNotice | undefined;

export interface HandReach extends Activity {
  /**
   * Stops the player and starts them reaching, to the ground or at waist height, toward `toward` if given.
   * `act` runs when the hand gets to the thing, unless something cancels the reach first.
   */
  start(height: ReachHeight, toward: GroundPoint | undefined, act?: HandAct): void;
  /**
   * Starts the reach once the player stops walking, for a command that only walks the player to a thing,
   * such as opening a chest. `toward` gives the thing's middle.
   */
  startOnArrival(height: ReachHeight, toward: GroundPoint): void;
  /** Whether the player is reaching now, or waiting to reach once they stop walking. */
  busy(): boolean;
}

export function createHandReach(entities: EntityStore): HandReach {
  const players = playerEntities(entities);
  /** What the hand does when it gets to the thing. Undefined once it has run, or if the reach has nothing to do. */
  let act: HandAct | undefined;
  /** A reach to start when the player stops walking. */
  let onArrival: { height: ReachHeight; toward: GroundPoint } | undefined;

  function stop(): void {
    act = undefined;
    onArrival = undefined;
    for (const player of players) entities.removeComponent(player, "handReach");
  }

  function start(height: ReachHeight, toward: GroundPoint | undefined, then?: HandAct): void {
    stop();
    act = then;
    for (const player of players) {
      entities.removeComponent(player, "walkPath");
      setComponent(entities, player, "handReach", { height, seconds: 0, ...(toward === undefined ? {} : { toward: { x: toward.x, z: toward.z } }) });
    }
  }

  return {
    start,
    startOnArrival(height, toward) {
      stop();
      onArrival = { height, toward: { x: toward.x, z: toward.z } };
    },
    busy() {
      return onArrival !== undefined || players.entities.some((player) => player.handReach !== undefined);
    },
    cancel: stop,
    step(playerSeconds) {
      if (onArrival !== undefined && players.entities.every((player) => player.walkPath === undefined)) {
        start(onArrival.height, onArrival.toward);
      }
      let notice: Notice | PlainNotice | undefined;
      for (const player of players) {
        const reach = player.handReach;
        if (reach === undefined) continue;
        reach.seconds += playerSeconds;
        if (act !== undefined && reach.seconds >= HAND_AT_SECONDS) {
          const now = act;
          act = undefined;
          notice = now();
        }
        if (reach.seconds >= REACH_SECONDS) entities.removeComponent(player, "handReach");
      }
      return notice;
    },
  };
}
