import { describe, expect, it } from "bun:test";
import * as THREE from "three";
import { TORCH_LIGHT_METRES } from "../sim/api";
import { createTorchLights, type TorchFlame } from "./torch-lights";

const flame = { position: new THREE.Vector3(3, 1.6, -2), seed: 0, aboveGroundMetres: 1.6 };
const camera = new THREE.Vector3(0, 10, 0);

function pointLights(group: THREE.Group): THREE.PointLight[] {
  return group.children.filter((child): child is THREE.PointLight => child instanceof THREE.PointLight);
}

/** Where each lit light stands, as [x, z], sorted from west to east. */
function litSpots(group: THREE.Group): number[][] {
  return pointLights(group)
    .filter((light) => light.intensity > 0)
    .map((light) => [light.position.x, light.position.z])
    .sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0));
}

/** A planted torch's flame at x along the ground, half a metre up. */
function plantedAt(x: number): TorchFlame {
  return { position: new THREE.Vector3(x, 0.5, 0), seed: x, aboveGroundMetres: 0.5 };
}

describe("the torch lights", () => {
  it("keep the same lights in the scene whether a torch is lit or not, dark when none is", () => {
    const lights = createTorchLights();
    const before = pointLights(lights.group);
    lights.update(undefined, [], camera, 0);
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((light) => light.intensity === 0)).toBe(true);

    lights.update(flame, [], camera, 1);
    expect(pointLights(lights.group)).toEqual(before);
    expect(before[0]?.intensity).toBeGreaterThan(0);
    expect(before[0]?.position.toArray()).toEqual([3, 1.6, -2]);

    lights.update(undefined, [], camera, 2);
    expect(pointLights(lights.group)).toEqual(before);
    expect(before.every((light) => light.intensity === 0)).toBe(true);
  });

  it("light the ground about 6 m around the flame, and cast no shadows", () => {
    const lights = createTorchLights();
    lights.update(flame, [], camera, 0);
    const [light] = pointLights(lights.group);

    expect(TORCH_LIGHT_METRES).toBe(6);
    // The light reaches the ground TORCH_LIGHT_METRES from the spot under the flame.
    expect(Math.sqrt((light?.distance ?? 0) ** 2 - flame.position.y ** 2)).toBeCloseTo(TORCH_LIGHT_METRES, 1);
    expect(light?.castShadow).toBe(false);
  });

  it("light the ground about 6 m around a planted torch's flame too, though it stands lower than one in hand", () => {
    const lights = createTorchLights();
    // The planted torch stands on a deck 2 m above the valley floor, so its flame is 2.5 m up but 0.5 m above where it stands.
    const planted = { position: new THREE.Vector3(1, 2.5, 0), seed: 0, aboveGroundMetres: 0.5 };
    lights.update(undefined, [planted], camera, 0);
    const [light] = pointLights(lights.group);

    expect(Math.sqrt((light?.distance ?? 0) ** 2 - 0.5 ** 2)).toBeCloseTo(TORCH_LIGHT_METRES, 1);
  });

  it("give the first light to the torch in hand, then the planted torches from nearest the camera outwards", () => {
    const lights = createTorchLights();
    const hand = { position: new THREE.Vector3(-40, 1.6, 0), seed: 0, aboveGroundMetres: 1.6 };

    lights.update(hand, [8, 3, -9, 1, -2].map(plantedAt), camera, 0);

    expect(pointLights(lights.group).map((light) => light.position.x)).toEqual([-40, 1, -2, 3]);
  });

  it("with 6 torches lit, light only 4: the one in hand, then the 3 planted nearest the camera", () => {
    const lights = createTorchLights();
    const hand = { position: new THREE.Vector3(-40, 1.6, 0), seed: 0, aboveGroundMetres: 1.6 };
    // The camera is at x = 0, so the planted torches at 1, -2, and 3 are nearest it, and those at 8 and -9 are not.
    const planted = [8, 3, -9, 1, -2].map(plantedAt);

    lights.update(hand, planted, camera, 0);

    expect(litSpots(lights.group)).toEqual([
      [-40, 0],
      [-2, 0],
      [1, 0],
      [3, 0],
    ]);
  });

  it("with no torch in hand, light the 4 planted torches nearest the camera", () => {
    const lights = createTorchLights();

    lights.update(undefined, [8, 3, -9, 1, -2].map(plantedAt), camera, 0);

    expect(litSpots(lights.group)).toEqual([
      [-2, 0],
      [1, 0],
      [3, 0],
      [8, 0],
    ]);
  });

  it("never add or remove a light as torches are planted and picked up", () => {
    const lights = createTorchLights();
    const before = pointLights(lights.group);
    for (const count of [0, 1, 3, 4, 5, 20, 2, 0]) {
      lights.update(
        count % 2 === 0 ? flame : undefined,
        Array.from({ length: count }, (_, i) => plantedAt(i * 2)),
        camera,
        count,
      );
      expect(pointLights(lights.group)).toEqual(before);
    }
    expect(before).toHaveLength(4);
  });
});
