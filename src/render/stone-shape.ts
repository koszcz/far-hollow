// How one stone looks lying in a pile, part of the approved "stone" asset in asset-manifest.json. Built in code.
// Added by fireplace ticket 01. pile-meshes.ts lays stones out like the other things in a pile, and player-mesh.ts
// shows the first stone shape in the player's hands while gathering stone.
// A stone is a flat river stone, about 20 cm long: a low-poly ball pushed out into lumps, squashed, and cut flat at the foot.
// It is built like the approved "pebbles" in pebble-shape.ts, so stones in a pile match the stones on the river bank:
// each face has one colour, light on top and darker at the foot, and its normal is bent towards straight up,
// so the shady side never turns black. Draw it lit by its own normals, not shaded flat.
// There are three stone shapes in three greys. A pile takes them in turn, so it looks gathered by hand.
// The pivot is the middle of the stone's underside. Sizes are in metres.
import * as THREE from "three";
import { createRandom, type Random } from "../sim/random";

/** One part of a stone in a pile: a shape and what it is drawn with. */
export interface StonePart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
}

/** How one stone shape is built. */
interface StoneRecipe {
  readonly seed: number;
  /** How wide the stone is, how tall, and how long, in metres. */
  readonly size: readonly [number, number, number];
  /** How far the lumps push out, as a share of the stone's size. 0 is a smooth egg. */
  readonly lumpiness: number;
  /** The colour of the stone's top. Faces lower down are darker. Warm greys, like the stones on the river bank, so the blue sky light does not turn them lilac. */
  readonly colour: number;
}

const RECIPES: readonly StoneRecipe[] = [
  { seed: 11, size: [0.16, 0.09, 0.2], lumpiness: 0.22, colour: 0xa29f98 },
  { seed: 23, size: [0.14, 0.08, 0.18], lumpiness: 0.28, colour: 0x93918b },
  { seed: 37, size: [0.15, 0.065, 0.21], lumpiness: 0.18, colour: 0xa8a297 },
];

/** How far each face's normal is bent towards straight up. 0 keeps the true normal. */
const NORMAL_UP_BEND = 0.7;
/** The share of the stone's height cut off flat at the foot, so it lies still rather than rocking on a point. */
const FLAT_FOOT = 0.15;
/** How dark the faces at the foot are, as a share of the stone's colour. The top is the full colour. */
const FOOT_SHADE = 0.68;
/** How much each face's shade varies at random, so the facets show. */
const FACE_SHADE_SPREAD = 0.06;

/** Makes a material from a colour and options. The caller disposes it. */
type MakeMaterial = (colour: number, options?: THREE.MeshStandardMaterialParameters) => THREE.Material;
/** Hands a geometry to the caller to dispose, and returns it. */
type Track = <T extends { dispose(): void }>(resource: T) => T;

/** How many different stone shapes there are. */
export const STONE_SHAPE_COUNT = RECIPES.length;

/**
 * Every stone shape, as parts to lie in a pile. A pile shows shape `index % STONE_SHAPE_COUNT` for its `index`th stone.
 * `material` makes a material from a colour, and `track` hands each geometry to the caller to dispose.
 */
export function stonePileShapes(material: MakeMaterial, track: Track): readonly (readonly StonePart[])[] {
  const drawnWith = material(0xffffff, { vertexColors: true, flatShading: false, roughness: 0.9 });
  return RECIPES.map((_, shape) => [{ geometry: track(createStoneGeometry(shape)), material: drawnWith }]);
}

/** One stone shape, resting on y = 0, with a colour on each face. Draw it with a white material that uses vertex colours. The same every time. */
export function createStoneGeometry(shape = 0): THREE.BufferGeometry {
  const recipe = RECIPES[shape % RECIPES.length];
  if (recipe === undefined) throw new Error(`No stone shape ${shape}`);
  const random = createRandom(recipe.seed);
  const ball = new THREE.IcosahedronGeometry(1, 1);
  const positions = ball.getAttribute("position");
  // Lumps: a few random directions where the surface swells out. Shared corners move together, so no cracks open.
  const lumps = Array.from({ length: 5 }, () => ({
    towards: new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize(),
    height: (0.4 + random() * 0.6) * recipe.lumpiness,
  }));
  const [width, height, length] = recipe.size;
  const corner = new THREE.Vector3();
  const moved = new Map<string, THREE.Vector3>();
  for (let i = 0; i < positions.count; i += 1) {
    corner.fromBufferAttribute(positions, i);
    const key = `${corner.x.toFixed(4)},${corner.y.toFixed(4)},${corner.z.toFixed(4)}`;
    let out = moved.get(key);
    if (out === undefined) {
      const direction = corner.clone().normalize();
      let radius = 1 - recipe.lumpiness * 0.5;
      for (const lump of lumps) radius += lump.height * Math.max(0, direction.dot(lump.towards)) ** 2;
      out = direction.multiplyScalar(radius);
      // Squash to the stone's size, then cut the foot flat.
      out.set((out.x * width) / 2, ((out.y + 1) / 2) * height, (out.z * length) / 2);
      out.y = Math.max(out.y, height * FLAT_FOOT);
      moved.set(key, out);
    }
    positions.setXYZ(i, out.x, out.y, out.z);
  }

  const loose = ball.toNonIndexed();
  ball.dispose();
  loose.computeBoundingBox();
  const bottom = loose.boundingBox?.min.y ?? 0;
  loose.translate(0, -bottom, 0);
  paintFaces(loose, recipe.colour, random);
  loose.computeBoundingBox();
  loose.computeBoundingSphere();
  return loose;
}

/** Gives each face one colour, lighter higher up, and one normal bent towards straight up. */
function paintFaces(geometry: THREE.BufferGeometry, stoneColour: number, random: Random): void {
  const positions = geometry.getAttribute("position");
  const top = geometry.boundingBox?.max.y ?? 1;
  const count = positions.count;
  const colours = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const base = new THREE.Color(stoneColour);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const side = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const colour = new THREE.Color();
  for (let i = 0; i < count; i += 3) {
    a.fromBufferAttribute(positions, i);
    b.fromBufferAttribute(positions, i + 1);
    c.fromBufferAttribute(positions, i + 2);
    normal.subVectors(c, b).cross(side.subVectors(a, b)).normalize();
    // How high the face sits, from 0 at the foot to 1 at the top.
    const rise = THREE.MathUtils.clamp((a.y + b.y + c.y) / 3 / top, 0, 1);
    const shade = FOOT_SHADE + (1 - FOOT_SHADE) * rise + (random() * 2 - 1) * FACE_SHADE_SPREAD;
    colour.copy(base).multiplyScalar(shade);
    normal.y += NORMAL_UP_BEND;
    normal.normalize();
    for (let corner = i; corner < i + 3; corner += 1) {
      colour.toArray(colours, corner * 3);
      normal.toArray(normals, corner * 3);
    }
  }
  for (const name of Object.keys(geometry.attributes)) {
    if (name !== "position") geometry.deleteAttribute(name);
  }
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
}
