import { expect, test, type Page } from "@playwright/test";

/** Opens a fixed new game and waits until the loading screen has gone. */
async function openGame(page: Page): Promise<void> {
  await page.goto("/?seed=42");
  await page.waitForFunction(() => "farHollow" in window);
  await expect(page.locator("#loading")).toHaveCount(0);
}

test("a hotbar cell shows its name above it only while the player points at it", async ({ page }) => {
  await openGame(page);
  const cell = page.locator(".hud-hotbar-cell").first();
  const name = cell.locator(".hud-hotbar-name");
  await expect(name).toBeHidden();

  await cell.hover();
  await expect(name).toBeVisible();
  const label = await name.boundingBox();
  const box = await cell.boundingBox();
  if (label === null || box === null) throw new Error("The cell or its name label is not on screen");
  expect(label.y + label.height).toBeLessThanOrEqual(box.y);

  await page.mouse.move(5, 5);
  await expect(name).toBeHidden();
});

test("a hotbar cell shows its name while it has keyboard focus", async ({ page }) => {
  await openGame(page);
  const cells = page.locator(".hud-hotbar-cell");
  const first = cells.first();
  await first.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(first).toBeFocused();
  await expect(first.locator(".hud-hotbar-name")).toBeVisible();
  await expect(cells.nth(1).locator(".hud-hotbar-name")).toBeHidden();
});

test("the hotbar cells and the build and craft buttons are 58 px squares in one row", async ({ page }) => {
  await openGame(page);
  const cell = await page.locator(".hud-hotbar-cell").first().boundingBox();
  const build = await page.getByRole("button", { name: "Build", exact: true }).boundingBox();
  const craft = await page.getByRole("button", { name: "Craft", exact: true }).boundingBox();
  if (cell === null || build === null || craft === null) throw new Error("A hotbar cell or a tool button is not on screen");

  for (const box of [cell, build, craft]) {
    expect(Math.round(box.width)).toBe(58);
    expect(Math.round(box.height)).toBe(58);
  }
  expect(Math.abs(build.y - craft.y)).toBeLessThan(1);
  expect(build.x + build.width).toBeLessThanOrEqual(craft.x);
});
