// Frame-rate probe for ticket 09: ground types and undergrowth. Run it from the repo root:
//   PORT=5174 bun scripts/dev.ts
//   bun .scratch/forest-floor/measure.ts
// It opens seed 12345 in Chrome on the real GPU with no frame cap. It walks the player to a dense forest and to an open
// river bank with the dev hooks, and prints the mean frame time, the 95th percentile, and the draw calls at each spot.
// The spots come from the valley of seed 12345: the most trees within 25 m, and a river bank spot with no tree within 25 m.
import { chromium } from "@playwright/test";

const FRAMES = 600;
// Edit PORT if your dev server runs elsewhere.
const PORT = 5174;
const url = `http://localhost:${PORT}/?seed=12345`;
const WIDTH = 1512;
const HEIGHT = 900;
const PIXEL_RATIO = 2;

const spots = [
  { label: "start spot", x: 1.5, z: 0.5 },
  { label: "dense forest (103 trees within 25 m)", x: -80, z: 70 },
  { label: "open river bank (no tree within 25 m)", x: -1.5, z: 22.5 },
];

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--disable-gpu-vsync", "--disable-frame-rate-limit"],
});
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: PIXEL_RATIO });
  page.on("pageerror", (error) => {
    console.log("page error:", error.message);
  });
  await page.goto(url);
  await page.waitForFunction(() => "farHollow" in window, null, { timeout: 60_000 });
  await page.waitForTimeout(3000);
  const renderer = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    return info ? String(gl?.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "unknown";
  });
  console.log(`seed 12345, ${WIDTH} by ${HEIGHT} at pixel ratio ${PIXEL_RATIO}, ${FRAMES} frames, GPU: ${renderer}`);

  for (const spot of spots) {
    const reached = await page.evaluate(({ x, z }) => {
      type Hooks = {
        client: { send(command: unknown): void; getView(): { playerPosition: { x: number; z: number } } };
        advance(seconds: number): number;
      };
      const hooks = (window as unknown as { farHollow: Hooks }).farHollow;
      const { client } = hooks;
      client.send({ type: "walkTo", x, z });
      for (let tries = 0; tries < 20; tries += 1) hooks.advance(10);
      return client.getView().playerPosition;
    }, spot);
    await page.waitForTimeout(3000);
    const result = await page.evaluate(async (frames: number) => {
      let draws = 0;
      const proto = WebGL2RenderingContext.prototype;
      const originals: Record<string, unknown> = {};
      for (const name of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"] as const) {
        const original = proto[name] as (...args: unknown[]) => void;
        originals[name] = original;
        (proto as unknown as Record<string, unknown>)[name] = function (this: unknown, ...args: unknown[]) {
          draws += 1;
          original.apply(this, args);
        };
      }
      const times: number[] = [];
      let last = performance.now();
      await new Promise<void>((done) => {
        const tick = (now: number) => {
          times.push(now - last);
          last = now;
          if (times.length < frames) requestAnimationFrame(tick);
          else done();
        };
        requestAnimationFrame(tick);
      });
      Object.assign(proto, originals);
      times.sort((a, b) => a - b);
      const mean = times.reduce((sum, time) => sum + time, 0) / times.length;
      return {
        meanMs: mean.toFixed(2),
        p95Ms: (times[Math.floor(times.length * 0.95)] ?? 0).toFixed(2),
        maxMs: (times.at(-1) ?? 0).toFixed(2),
        drawsPerFrame: Math.round(draws / frames),
      };
    }, FRAMES);
    const at = `player at ${reached.x.toFixed(1)}, ${reached.z.toFixed(1)}`;
    console.log(`${spot.label}, ${at}:`, JSON.stringify(result));
  }
} finally {
  await browser.close();
}
