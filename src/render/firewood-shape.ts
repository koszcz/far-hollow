// The code-built shape listed in asset-manifest.json as "firewood" (approved). Nothing draws it in the world yet.
// src/render/showcases/camp.ts draws it at /?asset=firewood.
// A piece of firewood is one quarter of the "logs" asset, split lengthwise: bark on its round face, pale split wood on its
// two flat faces and its sawn ends. Its edges are a little uneven, so it looks split by hand.
import * as THREE from "three";
import { LOG_COLOUR, LOG_CUT_COLOUR } from "./log-shape";

/** The bark colour, the same as the log it was split from. Draw firewood with this as the material colour. */
export const FIREWOOD_COLOUR = LOG_COLOUR;
/** Freshly split wood, a little lighter than the sawn ends. */
const SPLIT_FACE_COLOUR = 0xdcbc86;
/** The sawn ends, the same colour as the log's cut ends. */
const END_COLOUR = LOG_CUT_COLOUR;
export const FIREWOOD_LENGTH_METRES = 0.5;
/** About the radius of the log, so four pieces look like they came from one. */
const RADIUS_METRES = 0.14;
/** Points on the bark's arc, from one split face to the other. */
const ARC_POINTS = 5;
/** Cross-sections along the piece. More than two lets the bark bulge and dip. */
const RINGS = 4;
/**
 * How much each point on the bark's arc strays from the round, as a share of the radius, for each ring.
 * Fixed numbers, so every piece of firewood is the same shape and screenshots compare.
 */
const BARK_WOBBLE: readonly (readonly number[])[] = [
  [0.02, -0.06, 0.04, -0.03, 0.05],
  [-0.04, 0.05, -0.02, 0.06, -0.05],
  [0.05, -0.02, 0.07, -0.05, 0.01],
  [-0.03, 0.04, -0.06, 0.02, 0.04],
];
/** How far the inner edge, where the two split faces meet, strays sideways at each ring, in metres. */
const INNER_EDGE_WOBBLE: readonly number[] = [0.004, -0.006, 0.005, -0.003];

/**
 * A piece of firewood lying along z, from z = -0.25 to z = 0.25, resting on one split face at y = 0, centred on x.
 * It carries a colour per corner: white on the bark and pale tints on the split faces and ends.
 * Draw it with `vertexColors: true`, `flatShading: true`, and the material colour set to FIREWOOD_COLOUR.
 */
export function createFirewoodGeometry(): THREE.BufferGeometry {
  // Each ring holds the inner edge first, then the arc from the bottom split face (angle 0) up to the other (90°).
  const rings: THREE.Vector3[][] = [];
  for (let r = 0; r < RINGS; r += 1) {
    const z = -FIREWOOD_LENGTH_METRES / 2 + (r / (RINGS - 1)) * FIREWOOD_LENGTH_METRES;
    const inner = new THREE.Vector3(INNER_EDGE_WOBBLE[r] ?? 0, 0, z);
    const arc: THREE.Vector3[] = [];
    for (let a = 0; a < ARC_POINTS; a += 1) {
      const angle = (a / (ARC_POINTS - 1)) * (Math.PI / 2);
      const radius = RADIUS_METRES * (1 + (BARK_WOBBLE[r]?.[a] ?? 0));
      // The first arc point stays on y = 0, so the piece lies flat on its bottom split face.
      arc.push(new THREE.Vector3(Math.cos(angle) * radius, a === 0 ? 0 : Math.sin(angle) * radius, z));
    }
    rings.push([inner, ...arc]);
  }

  const bark = new THREE.Color(FIREWOOD_COLOUR);
  // Vertex colours multiply the material colour, so each pale colour is divided by the bark colour first.
  const tint = (hex: number): THREE.Color => {
    const colour = new THREE.Color(hex);
    return new THREE.Color(colour.r / bark.r, colour.g / bark.g, colour.b / bark.b);
  };
  const barkTint = new THREE.Color(1, 1, 1);
  const splitTint = tint(SPLIT_FACE_COLOUR);
  const endTint = tint(END_COLOUR);

  const positions: number[] = [];
  const colours: number[] = [];
  const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, colour: THREE.Color): void => {
    for (const point of [a, b, c]) {
      positions.push(point.x, point.y, point.z);
      colours.push(colour.r, colour.g, colour.b);
    }
  };
  /** Two triangles for the four corners, given counter-clockwise as seen from outside. */
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, colour: THREE.Color): void => {
    triangle(a, b, c, colour);
    triangle(a, c, d, colour);
  };

  const point = (ring: number, index: number): THREE.Vector3 => rings[ring]?.[index] ?? new THREE.Vector3();
  const lastArc = ARC_POINTS;
  for (let r = 0; r < RINGS - 1; r += 1) {
    // The bark, between neighbouring arc points.
    for (let a = 1; a < lastArc; a += 1) quad(point(r, a), point(r, a + 1), point(r + 1, a + 1), point(r + 1, a), barkTint);
    // The bottom split face, from the inner edge out to the first arc point.
    quad(point(r, 0), point(r, 1), point(r + 1, 1), point(r + 1, 0), splitTint);
    // The upright split face, from the last arc point back to the inner edge.
    quad(point(r, lastArc), point(r, 0), point(r + 1, 0), point(r + 1, lastArc), splitTint);
  }
  // The two sawn ends, each a fan from the inner edge.
  for (let a = 1; a < lastArc; a += 1) {
    triangle(point(0, 0), point(0, a + 1), point(0, a), endTint);
    triangle(point(RINGS - 1, 0), point(RINGS - 1, a), point(RINGS - 1, a + 1), endTint);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  // Centre the piece across its width, so it turns about its own middle.
  geometry.translate(-RADIUS_METRES / 2, 0, 0);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
