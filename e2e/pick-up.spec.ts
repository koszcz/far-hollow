import { expect, test, type Page } from "@playwright/test";

interface View {
  backpack: Record<string, number | undefined>;
  reach: { height: string; seconds: number } | null;
}

interface Client {
  getView(): View;
  nearestInReach(): { kind: string; id: number } | null;
  send(command: unknown): void;
}

/** Reads the parts of the game's view this test needs. The dev build puts the game client on `window.farHollow`. */
async function view(page: Page): Promise<View> {
  return page.evaluate(() => {
    const { backpack, reach } = (window as unknown as { farHollow: { client: Client } }).farHollow.client.getView();
    return { backpack: { ...backpack }, reach: reach === null ? null : { ...reach } };
  });
}

test("the player bends down to put a knife on the ground and to pick it up again", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?seed=42");
  await page.waitForFunction(() => "farHollow" in window);
  await expect(page.locator("#loading")).toHaveCount(0);

  // Put the knife down at the player's feet. It leaves the backpack only when the hand gets to the ground.
  await page.evaluate(() => {
    (window as unknown as { farHollow: { client: Client } }).farHollow.client.send({ type: "dropFromBackpack", content: "knife" });
  });
  await expect.poll(async () => (await view(page)).reach?.height).toBe("low");
  await expect.poll(async () => (await view(page)).backpack.knife ?? 0).toBe(0);
  await expect.poll(async () => (await view(page)).reach, { timeout: 5_000 }).toBeNull();

  // Pick the knife up from the pile it lies in.
  await page.evaluate(() => {
    const client = (window as unknown as { farHollow: { client: Client } }).farHollow.client;
    const pile = client.nearestInReach();
    if (pile?.kind !== "pile") throw new Error(`The nearest thing is ${pile?.kind ?? "nothing"}, not the pile`);
    client.send({ type: "pickUpPile", pileId: pile.id });
  });
  await expect.poll(async () => (await view(page)).reach?.height).toBe("low");
  await expect.poll(async () => (await view(page)).backpack.knife ?? 0).toBe(1);
  await expect.poll(async () => (await view(page)).reach, { timeout: 5_000 }).toBeNull();
  expect(errors).toEqual([]);
});
