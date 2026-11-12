// Builds the "flowers" asset in asset-manifest.json (approved): small clumps of wild flowers made in code.
// The whole file is this asset. undergrowth-models.ts adds these shapes to the other undergrowth models,
// and undergrowth-meshes.ts draws them in batches. Flowers grow only in clearings.
// - There are three kinds: white daisies, purple bellflowers, and yellow buttercups. Each kind has three clumps,
//   from two to five flowers.
// - Each flower has a thin stem, a ring of petals with a coloured middle, and long leaves at its foot.
// - Daisies and buttercups face the sky. Bellflowers cup their petals and hang their heads, so they read as bells.
// - Every face has a front and a back, because the undergrowth material draws front faces only.
// - Every normal points nearly straight up, so the flowers are lit like the ground and never turn black.
// - The pivot is the middle of the clump's foot, on the ground. Sizes are in metres. A flower stands 0.15 m to 0.34 m.
import * as THREE from "three";
import { createRandom, type Random } from "../sim/random";

/** How one kind of flower looks. */
interface FlowerKind {
  readonly petals: number;
  /** How long a petal is, from the head's middle to its tip, in metres. */
  readonly petalLength: number;
  /** How wide a petal is at its widest, as a share of its length. */
  readonly petalWidth: number;
  /** How far the petals tip up from flat, in radians. 0 is a flat disc. */
  readonly cup: number;
  /** How far the head nods away from upright, in radians. */
  readonly nod: readonly [number, number];
  /** How tall the stems are, in metres. */
  readonly height: readonly [number, number];
  /** The colours at the petal's base and tip, and of the head's middle. */
  readonly petalBase: number;
  readonly petalTip: number;
  readonly middle: number;
  /** The radius of the head's middle, as a share of the petal length. */
  readonly middleSize: number;
}

const DAISY: FlowerKind = {
  petals: 11,
  petalLength: 0.058,
  petalWidth: 0.32,
  cup: 0.12,
  nod: [0.05, 0.3],
  height: [0.17, 0.3],
  petalBase: 0xe6e0cc,
  petalTip: 0xfaf6ea,
  middle: 0xe0b42c,
  middleSize: 0.34,
};

const BELLFLOWER: FlowerKind = {
  petals: 5,
  petalLength: 0.05,
  petalWidth: 0.7,
  cup: 1.0,
  nod: [0.9, 1.3],
  height: [0.2, 0.34],
  petalBase: 0x5c3c96,
  petalTip: 0x9a72d6,
  middle: 0x4a2f7a,
  middleSize: 0.25,
};

const BUTTERCUP: FlowerKind = {
  petals: 5,
  petalLength: 0.046,
  petalWidth: 0.85,
  cup: 0.4,
  nod: [0.05, 0.35],
  height: [0.15, 0.26],
  petalBase: 0xd9a826,
  petalTip: 0xf2d24a,
  middle: 0xb88a1c,
  middleSize: 0.3,
};

/** How one clump is built. */
interface ClumpRecipe {
  /** The model's name. undergrowth-meshes.ts picks the flower models by the "flower_" start. */
  readonly name: string;
  readonly kind: FlowerKind;
  readonly seed: number;
  readonly flowers: number;
  /** How far from the middle the stems may stand, in metres. */
  readonly spread: number;
}

const RECIPES: readonly ClumpRecipe[] = [
  { name: "flower_daisyA", kind: DAISY, seed: 101, flowers: 2, spread: 0.04 },
  { name: "flower_daisyB", kind: DAISY, seed: 103, flowers: 3, spread: 0.06 },
  { name: "flower_daisyC", kind: DAISY, seed: 107, flowers: 5, spread: 0.09 },
  { name: "flower_bellA", kind: BELLFLOWER, seed: 109, flowers: 2, spread: 0.04 },
  { name: "flower_bellB", kind: BELLFLOWER, seed: 113, flowers: 3, spread: 0.06 },
  { name: "flower_bellC", kind: BELLFLOWER, seed: 127, flowers: 4, spread: 0.08 },
  { name: "flower_buttercupA", kind: BUTTERCUP, seed: 131, flowers: 2, spread: 0.04 },
  { name: "flower_buttercupB", kind: BUTTERCUP, seed: 137, flowers: 3, spread: 0.06 },
  { name: "flower_buttercupC", kind: BUTTERCUP, seed: 139, flowers: 5, spread: 0.09 },
];

const STEM_ROOT = 0x3d5c24;
const STEM_TOP = 0x5f8a36;
const LEAF_ROOT = 0x40632a;
const LEAF_TIP = 0x7aa64a;
/** How wide a stem is, in metres. */
const STEM_WIDTH = 0.01;
/** How far the normals tip towards the way a face points. 0 points them straight up. */
const NORMAL_LEAN = 0.3;

