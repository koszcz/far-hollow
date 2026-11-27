import * as THREE from "three";

const BEANIE_COLOUR = 0xb08a5e;
const BEANIE_CUFF_COLOUR = 0x96714a;

/**
 * A knit beanie with a folded cuff and a bobble, sized to the head and standing where it should sit on the posed `model`.
 * The caller adds it to the group and fixes it to the head bone. `material` makes each paint, and `geometries` collects the
 * shapes the caller must dispose.
 */
export function createBeanie(
  model: THREE.Object3D,
  head: THREE.Object3D,
  material: (color: THREE.ColorRepresentation) => THREE.Material,
  geometries: THREE.BufferGeometry[],
): THREE.Group {
  const box = new THREE.Box3().setFromObject(head, true);
  const size = box.getSize(new THREE.Vector3());
  const middle = box.getCenter(new THREE.Vector3());
  // The skinned head's own box stops short of the crown, so take the crown from the whole posed model.
  const crown = new THREE.Box3().setFromObject(model, true).max.y;
  const radius = (Math.max(size.x, size.z) / 2) * 0.86;
  const knit = material(BEANIE_COLOUR);
  const beanie = new THREE.Group();
  const domeShape = new THREE.SphereGeometry(radius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const cuffShape = new THREE.CylinderGeometry(radius * 1.04, radius * 1.04, radius * 0.32, 24);
  const bobbleShape = new THREE.SphereGeometry(radius * 0.2, 12, 8);
  geometries.push(domeShape, cuffShape, bobbleShape);
  const dome = new THREE.Mesh(domeShape, knit);
  dome.scale.set(1, 0.85, 1);
  const cuff = new THREE.Mesh(cuffShape, material(BEANIE_CUFF_COLOUR));
  cuff.position.y = radius * 0.1;
  const bobble = new THREE.Mesh(bobbleShape, knit);
  bobble.position.y = radius * 0.9;
  for (const part of [dome, cuff, bobble]) {
    part.castShadow = true;
    beanie.add(part);
  }
  // The cuff sits across the forehead, just above the brows. The box was measured from the group, so place it there first.
  beanie.position.set(middle.x, crown - radius * 1.05, middle.z);
  return beanie;
}
