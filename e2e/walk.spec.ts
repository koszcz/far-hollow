import { expect, test, type Page } from "@playwright/test";

interface PlayerPosition {
  x: number;
  y: number;
  z: number;
}

/** Reads where the player stands from the game's view. The dev build puts the game client on `window.farHollow`. */
async function playerPosition(page: Page): Promise<PlayerPosition> {
  return page.evaluate(() => {
    const game = (window as unknown as { farHollow: { client: { getView(): { playerPosition: PlayerPosition } } } }).farHollow;
    return { ...game.client.getView().playerPosition };
  });
}

test("the game loads and the player walks where the ground is clicked", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?seed=42");
  const canvas = page.locator("#scene");
  await expect(canvas).toBeVisible();
  await page.waitForFunction(() => "farHollow" in window);
  // The loading screen covers the canvas until the first frame draws, then fades out.
  await expect(page.locator("#loading")).toHaveCount(0);

  const start = await playerPosition(page);
  // The camera follows the player, so the player is in the middle of the screen. Click the ground below them on screen, which is towards the camera and into the valley.
  const box = await canvas.boundingBox();
  if (box === null) throw new Error("The canvas has no size");
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.75);

  await expect
    .poll(
      async () => {
        const now = await playerPosition(page);
        return Math.hypot(now.x - start.x, now.z - start.z);
      },
      { timeout: 10_000 },
    )
    .toBeGreaterThan(2);
  expect(errors).toEqual([]);
});
