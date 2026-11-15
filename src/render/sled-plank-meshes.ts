// Draws the planks lying on a finished sled: the "sled-planks" asset in asset-manifest.json, built in code. The owner approved the asset.
// Each plank is the plank shape from the "pile" asset in pile-meshes.ts: a flat board of pale sawn wood, 0.8 m long.
// Each plank has a slightly different tone, and its sawn ends are darker, so the boards read as separate pieces.
// The planks lie flat along the runners, in layers of eight: two end to end, four side by side.
// Each layer slides a little forward or back from the one below, so the ends of the stack are ragged.
// Once a layer is full, two rope lashings bind the full layers, one round the middle of each half of the stack.
// Planks in a layer that is not yet full lie loose on top.
// They rest on the cross pieces when the sled holds no logs, and on top of the logs when it does.
// The sled itself is the approved "sled" asset in sled-meshes.ts, which adds these planks to the load it draws.
import * as THREE from "three";

/** A plank's size, in metres: as long and thick as the plank in a pile. */
const PLANK_LENGTH_METRES = 0.8;
const PLANK_WIDTH_METRES = 0.1;
const PLANK_THICKNESS_METRES = 0.025;
/** The plank tones: the pale sawn wood of a plank in a pile, and two near shades of it. */
const PLANK_COLOURS: readonly number[] = [0xd9b07a, 0xcfa46e, 0xe0ba86];
/** The colour of a plank's sawn ends, one per tone: darker, as end grain is. */
const PLANK_END_COLOURS: readonly number[] = [0xb08a58, 0xa67f4e, 0xb89462];
/** Planks in a layer sit this far apart, in metres, so their edges show. */
const PLANK_GAP_METRES = 0.012;
/** How many planks lie end to end along the runners in one layer. */
const PLANKS_ALONG = 2;
/** How many planks lie side by side across the runners in one layer. */
const PLANKS_ACROSS = 4;
/** How far each layer slides along the runners, in metres, one per layer, so the ends of the stack are ragged. */
const LAYER_SLIDES: readonly number[] = [0, 0.035, -0.025, 0.02];
/** How far each plank slides along the runners within its layer, in metres, one per place in a layer. */
const PLANK_SLIDES: readonly number[] = [0.01, -0.02, -0.012, 0.018, 0.02, -0.008, -0.015, 0.006];
/** Planks turn by these angles about the vertical, in radians, one per place in a layer, so the stack is not too neat. */
const PLANK_TWISTS: readonly number[] = [0.012, -0.01, 0.008, -0.014, 0.01, -0.006, -0.012, 0.009];
/** The rope colour and thickness, the same as the sled's lashings in sled-meshes.ts. */
const ROPE_COLOUR = 0x3d3128;
const ROPE_RADIUS_METRES = 0.011;
/** Each lashing goes round the middle of one half of the stack, this far from the sled's middle, in metres. */
const LASHING_OFFSET_METRES = (PLANK_LENGTH_METRES + PLANK_GAP_METRES) / 2;

export interface SledPlankShapes {
  /** Adds `count` planks to `load`, a group in the sled's own space, the lowest layer resting at `restHeight` above the ground. */
  addPlanks(load: THREE.Group, count: number, restHeight: number): void;
  dispose(): void;
}

/** The shapes for the planks on a sled. One set serves every sled. */
export function createSledPlankShapes(): SledPlankShapes {
  // The board lies along x, along the runners. A box's first two faces are its ends along x.
  const geometry = new THREE.BoxGeometry(PLANK_LENGTH_METRES, PLANK_THICKNESS_METRES, PLANK_WIDTH_METRES).translate(0, PLANK_THICKNESS_METRES / 2, 0);
  const materials: THREE.MeshStandardMaterial[] = [];
  const tones = PLANK_COLOURS.map((colour, index) => {
    const side = new THREE.MeshStandardMaterial({ color: colour, flatShading: true });
    const end = new THREE.MeshStandardMaterial({ color: PLANK_END_COLOURS[index] ?? colour, flatShading: true });
    materials.push(side, end);
    return [end, end, side, side, side, side];
  });
  const ropeMaterial = new THREE.MeshStandardMaterial({ color: ROPE_COLOUR, flatShading: true });
  materials.push(ropeMaterial);
  const perLayer = PLANKS_ALONG * PLANKS_ACROSS;
  const stackWidth = PLANKS_ACROSS * PLANK_WIDTH_METRES + (PLANKS_ACROSS - 1) * PLANK_GAP_METRES;

  /** One rope loop round each height of full layers, made when first needed. */
  const lashings = new Map<number, THREE.TubeGeometry>();
  function lashing(fullLayers: number): THREE.TubeGeometry {
    const made = lashings.get(fullLayers);
    if (made !== undefined) return made;
    // The loop runs round the stack in the y-z plane, its corners rounded a little, pulled tight over the top.
    const top = fullLayers * PLANK_THICKNESS_METRES + ROPE_RADIUS_METRES;
    const side = stackWidth / 2 + ROPE_RADIUS_METRES;
    const round = ROPE_RADIUS_METRES * 1.5;
    const points = [
      new THREE.Vector3(0, -ROPE_RADIUS_METRES, -side + round),
      new THREE.Vector3(0, -ROPE_RADIUS_METRES, side - round),
      new THREE.Vector3(0, -ROPE_RADIUS_METRES + round, side),
      new THREE.Vector3(0, top - round, side),
      new THREE.Vector3(0, top, side - round),
      new THREE.Vector3(0, top, -side + round),
      new THREE.Vector3(0, top - round, -side),
      new THREE.Vector3(0, -ROPE_RADIUS_METRES + round, -side),
    ];
    const loop = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true, "centripetal"), 32, ROPE_RADIUS_METRES, 5, true);
    lashings.set(fullLayers, loop);
    return loop;
  }

  return {
    addPlanks(load, count, restHeight) {
      for (let index = 0; index < count; index += 1) {
        const layer = Math.floor(index / perLayer);
        const inLayer = index % perLayer;
        const along = inLayer % PLANKS_ALONG;
        const across = Math.floor(inLayer / PLANKS_ALONG);
        const plank = new THREE.Mesh(geometry, tones[(index * 7 + layer) % tones.length]);
        plank.position.set(
          (along - (PLANKS_ALONG - 1) / 2) * (PLANK_LENGTH_METRES + PLANK_GAP_METRES) +
            (LAYER_SLIDES[layer % LAYER_SLIDES.length] ?? 0) +
            (PLANK_SLIDES[(inLayer + layer * 3) % PLANK_SLIDES.length] ?? 0),
          restHeight + layer * PLANK_THICKNESS_METRES,
          (across - (PLANKS_ACROSS - 1) / 2) * (PLANK_WIDTH_METRES + PLANK_GAP_METRES),
        );
        plank.rotation.y = PLANK_TWISTS[(inLayer + layer) % PLANK_TWISTS.length] ?? 0;
        plank.castShadow = true;
        plank.receiveShadow = true;
        load.add(plank);
      }
      const fullLayers = Math.floor(count / perLayer);
      if (fullLayers === 0) return;
      for (const x of [-LASHING_OFFSET_METRES, LASHING_OFFSET_METRES]) {
        const rope = new THREE.Mesh(lashing(fullLayers), ropeMaterial);
        rope.position.set(x, restHeight, 0);
        rope.castShadow = true;
        load.add(rope);
      }
    },
    dispose() {
      geometry.dispose();
      for (const loop of lashings.values()) loop.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