/** One flower clump, named like "flower_daisyA". Draw it lit by its own normals, not shaded flat. */
export interface FlowerClump {
  readonly name: string;
  readonly geometry: THREE.BufferGeometry;
}

/** Builds every flower clump. The same code always builds the same clumps. */
export function buildFlowerClumps(): FlowerClump[] {
  return RECIPES.map((recipe) => ({ name: recipe.name, geometry: buildClump(recipe) }));
}

/** Collects triangles, each with a front and a back, with a colour and a normal at each corner. */
class Faces {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colours: number[] = [];

  /** Adds a triangle with both faces. `facing` is the way its front points; its normals lean that way from straight up. */
  triangle(
    corners: readonly [THREE.Vector3, THREE.Vector3, THREE.Vector3],
    colours: readonly [THREE.Color, THREE.Color, THREE.Color],
    facing: THREE.Vector3,
  ): void {
    const normal = new THREE.Vector3(facing.x * NORMAL_LEAN, 1, facing.z * NORMAL_LEAN).normalize();
    for (const order of [
      [0, 1, 2],
      [0, 2, 1],
    ] as const) {
      for (const i of order) {
        this.positions.push(corners[i].x, corners[i].y, corners[i].z);
        this.normals.push(normal.x, normal.y, normal.z);
        this.colours.push(colours[i].r, colours[i].g, colours[i].b);
      }
    }
  }

  /** Adds a four-cornered strip piece, a b on one end and c d on the other, as two triangles. */
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, near: THREE.Color, far: THREE.Color, facing: THREE.Vector3): void {
    this.triangle([a, b, d], [near, near, far], facing);
    this.triangle([a, d, c], [near, far, far], facing);
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.colours, 3));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
}

function buildClump(recipe: ClumpRecipe): THREE.BufferGeometry {
  const random = createRandom(recipe.seed);
  const faces = new Faces();
  for (let i = 0; i < recipe.flowers; i += 1) {
    // Spread the flowers round the clump, with the first one near the middle.
    const around = ((i + random() * 0.7) / recipe.flowers) * Math.PI * 2;
    const reach = i === 0 ? random() * recipe.spread * 0.3 : (0.5 + random() * 0.5) * recipe.spread;
    const root = new THREE.Vector3(Math.cos(around) * reach, 0, Math.sin(around) * reach);
    addFlower(faces, recipe.kind, random, root, around);
  }
  for (let i = 0; i < recipe.flowers + 2; i += 1) addLeaf(faces, random, recipe.spread, i, recipe.flowers + 2);
  return faces.build();
}

/** One flower: a stem that leans a little outwards, with its head on top. */
function addFlower(faces: Faces, kind: FlowerKind, random: Random, root: THREE.Vector3, around: number): void {
  const height = between(random, kind.height);
  const leanAngle = around + (random() - 0.5) * 0.8;
  const out = new THREE.Vector3(Math.cos(leanAngle), 0, Math.sin(leanAngle));
  const lean = height * (0.08 + random() * 0.12);
  // The stem bends more near the top, so it is built from three pieces.
  const points: THREE.Vector3[] = [];
  for (let s = 0; s <= 3; s += 1) {
    const t = s / 3;
    points.push(
      root
        .clone()
        .addScaledVector(out, lean * t * t)
        .setY(height * t),
    );
  }
  // Two crossed strips, so the stem shows from every side.
  const stemRoot = new THREE.Color(STEM_ROOT);
  const stemTop = new THREE.Color(STEM_TOP);
  for (const turn of [0, Math.PI / 2]) {
    const side = new THREE.Vector3(Math.cos(leanAngle + turn), 0, Math.sin(leanAngle + turn)).multiplyScalar(STEM_WIDTH / 2);
    const facing = new THREE.Vector3(-side.z, 0, side.x).normalize();
    for (let s = 0; s < 3; s += 1) {
      const from = points[s] ?? root;
      const to = points[s + 1] ?? root;
      const near = new THREE.Color().lerpColors(stemRoot, stemTop, s / 3);
      const far = new THREE.Color().lerpColors(stemRoot, stemTop, (s + 1) / 3);
      faces.quad(from.clone().sub(side), from.clone().add(side), to.clone().sub(side), to.clone().add(side), near, far, facing);
    }
  }
  const top = points[3] ?? root;
  const nod = between(random, kind.nod);
  const up = new THREE.Vector3(0, 1, 0);
  const headUp = up.clone().applyAxisAngle(new THREE.Vector3(-out.z, 0, out.x), nod);
  addHead(faces, kind, random, top, new THREE.Quaternion().setFromUnitVectors(up, headUp));
}

