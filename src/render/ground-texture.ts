// Paints the "terrain" asset's textures in code: one repeating texture for each ground type
// (forest floor, clearing, and river bank), and a map of how much of each type shows across the valley.
// The ground mesh in valley-meshes.ts blends the three textures with that map.
// The terrain is a draft in asset-manifest.json.
import * as THREE from "three";
import { groundTypeWeightsAt, type GroundMap, type GroundType } from "../sim/ground-types";

/** Each painted texture covers a square this many metres on each side before it repeats. */
export const GROUND_TEXTURE_TILE_METRES = 12;

const TEXTURE_PIXELS = 512;

interface GroundPaint {
  /** Fixed seed, so the ground looks the same in every game. */
  readonly seed: number;
  readonly base: string;
  /** Large soft patches, drawn first. */
  readonly patches: readonly string[];
  /** Medium blots, such as dirt or mud. */
  readonly blots: readonly string[];
  /** Tiny marks on top, such as grass blades, needles, or pebbles. */
  readonly flecks: readonly string[];
  readonly fleckCount: number;
  readonly fleckRadius: readonly [number, number];
}

const PAINTS: Readonly<Record<GroundType, GroundPaint>> = {
  // Brighter grass with a little dirt.
  clearing: {
    seed: 7,
    base: "#6a8a3c",
    patches: ["#63823a", "#76984a", "#6d8f40"],
    blots: ["#7a6a46", "#81704a"],
    flecks: ["#557230", "#86a654", "#6d8f40", "#7da04c"],
    fleckCount: 1800,
    fleckRadius: [2, 5],
  },
  // Brown needle and leaf litter, darker than a clearing.
  forestFloor: {
    seed: 11,
    base: "#5a4630",
    patches: ["#4e3d2a", "#634d33", "#55452c", "#4f5a2c"],
    blots: ["#6e5232", "#7a5a34", "#3f3222"],
    flecks: ["#826038", "#3a2c1e", "#8c6a3c", "#6b4a2a", "#9a7442"],
    fleckCount: 2600,
    fleckRadius: [1, 4],
  },
  // Mud with grey and sandy pebbles.
  riverBank: {
    seed: 13,
    base: "#6b5a44",
    patches: ["#5f503c", "#76664c", "#625842"],
    blots: ["#544638", "#7d6c52"],
    flecks: ["#9a948a", "#b0a894", "#7f7a72", "#c2b49a", "#8a8478"],
    fleckCount: 450,
    fleckRadius: [3, 8],
  },
};

/** Paints the clearing's seamless grass texture on a canvas. Needs a browser `document`. */
export function createGroundTexture(): THREE.CanvasTexture {
  return paintGroundTexture(PAINTS.clearing);
}

/** Paints one seamless texture for each ground type. Needs a browser `document`. */
export function createGroundTypeTextures(): Record<GroundType, THREE.CanvasTexture> {
  return {
    forestFloor: paintGroundTexture(PAINTS.forestFloor),
    clearing: paintGroundTexture(PAINTS.clearing),
    riverBank: paintGroundTexture(PAINTS.riverBank),
  };
}

/**
 * Bakes how much of each ground type shows across the valley, `texels` × `texels` spots, row by row.
 * Row 0 is the edge at z = -size / 2. Column 0 is the edge at x = -size / 2.
 * Each spot has four bytes: forest floor, clearing, and river bank from 0 to 255, then 255.
 */
export function bakeGroundTypeWeights(map: GroundMap, texels: number): Uint8Array {
  const data = new Uint8Array(texels * texels * 4);
  const step = map.size / texels;
  const half = map.size / 2;
  for (let row = 0; row < texels; row += 1) {
    const z = -half + (row + 0.5) * step;
    for (let column = 0; column < texels; column += 1) {
      const weights = groundTypeWeightsAt(map, { x: -half + (column + 0.5) * step, z });
      const index = (row * texels + column) * 4;
      data[index] = Math.round(weights.forestFloor * 255);
      data[index + 1] = Math.round(weights.clearing * 255);
      data[index + 2] = Math.round(weights.riverBank * 255);
      data[index + 3] = 255;
    }
  }
  return data;
}

function paintGroundTexture(paint: GroundPaint): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_PIXELS;
  canvas.height = TEXTURE_PIXELS;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("This browser cannot paint the ground texture.");

  const random = seededRandom(paint.seed);
  context.fillStyle = paint.base;
  context.fillRect(0, 0, TEXTURE_PIXELS, TEXTURE_PIXELS);

  // Pixel sizes below are for a 512-pixel texture, about 43 pixels per metre.
  paintBlots(context, random, 60, paint.patches, 20, 56, paint.base);
  paintBlots(context, random, 14, paint.blots, 12, 28, paint.base);
  paintBlots(context, random, paint.fleckCount, paint.flecks, paint.fleckRadius[0], paint.fleckRadius[1], paint.base);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  // three.js lowers this to what the graphics card supports.
  texture.anisotropy = 8;
  return texture;
}

/** Paints soft oval blots. Each blot is also drawn across the edges, so the texture repeats without seams. */
function paintBlots(
  context: CanvasRenderingContext2D,
  random: () => number,
  count: number,
  colours: readonly string[],
  minRadius: number,
  maxRadius: number,
  fallback: string,
): void {
  for (let blot = 0; blot < count; blot += 1) {
    context.fillStyle = colours[Math.floor(random() * colours.length)] ?? fallback;
    const x = random() * TEXTURE_PIXELS;
    const y = random() * TEXTURE_PIXELS;
    const radius = minRadius + random() * (maxRadius - minRadius);
    const turn = random() * Math.PI;
    for (const shiftX of [-TEXTURE_PIXELS, 0, TEXTURE_PIXELS]) {
      for (const shiftY of [-TEXTURE_PIXELS, 0, TEXTURE_PIXELS]) {
        context.beginPath();
        context.ellipse(x + shiftX, y + shiftY, radius, radius * 0.7, turn, 0, Math.PI * 2);
        context.fill();
      }
    }
  }
}

/** A small repeatable random-number generator, so the painting needs no outside state. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}
