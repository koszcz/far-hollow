import { expect, test, type Page } from "@playwright/test";

/** Opens a fixed new game and waits until the loading screen has gone. */
async function openGame(page: Page): Promise<void> {
  await page.goto("/?seed=42");
  await page.waitForFunction(() => "farHollow" in window);
  await expect(page.locator("#loading")).toHaveCount(0);
}

test.use({ viewport: { width: 1280, height: 720 } });

test("the cutaway button turns the cabin cutaway on and off", async ({ page }) => {
  await openGame(page);
  const off = page.getByRole("button", { name: "See inside cabins" });
  await expect(off).toHaveAttribute("aria-pressed", "false");

  await off.click();
  const on = page.getByRole("button", { name: "Show cabin roofs" });
  await expect(on).toHaveAttribute("aria-pressed", "true");

  await on.click();
  await expect(page.getByRole("button", { name: "See inside cabins" })).toHaveAttribute("aria-pressed", "false");
});
