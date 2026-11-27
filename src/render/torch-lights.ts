// The light that lit torches cast on the ground around them. Part of the approved "torch" asset in asset-manifest.json.
// A small fixed set of point lights stays in the scene all the time. A light with no torch to show sits at zero strength,
// as an unlit campfire's glow does, because adding or removing a light makes three.js rebuild every material.
// Torches cast no shadows.
import * as THREE from "three";
import { TORCH_LIGHT_METRES } from "../sim/api-game-view";

/** How many torches cast real light at once: the one in the player's hand, then the planted torches nearest the camera. */
export const TORCH_LIGHT_COUNT = 4;
/** A warm orange, a little yellower than a campfire's glow. */
const TORCH_LIGHT_COLOUR = 0xffa552;
/** How bright a torch's light is. */
const TORCH_LIGHT_STRENGTH = 2.6;
/** How far the light falls off with distance. 1 is a gentle, game-like fall-off. */
const TORCH_LIGHT_FALL_OFF = 1;
/** How fast and how much the light flickers. */
const FLICKER_PER_SECOND = 11;
const FLICKER_AMOUNT = 0.14;

/**
 * One torch flame to light the ground from: where it is in the world, a seed so torches side by side flicker apart, and how
 * high it is above the ground or deck under it, in metres.
 */
export interface TorchFlame {
  readonly position: THREE.Vector3;
  readonly seed: number;
  readonly aboveGroundMetres: number;
}

export interface TorchLights {
  /** Holds every light. Add it to the scene once. */
  readonly group: THREE.Group;
  /**
   * Lights the ground from at most TORCH_LIGHT_COUNT flames, flickering at `nowSeconds`: the torch in the player's hand, if
   * they hold one, then the planted torches nearest `camera`. The lights left over go dark. The other planted torches cast no light.
   */
  update(hand: TorchFlame | undefined, planted: readonly TorchFlame[], camera: THREE.Vector3, nowSeconds: number): void;
}

export function createTorchLights(): TorchLights {
  const group = new THREE.Group();
  const lights = Array.from({ length: TORCH_LIGHT_COUNT }, () => {
    const light = new THREE.PointLight(TORCH_LIGHT_COLOUR, 0, TORCH_LIGHT_METRES, TORCH_LIGHT_FALL_OFF);
    light.castShadow = false;
    group.add(light);
    return light;
  });
  /** The flames that get a light this frame, in order. Reused every frame, so drawing makes no garbage. */
  const chosen: TorchFlame[] = [];

  /** Puts the planted flames nearest `camera` into `chosen` after the hand torch, nearest first, until every light has one. */
  function chooseNearest(planted: readonly TorchFlame[], camera: THREE.Vector3): void {
    const from = chosen.length;
    for (const flame of planted) {
      const distance = flame.position.distanceToSquared(camera);
      // Insert it into the short list, which stays sorted, and drop whatever falls off the end.
      let at = chosen.length;
      while (at > from && (chosen[at - 1]?.position.distanceToSquared(camera) ?? 0) > distance) at -= 1;
      if (at >= TORCH_LIGHT_COUNT) continue;
      chosen.splice(at, 0, flame);
      chosen.length = Math.min(chosen.length, TORCH_LIGHT_COUNT);
    }
  }

  return {
    group,
    update(hand, planted, camera, nowSeconds) {
      chosen.length = 0;
      if (hand !== undefined) chosen.push(hand);
      chooseNearest(planted, camera);
      for (const [index, light] of lights.entries()) {
        const flame = chosen[index];
        if (flame === undefined) {
          light.intensity = 0;
          continue;
        }
        const t = nowSeconds * FLICKER_PER_SECOND + flame.seed;
        const flicker = 1 + FLICKER_AMOUNT * (Math.sin(t) * 0.6 + Math.sin(t * 2.7 + 0.9) * 0.4);
        light.position.copy(flame.position);
        // The reach is measured from the light, so it ends on the ground TORCH_LIGHT_METRES from the spot under the flame.
        light.distance = Math.hypot(TORCH_LIGHT_METRES, flame.aboveGroundMetres);
        light.intensity = TORCH_LIGHT_STRENGTH * flicker;
      }
    },
  };
}
