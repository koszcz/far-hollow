// Draws the player with the code-built placeholder shape approved in asset-manifest.json as "player".
import * as THREE from "three";

const BODY_COLOUR = 0xc8553d;
const HEAD_COLOUR = 0xe8c39e;
const BODY_RADIUS_METRES = 0.3;
const BODY_LENGTH_METRES = 1.0;
const HEAD_RADIUS_METRES = 0.22;

export interface PlayerMesh {
  /** Place this at the player's feet. */
  readonly group: THREE.Group;
  dispose(): void;
}

export function createPlayerMesh(): PlayerMesh {
  const group = new THREE.Group();
  const bodyGeometry = new THREE.CapsuleGeometry(BODY_RADIUS_METRES, BODY_LENGTH_METRES, 4, 8);
  const bodyHeight = BODY_LENGTH_METRES + BODY_RADIUS_METRES * 2;
  bodyGeometry.translate(0, bodyHeight / 2, 0);
  const headGeometry = new THREE.SphereGeometry(HEAD_RADIUS_METRES, 10, 8);
  headGeometry.translate(0, bodyHeight + HEAD_RADIUS_METRES * 0.8, 0);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: BODY_COLOUR, flatShading: true });
  const headMaterial = new THREE.MeshStandardMaterial({ color: HEAD_COLOUR, flatShading: true });
  group.add(new THREE.Mesh(bodyGeometry, bodyMaterial), new THREE.Mesh(headGeometry, headMaterial));
  return {
    group,
    dispose() {
      bodyGeometry.dispose();
      headGeometry.dispose();
      bodyMaterial.dispose();
      headMaterial.dispose();
    },
  };
}
