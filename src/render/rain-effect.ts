// Builds the code-built "rain" listed in asset-manifest.json (approved): streaks of rain falling around where the camera looks,
// and small splash rings on the ground near it.
// - Each drop is one thin, pale streak with a faded tail. It falls at a slight slant and starts again at the top when it
//   reaches the bottom. Every drop has its own length, speed, and brightness, so the rain never looks like a regular grid.
// - The drops fill a box centred on the camera's focus, so rain is everywhere the player can see.
// - Splashes are short-lived rings that grow and fade on the ground, each time at a new spot near the focus.
// - The rain eases in when it starts and eases out when it stops. It dims with the daylight, so it does not glow at night.
import * as THREE from "three";
import { rainEntities, type EntityStore, type Vec3 } from "../sim/entities";

const DROP_COUNT = 1500;
/** The drops fill a box this wide and deep, and this tall above the focus, in metres. */
const BOX_WIDTH_METRES = 60;
const BOX_HEIGHT_METRES = 30;
/** Drops start this far below the focus, so they still fall past the ground on slopes. */
const BOX_BELOW_METRES = 5;
/** Each drop's streak length is picked between these, in metres. */
const DROP_LENGTH_METRES = { min: 0.35, max: 0.9 };
/** Each drop's falling speed is picked between these, in metres per second. */
const FALL_METRES_PER_SECOND = { min: 11, max: 17 };
/** Each drop's brightness is picked between these. 1 is the plain drop colour. */
const DROP_BRIGHTNESS = { min: 0.7, max: 1 };
/** How far a drop drifts sideways for each metre it falls, as if a light wind blew. */
const SLANT = 0.12;
const DROP_COLOUR = 0xd8e0e8;
/** How opaque the brightest drop's head is, from 0 to 1. The tail fades to fully clear. */
const DROP_OPACITY = 0.8;

const SPLASH_COUNT = 160;
/** Splashes land within this distance of the focus, in metres. Farther away they are too small to see. */
const SPLASH_RADIUS_METRES = 10;
/** Each splash ring grows from the first size to the second, in metres. */
const SPLASH_SIZE_METRES = { start: 0.02, end: 0.14 };
/** Each splash repeats after a time picked between these, in seconds. It is visible for the first part of that time. */
const SPLASH_CYCLE_SECONDS = { min: 0.5, max: 1.1 };
const SPLASH_VISIBLE_SECONDS = 0.28;
/** How bright a fresh splash is. The rings add light to the ground, so this stays small. */
const SPLASH_BRIGHTNESS = 0.35;
/** Splashes sit this far above the ground, in metres, so the ground does not hide them. */
const SPLASH_LIFT_METRES = 0.02;

/** How long the rain takes to ease in when it starts, and to ease out when it stops, in seconds. */
const FADE_SECONDS = 4;
/** How bright the rain is at night, compared with full day. Night rain is faint, but still there. */
const NIGHT_BRIGHTNESS = 0.3;

export interface RainEffect {
  readonly group: THREE.Group;
  /**
   * Eases the rain towards falling or stopped, as the game says, and moves every drop and splash to where it is at
   * `nowSeconds` around `focus`. `daylight` runs from 0 (night) to 1 (full day).
   */
  update(nowSeconds: number, focus: Readonly<Vec3>, daylight: number): void;
  dispose(): void;
}

