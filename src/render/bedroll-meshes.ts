// Draws bedrolls laid on the ground with the code-built "bedroll" (draft) in asset-manifest.json.
// The draft is cheap on purpose: a flat green canvas mat with a rolled-up blanket at its head end.
import * as THREE from "three";
import { bedrollEntities, type Entity, type EntityStore } from "../sim/entities";
import type { OutlinePart } from "./hover-outline";

const MAT_COLOUR = 0x4f6b3a;
const ROLL_COLOUR = 0x8a3b2e;
const MAT_LENGTH_METRES = 1.9;
const MAT_WIDTH_METRES = 0.7;
const MAT_THICKNESS_METRES = 0.04;
const ROLL_RADIUS_METRES = 0.09;
/** Clicks on a bedroll hit an invisible box this much taller than the mat, so the flat mat is easy to hit. */
const PICK_HEIGHT_METRES = 0.3;

export interface BedrollMeshes {
  readonly group: THREE.Group;
  /** Brings every laid bedroll up to date with game state. */
  update(): void;
  /** What a ray from the camera hits first among bedrolls, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: { kind: "bedroll"; entity: Entity }; distance: number } | undefined;
  /** The mat and roll of a bedroll, placed in the world. Empty once it is gone. */
  outlineOf(entity: Entity): OutlinePart[];
  dispose(): void;
}

interface Drawn {
  readonly root: THREE.Group;
  readonly parts: THREE.Mesh[];
  readonly picker: THREE.Mesh;
}

export function createBedrollMeshes(entities: EntityStore): BedrollMeshes {
  const group = new THREE.Group();
  const matGeometry = new THREE.BoxGeometry(MAT_WIDTH_METRES, MAT_THICKNESS_METRES, MAT_LENGTH_METRES);
  matGeometry.translate(0, MAT_THICKNESS_METRES / 2, 0);
  const rollGeometry = new THREE.CylinderGeometry(ROLL_RADIUS_METRES, ROLL_RADIUS_METRES, MAT_WIDTH_METRES * 0.95, 10);
  rollGeometry.rotateZ(Math.PI / 2);
  rollGeometry.translate(0, MAT_THICKNESS_METRES + ROLL_RADIUS_METRES * 0.8, -MAT_LENGTH_METRES / 2 + ROLL_RADIUS_METRES * 1.5);
  const pickGeometry = new THREE.BoxGeometry(MAT_WIDTH_METRES, PICK_HEIGHT_METRES, MAT_LENGTH_METRES);
  pickGeometry.translate(0, PICK_HEIGHT_METRES / 2, 0);
  const matMaterial = new THREE.MeshStandardMaterial({ color: MAT_COLOUR, flatShading: true });
  const rollMaterial = new THREE.MeshStandardMaterial({ color: ROLL_COLOUR, flatShading: true });
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const bedrolls = bedrollEntities(entities);
  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const hits: THREE.Intersection[] = [];

  function draw(entity: Entity & { position: { x: number; y: number; z: number } }): void {
    if (drawn.has(entity)) return;
    const root = new THREE.Group();
    const mat = new THREE.Mesh(matGeometry, matMaterial);
    const roll = new THREE.Mesh(rollGeometry, rollMaterial);
    for (const part of [mat, roll]) {
      part.castShadow = true;
      part.receiveShadow = true;
      root.add(part);
    }
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    root.position.set(entity.position.x, entity.position.y, entity.position.z);
    group.add(root);
    drawn.set(entity, { root, parts: [mat, roll], picker });
  }

  return {
    group,
    update() {
      const seen = new Set<Entity>();
      for (const bedroll of bedrolls) {
        draw(bedroll);
        seen.add(bedroll);
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
      if (first === undefined || entity?.bedroll !== true) return undefined;
      return { hit: { kind: "bedroll", entity }, distance: first.distance };
    },
    outlineOf(entity) {
      const item = drawn.get(entity);
      if (item === undefined) return [];
      item.root.updateMatrixWorld(true);
      return item.parts.map((mesh) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    dispose() {
      for (const item of [matGeometry, rollGeometry, pickGeometry, matMaterial, rollMaterial, pickMaterial]) item.dispose();
    },
  };
}
