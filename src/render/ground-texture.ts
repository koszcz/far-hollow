// Paints the "terrain" asset's textures in code: one repeating texture for each ground type
// (forest floor, clearing, and river bank), and a map of how much of each type shows across the valley.
// The ground mesh in valley-meshes.ts blends the three textures with that map.
// The terrain is approved in asset-manifest.json.
import * as THREE from "three";
import { groundTypeWeightsAt, smoothNoise, type GroundMap, type GroundType } from "../sim/ground-types";

/** Each painted texture covers a square this many metres on each side before it repeats. */
export const GROUND_TEXTURE_TILE_METRES = 12;

const TEXTURE_PIXELS = 512;

/** Painted marks are sized for a 512-pixel texture that covers 12 m, about 43 pixels per metre. */
type Painter = (context: CanvasRenderingContext2D, random: () => number) => void;

interface GroundPaint {
  /** Fixed seed, so the ground looks the same in every game. */
  readonly seed: number;
  readonly base: string;
  /** Large soft patches, drawn first. They are close to the base colour, so they never read as spots. */
  readonly patches: readonly string[];
  /** Draws the small detail on top, such as grass blades, needles, or pebbles. */
  readonly detail: Painter;
}

const PAINTS: Readonly<Record<GroundType, GroundPaint>> = {
  // Short grass blades in several greens, with a few dry blades and bits of clover.
  clearing: {
    seed: 7,
    base: "#5f7f36",
    patches: ["#5a7a33", "#67883c", "#617f38", "#6a8a3e"],
    detail(context, random) {
      paintStrokes(context, random, 5200, ["#4f6e2c", "#6f9442", "#7ea24c", "#587a30", "#86a856", "#93a45a"], 5, 13, 1.4, 2.4);
      paintStrokes(context, random, 500, ["#a4a35e", "#8f8c4e"], 5, 11, 1.2, 1.8);
      paintBlots(context, random, 160, ["#4b6a2a", "#76a04a"], 2, 4);
    },
  },
  // Brown needle and leaf litter with a little moss, darker than a clearing.
  forestFloor: {
    seed: 11,
    base: "#4f3d2a",
    patches: ["#4a3a28", "#56432e", "#4c3f29", "#4a4d2a", "#5a452f"],
    detail(context, random) {
      paintBlots(context, random, 40, ["#4c5a2c", "#56632f"], 8, 18);
      paintStrokes(context, random, 4200, ["#6e5234", "#7c5e3a", "#453422", "#634629", "#86663e", "#584026"], 5, 11, 0.7, 1.1);
      paintLeaves(context, random, 260, ["#8a5a2c", "#a0702e", "#6e4826", "#9a8040", "#7a3e22"]);
    },
  },
  // Wet mud with sand grains and shaded grey and sandy pebbles.
  riverBank: {
    seed: 13,
    base: "#5e4f3c",
    patches: ["#57493a", "#665643", "#5a4d3b", "#4f4335"],
    detail(context, random) {
      paintBlots(context, random, 1600, ["#77684f", "#4c4032", "#837358"], 0.8, 1.8);
      paintPebbles(context, random, 340, ["#9a948a", "#b0a894", "#7f7a72", "#c2b49a", "#8a8478", "#a39a86"]);
    },
  },
};

/**
 * Paints the clearing's seamless grass texture on a canvas. Needs a browser `document`.
 * Only the asset showcase uses it, for the flat ground under a prop. The valley uses createGroundTypeTextures.
 */
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

/** Large-scale light and dark patches change over about this many metres, so the repeating textures do not show a pattern. */
const PATCH_SPACING_METRES = 23;
/** Which of two texture sizes shows changes over about this many metres. */
const TEXTURE_MIX_SPACING_METRES = 9;

/**
 * Bakes the ground map across the valley, `texels` × `texels` spots, row by row.
 * Row 0 is the edge at z = -size / 2. Column 0 is the edge at x = -size / 2.
 * Each spot has four bytes, from 0 to 255:
 * 1. how much forest floor shows,
 * 2. how bright the ground is there, from 0 (darkest) to 255 (brightest),
 * 3. how much river bank shows,
 * 4. how much of the larger texture size shows.
 * Clearing fills whatever forest floor and river bank leave.
 */
