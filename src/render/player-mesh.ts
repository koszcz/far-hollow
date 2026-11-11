// Draws the player with the code-built placeholder shape approved in asset-manifest.json as "player".
// The chopping swing is the code-built "chop-animation". The splitting strike is the code-built "split-animation". The carried log is the code-built "logs" shape.
import * as THREE from "three";
import { createLogGeometry, LOG_COLOUR } from "./log-shape";

const BODY_COLOUR = 0xc8553d;
const HEAD_COLOUR = 0xe8c39e;
const BODY_RADIUS_METRES = 0.3;
const BODY_LENGTH_METRES = 1.0;
const HEAD_RADIUS_METRES = 0.22;
/** The carried log rests here on the player's right shoulder, from the player's feet. */
const SHOULDER_LOG_SPOT = { x: -0.32, y: 1.45, z: 0 };
/** How many times a second the player swings the axe. */
const CHOP_SWINGS_PER_SECOND = 1.25;
/** How far the player leans into each swing, in radians. */
const CHOP_LEAN_RADIANS = 0.35;
/** How many times a second the player strikes down at a log when splitting. Slower than chopping, because each strike is a full overhead lift. */
const SPLIT_STRIKES_PER_SECOND = 0.8;
/** Share of each splitting strike spent lifting the axe overhead. The rest is the fast drop onto the log. */
const SPLIT_LIFT_SHARE = 0.7;
/** How far the player leans back with the axe overhead, in radians. */
const SPLIT_LIFT_LEAN_RADIANS = 0.4;
/** How far the player bends forward at the end of the strike, in radians. */
const SPLIT_STRIKE_LEAN_RADIANS = 0.55;
/** How far the player dips at the knees as the axe lands, in metres. */
const SPLIT_STRIKE_DIP_METRES = 0.18;

export interface PlayerMesh {
  /** Place this at the player's feet. */
  readonly group: THREE.Group;
  /** Turns the player to face along a direction on the ground, in radians from the +z axis toward +x. */
  setHeading(radians: number): void;
  /** Shows or hides the log on the player's shoulder. */
  setCarryingLog(carrying: boolean): void;
  /** Swings the player as if chopping. Pass undefined to stand upright. `nowSeconds` is a steady real-time clock. */
  setChopping(nowSeconds: number | undefined): void;
  /** Lifts the axe overhead and drops it as if splitting a log. Pass undefined to stand upright. `nowSeconds` is a steady real-time clock. */
  setSplitting(nowSeconds: number | undefined): void;
  dispose(): void;
}

export function createPlayerMesh(): PlayerMesh {
  const group = new THREE.Group();
  // The body leans inside the group, so the group can stay at the player's feet.
  const body = new THREE.Group();
  group.add(body);
  const bodyGeometry = new THREE.CapsuleGeometry(BODY_RADIUS_METRES, BODY_LENGTH_METRES, 4, 8);
  const bodyHeight = BODY_LENGTH_METRES + BODY_RADIUS_METRES * 2;
  bodyGeometry.translate(0, bodyHeight / 2, 0);
  const headGeometry = new THREE.SphereGeometry(HEAD_RADIUS_METRES, 10, 8);
  headGeometry.translate(0, bodyHeight + HEAD_RADIUS_METRES * 0.8, 0);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: BODY_COLOUR, flatShading: true });
  const headMaterial = new THREE.MeshStandardMaterial({ color: HEAD_COLOUR, flatShading: true });
  body.add(new THREE.Mesh(bodyGeometry, bodyMaterial), new THREE.Mesh(headGeometry, headMaterial));

  const logGeometry = createLogGeometry();
  const logMaterial = new THREE.MeshStandardMaterial({ color: LOG_COLOUR, flatShading: true });
  const shoulderLog = new THREE.Mesh(logGeometry, logMaterial);
  shoulderLog.position.set(SHOULDER_LOG_SPOT.x, SHOULDER_LOG_SPOT.y, SHOULDER_LOG_SPOT.z);
  shoulderLog.visible = false;
  body.add(shoulderLog);

  return {
    group,
    setHeading(radians) {
      group.rotation.y = radians;
    },
    setCarryingLog(carrying) {
      shoulderLog.visible = carrying;
    },
    setChopping(nowSeconds) {
      body.position.y = 0;
      if (nowSeconds === undefined) {
        body.rotation.x = 0;
        return;
      }
      // Lean back to raise the axe, then forward into the strike.
      body.rotation.x = Math.sin(nowSeconds * CHOP_SWINGS_PER_SECOND * Math.PI * 2) * CHOP_LEAN_RADIANS;
    },
    setSplitting(nowSeconds) {
      if (nowSeconds === undefined) {
        body.rotation.x = 0;
        body.position.y = 0;
        return;
      }
      // Unlike the steady to-and-fro of chopping, splitting is a slow lift overhead, then a sharp drop with a dip at the knees.
      const phase = (nowSeconds * SPLIT_STRIKES_PER_SECOND) % 1;
      if (phase < SPLIT_LIFT_SHARE) {
        // Rise from the end of the last strike to leaning back with the axe overhead, easing in and out.
        const lift = easeInOut(phase / SPLIT_LIFT_SHARE);
        body.rotation.x = SPLIT_STRIKE_LEAN_RADIANS + (-SPLIT_LIFT_LEAN_RADIANS - SPLIT_STRIKE_LEAN_RADIANS) * lift;
        body.position.y = -SPLIT_STRIKE_DIP_METRES * (1 - lift);
      } else {
        // Drop fast, speeding up into the log.
        const strike = ((phase - SPLIT_LIFT_SHARE) / (1 - SPLIT_LIFT_SHARE)) ** 2;
        body.rotation.x = -SPLIT_LIFT_LEAN_RADIANS + (SPLIT_STRIKE_LEAN_RADIANS + SPLIT_LIFT_LEAN_RADIANS) * strike;
        body.position.y = -SPLIT_STRIKE_DIP_METRES * strike;
      }
    },
    dispose() {
      bodyGeometry.dispose();
      headGeometry.dispose();
      bodyMaterial.dispose();
      headMaterial.dispose();
      logGeometry.dispose();
      logMaterial.dispose();
    },
  };
}

/** Eases a value from 0 to 1 so it starts and ends slowly. */
function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}
