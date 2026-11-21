import { describe, expect, it } from "bun:test";
import { createHandCraftMotion } from "./hand-craft-animation";
import { createTestRig } from "./test-rig";

describe("the hand-craft motion", () => {
  it("stands the player straight back up the moment crafting stops", () => {
    const motion = createHandCraftMotion(createTestRig());
    motion.update(10, 100);
    motion.update(13, 103);

    expect(motion.update(undefined, 103.1)).toEqual({ kind: "stopped", leaving: undefined });
    expect(motion.playing).toBe(false);
  });
});