/** One head: a ring of petals round a coloured middle, built facing up, then turned by `tilt` and set on the stem's top. */
function addHead(faces: Faces, kind: FlowerKind, random: Random, top: THREE.Vector3, tilt: THREE.Quaternion): void {
  const place = (local: THREE.Vector3) => local.applyQuaternion(tilt).add(top);
  const shade = 0.92 + random() * 0.16;
  const base = new THREE.Color(kind.petalBase).multiplyScalar(shade);
  const tip = new THREE.Color(kind.petalTip).multiplyScalar(shade);
  const start = random() * Math.PI * 2;
  for (let p = 0; p < kind.petals; p += 1) {
    const angle = start + (p / kind.petals) * Math.PI * 2 + (random() - 0.5) * 0.15;
    const length = kind.petalLength * (0.85 + random() * 0.3);
    const cup = kind.cup + (random() - 0.5) * 0.15;
    // The petal runs out along `along` and up by its cup. `across` is its width.
    const along = new THREE.Vector3(Math.cos(angle) * Math.cos(cup), Math.sin(cup), Math.sin(angle) * Math.cos(cup));
    const across = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const halfWidth = (length * kind.petalWidth) / 2;
    // A kite: narrow at the middle, widest just past halfway, round-ish at the tip. Each petal sits a hair higher
    // than the last, so overlapping petals do not flicker.
    const lift = new THREE.Vector3(0, 0.0004 * p, 0);
    const foot = place(
      along
        .clone()
        .multiplyScalar(length * 0.15)
        .add(lift),
    );
    const left = place(
      along
        .clone()
        .multiplyScalar(length * 0.6)
        .addScaledVector(across, -halfWidth)
        .add(lift),
    );
    const right = place(
      along
        .clone()
        .multiplyScalar(length * 0.6)
        .addScaledVector(across, halfWidth)
        .add(lift),
    );
    const end = place(along.clone().multiplyScalar(length).add(lift));
    const middle = new THREE.Color().lerpColors(base, tip, 0.6);
    const facing = along.clone().applyQuaternion(tilt);
    faces.triangle([foot, left, right], [base, middle, middle], facing);
    faces.triangle([left, end, right], [middle, tip, middle], facing);
  }
  // The middle: a small raised disc above the petals.
  const middleColour = new THREE.Color(kind.middle);
  const radius = kind.petalLength * kind.middleSize;
  const raise = 0.0004 * kind.petals + 0.003;
  const centre = place(new THREE.Vector3(0, raise + radius * 0.4, 0));
  const sides = 6;
  for (let s = 0; s < sides; s += 1) {
    const a = (s / sides) * Math.PI * 2;
    const b = ((s + 1) / sides) * Math.PI * 2;
    const rimA = place(new THREE.Vector3(Math.cos(a) * radius, raise, Math.sin(a) * radius));
    const rimB = place(new THREE.Vector3(Math.cos(b) * radius, raise, Math.sin(b) * radius));
    faces.triangle([centre, rimA, rimB], [middleColour, middleColour, middleColour], new THREE.Vector3(0, 1, 0).applyQuaternion(tilt));
  }
}

/** One long leaf at the clump's foot: a strip that narrows to a point and arches outwards. */
function addLeaf(faces: Faces, random: Random, spread: number, index: number, count: number): void {
  const around = ((index + random() * 0.6) / count) * Math.PI * 2;
  const out = new THREE.Vector3(Math.cos(around), 0, Math.sin(around));
  const root = out.clone().multiplyScalar(random() * spread * 0.6);
  const length = 0.09 + random() * 0.07;
  const width = 0.022 + random() * 0.01;
  const side = new THREE.Vector3(-out.z, 0, out.x);
  const shade = 0.9 + random() * 0.2;
  const rootColour = new THREE.Color(LEAF_ROOT).multiplyScalar(shade);
  const tipColour = new THREE.Color(LEAF_TIP).multiplyScalar(shade);
  const segments = 3;
  const points: { centre: THREE.Vector3; halfWidth: number; colour: THREE.Color }[] = [];
  for (let s = 0; s <= segments; s += 1) {
    const t = s / segments;
    // Rises steeply, then arches over.
    const centre = root
      .clone()
      .addScaledVector(out, length * t)
      .setY(length * 0.9 * Math.sin(t * Math.PI * 0.75));
    const halfWidth = (width / 2) * Math.sin(Math.PI * Math.min(1, 0.2 + t * 0.8));
    points.push({ centre, halfWidth, colour: new THREE.Color().lerpColors(rootColour, tipColour, t) });
  }
  for (let s = 0; s < segments; s += 1) {
    const from = points[s];
    const to = points[s + 1];
    if (from === undefined || to === undefined) continue;
    faces.quad(
      from.centre.clone().addScaledVector(side, -from.halfWidth),
      from.centre.clone().addScaledVector(side, from.halfWidth),
      to.centre.clone().addScaledVector(side, -to.halfWidth),
      to.centre.clone().addScaledVector(side, to.halfWidth),
      from.colour,
      to.colour,
      out,
    );
  }
}

function between(random: Random, [low, high]: readonly [number, number]): number {
  return low + random() * (high - low);
}
