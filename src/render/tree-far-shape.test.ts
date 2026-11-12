import { describe, expect, it } from "bun:test";
import * as THREE from "three";
import { createFarTreeShape } from "./tree-far-shape";

/** A stand-in for a loaded tree: a detailed cone crown on a detailed cylinder trunk. */
function detailedTree(): { trunk: THREE.BufferGeometry; crown: THREE.BufferGeometry } {
  const trunk = new THREE.CylinderGeometry(0.2, 0.3, 2, 32, 8).translate(0, 1, 0);
  const crown = new THREE.ConeGeometry(1.5, 6, 32, 16).translate(0, 5, 0);
  return { trunk, crown };
}

function size(geometry: THREE.BufferGeometry): THREE.Vector3 {
  geometry.computeBoundingBox();
  return geometry.boundingBox?.getSize(new THREE.Vector3()) ?? new THREE.Vector3();
}

describe("createFarTreeShape", () => {
  it("draws the tree with far fewer points", () => {
    const tree = detailedTree();
    const far = createFarTreeShape(tree);
    expect(far.crown.getAttribute("position").count).toBeLessThan(tree.crown.getAttribute("position").count / 5);
    expect(far.trunk.getAttribute("position").count).toBeLessThan(tree.trunk.getAttribute("position").count / 5);
  });

  it("keeps the crown about as tall and wide as the real one", () => {
    const tree = detailedTree();
    const real = size(tree.crown);
    const cheap = size(createFarTreeShape(tree).crown);
    expect(cheap.y).toBeCloseTo(real.y, 1);
    expect(cheap.x).toBeGreaterThan(real.x * 0.75);
    expect(cheap.x).toBeLessThanOrEqual(real.x * 1.01);
  });

  it("makes the trunk as wide as the real trunk's foot, reaching from the ground a little into the crown", () => {
    const tree = detailedTree();
    tree.crown.computeBoundingBox();
    const trunk = createFarTreeShape(tree).trunk;
    trunk.computeBoundingBox();
    const box = trunk.boundingBox ?? new THREE.Box3();
    expect(box.min.y).toBeCloseTo(0, 2);
    // The crown spans 2 m to 8 m, so a quarter of the way up is 3.5 m.
    expect(box.max.y).toBeCloseTo(3.5, 2);
    // The real foot is 0.3 m across from its middle. Seven sides reach a little less than that across the flats.
    expect(size(trunk).x).toBeGreaterThan(0.5);
    expect(size(trunk).x).toBeLessThanOrEqual(0.61);
  });
});
