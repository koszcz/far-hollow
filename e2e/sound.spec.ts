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

test("birds sing by day and crickets chirp at night, following the clock", async ({ page }) => {
  await openGame(page);
  const keysPlaying = async (): Promise<string[]> => (await readSound(page)).playing.map((playing) => playing.key);
  const hourOfDay = (): Promise<number> =>
    page.evaluate(
      () => (window as unknown as { farHollow: { client: { getView(): { time: { hourOfDay: number } } } } }).farHollow.client.getView().time.hourOfDay,
    );
  /** Runs play time on to this hour, then lets the heard daylight catch up over a few real seconds. */
  async function runTo(hour: number): Promise<void> {
    const hoursAhead = (hour - (await hourOfDay()) + 24) % 24;
    await page.evaluate((seconds) => (window as unknown as { farHollow: { advance(seconds: number): number } }).farHollow.advance(seconds), hoursAhead * 60);
    await page.waitForTimeout(2000);
  }

  await runTo(13);
  expect(await keysPlaying()).toContain("birds");
  expect(await keysPlaying()).not.toContain("crickets");

  await runTo(23);
  expect(await keysPlaying()).toContain("crickets");
  expect(await keysPlaying()).not.toContain("birds");
});
