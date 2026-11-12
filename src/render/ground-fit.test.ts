import { describe, expect, it } from "bun:test";
import * as THREE from "three";
import { fitToGround } from "./ground-fit";

/** Where a point of the thing, given relative to its pivot, ends up once it is laid with this fit. */
function laid(fit: ReturnType<typeof fitToGround>, spot: { x: number; z: number }, local: THREE.Vector3): THREE.Vector3 {
  return local
    .clone()
    .applyQuaternion(fit.tilt)
    .add(new THREE.Vector3(spot.x, fit.y, spot.z));
}

describe("laying a flat thing on the ground", () => {
  it("lies flat at the ground height on flat ground", () => {
    const fit = fitToGround(() => 2, { x: 5, y: 2, z: 5 }, 0.35, 0.95);
    expect(fit.y).toBeCloseTo(2);
    expect(fit.tilt.angleTo(new THREE.Quaternion())).toBeCloseTo(0);
  });

  it("tilts to a slope so both ends rest on the ground", () => {
    const groundAt = (_x: number, z: number) => 0.4 * z;
    const spot = { x: 0, y: 0, z: 0 };
    const fit = fitToGround(groundAt, spot, 0.35, 0.95);
    for (const end of [-0.95, 0.95]) {
      const point = laid(fit, spot, new THREE.Vector3(0, 0, end));
      expect(point.y).toBeCloseTo(groundAt(point.x, point.z), 2);
    }
  });

  it("follows the slope after a turn about the vertical", () => {
    const groundAt = (x: number) => 0.3 * x;
    const spot = { x: 0, y: 0, z: 0 };
    const fit = fitToGround(groundAt, spot, 0.5, 0.5, Math.PI / 4);
    const downhill = laid(fit, spot, new THREE.Vector3(-0.5, 0, 0));
    expect(downhill.y).toBeCloseTo(groundAt(downhill.x), 2);
  });

  it("lifts above a bump so the middle is not buried", () => {
    const groundAt = (x: number, z: number) => Math.max(0, 0.2 - Math.hypot(x, z) * 0.3);
    const fit = fitToGround(groundAt, { x: 0, y: 0.2, z: 0 }, 0.5, 0.5);
    expect(fit.y).toBeGreaterThanOrEqual(0.2 - 1e-9);
  });

  it("stays flat at its own height on a foundation deck", () => {
    const fit = fitToGround((_x, z) => 0.4 * z, { x: 0, y: 1, z: 0 }, 0.35, 0.95);
    expect(fit.y).toBe(1);
    expect(fit.tilt.angleTo(new THREE.Quaternion())).toBeCloseTo(0);
  });
});
