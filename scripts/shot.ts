// Takes screenshots of the game or of an asset showcase, for checking how something looks.
// It starts its own dev server on a free port, so it works in any worktree without a running server.
//
// Usage: bun scripts/shot.ts <path> <out.png> [options]
//   <path>             The page to open, such as "/?seed=42" or "/?asset=bed".
//   <out.png>          Where to save the screenshot. With --at, each shot gets its time in its name.
//   --hover <css>      Point at the first element that matches before the shot.
//   --click <css>      Click the first element that matches before the shot.
//   --press <key>      Press a key before the shot, such as "b". You can repeat it.
//   --element <css>    Save only the first element that matches, not the whole page.
//   --wait <ms>        Wait this long after the page is ready. The default is 300.
//   --at <s,s,...>     Take one shot at each time, in seconds after the page is ready, to show an animation.
//   --size <WxH>       The window size. The default is 1280x800, the same as the browser tests.
//   --compare <commit> Also take the same shots on an older commit, such as HEAD or main, and compare each pair.
//                      It prints the share of pixels that changed and the box that holds them, so you need not open either image.
//                      It saves the old shot as out-old.png and a diff image as out-diff.png, with changed pixels in red.
//                      The current shots include uncommitted changes. The old code runs in a temporary worktree that is removed afterwards.
//   --tolerance <share> With --compare, exit with code 1 when more than this share of pixels changed. The default is 0.001 (0.1%).
//
// It prints any page errors. Read the game's state through window.farHollow before you reach for a screenshot.
// See docs/agents/game-testing.md.
import { chromium, type Browser, type Page } from "@playwright/test";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { diffImages, type Pixels } from "./image-diff";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    hover: { type: "string" },
    click: { type: "string" },
    press: { type: "string", multiple: true },
    element: { type: "string" },
    wait: { type: "string", default: "300" },
    at: { type: "string" },
    size: { type: "string", default: "1280x800" },
    compare: { type: "string" },
    tolerance: { type: "string", default: "0.001" },
  },
});

const [path, out] = positionals;
if (path === undefined || out === undefined || !out.endsWith(".png")) {
  console.error("Usage: bun scripts/shot.ts <path> <out.png> [--hover css] [--click css] [--press key]");
  console.error("       [--element css] [--wait ms] [--at s,s,...] [--size WxH] [--compare commit] [--tolerance share]");
  process.exit(1);
}
const [width, height] = values.size.split("x").map(Number);
if (width === undefined || height === undefined || !(width > 0) || !(height > 0)) {
  console.error(`--size must look like 1280x800, not "${values.size}".`);
  process.exit(1);
}
const tolerance = Number(values.tolerance);
if (!(tolerance >= 0 && tolerance <= 1)) {
  console.error(`--tolerance must be a share from 0 to 1, such as 0.001, not "${values.tolerance}".`);
  process.exit(1);
}
const pagePath = path;
const viewport = { width, height };

/** One shot to take: where to save it, and when, in seconds after the page is ready. */
interface Shot {
  readonly file: string;
  readonly seconds: number;
}

/** The shots to take: one at once to `out`, or one per --at time, with its time in the file name. */
const SHOTS: readonly Shot[] =
  values.at === undefined
    ? [{ file: out, seconds: 0 }]
    : values.at.split(",").map((time) => ({ file: out.replace(/\.png$/, `-${Number(time)}s.png`), seconds: Number(time) }));

/** Where the old shot of a pair goes with --compare. */
const oldFileOf = (file: string): string => file.replace(/\.png$/, "-old.png");

/** The root of the checkout this script lives in. */
const ROOT = resolve(import.meta.dir, "..");

/** The dev servers this script has started and not yet stopped, so an interrupted run can stop them. */
const runningServers = new Set<Bun.Subprocess>();

/** Starts the dev server of the checkout at `root` on a free port and returns its address. */
async function startDevServer(root: string): Promise<{ url: string; stop: () => void }> {
  const probe = Bun.serve({ port: 0, fetch: () => new Response() });
  const port = probe.port;
  await probe.stop(true);
  // The dev server reads bunfig.toml from its working folder, so it runs from the root it serves.
  const server = Bun.spawn(["bun", "scripts/dev.ts"], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdout: "pipe",
    stderr: "inherit",
  });
  runningServers.add(server);
  void server.exited.then(() => runningServers.delete(server));
  const url = `http://localhost:${port}`;
  for (let tries = 0; tries < 100; tries++) {
    const ready = await fetch(url).then(
      (response) => response.ok,
      () => false,
    );
    if (ready) {
      return {
        url,
        stop: () => {
          server.kill();
        },
      };
    }
    await Bun.sleep(100);
  }
  server.kill();
  throw new Error(`The dev server did not start on port ${port}.`);
}

/** Waits until the showcase has drawn, or until the game has loaded. */
async function waitUntilReady(page: Page, isShowcase: boolean): Promise<void> {
  if (isShowcase) {
    await page.waitForFunction(() => document.body.dataset.showcase === "ready", null, { timeout: 60_000 });
  } else {
    await page.waitForFunction(() => "farHollow" in window, null, { timeout: 60_000 });
    await page.locator("#loading").waitFor({ state: "detached", timeout: 60_000 });
  }
}

