// Perf probe for issue 01: every tree in the valley felled and growing back. Run it from the repo root:
//   PORT=5174 bun scripts/dev.ts
//   bun .scratch/regrowth/measure.ts
// It needs `game` on window.farHollow, so add it there in src/app/main.tsx for the run, then take it out again.
// It opens seed 12345 in Chrome on the real GPU with no frame cap, and prints the mean frame time and draw calls:
// first with the forest standing, then with every tree a sapling on its stump, then every tree a young tree.
import { chromium } from "@playwright/test";
import type { EntityStore } from "../../src/sim/entities";

const FRAMES = 300;
// Edit PORT if your dev server runs elsewhere.
const PORT = 5174;
const url = `http://localhost:${PORT}/?seed=12345`;

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--disable-gpu-vsync", "--disable-frame-rate-limit"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(url);
  await page.waitForFunction(() => "farHollow" in window, null, { timeout: 60_000 });
  await page.waitForTimeout(3000);

  const measure = (label: string) =>
    page
      .evaluate(async (frames: number) => {
        let draws = 0;
        const proto = WebGL2RenderingContext.prototype;
        for (const name of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"] as const) {
          const original = proto[name] as (...args: unknown[]) => void;
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
        times.sort((a, b) => a - b);
        const mean = times.reduce((sum, time) => sum + time, 0) / times.length;
        return { meanMs: mean.toFixed(2), p95Ms: (times[Math.floor(times.length * 0.95)] ?? 0).toFixed(2), drawsPerFrame: Math.round(draws / frames) };
      }, FRAMES)
      .then((result) => {
        console.log(label, JSON.stringify(result));
      });

  const regrowAll = (stage: "sapling" | "youngTree") =>
    page.evaluate((stage) => {
      const { game } = (window as unknown as { farHollow: { game: { entities: EntityStore } } }).farHollow;
      const store = game.entities;
      for (const tree of [...store.with("tree")]) {
        store.removeComponent(tree, "tree");
        store.addComponent(tree, "stump", true);
        store.addComponent(tree, "growth", { stage: "stump", minutesLeft: 1 });
      }
      for (const tree of store.with("growth")) {
        tree.growth = { stage, minutesLeft: 1000 };
        if (stage === "youngTree" && tree.stump === true) store.removeComponent(tree, "stump");
      }
      return store.with("growth").size;
    }, stage);

  await measure("forest standing:");
  console.log("growing trees:", await regrowAll("sapling"));
  await page.waitForTimeout(4000);
  await measure("every tree a sapling on its stump:");
  await regrowAll("youngTree");
  await page.waitForTimeout(1000);
  await measure("every tree a young tree:");
} finally {
  await browser.close();
}
