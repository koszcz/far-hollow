// Draws bedrolls laid on the ground with the code-built "bedroll" (approved) in asset-manifest.json.
// The bedroll is a green canvas mat with bevelled edges and three quilted seams, and a rolled red blanket
// at its head end (-Z). Two leather straps with brass buckles hold the roll, and each end of the roll shows
// the spiral of its layers. The pivot is the centre of the mat's underside, flat on the ground.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { bedrollEntities, type Entity, type EntityStore } from "../sim/entities";
import type { OutlinePart } from "./hover-outline";

const MAT_COLOUR = 0x4f6b3a;
const SEAM_COLOUR = 0x3a5029;
const ROLL_COLOUR = 0x8a3b2e;
const SPIRAL_COLOUR = 0x5a2219;
const STRAP_COLOUR = 0x5a3a22;
const BUCKLE_COLOUR = 0xb08d3c;
/** A laid bedroll's mat lies along z and is this long, in metres. */
export const BEDROLL_LENGTH_METRES = 1.9;
/** A laid bedroll's mat is this wide, along x, in metres. */
export const BEDROLL_WIDTH_METRES = 0.7;
const MAT_LENGTH_METRES = BEDROLL_LENGTH_METRES;
const MAT_WIDTH_METRES = BEDROLL_WIDTH_METRES;
const MAT_THICKNESS_METRES = 0.04;
const MAT_BEVEL_METRES = 0.012;
const MAT_CORNER_METRES = 0.06;
/** Where the quilted seams cross the mat, along its length. The roll covers the head end. */
const SEAM_POSITIONS_METRES = [-0.3, 0.15, 0.6];
const ROLL_RADIUS_METRES = 0.11;
const ROLL_LENGTH_METRES = MAT_WIDTH_METRES * 0.92;
/** The roll is squashed a little by its own weight. */
const ROLL_SQUASH = 0.9;
const ROLL_SPIRAL_TURNS = 3;
const STRAP_WIDTH_METRES = 0.04;
/** The straps sit this far from the middle of the roll, as a share of half its length. */
const STRAP_OFFSET = 0.6;
/** Clicks on a bedroll hit an invisible box this much taller than the mat, so the flat mat is easy to hit. */
const PICK_HEIGHT_METRES = 0.3;

export interface BedrollMeshes {
  readonly group: THREE.Group;
  /** Brings every laid bedroll up to date with game state. */
  update(): void;
  /** What a ray from the camera hits first among bedrolls, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: { kind: "bedroll"; entity: Entity }; distance: number } | undefined;
  /** The mat, roll and straps of a bedroll, placed in the world. Empty once it is gone. */
  outlineOf(entity: Entity): OutlinePart[];
  dispose(): void;
}

interface Drawn {
  readonly root: THREE.Group;
  readonly parts: THREE.Mesh[];
  readonly picker: THREE.Mesh;
}

interface BedrollShape {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
}

const rollCentre = new THREE.Vector3(
  0,
  MAT_THICKNESS_METRES + ROLL_RADIUS_METRES * ROLL_SQUASH,
  -MAT_LENGTH_METRES / 2 + ROLL_RADIUS_METRES * 1.4,
);

function roundedRectangle(width: number, length: number, corner: number): THREE.Shape {
  const x = width / 2;
  const y = length / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-x + corner, -y);
  shape.lineTo(x - corner, -y);
  shape.quadraticCurveTo(x, -y, x, -y + corner);
  shape.lineTo(x, y - corner);
  shape.quadraticCurveTo(x, y, x - corner, y);
  shape.lineTo(-x + corner, y);
  shape.quadraticCurveTo(-x, y, -x, y - corner);
  shape.lineTo(-x, -y + corner);
  shape.quadraticCurveTo(-x, -y, -x + corner, -y);
  return shape;
}

function matGeometry(): THREE.BufferGeometry {
  const shape = roundedRectangle(
    MAT_WIDTH_METRES - 2 * MAT_BEVEL_METRES,
    MAT_LENGTH_METRES - 2 * MAT_BEVEL_METRES,
    MAT_CORNER_METRES,
  );
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: MAT_THICKNESS_METRES - 2 * MAT_BEVEL_METRES,
    bevelEnabled: true,
    bevelThickness: MAT_BEVEL_METRES,
    bevelSize: MAT_BEVEL_METRES,
    bevelSegments: 1,
    curveSegments: 3,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, MAT_BEVEL_METRES, 0);
  return geometry;
}

