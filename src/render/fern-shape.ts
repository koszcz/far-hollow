// Builds the "ferns" asset in asset-manifest.json (approved): ferns made in code, one frond at a time.
// The whole file is this asset. undergrowth-models.ts adds these shapes to the other undergrowth models,
// and undergrowth-meshes.ts draws them in batches on the forest floor.
// - Each fern is a ring of fronds rising from one foot. Each frond arches up and out, then droops towards its tip.
// - Each frond carries pairs of leaflets along its stem. The leaflets are longest a third of the way up
//   and shrink to nothing at the tip. The bottom of the stem is bare.
// - Colours fade from dark at the foot to light at the frond tips, so ferns blend into the forest floor.
// - Each face has a front and a back, because the undergrowth material draws front faces only.
// - Normals point nearly straight up, so ferns are lit like the ground under them, the same way as the grass.
// - The pivot is the middle of the fern's foot, on the ground. Sizes are in metres.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createRandom, type Random } from "../sim/random";

/** How one kind of fern is built. */
interface FernRecipe {
  /** The model's name. undergrowth-meshes.ts picks models by name. */
  readonly name: string;
  readonly seed: number;
  readonly fronds: number;
  /** The shortest and longest frond, measured along its stem, in metres. */
  readonly length: readonly [number, number];
  /** How upright the fronds stand. 1 rises steeply. Lower values spread flatter. */
  readonly upright: readonly [number, number];
  /** How many pairs of leaflets each frond carries. */
  readonly pairs: number;
  /** The longest leaflet, as a share of the frond's length. */
  readonly leaflet: number;
}

/** How far normals tip towards the frond's direction. 0 points them straight up. */
const NORMAL_LEAN = 0.35;
/** The share of each stem, from the foot, that has no leaflets. */
const BARE_STEM = 0.18;
/** Where along the leafy part of the stem the longest leaflets grow, from 0 at the bottom to 1 at the tip. */
const LONGEST_AT = 0.3;
/** How many pieces each stem is bent from. */
const STEM_SEGMENTS = 6;
/** How wide a stem is, in metres. */
const STEM_WIDTH = 0.012;

const FOOT_COLOUR = 0x2c4a1c;
const MIDDLE_COLOUR = 0x47722a;
const TIP_COLOUR = 0x86ad4c;

const RECIPES: readonly FernRecipe[] = [
  { name: "fern_small", seed: 7, fronds: 6, length: [0.26, 0.36], upright: [0.6, 0.85], pairs: 7, leaflet: 0.3 },
  { name: "fern_medium", seed: 19, fronds: 7, length: [0.38, 0.5], upright: [0.65, 0.9], pairs: 8, leaflet: 0.28 },
  { name: "fern_tall", seed: 31, fronds: 8, length: [0.52, 0.7], upright: [0.8, 1.05], pairs: 9, leaflet: 0.26 },
];

/** One fern, named like "fern_small". Draw it lit by its own normals, not shaded flat. */
export interface FernShape {
  readonly name: string;
  readonly geometry: THREE.BufferGeometry;
}

/** Builds every fern. The same code always builds the same ferns. */
export function buildFerns(): FernShape[] {
  return RECIPES.map((recipe) => ({ name: recipe.name, geometry: buildFern(recipe) }));
}

function buildFern(recipe: FernRecipe): THREE.BufferGeometry {
  const random = createRandom(recipe.seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < recipe.fronds; i += 1) parts.push(buildFrond(recipe, random, i));
  const fern = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  fern.computeBoundingBox();
  fern.computeBoundingSphere();
  return fern;
}

/** Collects triangles, each drawn from both sides, with one normal and a colour per corner. */
class Faces {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colours: number[] = [];

  constructor(private readonly normal: THREE.Vector3) {}

  triangle(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, ca: THREE.Color, cb: THREE.Color, cc: THREE.Color): void {
    this.corner(a, ca);
    this.corner(b, cb);
    this.corner(c, cc);
    this.corner(a, ca);
    this.corner(c, cc);
    this.corner(b, cb);
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.colours, 3));
    return geometry;
  }

  private corner(point: THREE.Vector3, colour: THREE.Color): void {
    this.positions.push(point.x, point.y, point.z);
    this.normals.push(this.normal.x, this.normal.y, this.normal.z);
    this.colours.push(colour.r, colour.g, colour.b);
  }
}

