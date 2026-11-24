import { expect, test } from "@playwright/test";

test("the asset browser opens with an asset chosen and loads another asset's showcase in its frame", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?assets=bed");
  await expect(page.locator("body[data-asset-browser=ready]")).toHaveCount(1);
  await expect(page.locator(".asset-browser-item.chosen")).toHaveAttribute("data-asset", "bed");
  await expect(page.locator(".asset-browser-frame")).toHaveAttribute("src", "/?asset=bed");

  // Pick the chest. Its showcase loads in the frame, and it cannot play, so live play is greyed out.
  await page.locator('.asset-browser-item[data-asset="chest"]').click();
  await expect(page).toHaveURL(/\?assets=chest$/);
  const frame = page.frameLocator(".asset-browser-frame");
  await expect(frame.locator("body[data-showcase=ready]")).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Live play" })).toBeDisabled();

  // The arrow keys move through the list, and "/" moves to the search box.
  await page.locator(".asset-browser-search").focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".asset-browser-item.chosen")).not.toHaveAttribute("data-asset", "chest");
  await page.locator(".asset-browser-entry").click();
  await page.keyboard.press("/");
  await expect(page.locator(".asset-browser-search")).toBeFocused();

  // Play an animation live at half speed. The address, the frame, and "Open alone" all record it.
  await page.locator(".asset-browser-search").fill("walk-animation");
  await page.locator('.asset-browser-item[data-asset="walk-animation"]').click();
  await page.getByRole("button", { name: "Live play" }).click();
  await page.getByRole("button", { name: "0.5×" }).click();
  await expect(page).toHaveURL(/\?assets=walk-animation&play&speed=0\.5$/);
  await expect(page.locator(".asset-browser-frame")).toHaveAttribute("src", "/?asset=walk-animation&play&speed=0.5");
  await expect(page.locator(".asset-browser-open")).toHaveAttribute("href", "/?asset=walk-animation&play&speed=0.5");

  // Reloading restores the asset, play, and speed.
  await page.reload();
  await expect(page.locator(".asset-browser-item.chosen")).toHaveAttribute("data-asset", "walk-animation");
  await expect(page.getByRole("button", { name: "0.5×" })).toHaveClass(/chosen/);
  await expect(page.locator(".asset-browser-frame")).toHaveAttribute("src", "/?asset=walk-animation&play&speed=0.5");
  expect(errors).toEqual([]);
});
