// The code-built draft shape listed in asset-manifest.json as "sticks". forest-meshes.ts places one on each stick's spot.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Lighter than the trunks and the ground, so sticks stand out on the forest floor. */
export const STICK_COLOUR = 0xb08654;
export const STICK_LENGTH_METRES = 0.9;
const STICK_RADIUS_METRES = 0.05;
/** Each stick has one short side twig, so it reads as a branch and not a line. */
const TWIG_LENGTH_METRES = 0.3;
const TWIG_RADIUS_METRES = 0.03;
/** Sticks float this far above their spot, so the ground's slope does not swallow them. */
const STICK_LIFT_METRES = 0.03;

/** A stick lying along x: a tapered branch with one twig forking off it, resting on y = 0. */
export function createStickGeometry(): THREE.BufferGeometry {
  const branch = new THREE.CylinderGeometry(STICK_RADIUS_METRES * 0.7, STICK_RADIUS_METRES, STICK_LENGTH_METRES, 6);
  branch.rotateZ(Math.PI / 2);
  const twig = new THREE.CylinderGeometry(TWIG_RADIUS_METRES * 0.6, TWIG_RADIUS_METRES, TWIG_LENGTH_METRES, 5);
  // The twig starts a little past the middle and angles forward and sideways along the ground.
  twig.translate(0, TWIG_LENGTH_METRES / 2, 0);
  twig.rotateZ(-Math.PI / 2 + 0.6);
  twig.rotateX(Math.PI / 2 - 0.15);
  twig.translate(STICK_LENGTH_METRES * 0.1, 0, 0);
  const stick = mergeGeometries([branch, twig]);
  branch.dispose();
  twig.dispose();
  stick.translate(0, STICK_RADIUS_METRES + STICK_LIFT_METRES, 0);
  return stick;
}
