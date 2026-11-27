// Builds the code-built "snowfall" listed in asset-manifest.json (draft): slow white flakes falling around where the camera looks.
// It follows the pattern of the "rain" effect in rain-effect.ts.
// - Each flake is one small, soft white point. It falls slowly and drifts from side to side as it falls, and starts again at
//   the top when it reaches the bottom. Every flake has its own size, speed, drift, and brightness.
// - The flakes fill a box centred on the camera's focus, so snow falls everywhere the player can see.
// - The snow eases in when it starts and eases out when it stops. It dims with the daylight, so it does not glow at night.
import * as THREE from "three";
import { type EntityStore, type Vec3 } from "../sim/entities";
import { isSnowing } from "../sim/entity-queries";
import { randomBetween } from "../sim/random";
import { createEasedShare } from "./eased-share";

const FLAKE_COUNT = 3500;
/** The flakes fill a box this wide and deep, and this tall above the focus, in metres. */
const BOX_WIDTH_METRES = 50;
const BOX_HEIGHT_METRES = 20;
/** Flakes start this far below the focus, so they still fall past the ground on slopes. */
const BOX_BELOW_METRES = 5;
/** Each flake's size on screen is picked between these, in metres. */
const FLAKE_SIZE_METRES = { min: 0.09, max: 0.18 };
/** Each flake's falling speed is picked between these, in metres per second. Snow falls far slower than rain. */
const FALL_METRES_PER_SECOND = { min: 0.7, max: 1.4 };
/** Each flake drifts from side to side this far, in metres, and this many times a second. */
const DRIFT_METRES = { min: 0.2, max: 0.7 };
const DRIFT_WAVES_PER_SECOND = { min: 0.15, max: 0.4 };
/** Each flake's brightness is picked between these. 1 is plain white. */
const FLAKE_BRIGHTNESS = { min: 0.8, max: 1 };
const FLAKE_COLOUR = 0xf4f7fb;
const FLAKE_OPACITY = 0.9;

/** How long the snow takes to ease in when it starts, and to ease out when it stops, in seconds. It matches the rain. */
const FADE_SECONDS = 4;
/** How bright the snow is at night, compared with full day. Night snow is faint, but still there. */
const NIGHT_BRIGHTNESS = 0.3;

export interface SnowfallEffect {
  readonly group: THREE.Group;
  /**
   * Eases the snow towards falling or stopped, as the game says, and moves every flake to where it is at `nowSeconds`
   * around `focus`. `daylight` runs from 0 (night) to 1 (full day).
   */
  update(nowSeconds: number, focus: Readonly<Vec3>, daylight: number): void;
  dispose(): void;
}

/** Draws snow while the game says it is falling. Rendering only reads the weather. It never changes it. */
export function createSnowfallEffect(entities: EntityStore): SnowfallEffect {
  const group = new THREE.Group();
  group.name = "snowfall";

  const flakes = Array.from({ length: FLAKE_COUNT }, () => ({
    x: (Math.random() - 0.5) * BOX_WIDTH_METRES,
    z: (Math.random() - 0.5) * BOX_WIDTH_METRES,
    phase: Math.random(),
    fallSeconds: BOX_HEIGHT_METRES / randomBetween(Math.random, FALL_METRES_PER_SECOND),
    drift: randomBetween(Math.random, DRIFT_METRES),
    driftSpeed: randomBetween(Math.random, DRIFT_WAVES_PER_SECOND) * Math.PI * 2,
    driftPhase: Math.random() * Math.PI * 2,
  }));
  const positions = new Float32Array(FLAKE_COUNT * 3);
  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  geometry.setAttribute("position", positionAttribute);
  const colours = new Float32Array(FLAKE_COUNT * 3);
  const sizes = new Float32Array(FLAKE_COUNT);
  flakes.forEach((_, index) => {
    const brightness = randomBetween(Math.random, FLAKE_BRIGHTNESS);
    colours.set([brightness, brightness, brightness], index * 3);
    sizes[index] = randomBetween(Math.random, FLAKE_SIZE_METRES);
  });
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geometry.setAttribute("flakeSize", new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.PointsMaterial({
    color: FLAKE_COLOUR,
    vertexColors: true,
    size: 1,
    sizeAttenuation: true,
    transparent: true,
    opacity: FLAKE_OPACITY,
    depthWrite: false,
    // Tone mapping would grey the white flakes against a bright day, as it would the rain.
    toneMapped: false,
  });
  // Each flake has its own size, and is a soft round dot instead of a square.
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float flakeSize;")
      .replace("gl_PointSize = size;", "gl_PointSize = size * flakeSize;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <clipping_planes_fragment>",
        "#include <clipping_planes_fragment>\nfloat flakeEdge = length( gl_PointCoord - 0.5 );\nif ( flakeEdge > 0.5 ) discard;",
      )
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.a *= 1.0 - smoothstep( 0.25, 0.5, flakeEdge );");
  };
  const points = new THREE.Points(geometry, material);
  // The flakes move every frame around the camera, so their bounds are never up to date.
  points.frustumCulled = false;
  group.add(points);

  // How strongly the snow falls, from 0 (stopped) to 1 (full). It eases towards what the game says.
  const strength = createEasedShare({ riseSeconds: FADE_SECONDS, fallSeconds: FADE_SECONDS });
  let lastSeconds = 0;

  return {
    group,
    update(nowSeconds, focus, daylight) {
      // The first frame shows the weather as it is, so a game loaded in the snow does not ease in.
      const falling = strength.toward(isSnowing(entities) ? 1 : 0, Math.abs(nowSeconds - lastSeconds));
      lastSeconds = nowSeconds;
      group.visible = falling > 0;
      if (!group.visible) return;

      const eased = falling * falling * (3 - 2 * falling);
      material.opacity = FLAKE_OPACITY * THREE.MathUtils.lerp(NIGHT_BRIGHTNESS, 1, daylight) * eased;
      // Lighter snow also means fewer flakes, so the snow thins out as it stops rather than only turning see-through.
      geometry.setDrawRange(0, Math.round(FLAKE_COUNT * eased));
      flakes.forEach((flake, index) => {
        const fallen = ((nowSeconds / flake.fallSeconds + flake.phase) % 1) * BOX_HEIGHT_METRES;
        const sway = Math.sin(nowSeconds * flake.driftSpeed + flake.driftPhase) * flake.drift;
        positions.set([focus.x + flake.x + sway, focus.y - BOX_BELOW_METRES + BOX_HEIGHT_METRES - fallen, focus.z + flake.z + sway * 0.5], index * 3);
      });
      positionAttribute.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
