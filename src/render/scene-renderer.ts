import * as THREE from "three";
import { movingEntities, type EntityStore } from "../sim/entities";
import { terrainHeightAt, type GroundPoint, type Valley } from "../sim/valley";
import { blendPosition } from "./blend";
import { createCameraRig, type CameraRig } from "./camera-rig";
import { createPlayerMesh } from "./player-mesh";
import { createSkyLighting } from "./sky-lighting";
import { createValleyMeshes } from "./valley-meshes";

export const CAMERA_FIELD_OF_VIEW_DEGREES = 45;
const CAMERA_NEAR_METRES = 0.1;
const CAMERA_FAR_METRES = 4000;

export interface SceneRenderer {
  /** Draws one frame. alpha says how far the frame is between the last two logic steps. */
  render(alpha: number): void;
  /** Where the camera looks. Camera input and camera follow change it. It never changes game state. */
  readonly cameraRig: CameraRig;
  /** The spot on the ground under a point on the screen, in page pixels, or undefined if the point is off the ground. */
  groundSpotAt(clientX: number, clientY: number): GroundPoint | undefined;
  dispose(): void;
}

/**
 * readHourOfDay returns the clock's hour of the day, with its fraction, from game logic.
 * Rendering only reads the clock. It never changes it.
 */
export function createSceneRenderer(
  canvas: HTMLCanvasElement,
  valley: Valley,
  entities: EntityStore,
  readHourOfDay: () => number,
): SceneRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

  const scene = new THREE.Scene();
  const skyLighting = createSkyLighting(scene);

  const camera = new THREE.PerspectiveCamera(
    CAMERA_FIELD_OF_VIEW_DEGREES,
    1,
    CAMERA_NEAR_METRES,
    CAMERA_FAR_METRES,
  );
  const cameraRig = createCameraRig({ groundHeightAt: (x, z) => terrainHeightAt(valley.terrain, x, z) });
  function placeCamera(): void {
    const { eye, focus } = cameraRig.view();
    camera.position.set(eye.x, eye.y, eye.z);
    camera.lookAt(focus.x, focus.y, focus.z);
  }

  const valleyMeshes = createValleyMeshes(valley, entities);
  scene.add(valleyMeshes.group);

  let drawnWidth = 0;
  let drawnHeight = 0;
  let drawnPixelRatio = 0;
  function matchCanvasSize(): void {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const pixelRatio = window.devicePixelRatio;
    if (width === drawnWidth && height === drawnHeight && pixelRatio === drawnPixelRatio) return;
    drawnWidth = width;
    drawnHeight = height;
    drawnPixelRatio = pixelRatio;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const playerMesh = createPlayerMesh();
  scene.add(playerMesh.group);
  /** Where the player is drawn this frame. The camera follows it. */
  const playerDrawn = { x: 0, y: 0, z: 0 };
  cameraRig.setFollowTarget(playerDrawn);

  const moving = movingEntities(entities);
  const blended = { x: 0, y: 0, z: 0 };
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  return {
    cameraRig,
    render(alpha) {
      matchCanvasSize();
      skyLighting.update(readHourOfDay());
      for (const entity of moving) {
        blendPosition(entity.previousPosition, entity.position, alpha, blended);
        if (entity.player) {
          Object.assign(playerDrawn, blended);
          playerMesh.group.position.set(blended.x, blended.y, blended.z);
        }
      }
      placeCamera();
      renderer.render(scene, camera);
    },
    groundSpotAt(clientX, clientY) {
      const bounds = canvas.getBoundingClientRect();
      pointer.set(((clientX - bounds.left) / bounds.width) * 2 - 1, -((clientY - bounds.top) / bounds.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(valleyMeshes.ground, false)[0];
      return hit === undefined ? undefined : { x: hit.point.x, z: hit.point.z };
    },
    dispose() {
      valleyMeshes.dispose();
      playerMesh.dispose();
      renderer.dispose();
    },
  };
}
