import { describe, expect, it } from "bun:test";
import { createPlayerMotions, PLAYER_MOTIONS, type MotionId, type MotionMoment } from "./motion-list";
import type { PlayerMotion } from "./player-motion";
import { createTestRig } from "./test-rig";

/** A moment for each motion, a little way into it. */
const MOMENTS: { readonly [Id in MotionId]: MotionMoment<Id> } = {
  "player-build-animation": 1,
  "debarking-animation": 1,
  "sawing-animation": { nowSeconds: 1, progress: 0.2 },
  "hand-craft-animation": 1,
  "fishing-animation": { nowSeconds: 3, sinceCast: 3, toBite: 1, floatForward: 4, floatHeight: -0.5 },
  "gather-stone-animation": 1,
};

describe("the player motions", () => {
  it("names every motion posed in code, in the order body motions win", () => {
    expect(Object.keys(PLAYER_MOTIONS)).toEqual([
      "player-build-animation",
      "debarking-animation",
      "sawing-animation",
      "hand-craft-animation",
      "fishing-animation",
      "gather-stone-animation",
    ]);
  });

  it("puts the axe on the back for every motion", () => {
    const motions = createPlayerMotions(createTestRig());
    const onBack = Object.fromEntries(Object.entries(motions).map(([id, motion]) => [id, motion.axeOnBack]));
    expect(onBack).toEqual({
      "player-build-animation": true,
      "debarking-animation": true,
      "sawing-animation": true,
      "hand-craft-animation": true,
      "fishing-animation": true,
      "gather-stone-animation": true,
    });
  });

  it("plays from its first moment until it is given none, and has a pose unless it is an overlay", () => {
    const motions = createPlayerMotions(createTestRig());
    for (const id of Object.keys(PLAYER_MOTIONS) as MotionId[]) {
      const motion: PlayerMotion<unknown> = motions[id];
      expect(motion.playing).toBe(false);
      motion.update(MOMENTS[id], 0);
      expect(motion.playing).toBe(true);
      expect(motion.pose === undefined).toBe(motion.layer === "overlay");
      motion.pose?.();
      motion.placeProps();
      motion.update(undefined, 0);
      expect(motion.playing).toBe(false);
      motion.dispose();
    }
  });
});
