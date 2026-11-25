import { expect, test, type Page } from "@playwright/test";

/** Opens a fixed new game and waits until the loading screen has gone. */
async function openGame(page: Page): Promise<void> {
  await page.goto("/?seed=42");
  await page.waitForFunction(() => "farHollow" in window);
  await expect(page.locator("#loading")).toHaveCount(0);
}

test.use({ viewport: { width: 1280, height: 720 } });

test("the wall mode button steps from cutaway to walls down to walls up, and back to cutaway", async ({ page }) => {
  await openGame(page);
  const button = page.locator(".hud-cutaway button");
  // The game starts in cutaway. Each label names the wall mode the next click switches to.
  for (const [index, [mode, label]] of (
    [
      ["cutaway", "Show walls down"],
      ["wallsDown", "Show walls up"],
      ["wallsUp", "Show cutaway"],
      ["cutaway", "Show walls down"],
    ] as const
  ).entries()) {
    if (index > 0) await button.click();
    await expect(button).toHaveAttribute("data-wall-mode", mode);
    await expect(button).toHaveAccessibleName(label);
    await expect(button).toHaveAttribute("data-tip", label);
  }
});
