import * as THREE from "three";
import { describe, expect, it } from "bun:test";
import { generateValley } from "../sim/valley";
import { createRiverMeshes } from "./river-meshes";

const valley = generateValley(42);

/** The river's water: its see-through mesh. The pebble banks are solid. */
function waterOf(group: THREE.Group): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  for (const child of group.children) {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial && child.material.transparent) {
      return child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    }
  }
  throw new Error("no water mesh");
}

/** The heights of the water surface's corners. */
function waterHeights(group: THREE.Group): number[] {
  const positions = waterOf(group).geometry.getAttribute("position");
  return Array.from({ length: positions.count }, (_, corner) => positions.getY(corner));
}

function waterColour(group: THREE.Group): THREE.Color {
  return waterOf(group).material.color;
}

describe("the river", () => {
  it("ripples while it flows", () => {
    const river = createRiverMeshes(valley);
    river.update(1, 1);
    const before = waterHeights(river.group);
    river.update(3, 1);
    expect(waterHeights(river.group)).not.toEqual(before);
    river.dispose();
  });

  it("is still and pale while frozen", () => {
    const river = createRiverMeshes(valley);
    const flowing = waterColour(river.group).clone();
    river.setFrozen(true);
    river.update(1, 1);
    const before = waterHeights(river.group);
    river.update(3, 1);
    expect(waterHeights(river.group)).toEqual(before);
    const ice = waterColour(river.group);
    const brightness = (colour: THREE.Color) => colour.r + colour.g + colour.b;
    expect(brightness(ice)).toBeGreaterThan(brightness(flowing) * 1.5);
    river.dispose();
  });

  it("flows again once it thaws", () => {
    const river = createRiverMeshes(valley);
    const flowing = waterColour(river.group).getHex();
    river.setFrozen(true);
    river.update(1, 1);
    river.setFrozen(false);
    river.update(2, 1);
    const before = waterHeights(river.group);
    river.update(4, 1);
    expect(waterHeights(river.group)).not.toEqual(before);
    expect(waterColour(river.group).getHex()).toBe(flowing);
    river.dispose();
  });
});
