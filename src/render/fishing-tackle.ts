// Part of the approved "fishing-animation" asset in asset-manifest.json. It moves the tackle while the player fishes:
// it bends the approved "fishing-rod" as it whips and as a fish pulls on it, draws the line as a thin curve from the
// tip, and builds the float that bobs on the water. player-mesh.ts places them from the pose in player-fish-pose.ts.
import * as THREE from "three";
import { FISHING_ROD_LENGTH_METRES, type FishingRod } from "./fishing-rod-model";

/** How many steps the bend is worked out in along the rod. */
const BEND_STEPS = 24;
/** How many straight pieces draw the line, and how many sides each piece has. */
const LINE_PIECES = 20;
const LINE_SIDES = 4;

/** The float: a small cork, its top half painted, with a short quill standing up from it. Sizes are metres. */
const FLOAT_RADIUS_METRES = 0.022;
const FLOAT_TALL = 1.3;
const QUILL_LENGTH_METRES = 0.05;
const QUILL_RADIUS_METRES = 0.003;
const CORK_COLOUR = 0xd9c49a;
const PAINT_COLOUR = 0x9a3b2a;
const QUILL_COLOUR = 0xe8e2cc;

/**
 * Bends the rod's own geometry. The bend grows towards the tip, the way a thin rod bends more at its top.
 * `bend` is how far the tip turns, in radians. Positive bends it towards the rod's -y.
 */
export interface RodBend {
  bend(radians: number): void;
  /** Where the line is tied at the tip, after the bend, from the butt. */
  readonly tip: THREE.Vector3;
  /** Frees the copies of the rod's geometry that the bend moves. */
  dispose(): void;
}

export function createRodBend(rod: FishingRod): RodBend {
  const length = FISHING_ROD_LENGTH_METRES;
  const meshes: { geometry: THREE.BufferGeometry; straight: Float32Array }[] = [];
  rod.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    // Each rod in the hands gets its own copy, so bending it never bends a rod drawn anywhere else.
    const geometry = (object.geometry as THREE.BufferGeometry).clone();
    object.geometry = geometry;
    meshes.push({ geometry, straight: Float32Array.from(geometry.getAttribute("position").array as ArrayLike<number>) });
  });
  const tipStraight = rod.tip.clone();
  const tip = rod.tip.clone();
  // The rod's axis after the bend, at each step: how far it has dropped and come along, and which way it points.
  const axisY = new Float32Array(BEND_STEPS + 1);
  const axisZ = new Float32Array(BEND_STEPS + 1);
  const turn = new Float32Array(BEND_STEPS + 1);
  let bent = 0;

  /** Moves a point of the straight rod to where the bend puts it. */
  function bendPoint(x: number, y: number, z: number, out: { x: number; y: number; z: number }): void {
    const at = (Math.min(Math.max(z, 0), length) / length) * BEND_STEPS;
    const step = Math.min(Math.floor(at), BEND_STEPS - 1);
    const t = at - step;
    const mix = (values: Float32Array): number => (values[step] ?? 0) * (1 - t) + (values[step + 1] ?? 0) * t;
    const centreY = mix(axisY);
    const centreZ = mix(axisZ);
    const angle = mix(turn);
    // How far the point sits off the straight axis, turned with the rod at that point.
    const along = z - Math.min(Math.max(z, 0), length);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    out.x = x;
    out.y = centreY + y * cos - along * sin;
    out.z = centreZ + y * sin + along * cos;
  }

  return {
    tip,
    dispose() {
      for (const { geometry } of meshes) geometry.dispose();
    },
    bend(radians) {
      if (Math.abs(radians - bent) < 1e-4) return;
      bent = radians;
      const stepLength = length / BEND_STEPS;
      axisY[0] = 0;
      axisZ[0] = 0;
      turn[0] = 0;
      for (let step = 1; step <= BEND_STEPS; step++) {
        const s = step / BEND_STEPS;
        turn[step] = radians * s * s;
        const middle = radians * (s - 0.5 / BEND_STEPS) ** 2;
        axisY[step] = (axisY[step - 1] ?? 0) - Math.sin(middle) * stepLength;
        axisZ[step] = (axisZ[step - 1] ?? 0) + Math.cos(middle) * stepLength;
      }
      const moved = { x: 0, y: 0, z: 0 };
      for (const { geometry, straight } of meshes) {
        const position = geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let index = 0; index < position.count; index++) {
          bendPoint(straight[index * 3] ?? 0, straight[index * 3 + 1] ?? 0, straight[index * 3 + 2] ?? 0, moved);
          position.setXYZ(index, moved.x, moved.y, moved.z);
        }
        position.needsUpdate = true;
        geometry.computeBoundingSphere();
      }
      bendPoint(tipStraight.x, tipStraight.y, tipStraight.z, moved);
      tip.set(moved.x, moved.y, moved.z);
    },
  };
}

