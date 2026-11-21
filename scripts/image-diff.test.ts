import { describe, expect, test } from "bun:test";
import { diffImages, type Pixels } from "./image-diff";

/** Builds a width × height image filled with one colour, then paints the listed pixels another colour. */
function image(width: number, height: number, fill: number[], painted: { x: number; y: number; rgba: number[] }[] = []): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set(fill, i * 4);
  for (const { x, y, rgba } of painted) data.set(rgba, (y * width + x) * 4);
  return { width, height, data };
}

const GREY = [128, 128, 128, 255];
const RED = [255, 0, 0, 255];

describe("diffImages", () => {
  test("two identical images have no differing pixels and no box", () => {
    const result = diffImages(image(4, 3, GREY), image(4, 3, GREY));
    expect(result.share).toBe(0);
    expect(result.box).toBeNull();
  });

  test("changed pixels give their share of the image and the box that holds them", () => {
    const moved = image(10, 10, GREY, [
      { x: 2, y: 3, rgba: RED },
      { x: 6, y: 4, rgba: RED },
      { x: 4, y: 7, rgba: RED },
    ]);
    const result = diffImages(image(10, 10, GREY), moved);
    expect(result.share).toBe(0.03);
    expect(result.box).toEqual({ x: 2, y: 3, width: 5, height: 5 });
  });

  test("a pixel that is only slightly off, such as rendering noise, does not count as different", () => {
    const noisy = image(4, 4, GREY, [
      { x: 1, y: 1, rgba: [131, 126, 129, 255] },
      { x: 3, y: 0, rgba: [124, 128, 128, 255] },
    ]);
    const result = diffImages(image(4, 4, GREY), noisy);
    expect(result.share).toBe(0);
    expect(result.box).toBeNull();
  });

  test("the diff image paints differing pixels red and leaves the rest of the old image faded", () => {
    const result = diffImages(image(2, 1, GREY), image(2, 1, GREY, [{ x: 1, y: 0, rgba: [0, 0, 255, 255] }]));
    expect(result.image.width).toBe(2);
    expect(result.image.height).toBe(1);
    const [same, changed] = [result.image.data.slice(0, 4), result.image.data.slice(4, 8)];
    expect([...changed]).toEqual(RED);
    expect(same[0]).toBeGreaterThan(128);
    expect(same[0]).toBe(same[1] ?? -1);
    expect(same[3]).toBe(255);
  });

  test("images of different sizes count as wholly different", () => {
    const result = diffImages(image(4, 4, GREY), image(4, 3, GREY));
    expect(result.share).toBe(1);
    expect(result.box).toEqual({ x: 0, y: 0, width: 4, height: 4 });
  });
});
