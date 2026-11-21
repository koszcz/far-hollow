// Compares two screenshots pixel by pixel. scripts/shot.ts uses it for --compare.

/** An image as raw RGBA bytes, four per pixel, row by row from the top left. */
export interface Pixels {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/** The smallest rectangle that holds every differing pixel, in pixels from the top left. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ImageDiff {
  /** The share of pixels that differ, from 0 to 1. */
  readonly share: number;
  /** The box around the differing pixels, or null when none differ. */
  readonly box: Box | null;
  /** The old image, faded towards white, with each differing pixel painted red. For people to look at. */
  readonly image: Pixels;
}

/**
 * A pixel counts as different when one of its red, green, or blue values differs by more than this, out of 255.
 * Smaller gaps are rendering noise, such as dithering and anti-aliasing that change a little between runs.
 */
const PIXEL_THRESHOLD = 16;

/** The colour of a differing pixel in the diff image. */
const DIFF_COLOUR = [255, 0, 0, 255];

/** Compares two images. Images of different sizes count as wholly different. */
export function diffImages(a: Pixels, b: Pixels): ImageDiff {
  if (a.width !== b.width || a.height !== b.height) {
    const image = { width: a.width, height: a.height, data: new Uint8ClampedArray(a.data.length) };
    for (let i = 0; i < image.data.length; i += 4) image.data.set(DIFF_COLOUR, i);
    return { share: 1, box: { x: 0, y: 0, width: a.width, height: a.height }, image };
  }
  const image = { width: a.width, height: a.height, data: new Uint8ClampedArray(a.data.length) };
  let differing = 0;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * 4;
      const [ar = 0, ag = 0, ab = 0] = a.data.subarray(i, i + 3);
      const [br = 0, bg = 0, bb = 0] = b.data.subarray(i, i + 3);
      const gap = Math.max(Math.abs(ar - br), Math.abs(ag - bg), Math.abs(ab - bb));
      if (gap <= PIXEL_THRESHOLD) {
        const grey = (ar + ag + ab) / 3;
        image.data.fill(255 - (255 - grey) / 4, i, i + 3);
        image.data[i + 3] = 255;
        continue;
      }
      image.data.set(DIFF_COLOUR, i);
      differing++;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  const box = differing === 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
  return { share: differing / (a.width * a.height), box, image };
}
