// Builds the code-built "birds" listed in asset-manifest.json (draft): a small, generic brown songbird about 14 cm long.
// - A plump brown body with a pale buff belly, a short dark tail, thin dark legs, a round head, and a short yellow-brown beak.
// - Two brown wings with darker tips. On the ground they fold back along the body. In flight they beat up and down.
// - To peck, the bird tips forward and bends its head down to the ground.
// The bird faces +z, with its feet at the origin. Its four parts pose apart, so bird-meshes.ts can draw every bird with
// one instanced mesh per part, and the asset showcase draws one posed bird as a single shape.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const BROWN = 0x7a5636;
const DARK_BROWN = 0x4e3622;
const BUFF = 0xcfb48a;
const BEAK = 0xb08a3e;
const EYE = 0x161210;

/** Where the head turns on the neck, and where each wing turns on the shoulder, in metres from the feet. */
const NECK = new THREE.Vector3(0, 0.075, 0.04);
const SHOULDER = { x: 0.024, y: 0.072, z: 0.018 };
/** How far the wings beat each way from level in flight, and how far they swing back to fold, in radians. */
const FLAP_RADIANS = 1.0;
const FOLD_RADIANS = 1.45;
/** How far the body tips forward, and the head bends further down, at the bottom of a peck, in radians. */
const PECK_BODY_RADIANS = 0.45;
const PECK_HEAD_RADIANS = 0.9;
/** The body tips forward about the feet. Its middle sits this high. */
const BODY_HEIGHT_METRES = 0.055;

export type BirdPart = "body" | "head" | "leftWing" | "rightWing";
export const BIRD_PARTS: readonly BirdPart[] = ["body", "head", "leftWing", "rightWing"];

/** How a bird is posed. Flap runs from -1 (wings down) to 1 (wings up). Peck runs from 0 (head up) to 1 (at the ground). */
export interface BirdPose {
  readonly flying: boolean;
  readonly flap: number;
  readonly peck: number;
}

/** The bird's shape: one geometry per part, each in the bird's own space before posing, with vertex colours. */
export type BirdShape = Readonly<Record<BirdPart, THREE.BufferGeometry>>;

/** One coloured piece of a part, moved into place. */
function piece(geometry: THREE.BufferGeometry, colour: number, at: THREE.Matrix4): THREE.BufferGeometry {
  const placed = geometry.toNonIndexed().applyMatrix4(at);
  geometry.dispose();
  const count = placed.getAttribute("position").count;
  const tint = new THREE.Color(colour);
  const colours = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) colours.set([tint.r, tint.g, tint.b], i * 3);
  placed.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  placed.deleteAttribute("uv");
  return placed;
}

function merged(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geometry = mergeGeometries(pieces);
  for (const one of pieces) one.dispose();
  geometry.computeVertexNormals();
  return geometry;
}

const at = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, pitch = 0): THREE.Matrix4 =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, 0, 0)), new THREE.Vector3(sx, sy, sz));

/** A flat, tapered wing that reaches out along +x from the shoulder, or along -x when `side` is -1. */
function wing(side: 1 | -1): THREE.BufferGeometry {
  const outline = new THREE.Shape();
  // Drawn in x (out from the body) and y (back toward the tail is negative), then laid flat.
  outline.moveTo(0, 0.02);
  outline.lineTo(0.05, 0.012);
  outline.lineTo(0.095, -0.012);
  outline.lineTo(0.07, -0.03);
  outline.lineTo(0, -0.035);
  outline.closePath();
  const tip = new THREE.Shape();
  tip.moveTo(0.05, 0.012);
  tip.lineTo(0.095, -0.012);
  tip.lineTo(0.07, -0.03);
  tip.lineTo(0.055, -0.026);
  tip.closePath();
  // A shape lies in x and y. Turning it about x lays its y along +z, so its front edge points to the beak and its back edge to the tail.
  const flat = new THREE.Matrix4().makeScale(side, 1, 1).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  return merged([
    piece(new THREE.ShapeGeometry(outline), BROWN, flat),
    piece(new THREE.ShapeGeometry(tip), DARK_BROWN, flat.clone().premultiply(new THREE.Matrix4().makeTranslation(0, 0.001, 0))),
  ]);
}

