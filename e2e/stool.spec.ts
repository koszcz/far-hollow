import { expect, test, type Page } from "@playwright/test";

/** The parts of the game client these tests use. The dev build puts the client on `window.farHollow`. */
interface Client {
  getView(): { playerPosition: { x: number; z: number }; action: unknown; sittingOn: number | null };
  checkPlacement(structure: string, at: { x: number; z: number }, turns: number): { allowed: boolean };
  nearestInReach(): { kind: string; id: number } | null;
  send(command: Record<string, unknown>): void;
}

/** Runs `use` in the page against the game client, and returns what it returns. `use` must not refer to anything outside itself. */
async function withClient<T>(page: Page, use: (client: Client) => T): Promise<T> {
  return page.evaluate(`(${use.toString()})(window.farHollow.client)`) as Promise<T>;
}

test("the player builds a stool in the playground, sits on it, and stands up to walk away", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?playground&seed=42");
  await page.waitForFunction(() => "farHollow" in window);
  await expect(page.locator("#loading")).toHaveCount(0);

  // Place the stool on the first open spot a few metres from the player and build it. The playground spends no planks.
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
        if (client.checkPlacement("stool", at, 2).allowed) {
          client.send({ type: "placeBlueprint", structure: "stool", turns: 2, x: at.x, z: at.z, thenBuild: true });
          return true;
        }
      }
    }
    return false;
  });
  expect(placed).toBe(true);
  await expect.poll(() => withClient(page, (client) => client.getView().action !== null), { timeout: 10_000 }).toBe(true);
  await expect.poll(() => withClient(page, (client) => client.getView().action === null), { timeout: 30_000 }).toBe(true);

  const stool = await withClient(page, (client) => client.nearestInReach());
  expect(stool?.kind).toBe("stool");
  await withClient(page, (client) => {
    const found = client.nearestInReach();
    if (found !== null) client.send({ type: "sitOnStool", stoolId: found.id });
  });
  await expect.poll(() => withClient(page, (client) => client.getView().sittingOn), { timeout: 10_000 }).toBe(stool?.id);

  // Walking away stands the player up.
  await withClient(page, (client) => {
    const { x, z } = client.getView().playerPosition;
    client.send({ type: "walkTo", x: x + 3, z });
  });
  await expect.poll(() => withClient(page, (client) => client.getView().sittingOn), { timeout: 10_000 }).toBeNull();
  expect(errors).toEqual([]);
});

test("the stool and sit-animation showcases draw", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const id of ["stool", "sit-animation"]) {
    await page.goto(`/?asset=${id}`);
    await expect(page.locator("body[data-showcase=ready]")).toHaveCount(1, { timeout: 30_000 });
  }
  await page.goto("/?asset=sit-animation&play");
  await expect(page.locator("body[data-showcase=ready]")).toHaveCount(1, { timeout: 30_000 });
  await page.waitForTimeout(3000);
  expect(errors).toEqual([]);
});
