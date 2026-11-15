import { expect, test, type Page } from "@playwright/test";

/** Opens a fixed new game and waits until the loading screen has gone. */
async function openGame(page: Page): Promise<void> {
  await page.goto("/?seed=42");
  await page.waitForFunction(() => "farHollow" in window);
  await expect(page.locator("#loading")).toHaveCount(0);
}

test("the need gauges sit left of the hotbar, bottom aligned with it", async ({ page }) => {
  await openGame(page);
  const needs = await page.locator(".hud-needs").boundingBox();
  const hotbar = await page.locator(".hud-hotbar").boundingBox();
  if (needs === null || hotbar === null) throw new Error("The need group or the hotbar is not on screen");

  expect(needs.x + needs.width).toBeLessThanOrEqual(hotbar.x);
  expect(Math.abs(needs.y + needs.height - (hotbar.y + hotbar.height))).toBeLessThan(1);
});

test("on a narrow screen the need gauges move above the hotbar", async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 800 });
  await openGame(page);
  const needs = await page.locator(".hud-needs").boundingBox();
  const hotbar = await page.locator(".hud-hotbar").boundingBox();
  if (needs === null || hotbar === null) throw new Error("The need group or the hotbar is not on screen");

  expect(needs.y + needs.height).toBeLessThanOrEqual(hotbar.y);
});

test("screen readers read each need's name and level", async ({ page }) => {
  await openGame(page);
  const needs = page.getByRole("region", { name: "Needs" });
  for (const name of ["Warmth", "Hunger", "Thirst", "Rest"]) {
    await expect(needs.getByRole("progressbar", { name })).toHaveAttribute("value", /^[01](\.\d+)?$/);
  }
});