function seamGeometry(): THREE.BufferGeometry {
  const seams = SEAM_POSITIONS_METRES.map((z) => {
    const seam = new THREE.BoxGeometry(MAT_WIDTH_METRES * 0.9, 0.004, 0.014);
    seam.translate(0, MAT_THICKNESS_METRES + 0.001, z);
    return seam;
  });
  return mergeGeometries(seams);
}

/** A cylinder lying across the mat along X, squashed like the roll and centred on it. */
function acrossRoll(radius: number, length: number, x: number): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 14);
  geometry.rotateZ(Math.PI / 2);
  geometry.scale(1, ROLL_SQUASH, 1);
  geometry.translate(rollCentre.x + x, rollCentre.y, rollCentre.z);
  return geometry;
}

function spiralGeometry(): THREE.BufferGeometry {
  const ends = [-1, 1].map((side) => {
    const points: THREE.Vector3[] = [];
    const steps = 60;
    const inner = ROLL_RADIUS_METRES * 0.15;
    const outer = ROLL_RADIUS_METRES * 0.9;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * ROLL_SPIRAL_TURNS * Math.PI * 2;
      const radius = inner + (outer - inner) * t;
      points.push(
        new THREE.Vector3(
          rollCentre.x + side * (ROLL_LENGTH_METRES / 2 + 0.002),
          rollCentre.y + Math.sin(angle) * radius * ROLL_SQUASH,
          rollCentre.z + Math.cos(angle) * radius,
        ),
      );
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), steps * 2, 0.005, 4);
  });
  return mergeGeometries(ends);
}

function strapGeometry(): THREE.BufferGeometry {
  const offset = (ROLL_LENGTH_METRES / 2) * STRAP_OFFSET;
  return mergeGeometries(
    [-offset, offset].map((x) => acrossRoll(ROLL_RADIUS_METRES * 1.06, STRAP_WIDTH_METRES, x)),
  );
}

function buckleGeometry(): THREE.BufferGeometry {
  const offset = (ROLL_LENGTH_METRES / 2) * STRAP_OFFSET;
  const top = rollCentre.y + ROLL_RADIUS_METRES * 1.06 * ROLL_SQUASH;
  return mergeGeometries(
    [-offset, offset].map((x) => {
      const buckle = new THREE.BoxGeometry(STRAP_WIDTH_METRES * 1.3, 0.01, 0.035);
      buckle.translate(x, top, rollCentre.z + 0.02);
      return buckle;
    }),
  );
}

function bedrollShapes(): BedrollShape[] {
  const material = (color: number, roughness = 0.9) =>
    new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
  return [
    { geometry: matGeometry(), material: material(MAT_COLOUR) },
    { geometry: seamGeometry(), material: material(SEAM_COLOUR) },
    { geometry: acrossRoll(ROLL_RADIUS_METRES, ROLL_LENGTH_METRES, 0), material: material(ROLL_COLOUR) },
    { geometry: spiralGeometry(), material: material(SPIRAL_COLOUR) },
    { geometry: strapGeometry(), material: material(STRAP_COLOUR, 0.7) },
    {
      geometry: buckleGeometry(),
      material: new THREE.MeshStandardMaterial({ color: BUCKLE_COLOUR, roughness: 0.4, metalness: 0.7, flatShading: true }),
    },
  ];
}

export function createBedrollMeshes(entities: EntityStore): BedrollMeshes {
  const group = new THREE.Group();
  const shapes = bedrollShapes();
  const pickGeometry = new THREE.BoxGeometry(MAT_WIDTH_METRES, PICK_HEIGHT_METRES, MAT_LENGTH_METRES);
  pickGeometry.translate(0, PICK_HEIGHT_METRES / 2, 0);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const bedrolls = bedrollEntities(entities);
  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const hits: THREE.Intersection[] = [];

  function draw(entity: Entity & { position: { x: number; y: number; z: number } }): void {
    if (drawn.has(entity)) return;
    const root = new THREE.Group();
    const parts = shapes.map(({ geometry, material }) => {
      const part = new THREE.Mesh(geometry, material);
      part.castShadow = true;
      part.receiveShadow = true;
      root.add(part);
      return part;
    });
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    root.position.set(entity.position.x, entity.position.y, entity.position.z);
    group.add(root);
    drawn.set(entity, { root, parts, picker });
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
      for (const { geometry, material } of shapes) {
        geometry.dispose();
        material.dispose();
      }
      pickGeometry.dispose();
      pickMaterial.dispose();
    },
  };
}
