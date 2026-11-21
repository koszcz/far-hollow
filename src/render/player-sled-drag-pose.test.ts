import { describe, expect, it } from "bun:test";
import { SLED_DRAG_POSE, SLED_HEAVE_PEAK_SHARE, sledDragPoseAt } from "./player-sled-drag-pose";

describe("the sled drag animation", () => {
  it("leans the player forward into the pull", () => {
    expect(SLED_DRAG_POSE.hipsLean).toBeGreaterThan(0);
    expect(SLED_DRAG_POSE.chestLean).toBeGreaterThan(0);
  });

  it("holds the rope in the left hand, low behind the left hip", () => {
    expect(SLED_DRAG_POSE.reach).toBe(1);
    // The player faces +z, so the left is +x and behind is -z.
    expect(SLED_DRAG_POSE.hands.spread).toBeGreaterThan(0);
    expect(SLED_DRAG_POSE.hands.forward).toBeLessThan(0);
    expect(SLED_DRAG_POSE.hands.height).toBeLessThan(0.6);
    expect(SLED_DRAG_POSE.rightHand).toBeUndefined();
  });

  it("stands in the plain lean while still", () => {
    expect(sledDragPoseAt(undefined)).toEqual(SLED_DRAG_POSE);
  });

  it("heaves deeper into the pull at each push-off, and matches at the seam between steps", () => {
    const heave = sledDragPoseAt(3 + SLED_HEAVE_PEAK_SHARE);
    expect(heave.chestLean).toBeGreaterThan(SLED_DRAG_POSE.chestLean);
    expect(sledDragPoseAt(4 - 1e-9).chestLean).toBeCloseTo(sledDragPoseAt(4).chestLean, 6);
  });
});
