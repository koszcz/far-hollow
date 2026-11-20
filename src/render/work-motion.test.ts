import { describe, expect, it } from "bun:test";
import type { BuildPose } from "./player-build-pose";
import { createWorkMotion } from "./work-motion";

/** A pose whose chest lean is how many seconds the motion has played, so tests can read the time back. */
const poseAfter = (seconds: number): BuildPose => ({
  hipsDrop: 0,
  hipsBack: 0,
  hipsLean: 0,
  chestLean: seconds,
  headTilt: 0,
  reach: 1,
  hands: { forward: 0.3, height: 1, spread: 0.1 },
});

const easingMotion = () => createWorkMotion<number>({ startOf: (now) => now, poseAt: (now, since) => poseAfter(now - since), leaveSeconds: 0.5 });

describe("a work motion", () => {
  it("starts on the first moment and keeps that start while it plays", () => {
    const motion = easingMotion();

    expect(motion.update(10, 100)).toEqual({ kind: "started" });
    expect(motion.update(12, 102)).toBeUndefined();
    expect(motion.since).toBe(10);
    expect(motion.pose()?.chestLean).toBe(2);
  });

  it("eases back to standing from the pose it stopped in", () => {
    const motion = easingMotion();
    motion.update(10, 100);
    motion.update(13, 103);

    expect(motion.update(undefined, 103.1)).toEqual({ kind: "stopped", leaving: { at: 103.1, pose: poseAfter(3), seconds: 0.5 } });
    expect(motion.pose()).toBeUndefined();
    expect(motion.since).toBeUndefined();
  });

  it("does nothing when stopped while it does not play", () => {
    expect(easingMotion().update(undefined, 100)).toBeUndefined();
  });

  it("stands the player straight up when it has no time to ease back", () => {
    const motion = createWorkMotion<number>({ startOf: (now) => now, poseAt: (now, since) => poseAfter(now - since) });
    motion.update(10, 100);

    expect(motion.update(undefined, 101)).toEqual({ kind: "stopped", leaving: undefined });
  });

  it("starts again from a new moment after it stopped", () => {
    const motion = easingMotion();
    motion.update(10, 100);
    motion.update(undefined, 101);

    expect(motion.update(20, 110)).toEqual({ kind: "started" });
    expect(motion.since).toBe(20);
  });
});
