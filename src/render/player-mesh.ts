// Draws the player with the code-built placeholder shape approved in asset-manifest.json as "player".
// The chopping swing is the code-built "chop-animation". The carried log is the code-built "logs" shape.
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

export interface PlayerMesh {
  /** Place this at the player's feet. */
  readonly group: THREE.Group;
  /** Turns the player to face along a direction on the ground, in radians from the +z axis toward +x. */
  setHeading(radians: number): void;
  /** Shows or hides the log on the player's shoulder. */
  setCarryingLog(carrying: boolean): void;
  /** Swings the player as if chopping. Pass undefined to stand upright. `nowSeconds` is a steady real-time clock. */
  setChopping(nowSeconds: number | undefined): void;
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
      if (nowSeconds === undefined) {
        body.rotation.x = 0;
        return;
      }
      // Lean back to raise the axe, then forward into the strike.
      body.rotation.x = Math.sin(nowSeconds * CHOP_SWINGS_PER_SECOND * Math.PI * 2) * CHOP_LEAN_RADIANS;
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
