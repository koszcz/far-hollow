// Builds the "pebbles" asset in asset-manifest.json (approved): stones made in code.
// The whole file is this asset. undergrowth-models.ts adds these shapes to the other undergrowth models,
// and undergrowth-meshes.ts draws them in batches. It picks models by name:
// - "rock_small…" are the lumpy grey rocks on the forest floor. Some have moss on top.
// - "stone_small…" are the rounder, lighter stones that lie rarely in clearings.
// - "stone_smallFlat…" are clusters of flat, pale pebbles on the river bank, coloured like the pebbles painted on its ground.
// Each stone is a low-poly ball, pushed out into lumps and squashed, then cut flat at the foot and sunk a little into
// the ground, so it never seems to float. Each face has one colour: light on top, darker at the foot.
// Every face's normal is bent towards straight up, so the stone's shady side never turns black.
// The pivot is the middle of the stone's foot, on the ground. Sizes are in metres.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createRandom, type Random } from "../sim/random";

/** How one stone is built. */
interface StoneRecipe {
  /** How wide the stone is across and along, and how tall, in metres, before it sinks into the ground. */
  readonly size: readonly [number, number, number];
  /** How far the lumps push out, as a share of the stone's size. 0 is a smooth egg. */
  readonly lumpiness: number;
  /** The stone's main colour. Each face varies a little from it. */
  readonly colour: number;
  /** The share of upward faces covered in moss. 0 is no moss. */
  readonly moss: number;
}

/** How one model is built: one stone, or a cluster of pebbles. */
interface ModelRecipe {
  /** The model's name. undergrowth-meshes.ts picks models by name. */
  readonly name: string;
  readonly seed: number;
  readonly stones: readonly (StoneRecipe & { readonly x: number; readonly z: number })[];
}

/** How much bigger each pebble cluster is than the numbers in its recipe. */
const PEBBLE_CLUSTER_SCALE = 2.3;
/** How far each face's normal is bent towards straight up. 0 keeps the true normal. 1 points it halfway up. */
const NORMAL_UP_BEND = 0.7;
/** The share of a stone's height that is below the ground. */
const SINK = 0.18;
/** How much darker the foot is than the top. */
const FOOT_SHADE = 0.68;
/** How much each face's colour varies either way. */
const FACE_SHADE_SPREAD = 0.07;

const ROCK_GREY = 0x86837b;
const ROCK_COOL = 0x7b7e7b;
const ROCK_WARM = 0x8e8678;
const MOSS = 0x5b7234;
const STONE_LIGHT = 0xaea99d;
const STONE_PALE = 0xa3a198;
const PEBBLE_GREY = 0x9e988c;
const PEBBLE_SLATE = 0x8d9190;
const PEBBLE_SAND = 0xb2a690;

function rock(size: StoneRecipe["size"], colour: number, moss: number): StoneRecipe & { x: number; z: number } {
  return { size, lumpiness: 0.38, colour, moss, x: 0, z: 0 };
}

function stone(size: StoneRecipe["size"], colour: number): StoneRecipe & { x: number; z: number } {
  return { size, lumpiness: 0.16, colour, moss: 0, x: 0, z: 0 };
}

function pebble(x: number, z: number, width: number, colour: number): StoneRecipe & { x: number; z: number } {
  const grow = PEBBLE_CLUSTER_SCALE;
  return { size: [width * grow, width * grow * 0.8, width * grow * 0.28], lumpiness: 0.06, colour, moss: 0, x: x * grow, z: z * grow };
}

