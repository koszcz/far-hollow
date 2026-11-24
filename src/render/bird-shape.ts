// Builds the code-built "birds" listed in asset-manifest.json (approved): a small, generic brown songbird about 14 cm long.
// - A plump brown body with a pale buff belly, a fanned dark tail, a round head with dark eyes, and a short yellow-brown beak.
// - Thin dark legs with toes, which tuck back under the body in flight.
// - Two brown wings, each in an inner half and a darker outer half that bends at the wrist on the upstroke.
// bird-motion.ts decides the pose. This file turns a pose into where each part goes.
// The bird faces +z, with its feet at the origin. Its seven parts pose apart, so bird-meshes.ts can draw every bird with
// one instanced mesh per part, and the asset showcase draws one posed bird as a single shape.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { BirdPose } from "./bird-motion";

const BROWN = 0x7a5636;
const DARK_BROWN = 0x4e3622;
const BUFF = 0xcfb48a;
const BEAK = 0xb08a3e;
const EYE = 0x161210;

/** Where the legs meet the body, where the head turns on the neck, and where each wing turns on the shoulder, in metres from the feet. */
const HIP = new THREE.Vector3(0, 0.03, 0.005);
const NECK = new THREE.Vector3(0, 0.075, 0.04);
const SHOULDER = { x: 0.024, y: 0.072, z: 0.018 };
/** The outer half of a wing turns at the wrist, this far out from the shoulder, in metres. */
const WRIST_METRES = 0.045;
/** How far the wings beat each way from level in flight, and how far they swing back to fold, in radians. */
const FLAP_RADIANS = 1.0;
const FOLD_RADIANS = 1.45;
/** How far folded wings droop down at the tips, in radians. */
const FOLD_DROOP_RADIANS = 0.25;
/** How far the outer half of a wing bends down at the wrist at the middle of the upstroke, in radians. */
const TIP_BEND_RADIANS = 1.1;
/** How far the body tips forward at the hips, and the head bends further down, at the bottom of a peck, in radians. */
const PECK_BODY_RADIANS = 0.45;
const PECK_HEAD_RADIANS = 0.9;
/** How far the head turns to one side when the bird looks around, in radians. */
const HEAD_TURN_RADIANS = 0.8;
/** How far tucked legs swing back from straight down, in radians. */
const LEG_TUCK_RADIANS = 1.35;

export type BirdPart = "body" | "head" | "legs" | "leftWing" | "leftWingTip" | "rightWing" | "rightWingTip";
export const BIRD_PARTS: readonly BirdPart[] = ["body", "head", "legs", "leftWing", "leftWingTip", "rightWing", "rightWingTip"];

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

