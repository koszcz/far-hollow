import { expect, test, type Page } from "@playwright/test";

interface View {
  backpack: Record<string, number | undefined>;
  playerPosition: { x: number; z: number };
  actionQueue: { type: string }[];
}

interface Client {
  getView(): View;
  send(command: unknown): void;
}

/** Reads the parts of the game's view this test needs. The dev build puts the game client on `window.farHollow`. */
async function view(page: Page): Promise<View> {
  return page.evaluate(() => {
    const { backpack, playerPosition, actionQueue } = (window as unknown as { farHollow: { client: Client } }).farHollow.client.getView();
    return { backpack: { ...backpack }, playerPosition: { ...playerPosition }, actionQueue: actionQueue.map(({ type }) => ({ type })) };
  });
}

test("Shift with a number key lines up that backpack content's main action behind the walk under way", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?seed=42");
  await page.waitForFunction(() => "farHollow" in window);
  await expect(page.locator("#loading")).toHaveCount(0);

  const start = (await view(page)).playerPosition;
  const target = { x: start.x - 6, z: start.z };
  await page.evaluate((spot) => {
    (window as unknown as { farHollow: { client: Client } }).farHollow.client.send({ type: "walkTo", ...spot });
  }, target);
  await expect.poll(async () => (await view(page)).actionQueue).toEqual([{ type: "walkTo" }]);

  // In a new game on seed 42, the bedroll is in hotbar cell 5. Its main action lays it on the ground.
  await page.keyboard.press("Shift+Digit5");
  await expect.poll(async () => (await view(page)).actionQueue).toEqual([{ type: "walkTo" }, { type: "layBedroll" }]);

  // The bedroll is laid only once the walk is over, at the spot walked to.
  await expect.poll(async () => (await view(page)).backpack.bedroll ?? 0, { timeout: 15_000 }).toBe(0);
  const { playerPosition } = await view(page);
  expect(Math.hypot(playerPosition.x - target.x, playerPosition.z - target.z)).toBeLessThan(1);
  await expect.poll(async () => (await view(page)).actionQueue).toEqual([]);
  expect(errors).toEqual([]);
});
