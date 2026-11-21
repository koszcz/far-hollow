// Part of the "hand-craft-animation" asset in asset-manifest.json: the small bundle of sticks the player lashes while
// crafting by hand, and the cord running from its binding to the right hand. player-mesh.ts places it from the wrists
// each frame. player-hand-craft-pose.ts says how far the left hand turns it. The owner approved it.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createFishingLine } from "./fishing-tackle";
import { createStickSegment, STICK_COLOUR } from "./stick-shape";

/** How long the bundle is, in metres. It runs from just past the left fist across to the right. */
const WORK_LENGTH_METRES = 0.55;
/** How far the bundle reaches past the left fist on the left, in metres. */
const WORK_PAST_FIST_METRES = 0.1;
/** How thick each of the two sticks is, in metres across. */
const STICK_RADIUS_METRES = 0.03;
/** Where the binding sits along the bundle, in metres right of the left wrist. */
const BINDING_FROM_WRIST_METRES = 0.22;
/** How wide and how long the wound binding is, in metres. */
const BINDING_RADIUS_METRES = 0.045;
const BINDING_LENGTH_METRES = 0.07;
/** Where the fist holds the bundle from the left wrist: forward along the hand and a little down, in metres. */
const FIST_FORWARD_METRES = 0.08;
const FIST_DOWN_METRES = 0.02;
/** How thick the cord is, in metres across. */
const CORD_RADIUS_METRES = 0.007;
/** The cord and the binding: dark brown twine, the same as the cord on the approved "fishing-rod". */
const CORD_COLOUR = 0x5a3f2a;

export interface HandCraftWork {
  readonly group: THREE.Group;
  /** Shows or hides the bundle and its cord. */
  setVisible(visible: boolean): void;
  /**
   * Places the bundle in the left fist and runs the cord to the right wrist. Both wrists are in the player's own space,
   * where the player faces +z and their right is -x. `turn` rolls the bundle about its length, in radians: positive
   * rolls its top forward.
   */
  place(leftWrist: THREE.Vector3, rightWrist: THREE.Vector3, turn: number): void;
  dispose(): void;
}

export function createHandCraftWork(): HandCraftWork {
  const group = new THREE.Group();
  // The bundle is built along -x from the fist, the player's right, so turning it is a roll about x.
  const bundle = new THREE.Group();
  group.add(bundle);
  const stick = (from: THREE.Vector3, to: THREE.Vector3, z: number): THREE.BufferGeometry =>
    createStickSegment({
      from: from.clone().setZ(z),
      to: to.clone().setZ(z),
      fromRadius: STICK_RADIUS_METRES,
      toRadius: STICK_RADIUS_METRES * 0.85,
      sides: 6,
      paleFrom: true,
      paleTo: true,
    });
  const left = new THREE.Vector3(WORK_PAST_FIST_METRES, 0, 0);
  const right = new THREE.Vector3(WORK_PAST_FIST_METRES - WORK_LENGTH_METRES, 0, 0);
  const sticksGeometry = mergeGeometries([
    stick(left, right, STICK_RADIUS_METRES),
    stick(left.clone().setX(left.x - 0.02), right.clone().setX(right.x + 0.01), -STICK_RADIUS_METRES),
  ]);
  const stickMaterial = new THREE.MeshStandardMaterial({ color: STICK_COLOUR, roughness: 0.95, flatShading: true, vertexColors: true });
  bundle.add(new THREE.Mesh(sticksGeometry, stickMaterial));
  const cordMaterial = new THREE.MeshStandardMaterial({ color: CORD_COLOUR, roughness: 0.9, flatShading: true });
  const bindingGeometry = new THREE.CylinderGeometry(BINDING_RADIUS_METRES, BINDING_RADIUS_METRES, BINDING_LENGTH_METRES, 8);
  bindingGeometry.rotateZ(Math.PI / 2);
  bindingGeometry.translate(-BINDING_FROM_WRIST_METRES, 0, 0);
  bundle.add(new THREE.Mesh(bindingGeometry, cordMaterial));

  const cord = createFishingLine(CORD_RADIUS_METRES, cordMaterial);
  group.add(cord.mesh);
  const cordPoints = Array.from({ length: cord.pointCount }, () => new THREE.Vector3());
  const cordStart = new THREE.Vector3();

  return {
    group,
    setVisible(visible) {
      group.visible = visible;
    },
    place(leftWrist, rightWrist, turn) {
      bundle.position.set(leftWrist.x, leftWrist.y - FIST_DOWN_METRES, leftWrist.z + FIST_FORWARD_METRES);
      bundle.rotation.set(turn, 0, 0);
      bundle.updateMatrix();
      // The cord leaves the binding from the side the right hand is on, so it reads as winding round it.
      cordStart.set(-BINDING_FROM_WRIST_METRES, 0, 0).applyMatrix4(bundle.matrix);
      const last = cordPoints.length - 1;
      cordPoints.forEach((point, index) => point.lerpVectors(cordStart, rightWrist, index / last));
      cord.setPoints(cordPoints);
    },
    dispose() {
      sticksGeometry.dispose();
      bindingGeometry.dispose();
      stickMaterial.dispose();
      cordMaterial.dispose();
      cord.dispose();
    },
  };
}