/** One frond: an arching stem with pairs of leaflets that shrink towards its tip. */
function buildFrond(recipe: FernRecipe, random: Random, index: number): THREE.BufferGeometry {
  // Spread the fronds evenly round the foot, with a little jitter, so no side is bare.
  const around = ((index + (random() - 0.5) * 0.5) / recipe.fronds) * Math.PI * 2;
  const outward = new THREE.Vector3(Math.cos(around), 0, Math.sin(around));
  const side = new THREE.Vector3(-outward.z, 0, outward.x);
  const length = between(random, recipe.length);
  const upright = between(random, recipe.upright);
  // Each frond's colours vary a little, so a fern is not one flat green.
  const shade = 0.88 + random() * 0.24;
  const foot = new THREE.Color(FOOT_COLOUR).multiplyScalar(shade);
  const middle = new THREE.Color(MIDDLE_COLOUR).multiplyScalar(shade);
  const tip = new THREE.Color(TIP_COLOUR).multiplyScalar(shade);
  const colourAt = (t: number, out: THREE.Color) =>
    t < 0.5 ? out.lerpColors(foot, middle, t * 2) : out.lerpColors(middle, tip, (t - 0.5) * 2);

  // The stem is a curve that rises from the foot, then bends out and down towards the tip.
  const start = new THREE.Vector3(outward.x * 0.02, 0, outward.z * 0.02);
  const bend = start.clone().addScaledVector(outward, length * 0.3).setY(length * 0.75 * upright);
  const end = start.clone().addScaledVector(outward, length * 0.85).setY(length * 0.4 * upright);
  const stem = new THREE.QuadraticBezierCurve3(start, bend, end);

  const normal = new THREE.Vector3(outward.x * NORMAL_LEAN, 1, outward.z * NORMAL_LEAN).normalize();
  const faces = new Faces(normal);

  // The stem, as a thin strip.
  const c0 = new THREE.Color();
  const c1 = new THREE.Color();
  for (let s = 0; s < STEM_SEGMENTS; s += 1) {
    const t0 = s / STEM_SEGMENTS;
    const t1 = (s + 1) / STEM_SEGMENTS;
    const p0 = stem.getPoint(t0);
    const p1 = stem.getPoint(t1);
    const w0 = (STEM_WIDTH / 2) * (1 - t0 * 0.7);
    const w1 = (STEM_WIDTH / 2) * (1 - t1 * 0.7);
    colourAt(t0, c0);
    colourAt(t1, c1);
    const a = p0.clone().addScaledVector(side, -w0);
    const b = p0.clone().addScaledVector(side, w0);
    const c = p1.clone().addScaledVector(side, -w1);
    const d = p1.clone().addScaledVector(side, w1);
    faces.triangle(a, b, d, c0, c0, c1);
    faces.triangle(a, d, c, c0, c1, c1);
  }

  // The leaflets, in pairs along the stem.
  const baseColour = new THREE.Color();
  const tipColour = new THREE.Color();
  const spacing = (1 - BARE_STEM) / recipe.pairs;
  for (let p = 0; p < recipe.pairs; p += 1) {
    const t = BARE_STEM + (p + 0.5) * spacing;
    const along = (t - BARE_STEM) / (1 - BARE_STEM);
    // Longest a third of the way along the leafy part, shrinking to a point at the tip.
    const share = along < LONGEST_AT ? 0.55 + 0.45 * (along / LONGEST_AT) : 1 - 0.92 * ((along - LONGEST_AT) / (1 - LONGEST_AT));
    const leafLength = length * recipe.leaflet * share;
    const centre = stem.getPoint(t);
    const tangent = stem.getTangent(t);
    const halfBase = length * spacing * 0.42;
    colourAt(t, baseColour);
    colourAt(Math.min(1, t + 0.15), tipColour);
    for (const sign of [-1, 1]) {
      // Each leaflet points out sideways, a little towards the tip, and droops slightly.
      const direction = side
        .clone()
        .multiplyScalar(sign)
        .addScaledVector(tangent, 0.45)
        .setY(-0.2)
        .normalize();
      const a = centre.clone().addScaledVector(tangent, -halfBase);
      const b = centre.clone().addScaledVector(tangent, halfBase);
      const point = centre.clone().addScaledVector(direction, leafLength);
      faces.triangle(a, b, point, baseColour, baseColour, tipColour);
    }
  }

  return faces.build();
}

function between(random: Random, [low, high]: readonly [number, number]): number {
  return low + random() * (high - low);
}
