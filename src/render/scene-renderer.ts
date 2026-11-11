import * as THREE from "three";
import { movingEntities, type EntityStore } from "../sim/entities";
import type { Valley } from "../sim/valley";
import { blendPosition } from "./blend";
import { createSkyLighting } from "./sky-lighting";
import { createValleyMeshes } from "./valley-meshes";

const CAMERA_FIELD_OF_VIEW_DEGREES = 45;
const CAMERA_NEAR_METRES = 0.1;
const CAMERA_FAR_METRES = 4000;
/** Until camera controls exist, a fixed camera looks at the valley's centre from far enough away to show all of it. */
const CAMERA_DISTANCE_METRES = 1250;
/** How steeply the camera looks down. The spec allows about 30° to 75°. */
const CAMERA_DOWN_ANGLE_DEGREES = 45;

export interface SceneRenderer {
  /** Draws one frame. alpha says how far the frame is between the last two logic steps. */
  render(alpha: number): void;
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
  const downAngle = THREE.MathUtils.degToRad(CAMERA_DOWN_ANGLE_DEGREES);
  const groundDistance = CAMERA_DISTANCE_METRES * Math.cos(downAngle);
  camera.position.set(
    groundDistance * Math.SQRT1_2,
    CAMERA_DISTANCE_METRES * Math.sin(downAngle),
    groundDistance * Math.SQRT1_2,
  );
  camera.lookAt(0, 0, 0);

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

  const moving = movingEntities(entities);
  const blended = { x: 0, y: 0, z: 0 };

  return {
    render(alpha) {
      matchCanvasSize();
      skyLighting.update(readHourOfDay());
      for (const entity of moving) {
        blendPosition(entity.previousPosition, entity.position, alpha, blended);
        // Later tickets copy `blended` onto the entity's mesh here.
      }
      renderer.render(scene, camera);
    },
    dispose() {
      valleyMeshes.dispose();
      renderer.dispose();
    },
  };
}
