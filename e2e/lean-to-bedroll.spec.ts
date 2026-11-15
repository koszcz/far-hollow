import { expect, test, type Page } from "@playwright/test";

/** The parts of the game client this test uses. The dev build puts the client on `window.farHollow`. */
interface Client {
  getView(): {
    playerPosition: { x: number; z: number };
    action: unknown;
    backpack: Record<string, number | undefined>;
    nearby: { kind: string; view: { id: number } }[];
  };
  checkPlacement(structure: string, at: { x: number; z: number }, turns: number): { allowed: boolean };
  nearestInReach(): { kind: string; id: number } | null;
  send(command: Record<string, unknown>): void;
}

/** Runs `use` in the page against the game client, and returns what it returns. `use` must not refer to anything outside itself. */
async function withClient<T>(page: Page, use: (client: Client) => T): Promise<T> {
  return page.evaluate(`(${use.toString()})(window.farHollow.client)`) as Promise<T>;
}

test("the player builds a lean-to in the playground and lays the bedroll in it", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?playground&seed=42");
  await page.waitForFunction(() => "farHollow" in window);
  await expect(page.locator("#loading")).toHaveCount(0);

  // Place the lean-to on the first open spot a few metres from the player, and build it. The playground spends nothing.
  const placed = await withClient(page, (client) => {
    const { x, z } = client.getView().playerPosition;
    for (let distance = 4; distance < 20; distance += 1) {
      const sides: [number, number][] = [
        [0, -1],
        [1, 0],
        [-1, 0],
        [0, 1],
      ];
      for (const [dx, dz] of sides) {
        const at = { x: Math.round(x + dx * distance), z: Math.round(z + dz * distance) };
        if (client.checkPlacement("leanTo", at, 0).allowed) {
          client.send({ type: "placeBlueprint", structure: "leanTo", turns: 0, x: at.x, z: at.z, thenBuild: true });
          return true;
        }
      }
    }
    return false;
  });
  expect(placed).toBe(true);
  await expect.poll(() => withClient(page, (client) => client.getView().action !== null), { timeout: 10_000 }).toBe(true);
  // A finished lean-to keeps its blueprint's entity id.
  const leanToId = await withClient(page, (client) => client.getView().nearby.find((thing) => thing.kind === "blueprint")?.view.id);
  expect(leanToId).toBeDefined();
  await expect.poll(() => withClient(page, (client) => client.getView().action === null), { timeout: 40_000 }).toBe(true);

  await page.evaluate((id) => {
    (window as unknown as { farHollow: { client: Client } }).farHollow.client.send({ type: "layBedrollInLeanTo", leanToId: id });
  }, leanToId);

  await expect.poll(() => withClient(page, (client) => client.getView().backpack.bedroll ?? 0), { timeout: 10_000 }).toBe(0);
  await expect.poll(() => withClient(page, (client) => client.nearestInReach()?.kind), { timeout: 5_000 }).toBe("bedroll");
  expect(errors).toEqual([]);
});
