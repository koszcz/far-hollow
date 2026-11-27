// The player's reach: they bend or reach out with their hands to pick something up or put something down.
// A command that hands a thing over does not happen at once. Its system calls `start` once the player stands
// within reach, and the hand reach carries the command out when the hand gets to the thing, HAND_AT_SECONDS in.
// A new command before then cancels the reach, and the command is never carried out.
// The reach is not saved, so a game loaded from a save made mid-reach has the command either done or not done.
import type { Activity } from "./activity";
import type { Notice, PlainNotice } from "./api-notice";
import { setComponent, type EntityStore, type ReachHeight, type ReachingFor } from "./entities";
import { playerEntities } from "./entity-queries";
import { copyToward, type GroundPoint } from "./ground-point";

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
   * `reachingFor` says what the hand takes, for drawing, such as berries from a bush. It changes no rule.
   */
  start(height: ReachHeight, toward: GroundPoint | undefined, act?: HandAct, reachingFor?: ReachingFor): void;
  /** Whether the player is reaching now. */
  busy(): boolean;
}

export function createHandReach(entities: EntityStore): HandReach {
  const players = playerEntities(entities);
  /** What the hand does when it gets to the thing. Undefined once it has run, or if the reach has nothing to do. */
  let act: HandAct | undefined;

  function stop(): void {
    act = undefined;
    for (const player of players) entities.removeComponent(player, "handReach");
  }

  function start(height: ReachHeight, toward: GroundPoint | undefined, then?: HandAct, reachingFor?: ReachingFor): void {
    stop();
    act = then;
    for (const player of players) {
      entities.removeComponent(player, "walkPath");
      setComponent(entities, player, "handReach", {
        height,
        seconds: 0,
        ...copyToward(toward),
        ...(reachingFor === undefined ? {} : { reachingFor }),
      });
    }
  }

  return {
    start,
    busy() {
      return players.entities.some((player) => player.handReach !== undefined);
    },
    cancel: stop,
    step(playerSeconds) {
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

/** Starts the player reaching down to put something at their feet. `put` runs when the hand gets to the ground. */
export function putDown(hand: Pick<HandReach, "start">, put: () => void): void {
  hand.start("low", undefined, () => {
    put();
    return undefined;
  });
}

/** Reaches toward a thing the player stands beside, such as a campfire they came to tend or a chest they open. The reach carries nothing out. */
export function reachToward(hand: Pick<HandReach, "start">, entities: EntityStore, height: ReachHeight, thingId: number): void {
  hand.start(height, entities.entity(thingId)?.position);
}
