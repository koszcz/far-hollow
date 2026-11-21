import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

/** Reads the game's seed and step count from the game's view. The dev build puts the game client on `window.farHollow`. */
async function gameView(page: Page): Promise<{ seed: number; stepCount: number }> {
  return page.evaluate(() => {
    const game = (window as unknown as { farHollow: { client: { getView(): { seed: number; stepCount: number } } } }).farHollow;
    const view = game.client.getView();
    return { seed: view.seed, stepCount: view.stepCount };
  });
}

/** Hides the page so the game autosaves, the way it does when the player switches tabs. */
async function hidePage(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("visibilitychange"));
  });
}

test("the player starts a game with a typed seed in a slot, then continues it after a reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  const slots = page.getByRole("listitem");
  await expect(slots).toHaveCount(3);
  await expect(slots.nth(1)).toContainText("Empty");

  await slots.nth(1).getByRole("button", { name: "New game" }).click();
  await page.getByLabel("Seed").fill("42");
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForFunction(() => "farHollow" in window);
  expect((await gameView(page)).seed).toBe(42);
  await expect.poll(async () => (await gameView(page)).stepCount).toBeGreaterThan(0);
  await hidePage(page);

  await page.reload();
  await expect(slots.nth(1)).toContainText("Seed 42");
  await expect(slots.nth(1)).toContainText("Day 1");
  await expect(slots.nth(0)).toContainText("Empty");

  await slots.nth(1).getByRole("button", { name: "Continue" }).click();
  await page.waitForFunction(() => "farHollow" in window);
  const continued = await gameView(page);
  expect(continued.seed).toBe(42);
  expect(continued.stepCount).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("starting over a filled slot asks the player to confirm first", async ({ page }) => {
  await page.goto("/");
  const slots = page.getByRole("listitem");
  await slots.nth(0).getByRole("button", { name: "New game" }).click();
  await page.getByLabel("Seed").fill("7");
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForFunction(() => "farHollow" in window);

  await page.reload();
  await expect(slots.nth(0)).toContainText("Seed 7");
  await slots.nth(0).getByRole("button", { name: "New game" }).click();
  await expect(page.getByText("This replaces the saved game in slot 1.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(slots.nth(0)).toContainText("Seed 7");

  await slots.nth(0).getByRole("button", { name: "New game" }).click();
  await page.getByRole("button", { name: "Replace saved game" }).click();
  await page.waitForFunction(() => "farHollow" in window);
  expect((await gameView(page)).seed).not.toBe(7);
});

/**
 * Changes the game's save database directly: stores `data` under `key`, or deletes `key` if `data` is undefined.
 * Returns what `key` held before. Tests use it to leave data the way an older game or a damaged browser left it.
 */
async function replaceStored(page: Page, key: string, data: unknown): Promise<unknown> {
  return page.evaluate(
    async ({ key, data }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("far-hollow", 1);
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          reject(request.error ?? new Error("Could not open the save database"));
        };
      });
      const transaction = database.transaction("saves", "readwrite");
      const store = transaction.objectStore("saves");
      const before = await new Promise<unknown>((resolve) => {
        const request = store.get(key);
        request.onsuccess = () => {
          resolve(request.result);
        };
      });
      if (data === undefined) store.delete(key);
      else store.put(data, key);
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => {
          resolve();
        };
        transaction.onerror = () => {
          reject(transaction.error ?? new Error("Could not change the save database"));
        };
      });
      database.close();
      return before;
    },
    { key, data },
  );
}

/** Reads what the game's save database holds under `key`, leaving it as it is. */
async function readStored(page: Page, key: string): Promise<unknown> {
  const stored = await replaceStored(page, key, undefined);
  if (stored !== undefined) await replaceStored(page, key, stored);
  return stored;
}

/** Clicks a slot's Export button and returns the downloaded file's name and its parsed contents. */
async function exportSlot(page: Page, slot: number): Promise<{ name: string; data: unknown }> {
  const downloading = page.waitForEvent("download");
  await page.getByRole("listitem").nth(slot).getByRole("button", { name: "Export" }).click();
  const download = await downloading;
  const text = await readFile(await download.path(), "utf8");
  return { name: download.suggestedFilename(), data: JSON.parse(text) };
}

/** Starts a new game with a typed seed in a slot, then saves it the way switching tabs does. */
async function startAndSave(page: Page, slot: number, seed: string): Promise<void> {
  await page.getByRole("listitem").nth(slot).getByRole("button", { name: "New game" }).click();
  await page.getByLabel("Seed").fill(seed);
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForFunction(() => "farHollow" in window);
  await hidePage(page);
}

test("the player exports a filled slot and a broken slot to files, and an empty slot has no Export button", async ({ page }) => {
  await page.goto("/");
  await startAndSave(page, 0, "42");
  await replaceStored(page, "slot-2", { version: 3, seed: "broken" });

  await page.reload();
  const slots = page.getByRole("listitem");
  await expect(slots.nth(0)).toContainText("Seed 42");
  await expect(slots.nth(2).getByRole("button", { name: "Export" })).toHaveCount(0);

  const filled = await exportSlot(page, 0);
  expect(filled.name).toBe("far-hollow-slot-1-day-1.json");
  expect(filled.data).toEqual(await readStored(page, "slot-1"));

  const broken = await exportSlot(page, 1);
  expect(broken.name).toBe("far-hollow-slot-2-broken.json");
  expect(broken.data).toEqual({ version: 3, seed: "broken" });

  await page.reload();
  await expect(slots.nth(0)).toContainText("Seed 42");
  await expect(slots.nth(1)).toContainText("This saved game cannot be loaded.");
});

test("slot 1 exports the old single save if slot 1 has not been saved since save slots came in", async ({ page }) => {
  await page.goto("/");
  await startAndSave(page, 0, "9");
  // Move slot 1's save to where the game kept its one save before there were save slots.
  const saved = await replaceStored(page, "slot-1", undefined);
  await replaceStored(page, "current", saved);

  await page.reload();
  await expect(page.getByRole("listitem").nth(0)).toContainText("Seed 9");
  const exported = await exportSlot(page, 0);
  expect(exported.name).toBe("far-hollow-slot-1-day-1.json");
  expect(exported.data).toEqual(saved);
});
