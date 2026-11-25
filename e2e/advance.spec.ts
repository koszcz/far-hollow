import { expect, test, type Page } from "@playwright/test";

interface GameHooks {
  client: { getView(): { playerPosition: { x: number; z: number }; time: { hour: number; minute: number } } };
  advance(seconds: number): number;
}

/** Opens a fixed new game and waits until the loading screen has gone. */
async function openGame(page: Page): Promise<void> {
  await page.goto("/?seed=42");
  await page.waitForFunction(() => "farHollow" in window);
  await expect(page.locator("#loading")).toHaveCount(0);
}

test("advance runs play time at once: a clicked walk finishes and the HUD clock moves on", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openGame(page);

  const start = await page.evaluate(() => ({ ...(window as unknown as { farHollow: GameHooks }).farHollow.client.getView().playerPosition }));
  const box = await page.locator("#scene").boundingBox();
  if (box === null) throw new Error("The canvas has no size");
  // On seed 42 the ground below the player has stone on it, so the click opens the action menu.
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.75);
  await page.getByRole("button", { name: "Walk here" }).click();

  // One game hour of play: the walk ends well within it.
  const result = await page.evaluate(() => {
    const hooks = (window as unknown as { farHollow: GameHooks }).farHollow;
    const ran = hooks.advance(60);
    const view = hooks.client.getView();
    return { ran, position: { ...view.playerPosition }, time: { ...view.time } };
  });

  expect(result.ran).toBe(60);
  expect(Math.hypot(result.position.x - start.x, result.position.z - start.z)).toBeGreaterThan(2);
  expect(result.time).toMatchObject({ hour: 9 });
  await expect(page.locator(".hud-clock")).toContainText("Spring · day 1 of 7 · 09:");
  expect(errors).toEqual([]);
});
