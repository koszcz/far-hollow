// The light that lit torches cast on the ground around them. Part of the draft "torch" asset in asset-manifest.json.
// A small fixed set of point lights stays in the scene all the time. A light with no torch to show sits at zero strength,
// as an unlit campfire's glow does, because adding or removing a light makes three.js rebuild every material.
// Torches cast no shadows.
import * as THREE from "three";
import { TORCH_LIGHT_METRES } from "../sim/api";

/** How many torches cast real light at once. Now only the torch in the player's hand does. */
export const TORCH_LIGHT_COUNT = 1;
/** A warm orange, a little yellower than a campfire's glow. */
const TORCH_LIGHT_COLOUR = 0xffa552;
/** How bright a torch's light is. */
const TORCH_LIGHT_STRENGTH = 2.6;
/** The flame is about this high above the ground. A light's reach is measured from the light, so it ends on the ground at TORCH_LIGHT_METRES. */
const TORCH_FLAME_ABOVE_GROUND_METRES = 1.6;
const TORCH_LIGHT_REACH_METRES = Math.hypot(TORCH_LIGHT_METRES, TORCH_FLAME_ABOVE_GROUND_METRES);
/** How far the light falls off with distance. 1 is a gentle, game-like fall-off. */
const TORCH_LIGHT_FALL_OFF = 1;
/** How fast and how much the light flickers. */
const FLICKER_PER_SECOND = 11;
const FLICKER_AMOUNT = 0.14;

/** One torch flame to light the ground from: where it is in the world, and a seed so torches side by side flicker apart. */
export interface TorchFlame {
  readonly position: THREE.Vector3;
  readonly seed: number;
}

export interface TorchLights {
  /** Holds every light. Add it to the scene once. */
  readonly group: THREE.Group;
  /**
   * Lights the ground from the first TORCH_LIGHT_COUNT flames, flickering at `nowSeconds`. The lights left over go dark.
   * The caller lists the flames in the order they should get a light.
   */
  update(flames: readonly TorchFlame[], nowSeconds: number): void;
}

export function createTorchLights(): TorchLights {
  const group = new THREE.Group();
  const lights = Array.from({ length: TORCH_LIGHT_COUNT }, () => {
    const light = new THREE.PointLight(TORCH_LIGHT_COLOUR, 0, TORCH_LIGHT_REACH_METRES, TORCH_LIGHT_FALL_OFF);
    light.castShadow = false;
    group.add(light);
    return light;
  });
  return {
    group,
    update(flames, nowSeconds) {
      for (const [index, light] of lights.entries()) {
        const flame = flames[index];
        if (flame === undefined) {
          light.intensity = 0;
          continue;
        }
        const t = nowSeconds * FLICKER_PER_SECOND + flame.seed;
        const flicker = 1 + FLICKER_AMOUNT * (Math.sin(t) * 0.6 + Math.sin(t * 2.7 + 0.9) * 0.4);
        light.position.copy(flame.position);
        light.intensity = TORCH_LIGHT_STRENGTH * flicker;
      }
    },
  };
}
