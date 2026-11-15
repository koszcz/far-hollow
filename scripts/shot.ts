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
//
// It prints any page errors. Read the game's state through window.farHollow before you reach for a screenshot.
// See docs/agents/game-testing.md.
import { chromium, type Page } from "@playwright/test";
import { parseArgs } from "node:util";

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
  },
});

const [path, out] = positionals;
if (path === undefined || out === undefined || !out.endsWith(".png")) {
  console.error("Usage: bun scripts/shot.ts <path> <out.png> [--hover css] [--click css] [--press key]");
  console.error("       [--element css] [--wait ms] [--at s,s,...] [--size WxH]");
  process.exit(1);
}
const [width, height] = values.size.split("x").map(Number);
if (width === undefined || height === undefined || !(width > 0) || !(height > 0)) {
  console.error(`--size must look like 1280x800, not "${values.size}".`);
  process.exit(1);
}

/** Starts the dev server on a free port and returns its address. */
async function startDevServer(): Promise<{ url: string; stop: () => void }> {
  const probe = Bun.serve({ port: 0, fetch: () => new Response() });
  const port = probe.port;
  await probe.stop(true);
  const server = Bun.spawn(["bun", `${import.meta.dir}/dev.ts`], {
    env: { ...process.env, PORT: String(port) },
    stdout: "pipe",
    stderr: "inherit",
  });
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

const server = await startDevServer();
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    // Failed loads are reported with their address below, so skip the browser's vaguer message.
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });

  await page.goto(server.url + path);
  await waitUntilReady(page, path.includes("asset="));
  if (values.click !== undefined) await page.locator(values.click).first().click();
  for (const key of values.press ?? []) await page.keyboard.press(key);
  if (values.hover !== undefined) await page.locator(values.hover).first().hover();
  await page.waitForTimeout(Number(values.wait));

  const shoot = async (file: string): Promise<void> => {
    if (values.element === undefined) await page.screenshot({ path: file });
    else await page.locator(values.element).first().screenshot({ path: file });
    console.log(`saved ${file}`);
  };

  if (values.at === undefined) {
    await shoot(out);
  } else {
    const start = Date.now();
    for (const seconds of values.at.split(",").map(Number)) {
      const wait = seconds * 1000 - (Date.now() - start);
      if (wait > 0) await page.waitForTimeout(wait);
      await shoot(out.replace(/\.png$/, `-${seconds}s.png`));
    }
  }
  console.log(errors.length === 0 ? "no page errors" : `page errors:\n${errors.join("\n")}`);
} finally {
  await browser.close();
  server.stop();
}
