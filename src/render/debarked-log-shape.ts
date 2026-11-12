// The look of the "debarked-log" asset in asset-manifest.json: built in code. The owner approved the asset.
// A debarked log has the same shape as a log from log-shape.ts. Its colours are painted on each corner:
// pale wood with faint lengthwise drawknife streaks, a few scraps of bark left near the ends, darker knots,
// and cut ends that darken towards the heartwood in the middle.
// forest-meshes.ts draws it on the ground. player-mesh.ts draws it on the player's shoulder.
// foundation-meshes.ts draws its deck logs in DEBARKED_LOG_COLOUR, without the streaks.
import * as THREE from "three";
import { LOG_COLOUR } from "./log-shape";

/** The stripped wood along the log's length: paler than bark, a little darker than the cut ends. */
export const DEBARKED_LOG_COLOUR = 0xd8b98a;
/** The two cut ends at their rim, the same pale wood as a log's cut ends. */
export const DEBARKED_LOG_CUT_COLOUR = 0xc9a46a;
/** The middle of each cut end, where the older heartwood is darker. */
const HEARTWOOD_COLOUR = 0xa8783f;
/** Knots, where branches grew out of the trunk. */
const KNOT_COLOUR = 0x9a7044;
/** How much a drawknife streak can darken or lighten the wood, as a share of its colour. */
const STREAK_STRENGTH = 0.22;
/** The log's surface is cut into this many rings along its length, so streaks and scraps can change along the log. */
const RINGS = 16;
/** Bark scraps stay only in rings whose middle is this far from the log's middle or further, as a share of its half length. */
const SCRAP_FROM_MIDDLE = 0.6;
/** The share of the surface near the ends that keeps a bark scrap. */
const SCRAP_SHARE = 0.22;
/** Knots sit in these bands along the log, in metres from its middle. They match the branch stubs in log.glb. */
const KNOT_BANDS: readonly [number, number][] = [
  [-0.29, -0.2],
  [0.22, 0.3],
];

/**
 * The debarked log, built from the log shape of log-shape.ts: the same size, lying along the z axis.
 * It carries its colour on each corner. Draw it with one material: `vertexColors: true`, colour white.
 */
export function createDebarkedLogGeometry(logGeometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const source = logGeometry.index === null ? logGeometry : logGeometry.toNonIndexed();
  const position = source.getAttribute("position");
  source.computeBoundingBox();
  const halfLength = source.boundingBox?.max.z ?? 0.5;
  const ringLength = (halfLength * 2) / RINGS;
  const positions: number[] = [];
  const colours: number[] = [];
  const colour = new THREE.Color();
  const cutColour = new THREE.Color(DEBARKED_LOG_CUT_COLOUR);
  const normal = new THREE.Vector3();

  const add = (triangle: readonly THREE.Vector3[], paint: (corner: THREE.Vector3) => void): void => {
    for (const corner of triangle) {
      positions.push(corner.x, corner.y, corner.z);
      paint(corner);
      colours.push(colour.r, colour.g, colour.b);
    }
  };

  const groups = source.groups.length > 0 ? source.groups : [{ start: 0, count: position.count, materialIndex: 0 }];
  for (const group of groups) {
    const isBark = (group.materialIndex ?? 0) === 0;
    for (let first = group.start; first < group.start + group.count; first += 3) {
      const triangle = [0, 1, 2].map((i) => new THREE.Vector3().fromBufferAttribute(position, first + i));
      const zs = triangle.map((point) => point.z);
      const low = Math.min(...zs);
      const high = Math.max(...zs);

      if (high - low < 0.005 && Math.abs(low) > halfLength * 0.9) {
        // Each cut end darkens from the pale rim to the heartwood in the middle.
        add(triangle, (corner) => colour.setHex(HEARTWOOD_COLOUR).lerp(cutColour, Math.min(1, Math.hypot(corner.x, corner.y) / 0.12)));
      } else if (KNOT_BANDS.some(([from, to]) => low >= from && high <= to)) {
        add(triangle, () => colour.setHex(KNOT_COLOUR));
      } else if (!isBark) {
        add(triangle, () => colour.copy(cutColour));
      } else {
        // The stripped surface. Each face is cut into rings, and every piece of one face in one ring shares a colour,
        // so streaks run straight along the faces and scraps fill whole patches.
        const [a, b, c] = triangle as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
        normal.subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
        const side = Math.round(((Math.atan2(normal.y, normal.x) + Math.PI) / (Math.PI * 2)) * 24);
        for (let ring = 0; ring < RINGS; ring++) {
          const from = -halfLength + ring * ringLength;
          const piece = clipToBand(triangle, from, from + ringLength);
          if (piece.length < 3) continue;
          const ringMiddle = from + ringLength / 2;
          const scrap = Math.abs(ringMiddle) > halfLength * SCRAP_FROM_MIDDLE && noise(side, ring, 7) < SCRAP_SHARE;
          const shade = 1 + STREAK_STRENGTH * (noise(side, 0, 3) * 1.7 + noise(side, ring, 5) * 0.3 - 1);
          const paint = scrap ? () => colour.setHex(LOG_COLOUR) : () => colour.setHex(DEBARKED_LOG_COLOUR).multiplyScalar(shade);
          // The clipped piece is a flat, convex polygon. Fan it into triangles, keeping the winding.
          for (let i = 1; i + 1 < piece.length; i++) add([piece[0] as THREE.Vector3, piece[i] as THREE.Vector3, piece[i + 1] as THREE.Vector3], paint);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  if (source !== logGeometry) source.dispose();
  return geometry;
}

/** The part of a flat polygon between two heights along z, as a polygon with the same winding. */
function clipToBand(polygon: readonly THREE.Vector3[], from: number, to: number): THREE.Vector3[] {
  return clipAgainst(
    clipAgainst(polygon, (point) => point.z - from),
    (point) => to - point.z,
  );
}

/** Keeps the part of a polygon where `inside` is zero or more, cutting edges where it crosses zero. */
function clipAgainst(polygon: readonly THREE.Vector3[], inside: (point: THREE.Vector3) => number): THREE.Vector3[] {
  const kept: THREE.Vector3[] = [];
  polygon.forEach((point, i) => {
    const next = polygon[(i + 1) % polygon.length] as THREE.Vector3;
    const here = inside(point);
    const there = inside(next);
    if (here >= 0) kept.push(point);
    if (here >= 0 !== there >= 0) kept.push(point.clone().lerp(next, here / (here - there)));
  });
  return kept;
}

/** A steady number from 0 to 1 for each pair of whole numbers, so every debarked log looks the same. */
function noise(a: number, b: number, seed: number): number {
  const value = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
}
