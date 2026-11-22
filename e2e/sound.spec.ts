import { expect, test, type Page } from "@playwright/test";

/** What `window.farHollow.sound()` returns. See `docs/agents/game-testing.md`. */
interface SoundState {
  started: boolean;
  volume: number;
  muted: boolean;
  overall: number;
  playing: { key: string; sound: string; loudness: number; pan: number }[];
  frameMs: number;
}

async function readSound(page: Page): Promise<SoundState> {
  return page.evaluate(() => (window as unknown as { farHollow: { sound(): SoundState } }).farHollow.sound());
}

/** Opens a fixed new game and waits until the loading screen has gone. */
async function openGame(page: Page): Promise<void> {
  await page.goto("/?seed=42");
  await page.waitForFunction(() => "farHollow" in window);
  await expect(page.locator("#loading")).toHaveCount(0);
}

test("sound starts on the first click and plays the river and the forest, cheaply", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openGame(page);
  expect((await readSound(page)).started).toBe(false);

  await page.locator(".hud-sound button").click();
  await expect.poll(async () => (await readSound(page)).started).toBe(true);

  const sound = await readSound(page);
  // The player starts beside the river, so it is loud.
  expect(sound.playing.find((playing) => playing.key === "river")?.loudness).toBeGreaterThan(0.2);
  expect(sound.playing.find((playing) => playing.key === "forest")?.loudness).toBeGreaterThan(0);
  expect(sound.overall).toBeGreaterThan(0);

  // Sound costs under 0.5 ms a frame. Take the slowest of a second's worth of frames, after the first ones warm up.
  let slowest = 0;
  for (let frame = 0; frame < 60; frame += 1) {
    await page.evaluate(() => new Promise(requestAnimationFrame));
    if (frame >= 10) slowest = Math.max(slowest, (await readSound(page)).frameMs);
  }
  expect(slowest).toBeLessThan(0.5);
  expect(errors).toEqual([]);
});

interface ActionHooks {
  client: {
    send(command: unknown): void;
    getView(): { playerPosition: { x: number; z: number } };
    checkPlacement(structure: string, at: { x: number; z: number }, turns: number): { spot: { x: number; z: number }; allowed: boolean };
  };
  sound(): SoundState;
}

/** Collects every sound asset that plays over the next `frames` drawn frames, since footsteps and clicks are short. */
async function soundsOverFrames(page: Page, frames: number): Promise<string[]> {
  return page.evaluate(async (count) => {
    const hooks = (window as unknown as { farHollow: ActionHooks }).farHollow;
    const heard = new Set<string>();
    for (let frame = 0; frame < count; frame += 1) {
      await new Promise(requestAnimationFrame);
      for (const playing of hooks.sound().playing) heard.add(playing.sound);
    }
    return [...heard];
  }, frames);
}

test("walking plays footsteps, and placing and building a blueprint play their sounds until the work stops", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?seed=42&playground");
  await page.waitForFunction(() => "farHollow" in window);
  await expect(page.locator("#loading")).toHaveCount(0);

  await page.evaluate(() => {
    const { client } = (window as unknown as { farHollow: ActionHooks }).farHollow;
    const { x, z } = client.getView().playerPosition;
    client.send({ type: "walkTo", x: x + 6, z });
  });
  expect(await soundsOverFrames(page, 60)).toContain("sound-footstep");

  // Places a campfire blueprint on the first open spot nearby and builds it, which costs nothing in the playground.
  // The click is short, so listen over the frames after it.
  const placedAt = await page.evaluate(() => {
    const { client } = (window as unknown as { farHollow: ActionHooks }).farHollow;
    const { x, z } = client.getView().playerPosition;
    for (let dx = -4; dx <= 4; dx += 1) {
      for (let dz = -4; dz <= 4; dz += 1) {
        if (Math.hypot(dx, dz) < 2) continue;
        const check = client.checkPlacement("campfire", { x: x + dx, z: z + dz }, 0);
        if (!check.allowed) continue;
        client.send({ type: "placeBlueprint", structure: "campfire", turns: 0, x: check.spot.x, z: check.spot.z, thenBuild: true });
        return check.spot;
      }
    }
    return null;
  });
  expect(placedAt).not.toBeNull();
  expect(await soundsOverFrames(page, 15)).toContain("sound-place");

  await expect.poll(async () => (await readSound(page)).playing.map((playing) => playing.sound)).toContain("sound-build");

  await page.evaluate(() => {
    const { client } = (window as unknown as { farHollow: ActionHooks }).farHollow;
    client.send({ type: "stopBuilding" });
  });
  await expect.poll(async () => (await readSound(page)).playing.map((playing) => playing.sound)).not.toContain("sound-build");
  expect(errors).toEqual([]);
});

test("M mutes, the sound button shows it, and the Volume and mute survive a reload", async ({ page }) => {
  await openGame(page);
  await page.locator("#scene").click({ position: { x: 5, y: 5 } });

  await page.locator(".hud-sound button").click();
  const slider = page.getByRole("slider", { name: "Volume" });
  await slider.fill("30");
  expect((await readSound(page)).volume).toBeCloseTo(0.3);

  await page.keyboard.press("m");
  await expect(page.getByRole("button", { name: "Sound: muted" })).toBeVisible();
  const muted = await readSound(page);
  expect(muted.muted).toBe(true);
  expect(muted.overall).toBe(0);

  await openGame(page);
  const reloaded = await readSound(page);
  expect(reloaded).toMatchObject({ muted: true });
  expect(reloaded.volume).toBeCloseTo(0.3);
  await page.keyboard.press("m");
  expect((await readSound(page)).muted).toBe(false);
});
