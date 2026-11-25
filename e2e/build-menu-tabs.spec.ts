import { expect, test, type Page } from "@playwright/test";

/** Opens a fixed new game and waits until the loading screen has gone. */
async function openGame(page: Page): Promise<void> {
  await page.goto("/?seed=42");
  await page.waitForFunction(() => "farHollow" in window);
  await expect(page.locator("#loading")).toHaveCount(0);
}

test.use({ viewport: { width: 1280, height: 720 } });

test("the build menu shows one tab at a time, none of them scrolls, and it reopens on the tab used last", async ({ page }) => {
  await openGame(page);
  const menu = page.getByRole("region", { name: "Build" });
  const rows = menu.locator(".hud-menu-entry");

  await page.keyboard.press("b");
  await expect(page.getByRole("tab", { name: "Camp" })).toHaveAttribute("aria-selected", "true");
  await expect(rows).toHaveCount(5);

  for (const [tab, count] of [
    ["Camp", 5],
    ["Shelter", 7],
    ["Furniture", 6],
  ] as const) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(rows).toHaveCount(count);
    const scrolls = await menu.evaluate((element) => element.scrollHeight > element.clientHeight);
    expect(scrolls, `${tab} scrolls`).toBe(false);
  }
  await expect(menu.getByText("Hang a door in it once it is built.")).toHaveCount(0);
  await page.getByRole("tab", { name: "Shelter" }).click();
  await expect(menu.getByText("Hang a door in it once it is built.")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await page.keyboard.press("b");
  await expect(page.getByRole("tab", { name: "Shelter" })).toHaveAttribute("aria-selected", "true");
});