/** Serves the checkout at `root`, opens the page, and takes the shots, saving each to `fileOf(shot)`. Prints any page errors. */
async function takeShots(browser: Browser, root: string, fileOf: (shot: Shot) => string): Promise<void> {
  const server = await startDevServer(root);
  const page = await browser.newPage({ viewport });
  try {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      // Failed loads are reported with their address below, so skip the browser's vaguer message.
      if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });

    await page.goto(server.url + pagePath);
    await waitUntilReady(page, pagePath.includes("asset="));
    if (values.click !== undefined) await page.locator(values.click).first().click();
    for (const key of values.press ?? []) await page.keyboard.press(key);
    if (values.hover !== undefined) await page.locator(values.hover).first().hover();
    await page.waitForTimeout(Number(values.wait));

    const start = Date.now();
    for (const shot of SHOTS) {
      const wait = shot.seconds * 1000 - (Date.now() - start);
      if (wait > 0) await page.waitForTimeout(wait);
      const file = fileOf(shot);
      if (values.element === undefined) await page.screenshot({ path: file });
      else await page.locator(values.element).first().screenshot({ path: file });
      console.log(`saved ${file}`);
    }
    console.log(errors.length === 0 ? "no page errors" : `page errors:\n${errors.join("\n")}`);
  } finally {
    await page.close();
    server.stop();
  }
}

/** Checks out `commit` in a new temporary worktree that reuses this checkout's node_modules. */
function addOldWorktree(commit: string): { folder: string; remove: () => void } {
  const sha = Bun.spawnSync(["git", "-C", ROOT, "rev-parse", "--verify", "--quiet", `${commit}^{commit}`], { stdout: "pipe" });
  if (sha.exitCode !== 0) throw new Error(`--compare: "${commit}" is not a commit in this repository.`);
  const folder = mkdtempSync(join(tmpdir(), "far-hollow-shot-"));
  let removed = false;
  const remove = (): void => {
    if (removed) return;
    removed = true;
    Bun.spawnSync(["git", "-C", ROOT, "worktree", "remove", "--force", folder], { stdout: "ignore", stderr: "ignore" });
    rmSync(folder, { recursive: true, force: true });
    Bun.spawnSync(["git", "-C", ROOT, "worktree", "prune"], { stdout: "ignore", stderr: "ignore" });
  };
  try {
    const added = Bun.spawnSync(["git", "-C", ROOT, "worktree", "add", "--detach", folder, sha.stdout.toString().trim()], { stdout: "ignore", stderr: "pipe" });
    if (added.exitCode !== 0) throw new Error(`Could not check out ${commit}: ${added.stderr.toString().trim()}`);
    symlinkSync(join(ROOT, "node_modules"), join(folder, "node_modules"));
  } catch (error) {
    remove();
    throw error;
  }
  return { folder, remove };
}

/** Reads a PNG file into raw pixels, using the browser's image decoder so no system image tools are needed. */
async function readPng(page: Page, file: string): Promise<Pixels> {
  const png = Buffer.from(await Bun.file(file).arrayBuffer()).toString("base64");
  const decoded = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }), { colorSpaceConversion: "none", premultiplyAlpha: "none" });
    const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext("2d");
    if (context === null) throw new Error("The browser has no 2D canvas.");
    context.drawImage(bitmap, 0, 0);
    const data = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    let binary = "";
    for (let i = 0; i < data.length; i += 0x8000) binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
    return { width: bitmap.width, height: bitmap.height, data: btoa(binary) };
  }, png);
  return { width: decoded.width, height: decoded.height, data: new Uint8ClampedArray(Buffer.from(decoded.data, "base64")) };
}

/** Saves raw pixels as a PNG file, using the browser's image encoder. */
async function writePng(page: Page, file: string, image: Pixels): Promise<void> {
  const raw = Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength).toString("base64");
  const png = await page.evaluate(
    async ({ width, height, raw }) => {
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("The browser has no 2D canvas.");
      const pixels = Uint8ClampedArray.from(atob(raw), (char) => char.charCodeAt(0));
      context.putImageData(new ImageData(pixels, width, height), 0, 0);
      const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(binary);
    },
    { width: image.width, height: image.height, raw },
  );
  await Bun.write(file, Buffer.from(png, "base64"));
}

/** Compares each new shot with its old one, prints the result, and returns whether every pair is within the tolerance. */
async function compareShots(browser: Browser): Promise<boolean> {
  const page = await browser.newPage();
  try {
    let withinTolerance = true;
    for (const { file } of SHOTS) {
      const diff = diffImages(await readPng(page, oldFileOf(file)), await readPng(page, file));
      const diffFile = file.replace(/\.png$/, "-diff.png");
      await writePng(page, diffFile, diff.image);
      const percent = `${(diff.share * 100).toFixed(3)}%`;
      const box = diff.box === null ? "" : `, in the box x=${diff.box.x} y=${diff.box.y} width=${diff.box.width} height=${diff.box.height}`;
      const verdict = diff.share > tolerance ? "DIFFERENT" : "same";
      console.log(`${verdict}: ${file} has ${percent} of its pixels changed${box}. Diff image: ${diffFile}`);
      if (diff.share > tolerance) withinTolerance = false;
    }
    return withinTolerance;
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({ channel: "chrome" });
let worktree: { folder: string; remove: () => void } | undefined;
const stopOnSignal = (): void => {
  for (const server of runningServers) server.kill();
  worktree?.remove();
  process.exit(130);
};
process.on("SIGINT", stopOnSignal);
process.on("SIGTERM", stopOnSignal);
try {
  if (values.compare === undefined) {
    await takeShots(browser, ROOT, (shot) => shot.file);
  } else {
    worktree = addOldWorktree(values.compare);
    console.log("new shots, from the current code:");
    await takeShots(browser, ROOT, (shot) => shot.file);
    console.log(`old shots, from ${values.compare}:`);
    await takeShots(browser, worktree.folder, (shot) => oldFileOf(shot.file));
    worktree.remove();
    if (!(await compareShots(browser))) {
      console.log(`More than ${tolerance * 100}% of the pixels changed. Set the limit with --tolerance.`);
      process.exitCode = 1;
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  worktree?.remove();
  await browser.close();
}