export function bakeGroundTypeWeights(map: GroundMap, texels: number): Uint8Array {
  const data = new Uint8Array(texels * texels * 4);
  const step = map.size / texels;
  const half = map.size / 2;
  const toByte = (amount: number) => Math.round(Math.min(1, Math.max(0, amount)) * 255);
  for (let row = 0; row < texels; row += 1) {
    const z = -half + (row + 0.5) * step;
    for (let column = 0; column < texels; column += 1) {
      const x = -half + (column + 0.5) * step;
      const weights = groundTypeWeightsAt(map, { x, z });
      const brightness =
        0.65 * smoothNoise(x / PATCH_SPACING_METRES + 311, z / PATCH_SPACING_METRES) +
        0.35 * smoothNoise(x / (PATCH_SPACING_METRES / 3) + 97, z / (PATCH_SPACING_METRES / 3));
      const textureMix = smoothNoise(x / TEXTURE_MIX_SPACING_METRES + 503, z / TEXTURE_MIX_SPACING_METRES);
      const index = (row * texels + column) * 4;
      data[index] = toByte(weights.forestFloor);
      data[index + 1] = toByte(0.5 + brightness * 0.5);
      data[index + 2] = toByte(weights.riverBank);
      data[index + 3] = toByte(0.5 + textureMix * 0.9);
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
  context.lineCap = "round";
  paintBlots(context, random, 50, paint.patches, 24, 64);
  paint.detail(context, random);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  // three.js lowers this to what the graphics card supports.
  texture.anisotropy = 8;
  return texture;
}

/** Draws a mark at a spot, and again across each edge it might cross, so the texture repeats without seams. */
function drawWrapped(x: number, y: number, draw: (x: number, y: number) => void): void {
  for (const shiftX of [-TEXTURE_PIXELS, 0, TEXTURE_PIXELS]) {
    for (const shiftY of [-TEXTURE_PIXELS, 0, TEXTURE_PIXELS]) {
      draw(x + shiftX, y + shiftY);
    }
  }
}

function pick(random: () => number, colours: readonly string[]): string {
  return colours[Math.floor(random() * colours.length)] ?? "#000000";
}

/** Paints soft oval blots. */
function paintBlots(
  context: CanvasRenderingContext2D,
  random: () => number,
  count: number,
  colours: readonly string[],
  minRadius: number,
  maxRadius: number,
): void {
  for (let blot = 0; blot < count; blot += 1) {
    context.fillStyle = pick(random, colours);
    const radius = minRadius + random() * (maxRadius - minRadius);
    const turn = random() * Math.PI;
    drawWrapped(random() * TEXTURE_PIXELS, random() * TEXTURE_PIXELS, (x, y) => {
      context.beginPath();
      context.ellipse(x, y, radius, radius * 0.7, turn, 0, Math.PI * 2);
      context.fill();
    });
  }
}

/** Paints short straight strokes in random directions, such as grass blades or pine needles. */
function paintStrokes(
  context: CanvasRenderingContext2D,
  random: () => number,
  count: number,
  colours: readonly string[],
  minLength: number,
  maxLength: number,
  minWidth: number,
  maxWidth: number,
): void {
  for (let stroke = 0; stroke < count; stroke += 1) {
    context.strokeStyle = pick(random, colours);
    context.lineWidth = minWidth + random() * (maxWidth - minWidth);
    const length = minLength + random() * (maxLength - minLength);
    const turn = random() * Math.PI * 2;
    const dx = Math.cos(turn) * length;
    const dy = Math.sin(turn) * length;
    drawWrapped(random() * TEXTURE_PIXELS, random() * TEXTURE_PIXELS, (x, y) => {
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + dx, y + dy);
      context.stroke();
    });
  }
}

/** Paints fallen leaves: pointed ovals with a darker middle vein. */
function paintLeaves(context: CanvasRenderingContext2D, random: () => number, count: number, colours: readonly string[]): void {
  for (let leaf = 0; leaf < count; leaf += 1) {
    const colour = pick(random, colours);
    const length = 6 + random() * 6;
    const turn = random() * Math.PI * 2;
    drawWrapped(random() * TEXTURE_PIXELS, random() * TEXTURE_PIXELS, (x, y) => {
      context.save();
      context.translate(x, y);
      context.rotate(turn);
      context.fillStyle = colour;
      context.beginPath();
      context.moveTo(-length, 0);
      context.quadraticCurveTo(0, -length * 0.55, length, 0);
      context.quadraticCurveTo(0, length * 0.55, -length, 0);
      context.fill();
      context.strokeStyle = "rgba(40, 24, 12, 0.45)";
      context.lineWidth = 0.8;
      context.beginPath();
      context.moveTo(-length * 0.8, 0);
      context.lineTo(length * 0.8, 0);
      context.stroke();
      context.restore();
    });
  }
}

/** Paints round pebbles, each with a soft shadow below and a light spot on top, so they look raised. */
function paintPebbles(context: CanvasRenderingContext2D, random: () => number, count: number, colours: readonly string[]): void {
  for (let pebble = 0; pebble < count; pebble += 1) {
    const colour = pick(random, colours);
    const radius = 2.5 + random() * random() * 8;
    const squash = 0.6 + random() * 0.35;
    const turn = random() * Math.PI;
    drawWrapped(random() * TEXTURE_PIXELS, random() * TEXTURE_PIXELS, (x, y) => {
      const oval = (centreX: number, centreY: number, size: number) => {
        context.beginPath();
        context.ellipse(centreX, centreY, size, size * squash, turn, 0, Math.PI * 2);
        context.fill();
      };
      context.fillStyle = "rgba(30, 22, 14, 0.5)";
      oval(x + radius * 0.25, y + radius * 0.3, radius * 1.1);
      context.fillStyle = colour;
      oval(x, y, radius);
      context.fillStyle = "rgba(255, 250, 235, 0.28)";
      oval(x - radius * 0.3, y - radius * 0.3, radius * 0.45);
    });
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