/** An outline drawn in x and y, laid flat so its y runs along +z: its front edge points to the beak. */
function flatShape(points: readonly (readonly [number, number])[], colour: number, place: THREE.Matrix4): THREE.BufferGeometry {
  const outline = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  outline.closePath();
  return piece(new THREE.ShapeGeometry(outline), colour, place.clone().multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
}

/**
 * The inner half of a wing, from the shoulder out to the wrist, along +x, or along -x when `side` is -1.
 * In y, back toward the tail is negative.
 */
function innerWing(side: 1 | -1): THREE.BufferGeometry {
  const points = [
    [0, 0.02],
    [WRIST_METRES, 0.013],
    [WRIST_METRES, -0.033],
    [0, -0.035],
  ] as const;
  return merged([flatShape(points, BROWN, new THREE.Matrix4().makeScale(side, 1, 1))]);
}

/** The outer half of a wing, from the wrist to the tip. Its long flight feathers are darker. */
function outerWing(side: 1 | -1): THREE.BufferGeometry {
  const mirror = new THREE.Matrix4().makeScale(side, 1, 1);
  const base = [
    [0, 0.013],
    [0.012, 0.009],
    [0.012, -0.032],
    [0, -0.033],
  ] as const;
  const feathers = [
    [0.012, 0.009],
    [0.05, -0.012],
    [0.025, -0.03],
    [0.012, -0.032],
  ] as const;
  return merged([flatShape(base, BROWN, mirror), flatShape(feathers, DARK_BROWN, mirror)]);
}

/** Builds the bird's seven parts. The caller disposes them. */
export function createBirdShape(): BirdShape {
  const bodyMiddle = 0.055;
  // The tail fans out behind the body: narrow at the rump, wide and slightly notched at the end.
  const tail = [
    [-0.006, 0],
    [0.006, 0],
    [0.016, -0.05],
    [0.004, -0.045],
    [0, -0.048],
    [-0.004, -0.045],
    [-0.016, -0.05],
  ] as const;
  const body = merged([
    piece(new THREE.SphereGeometry(1, 10, 8), BROWN, at(0, bodyMiddle + 0.005, 0, 0.03, 0.03, 0.055)),
    piece(new THREE.SphereGeometry(1, 10, 8), BUFF, at(0, bodyMiddle - 0.004, 0.006, 0.025, 0.024, 0.045)),
    flatShape(tail, DARK_BROWN, at(0, bodyMiddle + 0.008, -0.045, 1, 1, 1, -0.3)),
  ]);
  // The head sits on the neck, so it turns about the origin of its own part, and is moved to the neck when posed.
  const head = merged([
    piece(new THREE.SphereGeometry(0.022, 10, 8), BROWN, at(0, 0.012, 0.012)),
    piece(new THREE.ConeGeometry(0.006, 0.018, 6), BEAK, at(0, 0.01, 0.04, 1, 1, 1, Math.PI / 2)),
    piece(new THREE.SphereGeometry(0.004, 6, 4), EYE, at(0.017, 0.016, 0.022)),
    piece(new THREE.SphereGeometry(0.004, 6, 4), EYE, at(-0.017, 0.016, 0.022)),
  ]);
  // The legs hang from the hip, at the origin of their own part, so they swing back as one when they tuck.
  const legs = merged(
    [1, -1].flatMap((side) => [
      piece(new THREE.CylinderGeometry(0.0025, 0.0025, HIP.y, 4), DARK_BROWN, at(side * 0.01, -HIP.y / 2, 0)),
      piece(new THREE.BoxGeometry(0.004, 0.002, 0.016), DARK_BROWN, at(side * 0.01, -HIP.y + 0.001, 0.005)),
    ]),
  );
  return { body, head, legs, leftWing: innerWing(1), leftWingTip: outerWing(1), rightWing: innerWing(-1), rightWingTip: outerWing(-1) };
}

const bodyMatrix = new THREE.Matrix4();
const step = new THREE.Matrix4();
const euler = new THREE.Euler();

/** Where the body goes: raised by `lift`, and tipped forward at the hips by `peck`. */
function placeBody(pose: BirdPose, out: THREE.Matrix4): THREE.Matrix4 {
  // +x rotation turns +y toward +z, so the head goes forward and down.
  return out
    .makeTranslation(HIP.x, HIP.y + pose.lift, HIP.z)
    .multiply(step.makeRotationX(pose.peck * PECK_BODY_RADIANS))
    .multiply(step.makeTranslation(-HIP.x, -HIP.y, -HIP.z));
}

/** Where the inner half of a wing goes. In flight it beats up and down. Folded, it swings back along the body and droops. */
function placeWing(side: 1 | -1, pose: BirdPose, out: THREE.Matrix4): THREE.Matrix4 {
  const spread = 1 - pose.fold;
  euler.set(0, side * FOLD_RADIANS * pose.fold, side * (pose.flap * FLAP_RADIANS * spread - FOLD_DROOP_RADIANS * pose.fold));
  return out
    .copy(bodyMatrix)
    .multiply(step.makeTranslation(side * SHOULDER.x, SHOULDER.y, SHOULDER.z))
    .multiply(step.makeRotationFromEuler(euler));
}

/**
 * Sets `out` to where one part goes for this pose, in the bird's own space: feet at the origin, facing +z.
 * Multiply it by the bird's place in the world to draw it.
 */
export function birdPartMatrix(part: BirdPart, pose: BirdPose, out: THREE.Matrix4): THREE.Matrix4 {
  placeBody(pose, bodyMatrix);
  switch (part) {
    case "body":
      return out.copy(bodyMatrix);
    case "head":
      // The head turns to look first, then bends further down to peck.
      return out
        .copy(bodyMatrix)
        .multiply(step.makeTranslation(NECK.x, NECK.y, NECK.z))
        .multiply(step.makeRotationY(pose.headTurn * HEAD_TURN_RADIANS))
        .multiply(step.makeRotationX(pose.peck * PECK_HEAD_RADIANS));
    case "legs":
      // The legs stay upright while the body tips, so the feet stay put on the ground. A -x turn would swing them forward.
      return out.makeTranslation(HIP.x, HIP.y + pose.lift, HIP.z).multiply(step.makeRotationX((1 - pose.legsDown) * LEG_TUCK_RADIANS));
    case "leftWing":
      return placeWing(1, pose, out);
    case "rightWing":
      return placeWing(-1, pose, out);
    case "leftWingTip":
    case "rightWingTip": {
      const side = part === "leftWingTip" ? 1 : -1;
      // A folded wing lies straight, so the bend fades as the wing folds.
      const bend = pose.tipBend * (1 - pose.fold) * TIP_BEND_RADIANS;
      return placeWing(side, pose, out)
        .multiply(step.makeTranslation(side * WRIST_METRES, 0, 0))
        .multiply(step.makeRotationZ(side * bend));
    }
  }
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
