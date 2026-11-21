import { describe, expect, it } from "bun:test";
import * as THREE from "three";
import { createSledDragMotion } from "./sled-drag-animation";
import { createTestRig } from "./test-rig";

describe("the sled-drag motion", () => {
  it("holds the rope in the left hand only while the player drags a sled", () => {
    const rig = createTestRig({ walkedMetres: 3 });
    const motion = createSledDragMotion(rig);
    expect(motion.ropeHold()).toBeUndefined();

    motion.update(true, 0);
    const hand = rig.leftArm.end.getWorldPosition(new THREE.Vector3());
    expect(motion.ropeHold()).toEqual({ hand: { x: hand.x, y: hand.y, z: hand.z }, walking: true });

    motion.update(undefined, 0);
    expect(motion.ropeHold()).toBeUndefined();
  });

  it("leaves the axe in the hand and never eases back to standing", () => {
    const motion = createSledDragMotion(createTestRig());
    expect(motion.axeOnBack).toBe(false);
    expect(motion.update(true, 0)).toEqual({ kind: "shown" });
    expect(motion.update(true, 1)).toBeUndefined();
    expect(motion.update(undefined, 2)).toEqual({ kind: "hidden" });
  });
});
