// Builds the code-built "rain" listed in asset-manifest.json (draft): streaks of rain falling around where the camera looks.
// - Each drop is one thin, pale line that falls at a slight slant and starts again at the top when it reaches the bottom.
// - The drops fill a box centred on the camera's focus, so rain is everywhere the player can see.
import * as THREE from "three";
import { rainEntities, type EntityStore, type Vec3 } from "../sim/entities";

const DROP_COUNT = 1500;
/** The drops fill a box this wide and deep, and this tall above the focus, in metres. */
const BOX_WIDTH_METRES = 60;
const BOX_HEIGHT_METRES = 30;
/** Drops start this far below the focus, so they still fall past the ground on slopes. */
const BOX_BELOW_METRES = 5;
const DROP_LENGTH_METRES = 0.6;
const FALL_METRES_PER_SECOND = 14;
/** How far a drop drifts sideways for each metre it falls, as if a light wind blew. */
const SLANT = 0.12;
const DROP_COLOUR = 0xb8c4d0;
const DROP_OPACITY = 0.45;

export interface RainEffect {
  readonly group: THREE.Group;
  /** Shows the rain if it is falling in the game, and moves every drop to where it is at `nowSeconds` around `focus`. */
  update(nowSeconds: number, focus: Readonly<Vec3>): void;
  dispose(): void;
}

/** Draws rain while the game says it is falling. Rendering only reads the rain. It never changes it. */
export function createRainEffect(entities: EntityStore): RainEffect {
  const weather = rainEntities(entities);
  const group = new THREE.Group();
  group.name = "rain";

  // Each drop has a fixed spot in the box and a phase, so drops do not fall in step.
  const spots = Array.from({ length: DROP_COUNT }, () => ({
    x: (Math.random() - 0.5) * BOX_WIDTH_METRES,
    z: (Math.random() - 0.5) * BOX_WIDTH_METRES,
    phase: Math.random(),
  }));
  const positions = new Float32Array(DROP_COUNT * 2 * 3);
  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  geometry.setAttribute("position", positionAttribute);
  const material = new THREE.LineBasicMaterial({ color: DROP_COLOUR, transparent: true, opacity: DROP_OPACITY, depthWrite: false });
  const lines = new THREE.LineSegments(geometry, material);
  // The drops move every frame around the camera, so their bounds are never up to date.
  lines.frustumCulled = false;
  group.add(lines);

  return {
    group,
    update(nowSeconds, focus) {
      group.visible = weather.first?.rain.falling === true;
      if (!group.visible) return;
      const fallSeconds = BOX_HEIGHT_METRES / FALL_METRES_PER_SECOND;
      spots.forEach((spot, index) => {
        const fallen = (((nowSeconds / fallSeconds + spot.phase) % 1) * BOX_HEIGHT_METRES);
        const topY = focus.y - BOX_BELOW_METRES + BOX_HEIGHT_METRES - fallen;
        const x = focus.x + spot.x + fallen * SLANT;
        const z = focus.z + spot.z;
        positions.set([x, topY, z, x + DROP_LENGTH_METRES * SLANT, topY - DROP_LENGTH_METRES, z], index * 6);
      });
      positionAttribute.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
