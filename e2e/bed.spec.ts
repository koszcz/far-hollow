import { expect, test, type Page } from "@playwright/test";

/** The parts of the game client these tests use. The dev build puts the client on `window.farHollow`. */
interface Client {
  getView(): { playerPosition: { x: number; z: number }; stepCount: number; action: unknown; lastSleep: { count: number } | null };
  checkPlacement(structure: string, at: { x: number; z: number }, turns: number): { allowed: boolean };
  nearestInReach(): { kind: string; id: number; furniture?: string } | null;
  send(command: Record<string, unknown>): void;
}

/** Runs `use` in the page against the game client, and returns what it returns. `use` must not refer to anything outside itself. */
async function withClient<T>(page: Page, use: (client: Client) => T): Promise<T> {
  return page.evaluate(`(${use.toString()})(window.farHollow.client)`) as Promise<T>;
}

test("the player builds a bed in the playground, sleeps in it, and gets up again", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?playground&seed=42");
  await page.waitForFunction(() => "farHollow" in window);
  await expect(page.locator("#loading")).toHaveCount(0);

  // Place the bed on the first open spot a few metres from the player, turned a quarter, and build it. The playground spends no planks.
  const placed = await withClient(page, (client) => {
    const { x, z } = client.getView().playerPosition;
    for (let distance = 2; distance < 20; distance += 0.5) {
      const sides: [number, number][] = [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ];
      for (const [dx, dz] of sides) {
        const at = { x: x + dx * distance, z: z + dz * distance };
        if (client.checkPlacement("bed", at, 1).allowed) {
          client.send({ type: "placeBlueprint", structure: "bed", turns: 1, x: at.x, z: at.z, thenBuild: true });
          return true;
        }
      }
    }
    return false;
  });
  expect(placed).toBe(true);
  await expect.poll(() => withClient(page, (client) => client.getView().action !== null), { timeout: 10_000 }).toBe(true);
  await expect.poll(() => withClient(page, (client) => client.getView().action === null), { timeout: 30_000 }).toBe(true);

  const bed = await withClient(page, (client) => client.nearestInReach());
  expect(bed?.kind).toBe("furniture");
  expect(bed?.furniture).toBe("bed");
  await withClient(page, (client) => {
    const found = client.nearestInReach();
    if (found !== null) client.send({ type: "sleepInBed", bedId: found.id });
  });

  // The game waits while the sleep plays, then runs on again.
  await expect.poll(() => withClient(page, (client) => client.getView().lastSleep?.count ?? 0), { timeout: 10_000 }).toBe(1);
  const asleepAt = await withClient(page, (client) => client.getView().stepCount);
  await expect.poll(() => withClient(page, (client) => client.getView().stepCount), { timeout: 20_000 }).toBeGreaterThan(asleepAt + 10);
  expect(errors).toEqual([]);
});

test("the bed showcase draws the bed", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?asset=bed");
  await expect(page.locator("body[data-showcase=ready]")).toHaveCount(1, { timeout: 30_000 });
  expect(errors).toEqual([]);
});
