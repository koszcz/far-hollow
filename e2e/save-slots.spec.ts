import { expect, test, type Page } from "@playwright/test";

/** Reads the game's seed and step count from the game's view. The dev build puts the game client on `window.farHollow`. */
async function gameView(page: Page): Promise<{ seed: number; stepCount: number }> {
  return page.evaluate(() => {
    const game = (window as unknown as { farHollow: { client: { getView(): { seed: number; stepCount: number } } } }).farHollow;
    const view = game.client.getView();
    return { seed: view.seed, stepCount: view.stepCount };
  });
}

/** Hides the page so the game autosaves, the way it does when the player switches tabs. */
async function hidePage(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("visibilitychange"));
  });
}

test("the player starts a game with a typed seed in a slot, then continues it after a reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  const slots = page.getByRole("listitem");
  await expect(slots).toHaveCount(3);
  await expect(slots.nth(1)).toContainText("Empty");

  await slots.nth(1).getByRole("button", { name: "New game" }).click();
  await page.getByLabel("Seed").fill("42");
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForFunction(() => "farHollow" in window);
  expect((await gameView(page)).seed).toBe(42);
  await expect.poll(async () => (await gameView(page)).stepCount).toBeGreaterThan(0);
  await hidePage(page);

  await page.reload();
  await expect(slots.nth(1)).toContainText("Seed 42");
  await expect(slots.nth(1)).toContainText("Day 1");
  await expect(slots.nth(0)).toContainText("Empty");

  await slots.nth(1).getByRole("button", { name: "Continue" }).click();
  await page.waitForFunction(() => "farHollow" in window);
  const continued = await gameView(page);
  expect(continued.seed).toBe(42);
  expect(continued.stepCount).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("starting over a filled slot asks the player to confirm first", async ({ page }) => {
  await page.goto("/");
  const slots = page.getByRole("listitem");
  await slots.nth(0).getByRole("button", { name: "New game" }).click();
  await page.getByLabel("Seed").fill("7");
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForFunction(() => "farHollow" in window);

  await page.reload();
  await expect(slots.nth(0)).toContainText("Seed 7");
  await slots.nth(0).getByRole("button", { name: "New game" }).click();
  await expect(page.getByText("This replaces the saved game in slot 1.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(slots.nth(0)).toContainText("Seed 7");

  await slots.nth(0).getByRole("button", { name: "New game" }).click();
  await page.getByRole("button", { name: "Replace saved game" }).click();
  await page.waitForFunction(() => "farHollow" in window);
  expect((await gameView(page)).seed).not.toBe(7);
});
