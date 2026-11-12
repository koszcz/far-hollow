import { expect, test, type Page } from "@playwright/test";

interface View {
  carrying: string | null;
  action: { kind: string } | null;
}

/** Reads the parts of the game's view this test needs. The dev build puts the game client on `window.farHollow`. */
async function view(page: Page): Promise<View> {
  return page.evaluate(() => {
    const game = (window as unknown as { farHollow: { client: { getView(): View } } }).farHollow;
    const { carrying, action } = game.client.getView();
    return { carrying, action };
  });
}

/** Moves the mouse over the scene in a grid and returns the first point where the cursor turns to a hand, meaning a thing is under it. */
async function findClickableThing(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator("#scene").boundingBox();
  if (box === null) throw new Error("The canvas has no size");
  for (let fy = 0.2; fy <= 0.7; fy += 0.04) {
    for (let fx = 0.15; fx <= 0.85; fx += 0.04) {
      const x = box.x + box.width * fx;
      const y = box.y + box.height * fy;
      await page.mouse.move(x, y);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      if ((await page.locator("#scene").evaluate((canvas) => canvas.style.cursor)) === "pointer") return { x, y };
    }
  }
  throw new Error("Found nothing to click in the scene");
}

test("a click on the ground while carrying a log opens a ring to walk there or drop the log there", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?seed=42");
  await page.waitForFunction(() => "farHollow" in window);
  await expect(page.locator("#loading")).toHaveCount(0);
  const menu = page.getByRole("navigation", { name: "Actions" });

  // Chop the first tree on screen. Felling it puts a log on the player's shoulder.
  const tree = await findClickableThing(page);
  await page.mouse.click(tree.x, tree.y);
  await menu.getByRole("button", { name: "Chop" }).click();
  await expect.poll(async () => (await view(page)).carrying, { timeout: 30_000 }).toBe("log");

  // Plain ground now opens a ring instead of walking at once. Felled logs may lie near the player, so try spots until one is plain ground.
  const box = await page.locator("#scene").boundingBox();
  if (box === null) throw new Error("The canvas has no size");
  const walkHere = menu.getByRole("button", { name: "Walk here" });
  for (const fx of [0.3, 0.7, 0.5, 0.2, 0.8]) {
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * 0.6);
    if (await walkHere.isVisible()) break;
    await page.keyboard.press("Escape");
  }
  await expect(walkHere).toBeVisible();
  await menu.getByRole("button", { name: "Drop the log here" }).click();

  await expect.poll(async () => (await view(page)).carrying, { timeout: 15_000 }).toBeNull();
  expect(errors).toEqual([]);
});
