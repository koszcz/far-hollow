import { describe, expect, it } from "bun:test";
import * as THREE from "three";
import { createFarTreeShape } from "./tree-far-shape";

/** A stand-in for a loaded tree: a detailed cone crown on a detailed cylinder trunk. */
function detailedTree(): {
  trunk: THREE.BufferGeometry;
  crown: THREE.BufferGeometry;
} {
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

describe("createFarTreeShape with a tiered crown", () => {
  it("keeps the notch between two tiers", () => {
    const lower = new THREE.ConeGeometry(1.5, 3, 32, 8).translate(0, 3.5, 0);
    const upper = new THREE.ConeGeometry(1.2, 3, 32, 8).translate(0, 5.5, 0);
    const crown = new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute([...lower.toNonIndexed().getAttribute("position").array, ...upper.toNonIndexed().getAttribute("position").array], 3),
    );
    const trunk = new THREE.CylinderGeometry(0.2, 0.3, 2, 32, 8).translate(0, 1, 0);
    const position = createFarTreeShape({ trunk, crown }).crown.getAttribute("position");
    // The lower tier spans 2 m to 5 m and the upper tier 4 m to 7 m. Just under 4 m the lower tier has narrowed to
    // about 0.55 m. Just over 4 m the upper tier is about 1.1 m wide. The far outline must keep that step.
    const points = Array.from({ length: position.count }, (_, index) => ({
      y: position.getY(index),
      reach: Math.hypot(position.getX(index), position.getZ(index)),
    }));
    expect(points.some(({ y, reach }) => y > 3.4 && y < 4 && reach < 0.8)).toBe(true);
    expect(points.some(({ y, reach }) => y > 4 && y < 4.6 && reach > 0.95)).toBe(true);
    expect(position.count).toBeLessThan(200);
  });
});

describe("createFarTreeShape with a trunk and crown sharing one list of points", () => {
  it("measures each part by its own points, so the trunk reaches into the crown", () => {
    // trees.glb stores both parts in one list of points. Each part's index names the points it uses.
    const trunkPart = new THREE.CylinderGeometry(0.2, 0.3, 4, 8, 1).translate(0, 2, 0);
    const crownPart = new THREE.ConeGeometry(1.5, 4, 8, 1).translate(0, 6, 0);
    const points = [...trunkPart.getAttribute("position").array, ...crownPart.getAttribute("position").array];
    const shared = new THREE.Float32BufferAttribute(points, 3);
    const offset = trunkPart.getAttribute("position").count;
    const trunk = new THREE.BufferGeometry().setAttribute("position", shared);
    trunk.setIndex(Array.from(trunkPart.getIndex()?.array ?? []));
    const crown = new THREE.BufferGeometry().setAttribute("position", shared);
    crown.setIndex(Array.from(crownPart.getIndex()?.array ?? [], (at) => at + offset));
    const far = createFarTreeShape({ trunk, crown });
    far.trunk.computeBoundingBox();
    far.crown.computeBoundingBox();
    // The crown spans 4 m to 8 m, so the trunk reaches a quarter of the way in, to 5 m.
    expect(far.crown.boundingBox?.min.y).toBeCloseTo(4, 1);
    expect(far.trunk.boundingBox?.max.y).toBeCloseTo(5, 1);
  });
});
