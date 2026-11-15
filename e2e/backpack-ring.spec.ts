import { expect, test, type Page } from "@playwright/test";

/** Opens a fixed new game and waits until the loading screen has gone. */
async function openGame(page: Page): Promise<void> {
  await page.goto("/?seed=42");
  await page.waitForFunction(() => "farHollow" in window);
  await expect(page.locator("#loading")).toHaveCount(0);
}

test("the backpack ring opens the hotbar and shows the exact weight on point", async ({ page }) => {
  await openGame(page);
  const ring = page.locator(".hud-hotbar .hud-weight-ring");
  const tip = ring.locator(".hud-weight-tip");
  const ringBox = await ring.boundingBox();
  const cellBox = await page.locator(".hud-hotbar-cell").first().boundingBox();
  if (ringBox === null || cellBox === null) throw new Error("The backpack ring or the first hotbar cell is not on screen");
  expect(ringBox.x + ringBox.width).toBeLessThan(cellBox.x);
  await expect(page.locator(".hud-hotbar-divider")).toBeVisible();

  await expect(tip).toBeHidden();
  await ring.hover();
  await expect(tip).toHaveText("5.5 of 20 kg");
  await page.mouse.move(5, 5);
  await expect(tip).toBeHidden();

  await ring.focus();
  await expect(tip).toBeVisible();
});

test("screen readers read the backpack weight as the ring's value", async ({ page }) => {
  await openGame(page);
  const meter = page.getByRole("meter", { name: "Backpack" });
  await expect(meter).toHaveAttribute("aria-valuetext", "5.5 of 20 kg");
});

test("the HUD no longer shows the weight as text", async ({ page }) => {
  await openGame(page);
  await expect(page.locator("#ui")).not.toContainText("/ 20 kg");
  await expect(page.locator(".hud-backpack-weight")).toHaveCount(0);
});

test("pointing at a hotbar cell shows its weight in its label", async ({ page }) => {
  await openGame(page);
  const cell = page.getByRole("button", { name: "Axe, key 1" });
  await cell.hover();
  await expect(cell.locator(".hud-hotbar-name")).toHaveText("Axe · 1.5 kg");
});

test("the open chest shows its weight with a ring in its heading, and a nearly full backpack warns", async ({ page }) => {
  await page.goto("/?asset=hud");
  const chestRing = page.locator(".hud-chest h2 .hud-weight-ring").first();
  await expect(chestRing).toHaveAttribute("aria-valuetext", "9.4 of 60 kg");
  await expect(chestRing).not.toHaveClass(/hud-weight-ring-warn/);
  await expect(page.locator(".hud-hotbar .hud-weight-ring-warn[aria-valuetext='19.6 of 20 kg']")).toHaveCount(1);
});
