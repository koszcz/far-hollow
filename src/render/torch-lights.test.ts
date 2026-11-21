import { describe, expect, it } from "bun:test";
import * as THREE from "three";
import { TORCH_LIGHT_METRES } from "../sim/api";
import { createTorchLights } from "./torch-lights";

const flame = { position: new THREE.Vector3(3, 1.6, -2), seed: 0 };

function pointLights(group: THREE.Group): THREE.PointLight[] {
  return group.children.filter((child): child is THREE.PointLight => child instanceof THREE.PointLight);
}

describe("the torch lights", () => {
  it("keep the same lights in the scene whether a torch is lit or not, dark when none is", () => {
    const lights = createTorchLights();
    const before = pointLights(lights.group);
    lights.update([], 0);
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((light) => light.intensity === 0)).toBe(true);

    lights.update([flame], 1);
    expect(pointLights(lights.group)).toEqual(before);
    expect(before[0]?.intensity).toBeGreaterThan(0);
    expect(before[0]?.position.toArray()).toEqual([3, 1.6, -2]);

    lights.update([], 2);
    expect(pointLights(lights.group)).toEqual(before);
    expect(before.every((light) => light.intensity === 0)).toBe(true);
  });

  it("light the ground about 6 m around the flame, and cast no shadows", () => {
    const lights = createTorchLights();
    lights.update([flame], 0);
    const [light] = pointLights(lights.group);

    expect(TORCH_LIGHT_METRES).toBe(6);
    // The light reaches the ground TORCH_LIGHT_METRES from the spot under the flame.
    expect(Math.sqrt((light?.distance ?? 0) ** 2 - flame.position.y ** 2)).toBeCloseTo(TORCH_LIGHT_METRES, 1);
    expect(light?.castShadow).toBe(false);
  });
});
