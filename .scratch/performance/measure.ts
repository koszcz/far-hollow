// Perf probe for issue 01. Start the dev server, then run:
//   bun .scratch/performance/measure.ts
// It expects the dev server on port 5174. Edit PORT below if yours runs elsewhere.
// It starts seed 12345 in headless Chrome on the real GPU, then prints, per pixel ratio:
// the CPU time per frame, the frame time with the GPU waited on, draw calls, and thousands of vertices per frame.
import { chromium } from "@playwright/test";

const PORT = 5174;
const url = `http://localhost:${PORT}/`;
const pixelRatios = [1, 2];
const FRAMES = 150;

for (const pixelRatio of pixelRatios) {
  const browser = await chromium.launch({
    channel: "chrome",
    args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--disable-gpu-vsync", "--disable-frame-rate-limit"],
  });
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 }, deviceScaleFactor: pixelRatio });
  await page.addInitScript(() => {
    localStorage.clear();
  });
  await page.goto(url);
  await page.getByRole("listitem").nth(1).getByRole("button", { name: "New game" }).click();
  await page.getByLabel("Seed").fill("12345");
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForFunction(() => "farHollow" in window);
  await page.waitForTimeout(3000);
  const result: unknown = await page.evaluate(async (frames: number) => {
    const canvas = [...document.querySelectorAll("canvas")].sort((a, b) => b.width * b.height - a.width * a.height).at(0);
    if (canvas === undefined) return { error: "No canvas" };
    const gl = canvas.getContext("webgl2");
    if (gl === null) return { error: "No WebGL2 canvas" };
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const gpu: unknown = info === null ? "?" : gl.getParameter(info.UNMASKED_RENDERER_WEBGL);
    let draws = 0;
    let vertices = 0;
    const proto = WebGL2RenderingContext.prototype;
    /** Wraps one draw method, counting its calls and the vertices it draws. */
    function countDraws(name: string, verticesOf: (args: number[]) => number): void {
      const original: unknown = Reflect.get(proto, name);
      if (typeof original !== "function") return;
      Reflect.set(proto, name, function (this: WebGL2RenderingContext, ...args: number[]): void {
        draws += 1;
        vertices += verticesOf(args);
        Reflect.apply(original, this, args);
      });
    }
    countDraws("drawElements", (args) => args[1] ?? 0);
    countDraws("drawArrays", (args) => args[2] ?? 0);
    countDraws("drawElementsInstanced", (args) => (args[1] ?? 0) * (args[4] ?? 0));
    countDraws("drawArraysInstanced", (args) => (args[2] ?? 0) * (args[3] ?? 0));
    const pixel = new Uint8Array(4);
    async function sample(waitForGpu: boolean): Promise<number[]> {
      const times: number[] = [];
      await new Promise<void>((done) => {
        function tick(start: number): void {
          if (waitForGpu) gl?.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          times.push(performance.now() - start);
          if (times.length < frames) requestAnimationFrame(tick);
          else done();
        }
        requestAnimationFrame(tick);
      });
      return times.sort((a, b) => a - b);
    }
    const at = (times: number[], share: number) => Math.round((times[Math.floor(times.length * share)] ?? 0) * 10) / 10;
    const cpu = await sample(false);
    draws = 0;
    vertices = 0;
    const total = await sample(true);
    return {
      gpu,
      buffer: `${canvas.width}x${canvas.height}`,
      cpuMedianMs: at(cpu, 0.5),
      totalMedianMs: at(total, 0.5),
      totalP95Ms: at(total, 0.95),
      drawsPerFrame: Math.round(draws / frames),
      kVertsPerFrame: Math.round(vertices / frames / 1000),
    };
  }, FRAMES);
  console.log(JSON.stringify({ pixelRatio, result }));
  await browser.close();
}
