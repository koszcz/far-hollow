import { describe, expect, it } from "bun:test";
import { createGame } from "../sim/game";
import { readSave, writeSave } from "../sim/save";
import { SAVE_VERSION } from "../sim/save-upgrades";
import { SMALL_VALLEY_SAVE_VERSION, SNUG_ROOM_NOTICE_SAVE_VERSION } from "../sim/save-versions";
import { saveExportFile } from "./save-export";
import { importIntoSlot, importSaveFile } from "./save-import";
import type { SaveStorage } from "./save-storage";

/** A saved game as a file's text, the way export writes it. */
function fileText(save: unknown): string {
  return JSON.stringify(save, null, 2);
}

describe("importing a saved game from a file", () => {
  it("refuses a file that is not JSON", () => {
    expect(importSaveFile("far hollow {")).toEqual({ ok: false, reason: "notASave" });
  });

  it("refuses JSON that is not a Far Hollow saved game", () => {
    expect(importSaveFile(fileText({ name: "a shopping list", items: ["eggs"] }))).toEqual({ ok: false, reason: "notASave" });
    expect(importSaveFile(fileText([1, 2, 3]))).toEqual({ ok: false, reason: "notASave" });
    expect(importSaveFile("null")).toEqual({ ok: false, reason: "notASave" });
  });

  it("refuses a damaged saved game", () => {
    const save = { ...writeSave(createGame({ seed: 5 })), clockMinutes: "noon" };
    expect(importSaveFile(fileText(save))).toEqual({ ok: false, reason: "notASave" });
  });

  it("refuses a saved game made in the 1 km valley", () => {
    const save = { ...writeSave(createGame({ seed: 5 })), version: SMALL_VALLEY_SAVE_VERSION - 1 };
    expect(importSaveFile(fileText(save))).toEqual({ ok: false, reason: "largeValley" });
  });

  it("refuses a saved game made by a newer version of the game", () => {
    const save = { ...writeSave(createGame({ seed: 5 })), version: SAVE_VERSION + 1 };
    expect(importSaveFile(fileText(save))).toEqual({ ok: false, reason: "newerVersion" });
  });

  it("upgrades an older saved game to the newest version", () => {
    const { snugRoomNoticeShown: _, ...older } = { ...writeSave(createGame({ seed: 5 })), version: SNUG_ROOM_NOTICE_SAVE_VERSION - 1 };

    const imported = importSaveFile(fileText(older));

    if (!imported.ok) throw new Error(`The file was refused: ${imported.reason}`);
    expect(imported.save.version).toBe(SAVE_VERSION);
    expect(imported.save.snugRoomNoticeShown).toBe(false);
    expect(imported.save.seed).toBe(5);
  });

  it("imports a file that export wrote, and the game continues as it was", () => {
    const game = createGame({ seed: 4321 });
    game.client.send({ type: "skipTime", hours: 20 });
    game.step();
    const stored = structuredClone(writeSave(game));
    const file = saveExportFile(0, stored);
    if (file === undefined) throw new Error("Nothing was exported");

    const imported = importSaveFile(file.text);

    if (!imported.ok) throw new Error(`The file was refused: ${imported.reason}`);
    expect(imported.save).toEqual(stored);
    const loaded = readSave(structuredClone(imported.save));
    if (!loaded.ok) throw new Error("The imported save did not load");
    expect(loaded.game.client.getView()).toEqual(game.client.getView());
  });
});

/** A save storage that keeps saves in memory. `failWrites` makes every write fail, the way a full browser storage does. */
function memoryStorage(failWrites = false): SaveStorage & { saves: Map<number, unknown> } {
  const saves = new Map<number, unknown>();
  return {
    saves,
    read: (slot) => Promise.resolve(saves.get(slot)),
    write: (slot, save) => {
      if (failWrites) return Promise.reject(new Error("The storage is full"));
      saves.set(slot, save);
      return Promise.resolve();
    },
  };
}

describe("storing an imported saved game in a save slot", () => {
  it("stores the imported saved game in the slot", async () => {
    const storage = memoryStorage();
    const save = writeSave(createGame({ seed: 5 }));

    const imported = await importIntoSlot(storage, 1, fileText(save));

    expect(imported).toEqual({ ok: true, save });
    expect(storage.saves.get(1)).toEqual(save);
  });

  it("leaves the slot as it was when it refuses the file", async () => {
    const storage = memoryStorage();
    storage.saves.set(1, "kept");

    expect(await importIntoSlot(storage, 1, "far hollow {")).toEqual({ ok: false, reason: "notASave" });
    expect(storage.saves.get(1)).toBe("kept");
  });

  it("says the saved game could not be stored when the browser cannot store it", async () => {
    const text = fileText(writeSave(createGame({ seed: 5 })));

    expect(await importIntoSlot(memoryStorage(true), 1, text)).toEqual({ ok: false, reason: "notStored" });
    expect(await importIntoSlot(undefined, 1, text)).toEqual({ ok: false, reason: "notStored" });
  });
});