/** Draws rain while the game says it is falling. Rendering only reads the rain. It never changes it. */
export function createRainEffect(entities: EntityStore, groundHeightAt: (x: number, z: number) => number = () => 0): RainEffect {
  const weather = rainEntities(entities);
  const group = new THREE.Group();
  group.name = "rain";

  // Each drop has a fixed spot in the box, a phase so drops do not fall in step, and its own length, speed, and brightness.
  const drops = Array.from({ length: DROP_COUNT }, () => ({
    x: (Math.random() - 0.5) * BOX_WIDTH_METRES,
    z: (Math.random() - 0.5) * BOX_WIDTH_METRES,
    phase: Math.random(),
    length: between(DROP_LENGTH_METRES, Math.random()),
    fallSeconds: BOX_HEIGHT_METRES / between(FALL_METRES_PER_SECOND, Math.random()),
    brightness: between(DROP_BRIGHTNESS, Math.random()),
  }));
  const positions = new Float32Array(DROP_COUNT * 2 * 3);
  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  geometry.setAttribute("position", positionAttribute);
  // Four numbers per point: colour and opacity. The head of each streak is solid and its tail is clear.
  const colours = new Float32Array(DROP_COUNT * 2 * 4);
  drops.forEach((drop, index) => {
    colours.set([drop.brightness, drop.brightness, drop.brightness, drop.brightness, drop.brightness, drop.brightness, drop.brightness, 0], index * 8);
  });
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 4));
  const material = new THREE.LineBasicMaterial({
    color: DROP_COLOUR,
    vertexColors: true,
    transparent: true,
    opacity: DROP_OPACITY,
    depthWrite: false,
    // Tone mapping would grey the pale drops until they vanish against a bright day.
    toneMapped: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  // The drops move every frame around the camera, so their bounds are never up to date.
  lines.frustumCulled = false;
  group.add(lines);

  // A flat ring, one metre across, that each splash scales to its size.
  const ringGeometry = new THREE.RingGeometry(0.75, 1, 16).rotateX(-Math.PI / 2);
  const splashMaterial = new THREE.MeshBasicMaterial({
    color: DROP_COLOUR,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const splashes = new THREE.InstancedMesh(ringGeometry, splashMaterial, SPLASH_COUNT);
  splashes.frustumCulled = false;
  splashes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const splashTimings = Array.from({ length: SPLASH_COUNT }, () => ({
    cycleSeconds: between(SPLASH_CYCLE_SECONDS, Math.random()),
    phase: Math.random(),
  }));
  const splashMatrix = new THREE.Matrix4();
  const splashColour = new THREE.Color();
  const splashScale = new THREE.Vector3();
  const splashPosition = new THREE.Vector3();
  const noTurn = new THREE.Quaternion();
  for (let index = 0; index < SPLASH_COUNT; index++) splashes.setColorAt(index, splashColour.setScalar(0));
  group.add(splashes);

  // How strongly the rain falls, from 0 (stopped) to 1 (full). It eases towards what the game says.
  let strength: number | undefined;
  let lastSeconds = 0;

  return {
    group,
    update(nowSeconds, focus, daylight) {
      const target = weather.first?.rain.falling === true ? 1 : 0;
      // The first frame shows the weather as it is, so a game loaded in the rain does not ease in.
      const step = strength === undefined ? 1 : Math.abs(nowSeconds - lastSeconds) / FADE_SECONDS;
      strength = moveTowards(strength ?? target, target, step);
      lastSeconds = nowSeconds;
      group.visible = strength > 0;
      if (!group.visible) return;

      const eased = strength * strength * (3 - 2 * strength);
      const light = THREE.MathUtils.lerp(NIGHT_BRIGHTNESS, 1, daylight);
      material.opacity = DROP_OPACITY * light * eased;
      // Lighter rain also means fewer drops, so the rain thins out as it stops rather than only turning see-through.
      geometry.setDrawRange(0, Math.round(DROP_COUNT * eased) * 2);
      drops.forEach((drop, index) => {
        const fallen = ((nowSeconds / drop.fallSeconds + drop.phase) % 1) * BOX_HEIGHT_METRES;
        const headY = focus.y - BOX_BELOW_METRES + BOX_HEIGHT_METRES - fallen;
        const x = focus.x + drop.x + fallen * SLANT;
        const z = focus.z + drop.z;
        positions.set([x, headY, z, x - drop.length * SLANT, headY + drop.length, z], index * 6);
      });
      positionAttribute.needsUpdate = true;

      splashTimings.forEach((timing, index) => {
        const cycles = nowSeconds / timing.cycleSeconds + timing.phase;
        const cycle = Math.floor(cycles);
        const age = (cycles - cycle) * timing.cycleSeconds;
        const t = age / SPLASH_VISIBLE_SECONDS;
        // Each splash lands at a new spot every cycle. The spot comes from the cycle's number, so it is the same every time
        // this moment is drawn. Splashes past their visible time, or beyond how hard it rains, are drawn at size zero.
        if (t >= 1 || hash(index, cycle, 2) > eased) {
          splashes.setMatrixAt(index, splashMatrix.makeScale(0, 0, 0));
          return;
        }
        const angle = hash(index, cycle, 0) * Math.PI * 2;
        const distance = Math.sqrt(hash(index, cycle, 1)) * SPLASH_RADIUS_METRES;
        const x = focus.x + Math.cos(angle) * distance;
        const z = focus.z + Math.sin(angle) * distance;
        const growth = 1 - (1 - t) ** 2;
        const size = THREE.MathUtils.lerp(SPLASH_SIZE_METRES.start, SPLASH_SIZE_METRES.end, growth);
        splashPosition.set(x, groundHeightAt(x, z) + SPLASH_LIFT_METRES, z);
        splashes.setMatrixAt(index, splashMatrix.compose(splashPosition, noTurn, splashScale.setScalar(size)));
        // Added light fades to nothing, so a darker colour is a more see-through ring.
        splashes.setColorAt(index, splashColour.setScalar(SPLASH_BRIGHTNESS * light * (1 - t) ** 2));
      });
      splashes.instanceMatrix.needsUpdate = true;
      if (splashes.instanceColor) splashes.instanceColor.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      ringGeometry.dispose();
      splashMaterial.dispose();
      splashes.dispose();
    },
  };
}

function between(range: { min: number; max: number }, share: number): number {
  return range.min + (range.max - range.min) * share;
}

function moveTowards(value: number, target: number, step: number): number {
  return value < target ? Math.min(value + step, target) : Math.max(value - step, target);
}

/** A number from 0 to 1 that looks random but is always the same for the same splash, cycle, and purpose. */
function hash(index: number, cycle: number, purpose: number): number {
  const n = Math.sin(index * 127.1 + cycle * 311.7 + purpose * 74.7) * 43758.5453;
  return n - Math.floor(n);
}
