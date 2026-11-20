// A work motion posed in code over the clip, such as building, debarking, sawing, fishing, or crafting by hand.
// It starts when drawing first passes it a moment, keeps that start time while it plays, and when it stops it either
// eases back to standing from the pose it stopped in, or stands the player straight back up.
import type { BuildPose } from "./player-build-pose";

/** Standing back up after a work motion stops: when it stopped, on the performance clock in seconds, the pose then, and how many seconds standing up takes. */
export interface Leaving {
  readonly at: number;
  readonly pose: BuildPose;
  readonly seconds: number;
}

/** What one update did: started the motion, stopped it, with how the player stands back up if they ease up, or neither. */
export type WorkChange = { readonly kind: "started" } | { readonly kind: "stopped"; readonly leaving: Leaving | undefined } | undefined;

export interface WorkMotion<At> {
  /** When the motion began, on the clock its moments use, or undefined while it does not play. */
  readonly since: number | undefined;
  /** The latest moment passed to `update` while it played. It stays after the motion stops. */
  readonly at: At | undefined;
  /** The pose now, or undefined while the motion does not play. */
  pose(): BuildPose | undefined;
  /** Moves the motion on to the moment `at`, or stops it when `at` is undefined. `now` is the performance clock, in seconds. */
  update(at: At | undefined, now: number): WorkChange;
}

/**
 * A work motion. `startOf` gives the clock time of a moment, `poseAt` gives the pose at a moment of a motion that began
 * at `since`, and `leaveSeconds` is how long standing back up takes once it stops. Without it, the player stands up at once.
 */
export function createWorkMotion<At>(options: {
  startOf: (at: At) => number;
  poseAt: (at: At, since: number) => BuildPose;
  leaveSeconds?: number;
}): WorkMotion<At> {
  let since: number | undefined;
  let latest: At | undefined;
  const poseNow = (): BuildPose | undefined => (since === undefined || latest === undefined ? undefined : options.poseAt(latest, since));
  return {
    get since() {
      return since;
    },
    get at() {
      return latest;
    },
    pose: poseNow,
    update(at, now) {
      if (at === undefined) {
        if (since === undefined) return undefined;
        const pose = poseNow();
        since = undefined;
        const { leaveSeconds } = options;
        return { kind: "stopped", leaving: pose === undefined || leaveSeconds === undefined ? undefined : { at: now, pose, seconds: leaveSeconds } };
      }
      latest = at;
      if (since !== undefined) return undefined;
      since = options.startOf(at);
      return { kind: "started" };
    },
  };
}
