import { describe, expect, it } from "bun:test";
import * as THREE from "three";
import { createHoverOutline } from "./hover-outline";

const outlineMeshes = (scene: THREE.Scene): THREE.Mesh[] => scene.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);

describe("the hover outline", () => {
  it("skips a part with no shape, such as a roof frame stage that has nothing built yet, and outlines the rest", () => {
    const scene = new THREE.Scene();
    const outline = createHoverOutline(scene);
    const box = new THREE.BoxGeometry(1, 1, 1);

    expect(() => {
      outline.show([
        { geometry: new THREE.BufferGeometry(), matrix: new THREE.Matrix4() },
        { geometry: box, matrix: new THREE.Matrix4() },
      ]);
    }).not.toThrow();

    const shown = outlineMeshes(scene).filter((mesh) => mesh.visible);
    expect(shown).toHaveLength(1);
    expect(shown[0]?.geometry.hasAttribute("position")).toBe(true);
  });
});