/** The fishing line: a thin tube through points that `setPoints` moves each frame. */
export interface FishingLine {
  readonly mesh: THREE.Mesh;
  /** How many points the line runs through, from the rod tip to its end. */
  readonly pointCount: number;
  setPoints(points: readonly THREE.Vector3[]): void;
  dispose(): void;
}

export function createFishingLine(radius: number, material: THREE.Material): FishingLine {
  const pointCount = LINE_PIECES + 1;
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(new Float32Array(pointCount * LINE_SIDES * 3), 3);
  geometry.setAttribute("position", position);
  const indices: number[] = [];
  for (let piece = 0; piece < LINE_PIECES; piece++) {
    for (let side = 0; side < LINE_SIDES; side++) {
      const a = piece * LINE_SIDES + side;
      const b = piece * LINE_SIDES + ((side + 1) % LINE_SIDES);
      indices.push(a, a + LINE_SIDES, b, b, a + LINE_SIDES, b + LINE_SIDES);
    }
  }
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, material);
  // The line moves every frame and can reach far from the player, so it is always drawn.
  mesh.frustumCulled = false;
  const along = new THREE.Vector3();
  const across = new THREE.Vector3();
  const over = new THREE.Vector3();
  const sideways = new THREE.Vector3(1, 0, 0);
  const upward = new THREE.Vector3(0, 1, 0);
  return {
    mesh,
    pointCount,
    setPoints(points) {
      for (let index = 0; index < pointCount; index++) {
        const point = points[index];
        const before = points[Math.max(0, index - 1)];
        const after = points[Math.min(pointCount - 1, index + 1)];
        if (point === undefined || before === undefined || after === undefined) continue;
        along.subVectors(after, before);
        if (along.lengthSq() < 1e-12) along.set(0, -1, 0);
        along.normalize();
        across.crossVectors(along, Math.abs(along.y) > 0.9 ? sideways : upward).normalize();
        over.crossVectors(along, across);
        for (let side = 0; side < LINE_SIDES; side++) {
          const angle = (side / LINE_SIDES) * Math.PI * 2;
          const cos = Math.cos(angle) * radius;
          const sin = Math.sin(angle) * radius;
          position.setXYZ(
            index * LINE_SIDES + side,
            point.x + across.x * cos + over.x * sin,
            point.y + across.y * cos + over.y * sin,
            point.z + across.z * cos + over.z * sin,
          );
        }
      }
      position.needsUpdate = true;
      geometry.computeVertexNormals();
    },
    dispose() {
      geometry.dispose();
    },
  };
}

/** The float. Its origin is at the waterline, at the middle of the cork. */
export function createFishingFloat(): { group: THREE.Group; dispose(): void } {
  const cork = new THREE.MeshStandardMaterial({ color: CORK_COLOUR, roughness: 1, flatShading: true });
  const paint = new THREE.MeshStandardMaterial({ color: PAINT_COLOUR, roughness: 0.9, flatShading: true });
  const quill = new THREE.MeshStandardMaterial({ color: QUILL_COLOUR, roughness: 0.8 });
  const parts = [
    { geometry: new THREE.SphereGeometry(FLOAT_RADIUS_METRES, 8, 3, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1, FLOAT_TALL, 1), material: cork },
    { geometry: new THREE.SphereGeometry(FLOAT_RADIUS_METRES, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, FLOAT_TALL, 1), material: paint },
    {
      geometry: new THREE.CylinderGeometry(QUILL_RADIUS_METRES * 0.6, QUILL_RADIUS_METRES, QUILL_LENGTH_METRES, 4).translate(
        0,
        FLOAT_RADIUS_METRES * FLOAT_TALL + QUILL_LENGTH_METRES / 2 - 0.004,
        0,
      ),
      material: quill,
    },
  ];
  const group = new THREE.Group();
  for (const { geometry, material } of parts) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    group.add(mesh);
  }
  return {
    group,
    dispose() {
      for (const { geometry } of parts) geometry.dispose();
      cork.dispose();
      paint.dispose();
      quill.dispose();
    },
  };
}
