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

/** Compares the image from before a change with the one after it. Images of different sizes count as wholly different. */
export function diffImages(before: Pixels, after: Pixels): ImageDiff {
  const image = { width: before.width, height: before.height, data: new Uint8ClampedArray(before.data.length) };
  if (before.width !== after.width || before.height !== after.height) {
    for (let i = 0; i < image.data.length; i += 4) image.data.set(DIFF_COLOUR, i);
    return { share: 1, box: { x: 0, y: 0, width: before.width, height: before.height }, image };
  }
  let differing = 0;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (let y = 0; y < before.height; y++) {
    for (let x = 0; x < before.width; x++) {
      const i = (y * before.width + x) * 4;
      const [beforeRed = 0, beforeGreen = 0, beforeBlue = 0] = before.data.subarray(i, i + 3);
      const [afterRed = 0, afterGreen = 0, afterBlue = 0] = after.data.subarray(i, i + 3);
      const gap = Math.max(Math.abs(beforeRed - afterRed), Math.abs(beforeGreen - afterGreen), Math.abs(beforeBlue - afterBlue));
      if (gap <= PIXEL_THRESHOLD) {
        const grey = (beforeRed + beforeGreen + beforeBlue) / 3;
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
  return { share: differing / (before.width * before.height), box, image };
}
