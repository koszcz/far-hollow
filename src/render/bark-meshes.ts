// Draws bark lying on the ground: the ground form of the "bark" asset (approved) in asset-manifest.json.
// Bark lands on the ground when the player takes down a building piece and the backpack has no room for it.
// Each piece is a peeled strip, curved like the trunk it came off, with its outer bark dark and its inner face pale.
// One end rolls into a tight curl, like the bark's HUD icon. Each piece lies at its own steady turn, picked from its spot.
import * as THREE from "three";
import { barkEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import type { OutlinePart } from "./hover-outline";

/** The outer face of the bark, the same brown as the roof's bark strips. */
const OUTER_COLOUR = 0x5b3f2c;
/** The inner face, where the bark lay against the wood, is pale. */
const INNER_COLOUR = 0xa98256;
/** A strip is this long, along z, in metres. */
const STRIP_LENGTH_METRES = 0.4;
/** The strip curves round this radius, in metres: the trunk's own curve. */
const STRIP_RADIUS_METRES = 0.07;
/** The strip covers this share of a full circle, open at the top. */
const STRIP_WRAP = 0.6;
/** The curl at one end is this tight, in metres, and this long along z. */
const CURL_RADIUS_METRES = 0.03;
const CURL_LENGTH_METRES = 0.09;
/** The curl wraps round more than once. */
const CURL_WRAP = 0.95;
/** Clicks hit an invisible box this much wider and taller than the strip, so the small strip is easy to hit. */
const PICK_WIDTH_METRES = 0.3;
const PICK_HEIGHT_METRES = 0.2;

export interface BarkMeshes {
  readonly group: THREE.Group;
  /** Brings every piece of bark on the ground up to date with game state. */
  update(): void;
  /** What a ray from the camera hits first among pieces of bark on the ground, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: { kind: "bark"; entity: Entity }; distance: number } | undefined;
  /** The parts of a piece of bark, placed in the world. Empty once it is gone. */
  outlineOf(entity: Entity): OutlinePart[];
  dispose(): void;
}

interface Drawn {
  readonly root: THREE.Group;
  readonly parts: THREE.Mesh[];
  readonly picker: THREE.Mesh;
}

/**
 * Part of a hollow tube lying along z, open at the top, resting on y = 0.
 * `wrap` is the share of a full circle it covers. `z` moves its middle along its length.
 */
function curvedSheet(radius: number, length: number, wrap: number, z: number): THREE.BufferGeometry {
  const arc = Math.PI * 2 * Math.min(wrap, 1);
  // Theta runs round the tube's axis. After the turn below, theta = π is straight up, so the gap is centred there.
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 10, 1, true, Math.PI + (Math.PI * 2 - arc) / 2, arc);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, radius, z);
  return geometry;
}

/**
 * The strip and its curl, each drawn twice: once for the outer bark, once for the pale inner face.
 * The strip lies along z, centred on it, resting on y = 0, with the curl at +z. pile-meshes.ts reuses it for piles of bark.
 * Each call makes new geometry and materials. The caller disposes of them.
 */
export function barkParts(): { geometry: THREE.BufferGeometry; material: THREE.Material }[] {
  const strip = curvedSheet(STRIP_RADIUS_METRES, STRIP_LENGTH_METRES, STRIP_WRAP, 0);
  const curl = curvedSheet(CURL_RADIUS_METRES, CURL_LENGTH_METRES, CURL_WRAP, STRIP_LENGTH_METRES / 2 + CURL_LENGTH_METRES / 2 - 0.02);
  const outer = new THREE.MeshStandardMaterial({ color: OUTER_COLOUR, roughness: 0.95, flatShading: true, side: THREE.FrontSide });
  const inner = new THREE.MeshStandardMaterial({ color: INNER_COLOUR, roughness: 0.8, flatShading: true, side: THREE.BackSide });
  return [
    { geometry: strip, material: outer },
    { geometry: strip, material: inner },
    { geometry: curl, material: outer },
    { geometry: curl, material: inner },
  ];
}

/** A steady turn for a piece of bark at this spot, in radians, so pieces side by side do not all line up. */
function turnFor(spot: Vec3): number {
  const noise = Math.sin(spot.x * 12.9898 + spot.z * 78.233) * 43758.5453;
  return (noise - Math.floor(noise)) * Math.PI * 2;
}

export function createBarkMeshes(entities: EntityStore): BarkMeshes {
  const group = new THREE.Group();
  const parts = barkParts();
  const pickGeometry = new THREE.BoxGeometry(PICK_WIDTH_METRES, PICK_HEIGHT_METRES, STRIP_LENGTH_METRES + CURL_LENGTH_METRES);
  pickGeometry.translate(0, PICK_HEIGHT_METRES / 2, 0);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const lying = barkEntities(entities);
  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const hits: THREE.Intersection[] = [];

  function draw(entity: Entity & { position: Vec3 }): void {
    const known = drawn.get(entity);
    if (known !== undefined) {
      known.root.position.set(entity.position.x, entity.position.y, entity.position.z);
      return;
    }
    const root = new THREE.Group();
    const meshes = parts.map(({ geometry, material }) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      return mesh;
    });
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    root.position.set(entity.position.x, entity.position.y, entity.position.z);
    root.rotation.y = turnFor(entity.position);
    group.add(root);
    drawn.set(entity, { root, parts: meshes, picker });
  }

  return {
    group,
    update() {
      const seen = new Set<Entity>();
      for (const bark of lying) {
        draw(bark);
        seen.add(bark);
      }
      for (const [entity, item] of [...drawn]) {
        if (seen.has(entity)) continue;
        group.remove(item.root);
        pickers.splice(pickers.indexOf(item.picker), 1);
        drawn.delete(entity);
      }
    },
    pick(raycaster) {
      hits.length = 0;
      raycaster.intersectObjects(pickers, false, hits);
      hits.sort((a, b) => a.distance - b.distance);
      const first = hits[0];
      const entity = first?.object.userData.entity as Entity | undefined;
      if (first === undefined || entity?.bark !== true) return undefined;
      return { hit: { kind: "bark", entity }, distance: first.distance };
    },
    outlineOf(entity) {
      const item = drawn.get(entity);
      if (item === undefined) return [];
      item.root.updateMatrixWorld(true);
      // Each sheet is drawn twice, once per face. Outlining one of each is enough.
      return item.parts.filter((_, index) => index % 2 === 0).map((mesh) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    dispose() {
      for (const geometry of new Set(parts.map(({ geometry }) => geometry))) geometry.dispose();
      for (const material of new Set(parts.map(({ material }) => material))) material.dispose();
      pickGeometry.dispose();
      pickMaterial.dispose();
    },
  };
}
