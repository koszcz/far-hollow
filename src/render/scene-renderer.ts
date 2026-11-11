import * as THREE from "three";
import { movingEntities, type EntityStore } from "../sim/entities";
import { blendPosition } from "./blend";

const SKY_COLOUR = 0x9cc7e8;
const GROUND_COLOUR = 0x5f7f3a;
/** The valley is about 1 km across. */
const VALLEY_SIZE_METRES = 1000;

/** Distant ground fades into the sky colour between these distances, so the horizon reads as sky. */
const FOG_START_METRES = 30;
const FOG_END_METRES = 110;

const CAMERA_FIELD_OF_VIEW_DEGREES = 45;
const CAMERA_NEAR_METRES = 0.1;
const CAMERA_FAR_METRES = 2000;
/** How far the camera sits from the point it looks at. */
const CAMERA_DISTANCE_METRES = 34;
/** How steeply the camera looks down. The spec allows about 30° to 75°. */
const CAMERA_DOWN_ANGLE_DEGREES = 30;

const SKY_LIGHT_STRENGTH = 1.2;
const SUN_STRENGTH = 1.5;

export interface SceneRenderer {
  /** Draws one frame. alpha says how far the frame is between the last two logic steps. */
  render(alpha: number): void;
  dispose(): void;
}

export function createSceneRenderer(canvas: HTMLCanvasElement, entities: EntityStore): SceneRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_COLOUR);
  scene.fog = new THREE.Fog(SKY_COLOUR, FOG_START_METRES, FOG_END_METRES);

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

  scene.add(new THREE.HemisphereLight(SKY_COLOUR, GROUND_COLOUR, SKY_LIGHT_STRENGTH));
  const sun = new THREE.DirectionalLight(0xffffff, SUN_STRENGTH);
  sun.position.set(30, 50, 10);
  scene.add(sun);

  // Terrain placeholder, built in code and approved in asset-manifest.json.
  const groundGeometry = new THREE.PlaneGeometry(VALLEY_SIZE_METRES, VALLEY_SIZE_METRES);
  const groundMaterial = new THREE.MeshStandardMaterial({ color: GROUND_COLOUR });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

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
      for (const entity of moving) {
        blendPosition(entity.previousPosition, entity.position, alpha, blended);
        // Later tickets copy `blended` onto the entity's mesh here.
      }
      renderer.render(scene, camera);
    },
    dispose() {
      groundGeometry.dispose();
      groundMaterial.dispose();
      renderer.dispose();
    },
  };
}
