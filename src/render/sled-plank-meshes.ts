// Draws the planks lying on a finished sled: the "sled-planks" asset in asset-manifest.json, built in code. A rough draft.
// Each plank is the plank shape from the "pile" asset in pile-meshes.ts: a flat board of pale sawn wood, 0.8 m long.
// The planks lie flat along the runners, in layers of six: two end to end, three side by side.
// They rest on the cross pieces when the sled holds no logs, and on top of the logs when it does.
// The sled itself is the approved "sled" asset in sled-meshes.ts, which adds these planks to the load it draws.
import * as THREE from "three";

/** A plank's size, in metres: as long and thick as the plank in a pile. */
const PLANK_LENGTH_METRES = 0.8;
const PLANK_WIDTH_METRES = 0.1;
const PLANK_THICKNESS_METRES = 0.025;
/** The plank colour, the same pale sawn wood as a plank in a pile. */
const PLANK_COLOUR = 0xd9b07a;
/** Planks in a layer sit this far apart, in metres, so their edges show. */
const PLANK_GAP_METRES = 0.012;
/** How many planks lie end to end along the runners in one layer. */
const PLANKS_ALONG = 2;
/** How many planks lie side by side across the runners in one layer. */
const PLANKS_ACROSS = 3;
/** Planks turn by these angles about the vertical, in radians, one per place in a layer, so the stack is not too neat. */
const PLANK_TWISTS: readonly number[] = [0.02, -0.015, 0.01, -0.02, 0.015, -0.01];

export interface SledPlankShapes {
  /** Adds `count` planks to `load`, a group in the sled's own space, the lowest layer resting at `restHeight` above the ground. */
  addPlanks(load: THREE.Group, count: number, restHeight: number): void;
  dispose(): void;
}

/** The shapes for the planks on a sled. One set serves every sled. */
export function createSledPlankShapes(): SledPlankShapes {
  // The board lies along x, along the runners.
  const geometry = new THREE.BoxGeometry(PLANK_LENGTH_METRES, PLANK_THICKNESS_METRES, PLANK_WIDTH_METRES).translate(0, PLANK_THICKNESS_METRES / 2, 0);
  const material = new THREE.MeshStandardMaterial({ color: PLANK_COLOUR, flatShading: true });
  const perLayer = PLANKS_ALONG * PLANKS_ACROSS;

  return {
    addPlanks(load, count, restHeight) {
      for (let index = 0; index < count; index += 1) {
        const layer = Math.floor(index / perLayer);
        const inLayer = index % perLayer;
        const along = inLayer % PLANKS_ALONG;
        const across = Math.floor(inLayer / PLANKS_ALONG);
        const plank = new THREE.Mesh(geometry, material);
        plank.position.set(
          (along - (PLANKS_ALONG - 1) / 2) * (PLANK_LENGTH_METRES + PLANK_GAP_METRES),
          restHeight + layer * PLANK_THICKNESS_METRES,
          (across - (PLANKS_ACROSS - 1) / 2) * (PLANK_WIDTH_METRES + PLANK_GAP_METRES),
        );
        plank.rotation.y = PLANK_TWISTS[(inLayer + layer) % PLANK_TWISTS.length] ?? 0;
        plank.castShadow = true;
        plank.receiveShadow = true;
        load.add(plank);
      }
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
