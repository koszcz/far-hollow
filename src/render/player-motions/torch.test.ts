import { describe, expect, it } from "bun:test";
import * as THREE from "three";
import { createTestRig } from "./test-rig";
import { createTorchMotion } from "./torch";

describe("the lit torch in the hand", () => {
  it("has a flame above the left hand only while the player holds it lit", () => {
    const rig = createTestRig();
    rig.group.position.set(5, 2, -3);
    const torch = createTorchMotion(rig);
    const flame = { position: new THREE.Vector3(), aboveGroundMetres: 0 };
    expect(torch.torchFlame(flame)).toBe(false);

    torch.update(10, 0);
    torch.placeProps();
    expect(torch.torchFlame(flame)).toBe(true);
    const hand = rig.leftArm.end.getWorldPosition(new THREE.Vector3());
    expect(flame.position.y).toBeGreaterThan(hand.y);
    expect(flame.position.distanceTo(hand)).toBeLessThan(1);
    expect(flame.aboveGroundMetres).toBeCloseTo(flame.position.y - 2);

    torch.update(undefined, 0);
    expect(torch.torchFlame(flame)).toBe(false);
    torch.dispose();
  });

  it("is an overlay that leaves the axe in the hand", () => {
    const torch = createTorchMotion(createTestRig());
    expect(torch.layer).toBe("overlay");
    expect(torch.pose).toBeUndefined();
    expect(torch.axeOnBack).toBe(false);
    torch.dispose();
  });
});
