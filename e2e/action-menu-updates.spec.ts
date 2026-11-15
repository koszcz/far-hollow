import { expect, test, type Page } from "@playwright/test";

interface Client {
  getView(): { backpack: Record<string, number | undefined> };
  send(command: unknown): void;
}

/** How many pots the backpack holds. The dev build puts the game client on `window.farHollow`. */
async function pots(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { farHollow: { client: Client } }).farHollow.client.getView().backpack.pot ?? 0);
}

/** Moves the mouse over the scene in a grid and yields every point where the cursor turns to a hand, meaning a thing is under it. */
async function* clickablePoints(page: Page): AsyncGenerator<{ x: number; y: number }> {
  const box = await page.locator("#scene").boundingBox();
  if (box === null) throw new Error("The canvas has no size");
  for (let fy = 0.2; fy <= 0.7; fy += 0.04) {
    for (let fx = 0.15; fx <= 0.85; fx += 0.04) {
      const x = box.x + box.width * fx;
      const y = box.y + box.height * fy;
      await page.mouse.move(x, y);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      if ((await page.locator("#scene").evaluate((canvas) => canvas.style.cursor)) === "pointer") yield { x, y };
    }
  }
}

test("an open action menu follows the game, such as dropping a row the player can no longer do", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?seed=42");
  await page.waitForFunction(() => "farHollow" in window);
  await expect(page.locator("#loading")).toHaveCount(0);
  const menu = page.getByRole("navigation", { name: "Actions" });
  const fillPot = menu.getByRole("button", { name: "Fill the pot" });

  // Open the river's menu. With a pot in the backpack, it offers to fill it.
  for await (const point of clickablePoints(page)) {
    await page.mouse.click(point.x, point.y);
    if ((await fillPot.count()) > 0) break;
    await page.keyboard.press("Escape");
  }
  await expect(fillPot).toBeVisible();

  // Put the pot down while the menu stays open. The menu drops the row without being opened again.
  await page.evaluate(() => {
    (window as unknown as { farHollow: { client: Client } }).farHollow.client.send({ type: "dropFromBackpack", content: "pot" });
  });
  await expect.poll(() => pots(page), { timeout: 10_000 }).toBe(0);
  await expect(menu).toBeVisible();
  await expect(fillPot).toHaveCount(0);
  await expect(menu.getByRole("button", { name: "Drink" })).toBeVisible();
  expect(errors).toEqual([]);
});
