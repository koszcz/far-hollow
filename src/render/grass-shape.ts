// Builds the "grass" asset in asset-manifest.json (approved): grass tufts made in code, one blade at a time.
// The whole file is this asset. undergrowth-models.ts adds these shapes to the other undergrowth models,
// and undergrowth-meshes.ts draws them in batches.
// - Short tufts grow in clearings and, smaller, on the forest floor. Tall tufts grow on the river bank.
// - Each blade tapers to a point and bends outwards. Its colour fades from dark at the root to light at the tip,
//   so the tufts blend into the ground's painted grass instead of standing out as dark blobs.
// - Each blade has a front and a back face, because the undergrowth material draws front faces only.
// - Every blade's normals point nearly straight up, so the grass is lit like the ground under it. A thin upright blade
//   shaded by its true face would turn black whenever it faces away from the sun.
// - The pivot is the middle of the tuft's foot, on the ground. Sizes are in metres.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createRandom, type Random } from "../sim/random";

/** How one kind of tuft is built. */
interface TuftRecipe {
  /** The model's name. undergrowth-meshes.ts picks models by name. */
  readonly name: string;
  readonly seed: number;
  readonly blades: number;
  /** How far from the middle the blades' roots may stand, in metres. */
  readonly spread: number;
  /** The shortest and tallest blade, in metres. */
  readonly height: readonly [number, number];
  /** How wide a blade is at its root, in metres. */
  readonly width: number;
  /** How far the tip leans out, as a share of the blade's height. */
  readonly lean: readonly [number, number];
  /** How many pieces each blade is bent from. More pieces make a smoother curve. */
  readonly segments: number;
  /** The colours at the root and at the tip. */
  readonly root: number;
  readonly tip: number;
}

/** How far a blade's normals tip towards its lean. 0 points them straight up. */
const NORMAL_LEAN = 0.35;

const SHORT_ROOT = 0x4a6b2a;
const SHORT_TIP = 0x9cbe5c;
const TALL_ROOT = 0x445e26;
const TALL_TIP = 0xa4a85e;

const RECIPES: readonly TuftRecipe[] = [
  { name: "grass_tuftA", seed: 11, blades: 20, spread: 0.12, height: [0.2, 0.36], width: 0.05, lean: [0.2, 0.55], segments: 2, root: SHORT_ROOT, tip: SHORT_TIP },
  { name: "grass_tuftB", seed: 23, blades: 22, spread: 0.15, height: [0.16, 0.3], width: 0.048, lean: [0.3, 0.7], segments: 2, root: SHORT_ROOT, tip: SHORT_TIP },
  { name: "grass_tuftC", seed: 37, blades: 16, spread: 0.09, height: [0.24, 0.42], width: 0.052, lean: [0.15, 0.45], segments: 2, root: SHORT_ROOT, tip: SHORT_TIP },
  { name: "grass_tallA", seed: 41, blades: 18, spread: 0.12, height: [0.45, 0.8], width: 0.05, lean: [0.2, 0.5], segments: 3, root: TALL_ROOT, tip: TALL_TIP },
  { name: "grass_tallB", seed: 53, blades: 16, spread: 0.1, height: [0.5, 0.9], width: 0.055, lean: [0.15, 0.4], segments: 3, root: TALL_ROOT, tip: TALL_TIP },
];

/** One grass tuft, named like "grass_tuftA" or "grass_tallA". Draw it lit by its own normals, not shaded flat. */
export interface GrassTuft {
  readonly name: string;
  readonly geometry: THREE.BufferGeometry;
}

/** Builds every grass tuft. The same code always builds the same tufts. */
export function buildGrassTufts(): GrassTuft[] {
  return RECIPES.map((recipe) => ({ name: recipe.name, geometry: buildTuft(recipe) }));
}

function buildTuft(recipe: TuftRecipe): THREE.BufferGeometry {
  const random = createRandom(recipe.seed);
  const blades: THREE.BufferGeometry[] = [];
  for (let i = 0; i < recipe.blades; i += 1) blades.push(buildBlade(recipe, random, i));
  const tuft = mergeGeometries(blades);
  for (const blade of blades) blade.dispose();
  tuft.computeBoundingBox();
  tuft.computeBoundingSphere();
  return tuft;
}

/** One blade: a strip that narrows to a point and bends away from the tuft's middle. */
function buildBlade(recipe: TuftRecipe, random: Random, index: number): THREE.BufferGeometry {
  // Spread the blades evenly round the tuft, with a little jitter, so no side is bare.
  const around = ((index + random() * 0.6) / recipe.blades) * Math.PI * 2;
  const reach = Math.sqrt(random()) * recipe.spread;
  const rootX = Math.cos(around) * reach;
  const rootZ = Math.sin(around) * reach;
  const height = between(random, recipe.height);
  const lean = between(random, recipe.lean) * height;
  // The blade leans roughly outwards, and its flat side faces across the lean.
  const leanAngle = around + (random() - 0.5) * 0.9;
  const leanX = Math.cos(leanAngle);
  const leanZ = Math.sin(leanAngle);
  const sideX = -leanZ;
  const sideZ = leanX;
  const width = recipe.width * (0.8 + random() * 0.4);
  // Each blade's colours vary a little, so a tuft is not one flat green.
  const shade = 0.9 + random() * 0.2;
  const root = new THREE.Color(recipe.root).multiplyScalar(shade);
  const tip = new THREE.Color(recipe.tip).multiplyScalar(shade);

  const positions: number[] = [];
  const colours: number[] = [];
  const normals: number[] = [];
  const normal = new THREE.Vector3(leanX * NORMAL_LEAN, 1, leanZ * NORMAL_LEAN).normalize();
  const colour = new THREE.Color();
  for (let s = 0; s <= recipe.segments; s += 1) {
    const t = s / recipe.segments;
    // The tip bends more than the root, so the lean grows with the square of the height.
    const out = lean * t * t;
    const x = rootX + leanX * out;
    const z = rootZ + leanZ * out;
    const y = height * t * (1 - 0.25 * t * (lean / height));
    const halfWidth = (width / 2) * (1 - t);
    colour.lerpColors(root, tip, t);
    for (const side of [-1, 1]) {
      positions.push(x + sideX * halfWidth * side, y, z + sideZ * halfWidth * side);
      colours.push(colour.r, colour.g, colour.b);
      normals.push(normal.x, normal.y, normal.z);
    }
  }

  // Two triangles per piece, once for the front and once, wound the other way, for the back.
  const indices: number[] = [];
  for (let s = 0; s < recipe.segments; s += 1) {
    const a = s * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, d, a, d, c);
    indices.push(a, d, b, a, c, d);
  }

  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  indexed.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  indexed.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  indexed.setIndex(indices);
  // Unshared corners, like the other undergrowth models.
  const blade = indexed.toNonIndexed();
  indexed.dispose();
  return blade;
}

function between(random: Random, [low, high]: readonly [number, number]): number {
  return low + random() * (high - low);
}
