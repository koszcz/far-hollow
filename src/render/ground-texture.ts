// Paints the "terrain" asset's grass-and-dirt texture in code. The ground mesh in
// valley-meshes.ts repeats this texture across the whole valley.
// The owner approved this texture in asset-manifest.json.
import * as THREE from "three";

/** The painted texture covers a square this many metres on each side before it repeats. */
export const GROUND_TEXTURE_TILE_METRES = 12;

const TEXTURE_PIXELS = 512;
/** Fixed seed, so the ground looks the same in every game. */
const PAINT_SEED = 7;

const BASE_GRASS = "#5f7f3a";
const GRASS_PATCHES = ["#567434", "#6a8b40", "#5a7a36"];
const DIRT_PATCHES = ["#7a6544", "#866f4a"];
const GRASS_FLECKS = ["#4c692c", "#78994a", "#5a7a36", "#6f9046"];

/** Paints a seamless grass-and-dirt texture on a canvas. Needs a browser `document`. */
export function createGroundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_PIXELS;
  canvas.height = TEXTURE_PIXELS;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("This browser cannot paint the ground texture.");

  const random = seededRandom(PAINT_SEED);
  context.fillStyle = BASE_GRASS;
  context.fillRect(0, 0, TEXTURE_PIXELS, TEXTURE_PIXELS);

  // Pixel sizes below are for a 512-pixel texture, about 43 pixels per metre.
  paintBlots(context, random, 60, GRASS_PATCHES, 20, 56);
  paintBlots(context, random, 14, DIRT_PATCHES, 12, 28);
  paintBlots(context, random, 1800, GRASS_FLECKS, 2, 5);

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
): void {
  for (let blot = 0; blot < count; blot += 1) {
    context.fillStyle = colours[Math.floor(random() * colours.length)] ?? BASE_GRASS;
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