const RECIPES: readonly ModelRecipe[] = [
  { name: "rock_smallA", seed: 101, stones: [rock([0.55, 0.48, 0.36], ROCK_GREY, 0.5)] },
  { name: "rock_smallB", seed: 113, stones: [rock([0.62, 0.5, 0.3], ROCK_COOL, 0)] },
  { name: "rock_smallC", seed: 127, stones: [rock([0.5, 0.44, 0.42], ROCK_WARM, 0.35)] },
  { name: "rock_smallD", seed: 139, stones: [rock([0.7, 0.55, 0.34], ROCK_GREY, 0)] },
  { name: "rock_smallE", seed: 149, stones: [rock([0.48, 0.46, 0.28], ROCK_COOL, 0.6)] },
  { name: "rock_smallF", seed: 157, stones: [rock([0.6, 0.42, 0.4], ROCK_WARM, 0)] },
  { name: "stone_smallA", seed: 211, stones: [stone([0.62, 0.56, 0.42], STONE_LIGHT)] },
  { name: "stone_smallB", seed: 223, stones: [stone([0.7, 0.58, 0.36], STONE_PALE)] },
  { name: "stone_smallC", seed: 233, stones: [stone([0.56, 0.52, 0.48], STONE_LIGHT)] },
  { name: "stone_smallD", seed: 241, stones: [stone([0.68, 0.6, 0.4], STONE_PALE)] },
  {
    name: "stone_smallFlatA",
    seed: 307,
    stones: [pebble(0, 0, 0.36, PEBBLE_GREY), pebble(0.24, 0.1, 0.18, PEBBLE_SLATE), pebble(-0.12, -0.2, 0.15, PEBBLE_SAND)],
  },
  {
    name: "stone_smallFlatB",
    seed: 311,
    stones: [pebble(0, 0, 0.3, PEBBLE_SLATE), pebble(-0.2, 0.12, 0.22, PEBBLE_SAND), pebble(0.16, -0.16, 0.12, PEBBLE_GREY)],
  },
  {
    name: "stone_smallFlatC",
    seed: 317,
    stones: [pebble(0, 0, 0.42, PEBBLE_SAND), pebble(0.26, -0.14, 0.14, PEBBLE_GREY)],
  },
  {
    name: "stone_smallFlatD",
    seed: 331,
    stones: [
      pebble(-0.1, 0, 0.24, PEBBLE_GREY),
      pebble(0.14, 0.08, 0.2, PEBBLE_SLATE),
      pebble(0.02, -0.18, 0.16, PEBBLE_SAND),
      pebble(0.2, -0.12, 0.1, PEBBLE_GREY),
    ],
  },
];

/** One stone model, named like "rock_smallA". Draw it lit by its own normals, not shaded flat. */
export interface PebbleShape {
  readonly name: string;
  readonly geometry: THREE.BufferGeometry;
}

/** Builds every stone model. The same code always builds the same stones. */
export function buildPebbles(): PebbleShape[] {
  return RECIPES.map((recipe) => {
    const random = createRandom(recipe.seed);
    const parts = recipe.stones.map((part) => buildStone(part, random));
    const geometry = mergeGeometries(parts);
    for (const part of parts) part.dispose();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return { name: recipe.name, geometry };
  });
}

/** One stone: a lumpy, squashed ball cut flat at the foot, standing at (x, z). */
function buildStone(recipe: StoneRecipe & { x: number; z: number }, random: Random): THREE.BufferGeometry {
  const ball = new THREE.IcosahedronGeometry(1, 1);
  const positions = ball.getAttribute("position");
  // Lumps: a few random directions where the surface swells out. Shared corners move together, so no cracks open.
  const lumps = Array.from({ length: 5 }, () => ({
    towards: new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize(),
    height: (0.4 + random() * 0.6) * recipe.lumpiness,
  }));
  const turn = random() * Math.PI * 2;
  const [width, depth, height] = recipe.size;
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
      // Squash to the stone's size and turn it, then sink the foot into the ground.
      out.set((out.x * width) / 2, ((out.y + 1) / 2) * height, (out.z * depth) / 2);
      out.applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
      out.y = Math.max(out.y - height * SINK, -height * SINK * 0.5);
      out.x += recipe.x;
      out.z += recipe.z;
      moved.set(key, out);
    }
    positions.setXYZ(i, out.x, out.y, out.z);
  }

  const loose = ball.toNonIndexed();
  ball.dispose();
  paintFaces(loose, recipe, random, height);
  return loose;
}

/** Gives each face one colour and one normal bent towards straight up. */
function paintFaces(geometry: THREE.BufferGeometry, recipe: StoneRecipe, random: Random, height: number): void {
  const positions = geometry.getAttribute("position");
  const count = positions.count;
  const colours = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const base = new THREE.Color(recipe.colour);
  const moss = new THREE.Color(MOSS);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const colour = new THREE.Color();
  for (let i = 0; i < count; i += 3) {
    a.fromBufferAttribute(positions, i);
    b.fromBufferAttribute(positions, i + 1);
    c.fromBufferAttribute(positions, i + 2);
    normal.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
    // How high the face sits, from 0 at the ground to 1 at the top.
    const rise = THREE.MathUtils.clamp((a.y + b.y + c.y) / 3 / (height * (1 - SINK)), 0, 1);
    const shade = FOOT_SHADE + (1 - FOOT_SHADE) * rise + (random() * 2 - 1) * FACE_SHADE_SPREAD;
    colour.copy(base).multiplyScalar(shade);
    if (recipe.moss > 0 && normal.y > 0.55 && random() < recipe.moss) colour.lerp(moss, 0.75 + random() * 0.25);
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
