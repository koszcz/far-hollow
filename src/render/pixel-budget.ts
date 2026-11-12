/**
 * The most pixels the game draws each frame. Drawing time grows with the number of pixels, so a large Retina or
 * ultrawide screen at full detail (about 5 million pixels) drops the frame rate by about a third. Above this budget,
 * the game draws a smaller picture and the browser stretches it to fill the canvas.
 */
export const MAX_DRAWN_PIXELS = 3_000_000;

/**
 * How many drawn pixels to use per CSS pixel of a canvas this many CSS pixels wide and high.
 * It is the screen's pixel ratio, lowered just enough to keep the drawn pixels within MAX_DRAWN_PIXELS.
 */
export function drawnPixelRatio(widthCssPixels: number, heightCssPixels: number, screenPixelRatio: number): number {
  const cssPixels = widthCssPixels * heightCssPixels;
  if (cssPixels <= 0) return screenPixelRatio;
  return Math.min(screenPixelRatio, Math.sqrt(MAX_DRAWN_PIXELS / cssPixels));
}