/** Builds the bird's four parts. The caller disposes them. */
export function createBirdShape(): BirdShape {
  const body = merged([
    piece(new THREE.SphereGeometry(1, 10, 8), BROWN, at(0, BODY_HEIGHT_METRES + 0.005, 0, 0.03, 0.03, 0.055)),
    piece(new THREE.SphereGeometry(1, 10, 8), BUFF, at(0, BODY_HEIGHT_METRES - 0.004, 0.006, 0.025, 0.024, 0.045)),
    piece(new THREE.BoxGeometry(0.03, 0.006, 0.05), DARK_BROWN, at(0, BODY_HEIGHT_METRES + 0.01, -0.07, 1, 1, 1, -0.3)),
    piece(new THREE.CylinderGeometry(0.0025, 0.0025, 0.03, 4), DARK_BROWN, at(0.01, 0.015, 0.005)),
    piece(new THREE.CylinderGeometry(0.0025, 0.0025, 0.03, 4), DARK_BROWN, at(-0.01, 0.015, 0.005)),
  ]);
  // The head sits on the neck, so it turns about the origin of its own part, and is moved to the neck when posed.
  const head = merged([
    piece(new THREE.SphereGeometry(0.022, 10, 8), BROWN, at(0, 0.012, 0.012)),
    piece(new THREE.ConeGeometry(0.006, 0.018, 6), BEAK, at(0, 0.01, 0.04, 1, 1, 1, Math.PI / 2)),
    piece(new THREE.SphereGeometry(0.004, 6, 4), EYE, at(0.017, 0.016, 0.022)),
    piece(new THREE.SphereGeometry(0.004, 6, 4), EYE, at(-0.017, 0.016, 0.022)),
  ]);
  return { body, head, leftWing: wing(1), rightWing: wing(-1) };
}

const tipForward = new THREE.Matrix4();
const pivot = new THREE.Matrix4();
const turn = new THREE.Matrix4();
const euler = new THREE.Euler();

/**
 * Sets `out` to where one part goes for this pose, in the bird's own space: feet at the origin, facing +z.
 * Multiply it by the bird's place in the world to draw it.
 */
export function birdPartMatrix(part: BirdPart, pose: BirdPose, out: THREE.Matrix4): THREE.Matrix4 {
  // Pecking tips the whole bird forward about its feet. +x rotation turns +y toward +z, so the head goes forward and down.
  tipForward.makeRotationX(pose.flying ? 0 : pose.peck * PECK_BODY_RADIANS);
  if (part === "body") return out.copy(tipForward);
  if (part === "head") {
    turn.makeRotationX(pose.flying ? 0 : pose.peck * PECK_HEAD_RADIANS);
    return out
      .copy(tipForward)
      .multiply(pivot.makeTranslation(NECK.x, NECK.y, NECK.z))
      .multiply(turn);
  }
  const side = part === "leftWing" ? 1 : -1;
  // A wing on the ground swings back along the body and droops a little. In flight it beats up and down about its root.
  if (pose.flying) euler.set(0, 0, side * pose.flap * FLAP_RADIANS);
  else euler.set(0, side * FOLD_RADIANS, side * -0.25);
  turn.makeRotationFromEuler(euler);
  return out
    .copy(tipForward)
    .multiply(pivot.makeTranslation(side * SHOULDER.x, SHOULDER.y, SHOULDER.z))
    .multiply(turn);
}

/** One posed bird as a single shape, for the asset showcase. The caller disposes it. */
export function posedBirdGeometry(shape: BirdShape, pose: BirdPose): THREE.BufferGeometry {
  const matrix = new THREE.Matrix4();
  return mergeGeometries(BIRD_PARTS.map((part) => shape[part].clone().applyMatrix4(birdPartMatrix(part, pose, matrix))));
}

/** The material every bird draws with. Birds fade by its opacity. */
export function createBirdMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, side: THREE.DoubleSide, transparent: true });
}
