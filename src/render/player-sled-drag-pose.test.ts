import { describe, expect, it } from "bun:test";
import { SLED_DRAG_POSE } from "./player-sled-drag-pose";

describe("the sled drag animation", () => {
  it("leans the player forward from the hips, with the hips set back to balance", () => {
    expect(SLED_DRAG_POSE.hipsLean).toBeGreaterThan(0);
    expect(SLED_DRAG_POSE.chestLean).toBeGreaterThan(0);
    expect(SLED_DRAG_POSE.hipsBack).toBeGreaterThan(0);
  });

  it("holds the rope hand all the way up at the left shoulder", () => {
    expect(SLED_DRAG_POSE.reach).toBe(1);
    // The player faces +z, so the left is +x.
    expect(SLED_DRAG_POSE.hands.spread).toBeGreaterThan(0);
    // The left shoulder joint stands about 0.8 m above the feet.
    expect(SLED_DRAG_POSE.hands.height).toBeGreaterThan(0.7);
    expect(SLED_DRAG_POSE.rightHand).toBeUndefined();
  });
});
